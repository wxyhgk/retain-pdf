//! 一轮同步:导出本机改动 → 读别的设备的改动 → 重试等待区。合并规则见 `sync` 模块说明。

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

use super::clock::{iso_ms, Hlc};
use super::files::{checked_relative, entity_files, file_hash, has_content, remove_file};
use super::folder::{hex, FolderBackend};
use super::store::{Backend, BlobLocation, DeviceState, Segment, SyncStore};
use super::{ChangeRecord, SyncFileEntry};
use crate::db::sync::{
    entity_spec, SyncApplyOutcome, SyncDirty, SyncEntityState, SyncEntityUpdate, SyncFileRef,
    SyncRows, SYNC_SEED_VERSIONS,
};
use crate::db::Db;

#[path = "maintain.rs"]
mod maintain;

pub use maintain::MaintenancePolicy;

pub(super) const DATA_ROOT_TOKEN: &str = "{{data_root}}";
const STATE_DEVICE: &str = "device_id";
const STATE_CLOCK: &str = "clock";
const STATE_SEGMENT: &str = "segment";
const STATE_SEEDED: &str = "seeded";
const STATE_FOLDER_ID: &str = "folder_id";
const STATE_FINGERPRINT: &str = "fingerprint";
/// 上次读各设备整理状态的时间;各设备的 base(`base:<设备号>`)。
const STATE_STATES_READ_AT: &str = "states_read_at";
const STATE_BASE_PREFIX: &str = "base:";
/// 已经写进同步文件夹的设备说明(设备号 + 名字),没变就不再写。
const STATE_DEVICE_WRITTEN: &str = "device_written";
/// 一段改动记录最多放多少条。
const SEGMENT_RECORDS: usize = 200;
/// 一个文件包大约多大就收尾(单个文件更大时自成一包)。
const PACK_BYTES: u64 = 32 << 20;
/// 文件清单的字段名(字段时钟里)。
const FILES_FIELD: &str = "$files";

type Clocks = BTreeMap<String, String>;

#[derive(Debug, Default, Clone, Serialize)]
pub struct SyncReport {
    pub device_id: String,
    /// 写进同步文件夹的改动记录条数。
    pub exported: usize,
    /// 新放进同步文件夹的文件内容个数。
    pub blobs_uploaded: usize,
    /// 应用了的别的设备的改动(含删除)。
    pub applied: usize,
    pub deleted: usize,
    /// 没有比本机新的内容、直接跳过的改动。
    pub stale: usize,
    /// 格式不对或路径越界、整条丢弃的改动。
    pub rejected: usize,
    /// 这一轮新放进等待区的。
    pub parked: usize,
    /// 等待区里还剩多少。
    pub pending: usize,
    pub files_written: usize,
    pub files_removed: usize,
    /// 这一轮发现换了同步文件夹,本机书库全部重新发。
    pub folder_changed: bool,
    /// 这一轮发现数据目录是从别处复制来的,换了新设备号。
    pub device_renewed: bool,
    /// 这一轮整理了同步文件夹里本机的目录(见 `maintain.rs`)。
    pub maintained: bool,
    /// 整理掉的改动记录段数。
    pub segments_compacted: usize,
    /// 新停用的包、停用期满删掉的包。
    pub packs_retired: usize,
    pub packs_deleted: usize,
    /// 删掉的包腾出的空间、为了留住还在用的内容重新上传的大小。
    pub bytes_freed: u64,
    pub bytes_repacked: u64,
    /// 整理没做完的原因(不影响这一轮同步本身)。
    pub maintenance_error: Option<String>,
}

/// 同步文件夹里的另一台设备。
#[derive(Debug, Clone, Serialize)]
pub struct SyncPeer {
    pub device_id: String,
    pub name: String,
    /// 已经读完它的多少段改动记录。
    pub segments_read: u64,
}

enum Considered {
    Applied { deleted: bool, written: usize, removed: usize },
    Stale,
    Rejected,
    Parked(String),
}

/// 一个实体合并后要落到本机的样子。
struct Target {
    rows: Option<SyncRows>,
    files: Vec<SyncFileEntry>,
    clocks: Clocks,
    clock: String,
}

pub struct SyncEngine {
    db: Db,
    data_root: PathBuf,
    store: SyncStore,
    device_name: String,
    policy: MaintenancePolicy,
}

/// 一批待写的改动记录与其中新出现的文件。
#[derive(Default)]
struct Batch {
    items: Vec<(SyncDirty, ChangeRecord)>,
    blobs: Vec<(PathBuf, String)>,
    shas: BTreeSet<String>,
    bytes: u64,
}

fn digest_of(rows: Option<&SyncRows>, files: &[SyncFileEntry]) -> Result<String> {
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_vec(&(rows, files))?);
    Ok(hex(&hasher.finalize()))
}

