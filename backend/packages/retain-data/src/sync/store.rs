//! 同步文件夹的通用读写:格式说明、设备说明、改动记录段、文件包。
//!
//! 「存文件」这一层是 [`Backend`]:本机目录(网盘客户端同步的文件夹,`folder.rs`)或
//! WebDAV(`webdav.rs`)。这里只用相对路径(`/` 分隔、只有 ASCII)跟它说话,布局与格式
//! 只在这里定义一次:
//!
//! ```text
//! format.json                              格式名、版本、文件夹编号
//! devices/<设备号>/device.json             设备说明
//! devices/<设备号>/state.json              整理状态:从第几段读起、停用了哪些包(格式 3)
//! devices/<设备号>/changes/<段号>.jsonl    改动记录段(写完不再改)
//! devices/<设备号>/packs/<段号>.pack       这一段新增的文件内容,首尾相接
//! ```
//!
//! 一段的最后几行是文件包索引 `{"pack": [[sha256, 偏移, 长度], ...]}`(没有新文件就
//! 没有这一行)和结束标记 `{"segment_end": 条数}`。文件包(每包约 32MB)先于改动记录段写好,所以看得到
//! 段就一定有完整的包;改动记录段先写临时名再改名,看不到写了一半的段;取出的每个文件
//! 都按指纹核对。
//!
//! # 整理(格式 3)
//!
//! 每台设备只整理自己的目录(仍然只有一个写的人):
//! - 改动记录:把每个实体在本设备的最后一条记录原样抄进新的几段,再在 `state.json` 里记下
//!   `base`(从这一段读起),然后删掉之前的段。读得落后的设备直接跳到 `base`:跳过的都是被
//!   同一设备后来的记录取代了的。被删的段里还在用的包,索引在新段里重新登记:
//!   `{"pack": [...], "pack_segment": 段号}` 指的是那一段的包。
//! - 文件包:没人用的包先在 `state.json` 的 `retired` 里登记停用,过一段时间(默认 7 天)
//!   再删。别的设备每轮开始时读这份清单:不再往停用的包里引用(要用的内容自己重新传),
//!   取文件时先找没停用的位置。大半没用的包,把还在用的内容重新打一个包再停用旧的。
//!
//! 格式 2 的程序不认识这些,第一次整理前把 `format.json` 升到 3,旧程序会提示先更新。
//!
//! 文件打成包而不是一个文件一个对象:WebDAV 上每个请求都有往返时间(经 Tailscale
//! 中转约半秒),坚果云还限制请求频率;一本书几千个小文件,打包后首次同步只要几十个请求。

use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use super::folder::{hex, temp_path};
use super::ChangeRecord;

pub const SYNC_FORMAT: &str = "retain-pdf-sync";
/// 2:文件内容按段打包(1 是一个文件一个对象,只在开发中用过);3:可以整理(见上)。
/// 格式 2 的文件夹照常读写,第一次整理前升到 3。
pub const SYNC_FORMAT_VERSION: u64 = 3;
const OLDEST_READABLE_VERSION: u64 = 2;

const SEGMENT_END: &str = "segment_end";
const PACK_INDEX: &str = "pack";
const PACK_SEGMENT: &str = "pack_segment";

/// 一个包的索引:(sha256, 偏移, 长度)。
pub type PackIndex = Vec<(String, u64, u64)>;

/// 一台设备的整理状态(`state.json`)。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DeviceState {
    /// 改动记录从这一段读起(之前的已经整理掉);0 或 1 表示从头读。
    pub base: u64,
    /// 停用的包:(段号, 从什么时候起,ISO 时间)。
    pub retired: Vec<(u64, String)>,
}

/// 后端读一个文件的结果。
pub enum Fetched {
    Bytes(Vec<u8>),
    Missing,
    /// 在,但还没到本机(iCloud 占位文件,已请系统下载)。
    Pending,
}

