//! 整理同步文件夹里本机的目录(格式 3,规则见 `store.rs` 开头)。每轮同步成功之后看一次,
//! 默认每天最多做一次:
//!
//! 1. 停用期满的包:删掉。删之前再核对一遍——停用期间别的设备可能又引用了里面的内容
//!    (在它看到停用通知之前);还要用的内容如果别处没有,本机有就重新打包留住,本机也没有
//!    就先不删。
//! 2. 没人用的包登记停用;大半没用的包,把还在用的内容重新打一个包,再停用旧的。「还在用」
//!    = 本机各实体当前的文件 + 等待区里的改动要的文件;别的设备的没停用的包里也有一份的
//!    不算(那份留着就够了)。
//! 3. 自己的改动记录段攒多了:每个实体只留最后一条,原样抄进新段,登记 `base`,删掉旧段。
//!
//! 任何一步出错都不影响这一轮同步本身(结果记在报告里,下一轮再试)。

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Utc};
use serde_json::Value;

use super::super::files::{checked_relative, file_hash};
use super::super::store::{DeviceState, PackIndex, Segment, SYNC_FORMAT_VERSION};
use super::{SyncEngine, SyncReport, PACK_BYTES, SEGMENT_RECORDS, STATE_SEGMENT};

const STATE_MAINTAINED_AT: &str = "maintained_at";
/// 停用的包删掉之后,停用登记再留多久(落后很久的设备回来时还能知道)。
const KEEP_RETIRED_NOTICE_DAYS: i64 = 180;

/// 整理的节奏。
#[derive(Debug, Clone)]
pub struct MaintenancePolicy {
    /// 两次整理之间至少隔多久。
    pub every: Duration,
    /// 自己的改动记录攒到这么多段才整理。
    pub compact_after_segments: u64,
    /// 停用的包过多久才删(给正在同步的设备时间看到停用通知)。
    pub retire_grace: Duration,
    /// 包里还在用的内容少于这个比例,就重新打包再停用。
    pub repack_below: f64,
    /// 各设备的整理状态隔多久重读一次。要比 `retire_grace` 短得多:别的设备最晚这么久之后
    /// 才知道某个包停用了。读得落后的设备也要等到重读才知道该跳到哪一段。
    pub refresh_states: Duration,
}

impl Default for MaintenancePolicy {
    fn default() -> Self {
        Self {
            every: Duration::hours(24),
            compact_after_segments: 64,
            retire_grace: Duration::days(7),
            repack_below: 0.5,
            refresh_states: Duration::minutes(10),
        }
    }
}

fn parse_time(text: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(text).ok().map(|t| t.with_timezone(&Utc))
}

impl SyncEngine {
    /// `state`:本机目录的整理状态(这一轮开始时读到或记下的)。
    pub(super) fn maintain(
        &self,
        device: &str,
        mut state: DeviceState,
        folder_id: &str,
        format_version: u64,
        report: &mut SyncReport,
    ) -> Result<()> {
        let now = Utc::now();
        if let Some(last) = self.db.sync_state_get(STATE_MAINTAINED_AT)?.as_deref().and_then(parse_time) {
            if now - last < self.policy.every {
                return Ok(());
            }
        }
        // 先记下时间:中途出错也等下一次(而不是每轮重试一遍)。
        self.db.sync_state_set(STATE_MAINTAINED_AT, &now.to_rfc3339())?;
        let mut upgraded = format_version >= SYNC_FORMAT_VERSION;
        // 格式 2 的程序看不懂整理后的目录:真要动手之前先把格式升上去(它们会提示先更新)。
        let mut upgrade = |engine: &Self| -> Result<()> {
            if !upgraded {
                engine.store.upgrade_format(folder_id)?;
                upgraded = true;
            }
            Ok(())
        };

        let mut changed = false;
        let deletions = self.due_deletions(device, &state, now)?;
        let (retire, rescue) = self.choose_retirements(device, &state)?;
        let last = self.own_last_segment()?;
        let base = state.base.max(1);
        let compact = last >= base && last - base + 1 >= self.policy.compact_after_segments;

        if !deletions.is_empty() || !retire.is_empty() || compact {
            upgrade(self)?;
        }
        // 1. 停用期满的包。
        let mut rescue_all = rescue;
        let mut deletable = Vec::new();
        for (segment, needed_here) in deletions {
            match needed_here {
                Some(blobs) => {
                    rescue_all.extend(blobs);
                    deletable.push(segment);
                }
                None => {} // 还要用、本机又没有:先不删
            }
        }
        // 2. 留住要用的内容,再登记停用。
        if !rescue_all.is_empty() {
            report.bytes_repacked += self.repack(device, &rescue_all)?;
        }
        for segment in &retire {
            state.retired.push((*segment, now.to_rfc3339()));
            report.packs_retired += 1;
            changed = true;
        }
        if changed {
            self.store.write_device_state(device, &state)?;
            self.remember_state(device, &state)?;
        }
        let packs = self.db.sync_device_packs(device)?;
        for segment in deletable {
            report.bytes_freed += packs.get(&segment).map_or(0, |index| index.iter().map(|b| b.2).sum());
            self.store.remove_pack(device, segment)?;
            self.db.sync_forget_pack(device, segment)?;
            report.packs_deleted += 1;
        }
        // 很久以前删掉的包,停用登记不再留。
        let before = state.retired.len();
        let known: BTreeSet<u64> = self.db.sync_device_packs(device)?.into_keys().collect();
        state.retired.retain(|(segment, since)| {
            known.contains(segment)
                || parse_time(since).map_or(true, |t| now - t < Duration::days(KEEP_RETIRED_NOTICE_DAYS))
        });
        if state.retired.len() != before {
            changed = true;
        }
        // 3. 改动记录(在重新打包之后:那几段也在新 base 之前,包的索引一起登记过去)。
        let mut obsolete = None;
        if compact {
            let new_base = self.compact(device, &mut state, base)?;
            report.segments_compacted = (new_base - base) as usize;
            obsolete = Some(base..new_base);
            changed = true;
        }
        if changed {
            self.store.write_device_state(device, &state)?;
            self.remember_state(device, &state)?;
        }
        if let Some(range) = obsolete {
            // base 已经登记:读的一方不会再要这些段了(包是另外的文件,不受影响)。
            for segment in range {
                self.store.remove_segment(device, segment)?;
            }
        }
        report.maintained = true;
        Ok(())
    }