fn map_strings(value: &mut Value, f: &dyn Fn(&str) -> Option<String>) {
    match value {
        Value::String(text) => {
            if let Some(replaced) = f(text) {
                *text = replaced;
            }
        }
        Value::Array(items) => items.iter_mut().for_each(|v| map_strings(v, f)),
        Value::Object(map) => map.values_mut().for_each(|v| map_strings(v, f)),
        _ => {}
    }
}

fn map_rows(rows: &mut SyncRows, f: &dyn Fn(&str) -> Option<String>) {
    for table in rows.values_mut() {
        for row in table.iter_mut() {
            for value in row.values_mut() {
                map_strings(value, f);
            }
        }
    }
}

fn is_valid_key(key: &str) -> bool {
    !key.is_empty()
        && key != "."
        && key != ".."
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'|'))
}

/// 看起来像一种实体(只是本机这个版本还不认识):小写字母与下划线。
fn is_kind_name(kind: &str) -> bool {
    !kind.is_empty() && kind.len() <= 40 && kind.bytes().all(|b| b.is_ascii_lowercase() || b == b'_')
}

/// 还没结束的:任务在排队或运行、AI 计算没算完、AI 改文档还没出结果(或结果不确定)。
/// 不发,结束后会再发;本机这一条还没结束时,收到别的设备的版本也先不覆盖。
fn in_progress(kind: &str, rows: &SyncRows) -> bool {
    let root = |table: &str, column: &str| {
        rows.get(table)
            .and_then(|r| r.first())
            .and_then(|row| row.get(column))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    };
    match kind {
        // 失败的任务也可能已经翻好了一部分。
        "job" => !matches!(
            root("jobs", "status_json").as_str(),
            "\"succeeded\"" | "\"failed\"" | "\"canceled\""
        ),
        "calculation" => !matches!(root("agent_calculation_runs", "status").as_str(), "completed" | "failed"),
        // 出了结果、等人确认采用的(result_ready)也发:可以在另一台设备上采用。
        "operation" => !matches!(
            root("document_operations", "status").as_str(),
            "result_ready" | "committed" | "failed" | "cancelled"
        ),
        _ => false,
    }
}

fn is_sha256(text: &str) -> bool {
    text.len() == 64 && text.bytes().all(|b| b.is_ascii_hexdigit())
}

/// 实体的字段:(字段名, 值)。根表逐列,子表整表,外加文件清单。
fn fields(kind: &str, rows: &SyncRows, files: &[SyncFileEntry]) -> BTreeMap<String, Value> {
    let mut out = BTreeMap::new();
    let Some(spec) = entity_spec(kind) else {
        return out;
    };
    let root = spec[0].0;
    if let Some(row) = rows.get(root).and_then(|r| r.first()) {
        for (column, value) in row {
            out.insert(format!("{root}.{column}"), value.clone());
        }
    }
    for (table, _) in spec.iter().skip(1) {
        let value = rows.get(*table).map(|r| serde_json::to_value(r).unwrap_or(Value::Null));
        out.insert((*table).to_string(), value.unwrap_or(Value::Array(Vec::new())));
    }
    out.insert(FILES_FIELD.to_string(), serde_json::to_value(files).unwrap_or(Value::Null));
    out
}

fn parse_clocks(json: &str) -> Clocks {
    serde_json::from_str(json).unwrap_or_default()
}

fn max_clock(clocks: &Clocks) -> String {
    clocks.values().max().cloned().unwrap_or_default()
}

impl SyncEngine {
    /// `data_root`:本机数据目录;`folder`:同步文件夹(本机目录);`device_name`:给人看的设备名。
    pub fn new(db: Db, data_root: &Path, folder: &Path, device_name: &str) -> Result<Self> {
        Self::with_backend(db, data_root, Box::new(FolderBackend::new(folder)), device_name)
    }

    /// 任意「存文件」后端(本机目录、WebDAV)。
    pub fn with_backend(db: Db, data_root: &Path, backend: Box<dyn Backend>, device_name: &str) -> Result<Self> {
        let data_root = fs::canonicalize(data_root)
            .with_context(|| format!("data root not found: {}", data_root.display()))?;
        let work_dir = data_root.join("sync-work");
        Ok(Self {
            db,
            store: SyncStore::new(backend, work_dir),
            data_root,
            device_name: device_name.to_string(),
            policy: MaintenancePolicy::default(),
        })
    }

    /// 改整理的节奏(测试用)。
    pub fn with_policy(mut self, policy: MaintenancePolicy) -> Self {
        self.policy = policy;
        self
    }

    /// 连通性测试(能读写删),返回往返耗时(毫秒)。不碰同步数据。
    pub fn probe(&self) -> Result<u64> {
        self.store.probe()
    }