/// 「存文件」这一层。路径相对同步文件夹的根,`/` 分隔。
pub trait Backend: Send + Sync {
    /// 给人看的位置(本机路径或 WebDAV 地址)。
    fn describe(&self) -> String;
    fn read(&self, path: &str) -> Result<Fetched>;
    fn exists(&self, path: &str) -> Result<bool>;
    /// 整个文件一次写好(别人看不到写了一半的样子)。
    fn write_atomic(&self, path: &str, bytes: &[u8]) -> Result<()>;
    /// 上传一个本机文件(文件包;读的一方按指纹核对,不要求原子)。
    fn upload(&self, path: &str, source: &Path) -> Result<()>;
    /// 目录下的子项名字;目录不存在为空。
    fn list(&self, dir: &str) -> Result<Vec<String>>;
    /// 文件在本机的一份可读副本(本机目录就是它自己;WebDAV 下载到缓存)。还没到为 None。
    fn local_copy(&self, path: &str) -> Result<Option<PathBuf>>;
    /// 删掉一个文件(只用于连通性测试的探针)。
    fn remove(&self, path: &str) -> Result<()>;
    /// 一轮同步结束:丢掉这一轮的下载缓存。
    fn end_cycle(&self) {}
}

fn records_lines(records: &[ChangeRecord]) -> Result<Vec<String>> {
    records.iter().map(|r| Ok(serde_json::to_string(r)?)).collect()
}

/// 一个文件在哪个包里。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlobLocation {
    pub device: String,
    pub segment: u64,
    pub offset: u64,
    pub length: u64,
}

/// 读到的一段。
pub enum Segment {
    Complete {
        records: Vec<ChangeRecord>,
        /// 这一段登记的包索引:(哪一段的包, 索引)。通常只有本段的包;整理后的段里还有
        /// 之前各段留下的包。
        packs: Vec<(u64, PackIndex)>,
    },
    Missing,
    Incomplete,
}

