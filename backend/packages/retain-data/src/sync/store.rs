//! 同步文件夹的通用读写:格式说明、设备说明、改动记录段、文件包。
//!
//! 「存文件」这一层是 [`Backend`]:本机目录(网盘客户端同步的文件夹,`folder.rs`)或
//! WebDAV(`webdav.rs`)。这里只用相对路径(`/` 分隔、只有 ASCII)跟它说话,布局与格式
//! 只在这里定义一次:
//!
//! ```text
//! format.json                              格式名、版本、文件夹编号
//! devices/<设备号>/device.json             设备说明
//! devices/<设备号>/changes/<段号>.jsonl    改动记录段(写完不再改)
//! devices/<设备号>/packs/<段号>.pack       这一段新增的文件内容,首尾相接
//! ```
//!
//! 一段的最后两行是文件包索引 `{"pack": [[sha256, 偏移, 长度], ...]}`(没有新文件就
//! 没有这一行)和结束标记 `{"segment_end": 条数}`。文件包(每包约 32MB)先于改动记录段写好,所以看得到
//! 段就一定有完整的包;改动记录段先写临时名再改名,看不到写了一半的段;取出的每个文件
//! 都按指纹核对。
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
/// 2:文件内容按段打包(1 是一个文件一个对象,只在开发中用过)。
pub const SYNC_FORMAT_VERSION: u64 = 2;

const SEGMENT_END: &str = "segment_end";
const PACK_INDEX: &str = "pack";

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
        /// (sha256, 偏移, 长度)
        pack: Vec<(String, u64, u64)>,
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

    /// 第一次用时写下格式说明;已有的检查格式与版本。返回文件夹编号:换了同步文件夹
    /// (而不是同一个文件夹换了路径或地址)靠它认出来。
    pub fn ensure(&self) -> Result<String> {
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
                if version < SYNC_FORMAT_VERSION {
                    bail!("同步文件夹是旧的测试格式({version}),请换一个空文件夹");
                }
                value
                    .get("folder_id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .ok_or_else(|| anyhow::anyhow!("{} 的 format.json 缺少 folder_id", self.describe()))
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
                Ok(folder_id)
            }
        }
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
    ) -> Result<(u64, Vec<(String, u64, u64)>)> {
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
        for record in records {
            serde_json::to_writer(&mut bytes, record)?;
            bytes.push(b'\n');
        }
        if !index.is_empty() {
            serde_json::to_writer(&mut bytes, &json!({ PACK_INDEX: index }))?;
            bytes.push(b'\n');
        }
        serde_json::to_writer(&mut bytes, &json!({ SEGMENT_END: records.len() }))?;
        bytes.push(b'\n');
        self.backend.write_atomic(&segment_path(device, segment), &bytes)?;
        Ok((segment, index))
    }

    pub fn read_segment(&self, device: &str, segment: u64) -> Result<Segment> {
        let bytes = match self.backend.read(&segment_path(device, segment))? {
            Fetched::Bytes(bytes) => bytes,
            Fetched::Missing => return Ok(Segment::Missing),
            Fetched::Pending => return Ok(Segment::Incomplete),
        };
        let text = String::from_utf8_lossy(&bytes);
        let mut records = Vec::new();
        let mut pack = Vec::new();
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
                pack = serde_json::from_value(entries.clone())
                    .with_context(|| format!("invalid pack index in {device}/{segment}"))?;
                continue;
            }
            records.push(
                serde_json::from_value(value)
                    .with_context(|| format!("invalid change record in {device}/{segment}"))?,
            );
        }
        match ended {
            Some(count) if count as usize == records.len() => Ok(Segment::Complete { records, pack }),
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