    /// 本机设备号(第一次调用时生成)。
    pub fn device_id(&self) -> Result<String> {
        if let Some(id) = self.db.sync_state_get(STATE_DEVICE)? {
            return Ok(id);
        }
        let id = format!("{:016x}", fastrand::u64(..));
        self.db.sync_state_set(STATE_DEVICE, &id)?;
        Ok(id)
    }

    fn portable(&self, rows: &mut SyncRows) {
        let root = self.data_root.to_string_lossy().to_string();
        let prefix = format!("{root}/");
        map_rows(rows, &|text| {
            if text == root {
                Some(DATA_ROOT_TOKEN.to_string())
            } else if text.contains(&prefix) {
                Some(text.replace(&prefix, &format!("{DATA_ROOT_TOKEN}/")))
            } else {
                None
            }
        });
        if let Some(jobs) = rows.get_mut("jobs") {
            for job in jobs.iter_mut() {
                // 进程号只在产生它的机器上有意义。
                job.insert("pid".into(), Value::Null);
            }
        }
    }

    fn localized(&self, rows: &SyncRows) -> SyncRows {
        let root = self.data_root.to_string_lossy().to_string();
        let mut rows = rows.clone();
        map_rows(&mut rows, &|text| {
            text.contains(DATA_ROOT_TOKEN).then(|| text.replace(DATA_ROOT_TOKEN, &root))
        });
        rows
    }

    /// 本机当前的内容(可移植形式);实体不存在为 None。
    fn local_rows(&self, kind: &str, key: &str) -> Result<Option<SyncRows>> {
        Ok(self.db.sync_read_entity(kind, key)?.map(|mut rows| {
            self.portable(&mut rows);
            rows
        }))
    }

    fn local_files(&self, kind: &str, key: &str, rows: &SyncRows) -> Result<Vec<SyncFileEntry>> {
        let mut files = Vec::new();
        for path in entity_files(&self.data_root, kind, key, rows)? {
            if let Some(entry) = file_hash(&self.db, &self.data_root, &path)? {
                files.push(entry);
            }
        }
        Ok(files)
    }

    fn load_clock(&self) -> Result<Hlc> {
        Ok(self
            .db
            .sync_state_get(STATE_CLOCK)?
            .and_then(|text| Hlc::parse(&text))
            .unwrap_or_default())
    }

    /// 数据库文件的身份:数据目录 + 文件所在设备与 inode。整个数据目录被复制到别处
    /// (换电脑时最常见的做法)后它会变,哪怕路径一样。
    fn fingerprint(&self) -> String {
        let meta = fs::metadata(self.db.path()).ok();
        #[cfg(unix)]
        let id = meta.map(|m| {
            use std::os::unix::fs::MetadataExt;
            format!("{}:{}", m.dev(), m.ino())
        });
        #[cfg(not(unix))]
        let id = meta.map(|_| String::new());
        format!("{}|{}", self.data_root.display(), id.unwrap_or_default())
    }

    /// 同步文件夹里的其它设备。
    pub fn peers(&self) -> Result<Vec<SyncPeer>> {
        let me = self.db.sync_state_get(STATE_DEVICE)?.unwrap_or_default();
        let mut out = Vec::new();
        for (device_id, name) in self.store.devices()? {
            if device_id == me {
                continue;
            }
            let segments_read = self.db.sync_cursor(&device_id)?;
            out.push(SyncPeer { device_id, name, segments_read });
        }
        Ok(out)
    }