    fn own_last_segment(&self) -> Result<u64> {
        Ok(self.db.sync_state_get(STATE_SEGMENT)?.and_then(|v| v.parse().ok()).unwrap_or(0))
    }

    /// 本机有没有这份内容:有的话给出文件路径。
    fn local_blob(&self, sha256: &str) -> Result<Option<PathBuf>> {
        for relative in self.db.sync_paths_with_sha(sha256)? {
            let Ok(relative) = checked_relative(&relative) else { continue };
            let path = self.data_root.join(relative);
            if file_hash(&self.db, &self.data_root, &path)?.is_some_and(|entry| entry.sha256 == sha256) {
                return Ok(Some(path));
            }
        }
        Ok(None)
    }

    /// 除了 `except` 里的包,这份内容在别处(没停用的包里)还有没有。
    fn elsewhere(&self, sha256: &str, except: &BTreeSet<(String, u64)>) -> Result<bool> {
        Ok(self
            .db
            .sync_blob_locations(sha256)?
            .iter()
            .any(|l| !l.retired && !except.contains(&(l.device.clone(), l.segment))))
    }

    /// 停用期满的包:Some(要先重新打包留住的内容) 可以删;None 还不能删。
    fn due_deletions(
        &self,
        device: &str,
        state: &DeviceState,
        now: DateTime<Utc>,
    ) -> Result<Vec<(u64, Option<Vec<(PathBuf, String)>>)>> {
        let packs = self.db.sync_device_packs(device)?;
        let needed = self.db.sync_needed_blobs()?;
        let retired: BTreeSet<(String, u64)> =
            state.retired.iter().map(|(s, _)| (device.to_string(), *s)).collect();
        let mut out = Vec::new();
        for (segment, since) in &state.retired {
            let Some(index) = packs.get(segment) else { continue }; // 已经删了
            let due = parse_time(since).map_or(true, |t| now - t >= self.policy.retire_grace);
            if !due {
                continue;
            }
            let mut rescue = Vec::new();
            let mut blocked = false;
            for (sha, _, _) in index {
                if !needed.contains(sha) || self.elsewhere(sha, &retired)? {
                    continue;
                }
                match self.local_blob(sha)? {
                    Some(path) => rescue.push((path, sha.clone())),
                    None => blocked = true,
                }
            }
            out.push((*segment, (!blocked).then_some(rescue)));
        }
        Ok(out)
    }

    /// 选出这一次要停用的包,以及停用前要重新打包留住的内容。
    fn choose_retirements(&self, device: &str, state: &DeviceState) -> Result<(Vec<u64>, Vec<(PathBuf, String)>)> {
        let packs = self.db.sync_device_packs(device)?;
        let needed = self.db.sync_needed_blobs()?;
        let mut gone: BTreeSet<(String, u64)> =
            state.retired.iter().map(|(s, _)| (device.to_string(), *s)).collect();
        let last = self.own_last_segment()?;
        let mut retire = Vec::new();
        let mut rescue = Vec::new();
        for (segment, index) in &packs {
            if gone.contains(&(device.to_string(), *segment)) || *segment > last {
                continue;
            }
            let total: u64 = index.iter().map(|b| b.2).sum();
            let mut live = Vec::new();
            let mut live_bytes = 0;
            for (sha, _, length) in index {
                let mut except = gone.clone();
                except.insert((device.to_string(), *segment));
                if needed.contains(sha) && !self.elsewhere(sha, &except)? {
                    live.push(sha.clone());
                    live_bytes += length;
                }
            }
            if live.is_empty() {
                retire.push(*segment);
            } else if total > 0 && (live_bytes as f64) < (total as f64) * self.policy.repack_below {
                let mut copies = Vec::new();
                for sha in &live {
                    match self.local_blob(sha)? {
                        Some(path) => copies.push((path, sha.clone())),
                        None => break,
                    }
                }
                if copies.len() != live.len() {
                    continue; // 本机缺其中的内容,留着这个包
                }
                rescue.extend(copies);
                retire.push(*segment);
            } else {
                continue;
            }
            gone.insert((device.to_string(), *segment));
        }
        Ok((retire, rescue))
    }