fn is_device_id(name: &str) -> bool {
    name.len() == 16 && name.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

fn segment_path(device: &str, segment: u64) -> String {
    format!("devices/{device}/changes/{segment:08}.jsonl")
}

fn pack_path(device: &str, segment: u64) -> String {
    format!("devices/{device}/packs/{segment:08}.pack")
}

fn state_path(device: &str) -> String {
    format!("devices/{device}/state.json")
}

pub struct SyncStore {
    backend: Box<dyn Backend>,
    /// 打包用的本机临时目录。
    work_dir: PathBuf,
}

impl SyncStore {
    pub fn new(backend: Box<dyn Backend>, work_dir: PathBuf) -> Self {
        Self { backend, work_dir }
    }

    pub fn describe(&self) -> String {
        self.backend.describe()
    }

    pub fn end_cycle(&self) {
        self.backend.end_cycle();
        let _ = fs::remove_dir(&self.work_dir);
    }

    /// 第一次用时写下格式说明;已有的检查格式与版本。返回文件夹编号(换了同步文件夹
    /// ——而不是同一个文件夹换了路径或地址——靠它认出来)与文件夹现在的格式版本。
    pub fn ensure_version(&self) -> Result<(String, u64)> {
        match self.backend.read("format.json")? {
            Fetched::Bytes(bytes) => {
                let value: Value = serde_json::from_slice(&bytes)
                    .with_context(|| format!("{} 里的 format.json 无法识别", self.describe()))?;
                if value.get("format").and_then(Value::as_str) != Some(SYNC_FORMAT) {
                    bail!("{} 不是 RetainPDF 的同步文件夹", self.describe());
                }
                let version = value.get("version").and_then(Value::as_u64).unwrap_or(0);
                if version > SYNC_FORMAT_VERSION {
                    bail!("同步文件夹的格式({version})比这个版本新,请先更新 RetainPDF");
                }
                if version < OLDEST_READABLE_VERSION {
                    bail!("同步文件夹是旧的测试格式({version}),请换一个空文件夹");
                }
                let folder_id = value
                    .get("folder_id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .ok_or_else(|| anyhow::anyhow!("{} 的 format.json 缺少 folder_id", self.describe()))?;
                Ok((folder_id, version))
            }
            Fetched::Pending => bail!("同步文件夹还在从网盘下载,稍后再试"),
            Fetched::Missing => {
                let folder_id = format!("{:016x}", fastrand::u64(..));
                self.backend.write_atomic(
                    "format.json",
                    &serde_json::to_vec_pretty(&json!({
                        "format": SYNC_FORMAT,
                        "version": SYNC_FORMAT_VERSION,
                        "folder_id": folder_id,
                    }))?,
                )?;
                Ok((folder_id, SYNC_FORMAT_VERSION))
            }
        }
    }

    /// 把格式说明升到当前版本(第一次整理前;文件夹编号不变)。
    pub fn upgrade_format(&self, folder_id: &str) -> Result<()> {
        self.backend.write_atomic(
            "format.json",
            &serde_json::to_vec_pretty(&json!({
                "format": SYNC_FORMAT,
                "version": SYNC_FORMAT_VERSION,
                "folder_id": folder_id,
            }))?,
        )
    }

    /// 一台设备的整理状态;没整理过(或格式 2)为默认值。
    pub fn device_state(&self, device: &str) -> Result<DeviceState> {
        let bytes = match self.backend.read(&state_path(device))? {
            Fetched::Bytes(bytes) => bytes,
            Fetched::Missing => return Ok(DeviceState::default()),
            Fetched::Pending => bail!("{device} 的整理状态还在从网盘下载"),
        };
        let value: Value = serde_json::from_slice(&bytes)
            .with_context(|| format!("invalid state.json of {device}"))?;
        let base = value.get("base").and_then(Value::as_u64).unwrap_or(0);
        let retired = value
            .get("retired")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|entry| {
                Some((
                    entry.get("segment")?.as_u64()?,
                    entry.get("since").and_then(Value::as_str).unwrap_or("").to_string(),
                ))
            })
            .collect();
        Ok(DeviceState { base, retired })
    }

    pub fn write_device_state(&self, device: &str, state: &DeviceState) -> Result<()> {
        let retired: Vec<Value> = state
            .retired
            .iter()
            .map(|(segment, since)| json!({ "segment": segment, "since": since }))
            .collect();
        self.backend.write_atomic(
            &state_path(device),
            &serde_json::to_vec_pretty(&json!({ "base": state.base, "retired": retired }))?,
        )
    }

    /// 删掉本机的一段改动记录(整理后)。
    pub fn remove_segment(&self, device: &str, segment: u64) -> Result<()> {
        self.backend.remove(&segment_path(device, segment))
    }

    /// 删掉本机的一个包(停用期满后)。
    pub fn remove_pack(&self, device: &str, segment: u64) -> Result<()> {
        self.backend.remove(&pack_path(device, segment))
    }

    /// 包还在不在(取不出文件时分辨是被删了还是还没下载到)。
    pub fn pack_exists(&self, device: &str, segment: u64) -> Result<bool> {
        self.backend.exists(&pack_path(device, segment))
    }

    /// 同步文件夹里的设备:(设备号, 设备名)。
    pub fn devices(&self) -> Result<Vec<(String, String)>> {
        let mut out = Vec::new();
        for device in self.device_ids()? {
            let name = match self.backend.read(&format!("devices/{device}/device.json"))? {
                Fetched::Bytes(bytes) => serde_json::from_slice::<Value>(&bytes)
                    .ok()
                    .and_then(|v| v.get("name").and_then(Value::as_str).map(str::to_string))
                    .unwrap_or_default(),
                _ => String::new(),
            };
            out.push((device, name));
        }
        Ok(out)
    }

    pub fn device_ids(&self) -> Result<Vec<String>> {
        let mut ids: Vec<String> = self
            .backend
            .list("devices")?
            .into_iter()
            .filter(|name| is_device_id(name))
            .collect();
        ids.sort();
        ids.dedup();
        Ok(ids)
    }

    pub fn write_device(&self, device: &str, name: &str) -> Result<()> {
        self.backend.write_atomic(
            &format!("devices/{device}/device.json"),
            &serde_json::to_vec_pretty(&json!({ "device_id": device, "name": name, "format": SYNC_FORMAT_VERSION }))?,
        )
    }

    /// 写本机的下一段:先把新文件打成包传上去,再写改动记录段。段号已被占用就往后找
    /// (比如数据库从备份恢复过)。返回段号与包索引。
    pub fn write_segment(
        &self,
        device: &str,
        after: u64,
        records: &[ChangeRecord],
        blobs: &[(PathBuf, String)],
    ) -> Result<(u64, PackIndex)> {
        self.write_segment_lines(device, after, &records_lines(records)?, blobs, &[])
    }

    /// 写一段:`lines` 是改动记录(已经是 JSON 的一行行,整理时原样抄),`carried` 是在
    /// 这一段里重新登记的之前各段的包。
    pub fn write_segment_lines(
        &self,
        device: &str,
        after: u64,
        lines: &[String],
        blobs: &[(PathBuf, String)],
        carried: &[(u64, PackIndex)],
    ) -> Result<(u64, PackIndex)> {
        let mut segment = after + 1;
        while self.backend.exists(&segment_path(device, segment))? {
            segment += 1;
        }
        let mut index = Vec::new();
        if !blobs.is_empty() {
            fs::create_dir_all(&self.work_dir)?;
            let local = self.work_dir.join(format!("pack-{:016x}", fastrand::u64(..)));
            let built = (|| -> Result<()> {
                let mut pack = File::create(&local)?;
                let mut offset = 0u64;
                let mut buffer = vec![0u8; 1 << 20];
                for (source, sha256) in blobs {
                    let mut input = File::open(source)
                        .with_context(|| format!("failed to open {}", source.display()))?;
                    let mut hasher = Sha256::new();
                    let mut length = 0u64;
                    loop {
                        let read = input.read(&mut buffer)?;
                        if read == 0 {
                            break;
                        }
                        hasher.update(&buffer[..read]);
                        pack.write_all(&buffer[..read])?;
                        length += read as u64;
                    }
                    if &hex(&hasher.finalize()) != sha256 {
                        bail!("{} 在打包时被改动了", source.display());
                    }
                    index.push((sha256.clone(), offset, length));
                    offset += length;
                }
                pack.sync_all()?;
                Ok(())
            })();
            let uploaded = built.and_then(|()| self.backend.upload(&pack_path(device, segment), &local));
            let _ = fs::remove_file(&local);
            uploaded?;
        }
        let mut bytes = Vec::new();
        for line in lines {
            bytes.extend_from_slice(line.as_bytes());
            bytes.push(b'\n');
        }
        for (pack_segment, entries) in carried {
            serde_json::to_writer(&mut bytes, &json!({ PACK_INDEX: entries, PACK_SEGMENT: pack_segment }))?;
            bytes.push(b'\n');
        }
        if !index.is_empty() {
            serde_json::to_writer(&mut bytes, &json!({ PACK_INDEX: index }))?;
            bytes.push(b'\n');
        }
        serde_json::to_writer(&mut bytes, &json!({ SEGMENT_END: lines.len() }))?;
        bytes.push(b'\n');
        self.backend.write_atomic(&segment_path(device, segment), &bytes)?;
        Ok((segment, index))
    }

    /// 读一段里的改动记录,原样的每一行(整理时抄本机自己的记录用)。不完整为 None。
    pub fn read_segment_lines(&self, device: &str, segment: u64) -> Result<Option<Vec<String>>> {
        let bytes = match self.backend.read(&segment_path(device, segment))? {
            Fetched::Bytes(bytes) => bytes,
            Fetched::Missing | Fetched::Pending => return Ok(None),
        };
        let text = String::from_utf8_lossy(&bytes);
        let mut lines = Vec::new();
        let mut ended = false;
        for line in text.lines().filter(|l| !l.trim().is_empty()) {
            let Ok(value) = serde_json::from_str::<Value>(line) else {
                return Ok(None);
            };
            if value.get(SEGMENT_END).is_some() {
                ended = true;
            } else if value.get(PACK_INDEX).is_none() {
                lines.push(line.to_string());
            }
        }
        Ok(ended.then_some(lines))
    }

    pub fn read_segment(&self, device: &str, segment: u64) -> Result<Segment> {
        let bytes = match self.backend.read(&segment_path(device, segment))? {
            Fetched::Bytes(bytes) => bytes,
            Fetched::Missing => return Ok(Segment::Missing),
            Fetched::Pending => return Ok(Segment::Incomplete),
        };
        let text = String::from_utf8_lossy(&bytes);
        let mut records = Vec::new();
        let mut packs = Vec::new();
        let mut ended = None;
        for line in text.lines() {
            if line.trim().is_empty() {
                continue;
            }
            if ended.is_some() {
                return Ok(Segment::Incomplete);
            }
            let Ok(value) = serde_json::from_str::<Value>(line) else {
                return Ok(Segment::Incomplete);
            };
            if let Some(count) = value.get(SEGMENT_END).and_then(Value::as_u64) {
                ended = Some(count);
                continue;
            }
            if let Some(entries) = value.get(PACK_INDEX) {
                let index: PackIndex = serde_json::from_value(entries.clone())
                    .with_context(|| format!("invalid pack index in {device}/{segment}"))?;
                let of = value.get(PACK_SEGMENT).and_then(Value::as_u64).unwrap_or(segment);
                packs.push((of, index));
                continue;
            }
            records.push(
                serde_json::from_value(value)
                    .with_context(|| format!("invalid change record in {device}/{segment}"))?,
            );
        }
        match ended {
            Some(count) if count as usize == records.len() => Ok(Segment::Complete { records, packs }),
            _ => Ok(Segment::Incomplete),
        }
    }

    /// 从包里取出一个文件放到 `target`(先写临时名,核对指纹再改名)。包还没到本机、
    /// 或内容对不上时返回 false。
    pub fn fetch_blob(&self, location: &BlobLocation, sha256: &str, target: &Path) -> Result<bool> {
        let Some(local) = self.backend.local_copy(&pack_path(&location.device, location.segment))? else {
            return Ok(false);
        };
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let temp = temp_path(target);
        let result = (|| -> Result<bool> {
            let mut pack = File::open(&local)?;
            if pack.metadata()?.len() < location.offset + location.length {
                return Ok(false);
            }
            pack.seek(SeekFrom::Start(location.offset))?;
            let mut input = pack.take(location.length);
            let mut output = File::create(&temp)?;
            let mut hasher = Sha256::new();
            let mut buffer = vec![0u8; 1 << 20];
            loop {
                let read = input.read(&mut buffer)?;
                if read == 0 {
                    break;
                }
                hasher.update(&buffer[..read]);
                output.write_all(&buffer[..read])?;
            }
            output.sync_all()?;
            if hex(&hasher.finalize()) != sha256 {
                return Ok(false);
            }
            fs::rename(&temp, target)?;
            Ok(true)
        })();
        if !matches!(result, Ok(true)) {
            let _ = fs::remove_file(&temp);
        }
        result
    }

    /// 连通性测试:能读、能写、能删。返回往返耗时(毫秒)。
    pub fn probe(&self) -> Result<u64> {
        let started = std::time::Instant::now();
        let name = format!(".probe-{:016x}", fastrand::u64(..));
        self.backend.write_atomic(&name, b"ok")?;
        match self.backend.read(&name)? {
            Fetched::Bytes(bytes) if bytes == b"ok" => {}
            _ => bail!("写进去的测试文件读不回来"),
        }
        self.backend.remove(&name)?;
        Ok(started.elapsed().as_millis() as u64)
    }
}