    /// 跑一轮同步。第一次跑时把本机现有的书库全部放进去。
    pub fn run_cycle(&self) -> Result<SyncReport> {
        let (folder_id, format_version) = self.store.ensure_version()?;
        let mut folder_changed = false;
        match self.db.sync_state_get(STATE_FOLDER_ID)? {
            Some(known) if known == folder_id => {}
            Some(_) => {
                // 换了同步文件夹:新文件夹里没有本机的东西,全部重新发。
                self.db.sync_forget_folder()?;
                self.db.sync_state_set(STATE_FOLDER_ID, &folder_id)?;
                folder_changed = true;
            }
            None => self.db.sync_state_set(STATE_FOLDER_ID, &folder_id)?,
        }
        let mut device_renewed = false;
        let fingerprint = self.fingerprint();
        match self.db.sync_state_get(STATE_FINGERPRINT)? {
            Some(known) if known != fingerprint => {
                // 数据目录是复制来的:原设备可能还在用旧设备号,两边不能写同一个设备目录。
                // 新设备号从第一段写起;旧设备号的改动在本机都已经有了,读到时按旧的跳过。
                let old = self.db.sync_state_get(STATE_DEVICE)?;
                // 复制那一刻旧设备号写到的段,本机已经全部包含:记为读过。之后原设备
                // 再写的段照常读。
                let written: u64 = self
                    .db
                    .sync_state_get(STATE_SEGMENT)?
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(0);
                if let Some(old) = old {
                    self.db.sync_set_cursor(&old, written)?;
                }
                let fresh = format!("{:016x}", fastrand::u64(..));
                self.db.sync_state_set(STATE_DEVICE, &fresh)?;
                self.db.sync_state_set(STATE_SEGMENT, "0")?;
                // 旧设备号的记录与整理状态属于原设备,新设备号从头记。
                self.db.sync_clear_own_records()?;
                device_renewed = true;
            }
            _ => {}
        }
        self.db.sync_state_set(STATE_FINGERPRINT, &fingerprint)?;
        let device = self.device_id()?;
        let written = format!("{device}|{}", self.device_name);
        if self.db.sync_state_get(STATE_DEVICE_WRITTEN)?.as_deref() != Some(written.as_str()) {
            self.store.write_device(&device, &self.device_name)?;
            self.db.sync_state_set(STATE_DEVICE_WRITTEN, &written)?;
        }
        self.seed()?;
        let mut report = SyncReport {
            device_id: device.clone(),
            folder_changed,
            device_renewed,
            ..SyncReport::default()
        };
        let mut hlc = self.load_clock()?;
        let result = (|| -> Result<DeviceState> {
            // 先看各设备停用了哪些包(导出时不再往里引用)、整理到了哪一段(读时跳过)。
            let states = self.device_states()?;
            self.export(&device, &mut hlc, &mut report)?;
            self.import(&device, &states, &mut hlc, &mut report)?;
            Ok(states.get(&device).cloned().unwrap_or_default())
        })();
        self.db.sync_state_set(STATE_CLOCK, &hlc.encode())?;
        if let Ok(own) = &result {
            if let Err(error) = self.maintain(&device, own.clone(), &folder_id, format_version, &mut report) {
                tracing::warn!("sync maintenance: {error:#}");
                report.maintenance_error = Some(format!("{error:#}"));
            }
        }
        self.store.end_cycle();
        result?;
        report.pending = self.db.sync_pending()?.len();
        Ok(report)
    }

    /// 各设备的整理状态;停用的包记进本机(导出、取文件时用)。每台设备一个请求,所以
    /// 隔一段时间(`refresh_states`,默认十分钟)才重读,其间用记下的:停用的包要等 7 天才删,
    /// 晚一会儿知道无妨。
    fn device_states(&self) -> Result<BTreeMap<String, DeviceState>> {
        let now = chrono::Utc::now();
        let due = self
            .db
            .sync_state_get(STATE_STATES_READ_AT)?
            .and_then(|t| chrono::DateTime::parse_from_rfc3339(&t).ok())
            .map_or(true, |t| now - t.with_timezone(&chrono::Utc) >= self.policy.refresh_states);
        let mut out = BTreeMap::new();
        for device in self.store.device_ids()? {
            let state = if due {
                let state = self.store.device_state(&device)?;
                self.remember_state(&device, &state)?;
                state
            } else {
                DeviceState {
                    base: self
                        .db
                        .sync_state_get(&format!("{STATE_BASE_PREFIX}{device}"))?
                        .and_then(|v| v.parse().ok())
                        .unwrap_or(0),
                    retired: self.db.sync_retired_packs(&device)?,
                }
            };
            out.insert(device, state);
        }
        if due {
            self.db.sync_state_set(STATE_STATES_READ_AT, &now.to_rfc3339())?;
        }
        Ok(out)
    }

    /// 记下一台设备的整理状态(本机读到的,或本机自己刚写的)。
    fn remember_state(&self, device: &str, state: &DeviceState) -> Result<()> {
        self.db.sync_set_retired_packs(device, &state.retired)?;
        self.db.sync_state_set(&format!("{STATE_BASE_PREFIX}{device}"), &state.base.to_string())
    }

    /// 把还没登记过(或登记版本旧了)的种类的现有内容标成待同步。
    fn seed(&self) -> Result<()> {
        let mut seeded: BTreeMap<String, u32> = match self.db.sync_state_get(STATE_SEEDED)?.as_deref() {
            None => BTreeMap::new(),
            // 第三期之前只记了「登记过」:当时的六种都是第 1 版。
            Some("1") => ["upload", "document", "collection", "collection_member", "favorite", "job"]
                .into_iter()
                .map(|kind| (kind.to_string(), 1))
                .collect(),
            Some(json) => serde_json::from_str(json).unwrap_or_default(),
        };
        let due: Vec<&str> = SYNC_SEED_VERSIONS
            .iter()
            .filter(|(kind, version)| seeded.get(*kind).map_or(true, |done| done < version))
            .map(|(kind, _)| *kind)
            .collect();
        if due.is_empty() {
            return Ok(());
        }
        self.db.sync_seed(&due)?;
        for (kind, version) in SYNC_SEED_VERSIONS {
            seeded.insert(kind.to_string(), *version);
        }
        self.db.sync_state_set(STATE_SEEDED, &serde_json::to_string(&seeded)?)
    }