    /// 把这些内容重新打包(新的几段,没有改动记录),返回上传的字节数。
    fn repack(&self, device: &str, blobs: &[(PathBuf, String)]) -> Result<u64> {
        let mut seen = BTreeSet::new();
        let mut batch: Vec<(PathBuf, String)> = Vec::new();
        let mut batch_bytes = 0;
        let mut uploaded = 0;
        let flush = |batch: &mut Vec<(PathBuf, String)>, uploaded: &mut u64| -> Result<()> {
            if batch.is_empty() {
                return Ok(());
            }
            let last = self.own_last_segment()?;
            let (segment, index) = self.store.write_segment_lines(device, last, &[], batch, &[])?;
            self.db.sync_state_set(STATE_SEGMENT, &segment.to_string())?;
            self.db.sync_record_blobs(device, segment, &index)?;
            *uploaded += index.iter().map(|b| b.2).sum::<u64>();
            batch.clear();
            Ok(())
        };
        for (path, sha) in blobs {
            if !seen.insert(sha.clone()) {
                continue;
            }
            let size = std::fs::metadata(path).with_context(|| format!("missing {}", path.display()))?.len();
            if !batch.is_empty() && batch_bytes + size > PACK_BYTES {
                flush(&mut batch, &mut uploaded)?;
                batch_bytes = 0;
            }
            batch.push((path.clone(), sha.clone()));
            batch_bytes += size;
        }
        flush(&mut batch, &mut uploaded)?;
        Ok(uploaded)
    }

    /// 把 base 之后各段里每个实体在本机的最后一条记录抄进新段,登记还在用的包;更新
    /// `state.base` 并返回它(之前的段由调用方在登记 base 之后删)。
    fn compact(&self, device: &str, state: &mut DeviceState, base: u64) -> Result<u64> {
        let last = self.own_last_segment()?;
        let mut latest: BTreeMap<(String, String), u64> = self
            .db
            .sync_own_records()?
            .into_iter()
            .filter(|(_, _, segment)| *segment <= last)
            .map(|(kind, key, segment)| ((kind, key), segment))
            .collect();
        if latest.is_empty() {
            // 第三期之前没记过:读一遍自己的段补上。
            for segment in base..=last {
                if let Segment::Complete { records, .. } = self.store.read_segment(device, segment)? {
                    for record in records {
                        latest.insert((record.kind, record.key), segment);
                    }
                }
            }
        }
        let wanted: BTreeSet<u64> = latest.values().copied().collect();
        let mut lines = Vec::new();
        let mut kept = Vec::new();
        for segment in wanted {
            let Some(segment_lines) = self.store.read_segment_lines(device, segment)? else {
                anyhow::bail!("own segment {segment} is missing or incomplete; not compacting");
            };
            for line in segment_lines {
                let value: Value = serde_json::from_str(&line)?;
                let kind = value.get("kind").and_then(Value::as_str).unwrap_or("").to_string();
                let key = value.get("key").and_then(Value::as_str).unwrap_or("").to_string();
                if latest.get(&(kind.clone(), key.clone())) == Some(&segment) {
                    lines.push(line);
                    kept.push((kind, key));
                }
            }
        }
        // 被删的段里还在用(没停用)的包,索引跟着新段走。
        let retired: BTreeSet<u64> = state.retired.iter().map(|(s, _)| *s).collect();
        let carried: Vec<(u64, PackIndex)> = self
            .db
            .sync_device_packs(device)?
            .into_iter()
            .filter(|(segment, _)| *segment <= last && !retired.contains(segment))
            .filter(|(_, index)| !index.is_empty())
            .collect();
        let mut first = None;
        let mut chunks: Vec<&[String]> = lines.chunks(SEGMENT_RECORDS).collect();
        if chunks.is_empty() {
            chunks.push(&[]);
        }
        let mut offset = 0;
        for (i, chunk) in chunks.iter().enumerate() {
            let after = self.own_last_segment()?;
            let carry: &[(u64, PackIndex)] = if i == 0 { &carried } else { &[] };
            let (segment, _) = self.store.write_segment_lines(device, after, chunk, &[], carry)?;
            self.db.sync_state_set(STATE_SEGMENT, &segment.to_string())?;
            self.db.sync_note_own_records(&kept[offset..offset + chunk.len()], segment)?;
            offset += chunk.len();
            first.get_or_insert(segment);
        }
        state.base = first.expect("at least one segment written");
        Ok(state.base)
    }
}