    // ---------------------------------------------------------------- 导出

    fn export(&self, device: &str, hlc: &mut Hlc, report: &mut SyncReport) -> Result<()> {
        loop {
            let dirty = self.db.sync_dirty(SEGMENT_RECORDS * 4)?;
            if dirty.is_empty() {
                return Ok(());
            }
            let mut batch = Batch::default();
            let mut progressed = false;
            for item in dirty {
                let Some(record) = self.export_record(device, hlc, &item)? else {
                    self.db.sync_clear_dirty(&item)?;
                    progressed = true;
                    continue;
                };
                // 新出现的文件(同步文件夹里还没有的)跟这一段一起打包。
                let mut fresh = Vec::new();
                let mut fresh_bytes = 0;
                for file in &record.files {
                    if batch.shas.contains(&file.sha256)
                        || fresh.iter().any(|(_, sha): &(PathBuf, String)| sha == &file.sha256)
                        || self.db.sync_blob_available(&file.sha256)?
                    {
                        continue;
                    }
                    fresh.push((self.data_root.join(checked_relative(&file.path)?), file.sha256.clone()));
                    fresh_bytes += file.size;
                }
                if !batch.items.is_empty() && batch.bytes + fresh_bytes > PACK_BYTES {
                    self.flush(device, &mut batch, report)?;
                    progressed = true;
                }
                for (path, sha) in fresh {
                    batch.shas.insert(sha.clone());
                    batch.blobs.push((path, sha));
                }
                batch.bytes += fresh_bytes;
                batch.items.push((item, record));
                if batch.items.len() >= SEGMENT_RECORDS || batch.bytes >= PACK_BYTES {
                    self.flush(device, &mut batch, report)?;
                    progressed = true;
                }
            }
            if !batch.items.is_empty() {
                self.flush(device, &mut batch, report)?;
                progressed = true;
            }
            if !progressed {
                return Ok(());
            }
        }
    }

    /// 一条待导出的改动 -> 改动记录(None:不用发,比如没真正变化、任务还没成功)。
    fn export_record(&self, device: &str, hlc: &mut Hlc, item: &SyncDirty) -> Result<Option<ChangeRecord>> {
        if entity_spec(&item.kind).is_none() || !is_valid_key(&item.key) {
            return Ok(None);
        }
        let state = self.db.sync_entity_state(&item.kind, &item.key)?;
        let Some(rows) = self.local_rows(&item.kind, &item.key)? else {
            // 删除:只有别的设备知道它(发过或收到过)才需要告诉它们。
            if state.as_ref().map_or(true, |s| s.deleted) {
                return Ok(None);
            }
            let clock = hlc.tick(iso_ms(&item.changed_at), device);
            return Ok(Some(ChangeRecord {
                kind: item.kind.clone(),
                key: item.key.clone(),
                clock,
                device: device.to_string(),
                deleted: true,
                rows: None,
                files: Vec::new(),
                clocks: Clocks::new(),
            }));
        };
        if in_progress(&item.kind, &rows) {
            return Ok(None);
        }
        let files = self.local_files(&item.kind, &item.key, &rows)?;
        let digest = digest_of(Some(&rows), &files)?;
        let live = state.as_ref().filter(|s| !s.deleted);
        if live.is_some_and(|s| s.digest == digest) {
            return Ok(None);
        }
        // 只有变了的字段换新时钟。
        let (base_fields, mut clocks) = match live {
            Some(s) => {
                let base: SyncRows = serde_json::from_str(&s.base_json).unwrap_or_default();
                let base_files: Vec<SyncFileEntry> = s
                    .files
                    .iter()
                    .filter_map(|f| {
                        files
                            .iter()
                            .find(|e| e.path == f.path && e.sha256 == f.sha256)
                            .cloned()
                    })
                    .collect();
                let base_files = if base_files.len() == s.files.len() { base_files } else { Vec::new() };
                (fields(&item.kind, &base, &base_files), parse_clocks(&s.clocks_json))
            }
            None => (BTreeMap::new(), Clocks::new()),
        };
        let clock = hlc.tick(iso_ms(&item.changed_at), device);
        for (field, value) in fields(&item.kind, &rows, &files) {
            if base_fields.get(&field) != Some(&value) || !clocks.contains_key(&field) {
                clocks.insert(field, clock.clone());
            }
        }
        Ok(Some(ChangeRecord {
            kind: item.kind.clone(),
            key: item.key.clone(),
            clock,
            device: device.to_string(),
            deleted: false,
            rows: Some(rows),
            files,
            clocks,
        }))
    }

    fn flush(&self, device: &str, batch: &mut Batch, report: &mut SyncReport) -> Result<()> {
        let records: Vec<ChangeRecord> = batch.items.iter().map(|(_, record)| record.clone()).collect();
        let last = self
            .db
            .sync_state_get(STATE_SEGMENT)?
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        let (segment, index) = self.store.write_segment(device, last, &records, &batch.blobs)?;
        self.db.sync_state_set(STATE_SEGMENT, &segment.to_string())?;
        self.db.sync_record_blobs(device, segment, &index)?;
        let entities: Vec<(String, String)> = records.iter().map(|r| (r.kind.clone(), r.key.clone())).collect();
        self.db.sync_note_own_records(&entities, segment)?;
        report.blobs_uploaded += index.len();
        let items = std::mem::take(&mut batch.items);
        *batch = Batch::default();
        for (item, record) in items {
            let refs = file_refs(&record.files);
            let (digest, base_json) = match &record.rows {
                Some(rows) => (digest_of(Some(rows), &record.files)?, serde_json::to_string(rows)?),
                None => (String::new(), String::new()),
            };
            self.db.sync_record_entity(&SyncEntityUpdate {
                kind: &record.kind,
                key: &record.key,
                clock: &record.clock,
                deleted: record.deleted,
                digest: &digest,
                base_json: &base_json,
                clocks_json: &serde_json::to_string(&record.clocks)?,
                files: &refs,
            })?;
            self.db.sync_clear_dirty(&item)?;
            report.exported += 1;
        }
        Ok(())
    }

    // ---------------------------------------------------------------- 导入

    fn retry_pending(&self, hlc: &mut Hlc, report: &mut SyncReport) -> Result<()> {
        // 一条应用成功可能让另一条的依赖到齐(收藏等它的任务):反复试到没有进展。
        loop {
            let before = report.applied + report.stale + report.rejected;
            for pending in self.db.sync_pending()? {
                let record: ChangeRecord = match serde_json::from_str(&pending.record_json) {
                    Ok(record) => record,
                    Err(_) => {
                        self.db.sync_unpark(&pending.kind, &pending.key, &pending.clock)?;
                        continue;
                    }
                };
                self.consider_and_count(&record, hlc, report, false)?;
            }
            if report.applied + report.stale + report.rejected == before {
                return Ok(());
            }
        }
    }

    fn import(
        &self,
        device: &str,
        states: &BTreeMap<String, DeviceState>,
        hlc: &mut Hlc,
        report: &mut SyncReport,
    ) -> Result<()> {
        self.retry_pending(hlc, report)?;
        for (other, state) in states {
            if other == device {
                continue;
            }
            let mut segment = self.db.sync_cursor(other)?;
            if state.base > segment + 1 {
                // 那台设备整理过:之前的段已经删了,里面还有用的记录都抄进了 base 之后。
                segment = state.base - 1;
                self.db.sync_set_cursor(other, segment)?;
            }
            let other = other.as_str();
            loop {
                match self.store.read_segment(other, segment + 1)? {
                    Segment::Complete { records, packs } => {
                        // 先记下包里有什么,这一段的改动才找得到自己的文件。
                        for (pack_segment, index) in &packs {
                            self.db.sync_record_blobs(other, *pack_segment, index)?;
                        }
                        for record in &records {
                            if record.device != other {
                                bail!("change record from {} found in {other}'s folder", record.device);
                            }
                            self.consider_and_count(record, hlc, report, true)?;
                        }
                        segment += 1;
                        self.db.sync_set_cursor(other, segment)?;
                    }
                    Segment::Missing | Segment::Incomplete => break,
                }
            }
        }
        self.retry_pending(hlc, report)
    }

    fn consider_and_count(
        &self,
        record: &ChangeRecord,
        hlc: &mut Hlc,
        report: &mut SyncReport,
        fresh: bool,
    ) -> Result<()> {
        match self.consider(record, hlc)? {
            Considered::Applied { deleted, written, removed } => {
                report.applied += 1;
                report.deleted += usize::from(deleted);
                report.files_written += written;
                report.files_removed += removed;
                self.db.sync_unpark(&record.kind, &record.key, &record.clock)?;
            }
            Considered::Rejected => {
                report.rejected += 1;
                tracing::warn!(kind = %record.kind, key = %record.key, device = %record.device, "sync: rejected a malformed change record");
                self.db.sync_unpark(&record.kind, &record.key, &record.clock)?;
            }
            Considered::Stale => {
                report.stale += 1;
                self.db.sync_unpark(&record.kind, &record.key, &record.clock)?;
            }
            Considered::Parked(reason) => {
                report.parked += usize::from(fresh);
                self.db.sync_park(
                    &record.kind,
                    &record.key,
                    &record.clock,
                    &serde_json::to_string(record)?,
                    &reason,
                )?;
            }
        }
        Ok(())
    }

    fn consider(&self, record: &ChangeRecord, hlc: &mut Hlc) -> Result<Considered> {
        if entity_spec(&record.kind).is_none() && is_kind_name(&record.kind) && is_valid_key(&record.key) {
            // 新版本才有的种类:留着,升级后再应用(丢掉的话升级后也收不到了)。
            return Ok(Considered::Parked(format!("{} needs a newer version of the app", record.kind)));
        }
        if entity_spec(&record.kind).is_none()
            || !is_valid_key(&record.key)
            || Hlc::parse(&record.clock).is_none()
            || record.clocks.values().any(|c| Hlc::parse(c).is_none() || c > &record.clock)
            || record.files.iter().any(|f| checked_relative(&f.path).is_err() || !is_sha256(&f.sha256))
            || (!record.deleted && record.rows.is_none())
        {
            return Ok(Considered::Rejected);
        }
        hlc.observe(&record.clock);
        // 本机还有没发出去的改动(这一轮导出之后才改的):下一轮先导出再合并。
        if self.db.sync_dirty_since(&record.kind, &record.key)?.is_some() {
            return Ok(Considered::Parked("local changes not sent yet".into()));
        }
        let state = self.db.sync_entity_state(&record.kind, &record.key)?;
        if self
            .db
            .sync_read_entity(&record.kind, &record.key)?
            .is_some_and(|rows| in_progress(&record.kind, &rows))
        {
            return Ok(Considered::Parked(format!("{} is still running on this device", record.kind)));
        }
        let target = if record.deleted {
            // 本机最后一次改动(或删除)比它新:不删。
            if state.as_ref().is_some_and(|s| s.clock.as_str() >= record.clock.as_str()) {
                return Ok(Considered::Stale);
            }
            Target { rows: None, files: Vec::new(), clocks: Clocks::new(), clock: record.clock.clone() }
        } else {
            match self.merge(record, state.as_ref())? {
                Some(target) => target,
                None => return Ok(Considered::Stale),
            }
        };
        self.apply(record, state.as_ref(), target)
    }

    /// 逐字段合并:对方时钟新的字段用对方的。没有任何字段要改时为 None。
    fn merge(&self, record: &ChangeRecord, state: Option<&SyncEntityState>) -> Result<Option<Target>> {
        let remote_rows = record.rows.as_ref().expect("checked in consider");
        let clock_of = |field: &str| record.clocks.get(field).cloned().unwrap_or_else(|| record.clock.clone());
        let local = match state {
            Some(s) if s.deleted => {
                // 本机删了它;对方在删除之后又改过才复活(整条用对方的)。
                if s.clock.as_str() >= record.clock.as_str() {
                    return Ok(None);
                }
                None
            }
            Some(_) => self.local_rows(&record.kind, &record.key)?,
            None => None,
        };
        let Some(local_rows) = local else {
            let clocks = fields(&record.kind, remote_rows, &record.files)
                .into_keys()
                .map(|field| {
                    let clock = clock_of(&field);
                    (field, clock)
                })
                .collect();
            return Ok(Some(Target {
                rows: Some(remote_rows.clone()),
                files: record.files.clone(),
                clocks,
                clock: record.clock.clone(),
            }));
        };
        let state = state.expect("local rows imply a state");
        let mut clocks = parse_clocks(&state.clocks_json);
        // 本机的文件清单就是上次导出或应用后记下的那份(大小在 apply 里按磁盘补)。
        let mut files: Vec<SyncFileEntry> = state
            .files
            .iter()
            .map(|f| SyncFileEntry { path: f.path.clone(), sha256: f.sha256.clone(), size: 0 })
            .collect();
        let mut rows = local_rows;
        let spec = entity_spec(&record.kind).expect("checked in consider");
        let root = spec[0].0;
        let mut changed = false;
        for (field, value) in fields(&record.kind, remote_rows, &record.files) {
            let remote_clock = clock_of(&field);
            if clocks.get(&field).is_some_and(|local| local.as_str() >= remote_clock.as_str()) {
                continue;
            }
            changed = true;
            clocks.insert(field.clone(), remote_clock);
            if field == FILES_FIELD {
                files = record.files.clone();
            } else if let Some(column) = field.strip_prefix(&format!("{root}.")) {
                if let Some(row) = rows.get_mut(root).and_then(|r| r.first_mut()) {
                    row.insert(column.to_string(), value);
                }
            } else {
                let table = remote_rows.get(field.as_str()).cloned().unwrap_or_default();
                rows.insert(field, table);
            }
        }
        if !changed {
            return Ok(None);
        }
        let clock = max_clock(&clocks).max(state.clock.clone());
        Ok(Some(Target { rows: Some(rows), files, clocks, clock }))
    }

    fn apply(&self, record: &ChangeRecord, state: Option<&SyncEntityState>, target: Target) -> Result<Considered> {
        // 先确认文件内容都到了,再动磁盘和数据库。
        let mut missing = Vec::new();
        for file in &target.files {
            if !has_content(&self.db, &self.data_root, file)? && self.db.sync_blob_locations(&file.sha256)?.is_empty() {
                missing.push(file.path.clone());
            }
        }
        if !missing.is_empty() {
            return Ok(Considered::Parked(format!("waiting for {} file(s), e.g. {}", missing.len(), missing[0])));
        }
        let mut written = 0;
        for file in &target.files {
            if has_content(&self.db, &self.data_root, file)? {
                continue;
            }
            let target_path = self.data_root.join(checked_relative(&file.path)?);
            if !self.fetch(&file.sha256, &target_path)? {
                return Ok(Considered::Parked(format!("waiting for 1 file(s) to download, e.g. {}", file.path)));
            }
            written += 1;
        }
        // 文件清单里的大小以磁盘为准(合并时本机清单不带大小)。
        let mut files = Vec::new();
        for file in &target.files {
            let path = self.data_root.join(checked_relative(&file.path)?);
            if let Some(entry) = file_hash(&self.db, &self.data_root, &path)? {
                files.push(entry);
            }
        }
        let localized = target.rows.as_ref().map(|rows| self.localized(rows));
        let refs = file_refs(&files);
        let (digest, base_json) = match &target.rows {
            Some(rows) => (digest_of(Some(rows), &files)?, serde_json::to_string(rows)?),
            None => (String::new(), String::new()),
        };
        let outcome = self.db.sync_apply_entity(
            &SyncEntityUpdate {
                kind: &record.kind,
                key: &record.key,
                clock: &target.clock,
                deleted: target.rows.is_none(),
                digest: &digest,
                base_json: &base_json,
                clocks_json: &serde_json::to_string(&target.clocks)?,
                files: &refs,
            },
            localized.as_ref(),
        )?;
        if let SyncApplyOutcome::MissingParent(reason) = outcome {
            return Ok(Considered::Parked(format!("waiting for a related item: {reason}")));
        }
        // 不再属于这个实体、也没有别的实体在用的旧文件。
        let keep: BTreeSet<&str> = files.iter().map(|f| f.path.as_str()).collect();
        let mut removed = 0;
        for old in state.map(|s| s.files.as_slice()).unwrap_or(&[]) {
            if keep.contains(old.path.as_str())
                || self.db.sync_file_shared(&old.path, &record.kind, &record.key)?
            {
                continue;
            }
            remove_file(&self.data_root, &old.path)?;
            removed += 1;
        }
        if target.rows.is_none() {
            // 实体自己的目录(渲染缓存等本机生成的东西)一起删。
            let dir = match record.kind.as_str() {
                "job" => Some(self.data_root.join("jobs").join(&record.key)),
                "document" => Some(self.data_root.join("documents").join(&record.key)),
                "upload" => Some(self.data_root.join("uploads").join(&record.key)),
                "calculation" => Some(self.data_root.join("agent-calculations").join(&record.key)),
                "operation" => Some(self.data_root.join("operations").join(&record.key)),
                _ => None,
            };
            if let Some(dir) = dir.filter(|d| d.is_dir()) {
                fs::remove_dir_all(&dir).with_context(|| format!("failed to remove {}", dir.display()))?;
            }
        }
        Ok(Considered::Applied { deleted: target.rows.is_none(), written, removed })
    }
}

impl SyncEngine {
    /// 从知道的位置里取出一份内容(没停用的包先试)。停用的包已经被它的设备删了就忘掉那个
    /// 位置、试下一个;都取不到为 false(还没下载到,或者暂时哪里都没有)。没停用的包不在
    /// 不算没了:网盘同步文件不分先后,段可能比包先到。
    fn fetch(&self, sha256: &str, target: &Path) -> Result<bool> {
        for location in self.db.sync_blob_locations(sha256)? {
            let at = BlobLocation {
                device: location.device.clone(),
                segment: location.segment,
                offset: location.offset,
                length: location.length,
            };
            if self.store.fetch_blob(&at, sha256, target)? {
                return Ok(true);
            }
            if location.retired && !self.store.pack_exists(&location.device, location.segment)? {
                self.db.sync_forget_pack(&location.device, location.segment)?;
            }
        }
        Ok(false)
    }
}

fn file_refs(files: &[SyncFileEntry]) -> Vec<SyncFileRef> {
    files
        .iter()
        .map(|f| SyncFileRef { path: f.path.clone(), sha256: f.sha256.clone() })
        .collect()
}
