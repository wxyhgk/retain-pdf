//! 同步文件夹的读写(布局见 `sync` 模块说明)。

use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use super::ChangeRecord;

pub const SYNC_FORMAT: &str = "retain-pdf-sync";
pub const SYNC_FORMAT_VERSION: u64 = 1;

/// 改动记录段的最后一行。
const SEGMENT_END: &str = "segment_end";

pub struct SyncFolder {
    root: PathBuf,
}

/// 读一个改动记录段的结果。
pub(super) enum Segment {
    /// 完整的一段。
    Complete(Vec<ChangeRecord>),
    /// 文件不存在(还没有这一段)。
    Missing,
    /// 文件在,但还没同步完整(没有结束标记,或 iCloud 只放了占位文件)。
    Incomplete,
}

fn is_device_id(name: &str) -> bool {
    name.len() == 16 && name.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

fn is_sha256(text: &str) -> bool {
    text.len() == 64 && text.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

/// 同目录里先写临时名再改名:别的设备、网盘客户端都看不到写了一半的文件。
fn temp_path(target: &Path) -> PathBuf {
    let name = target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    target.with_file_name(format!(".{name}.tmp-{:016x}", fastrand::u64(..)))
}

pub(super) fn write_atomic(target: &Path, bytes: &[u8]) -> Result<()> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let temp = temp_path(target);
    let result = (|| -> Result<()> {
        let mut file = File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp, target)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result.with_context(|| format!("failed to write {}", target.display()))
}

/// 把 `source` 复制到 `target`(先写临时名),边复制边算指纹;与 `expected` 不符就放弃。
pub(super) fn copy_verified(source: &Path, target: &Path, expected: &str) -> Result<bool> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let temp = temp_path(target);
    let result = (|| -> Result<bool> {
        let mut input = File::open(source)?;
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
        let actual = hex(&hasher.finalize());
        if actual != expected {
            return Ok(false);
        }
        fs::rename(&temp, target)?;
        Ok(true)
    })();
    if !matches!(result, Ok(true)) {
        let _ = fs::remove_file(&temp);
    }
    result.with_context(|| format!("failed to copy {} -> {}", source.display(), target.display()))
}

pub(super) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub(super) fn sha256_file(path: &Path) -> Result<String> {
    let mut file = File::open(path).with_context(|| format!("failed to open {}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex(&hasher.finalize()))
}

impl SyncFolder {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// 第一次用时写下格式说明;已有的检查格式与版本(更新版本的格式不碰)。
    pub fn ensure(&self) -> Result<()> {
        let path = self.root.join("format.json");
        match fs::read(&path) {
            Ok(bytes) => {
                let value: Value = serde_json::from_slice(&bytes)
                    .with_context(|| format!("{} is not a sync folder description", path.display()))?;
                if value.get("format").and_then(Value::as_str) != Some(SYNC_FORMAT) {
                    bail!("{} is not a RetainPDF sync folder", self.root.display());
                }
                let version = value.get("version").and_then(Value::as_u64).unwrap_or(0);
                if version > SYNC_FORMAT_VERSION {
                    bail!(
                        "sync folder format {version} is newer than this version supports ({SYNC_FORMAT_VERSION}); update RetainPDF"
                    );
                }
                Ok(())
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir_all(&self.root)?;
                write_atomic(
                    &path,
                    serde_json::to_vec_pretty(&json!({ "format": SYNC_FORMAT, "version": SYNC_FORMAT_VERSION }))?.as_slice(),
                )
            }
            Err(error) => Err(error.into()),
        }
    }

    pub(super) fn blob_path(&self, sha256: &str) -> PathBuf {
        self.root.join("blobs").join(&sha256[..2]).join(sha256)
    }

    pub(super) fn has_blob(&self, sha256: &str) -> bool {
        is_sha256(sha256) && self.blob_path(sha256).is_file()
    }

    /// 放进一个文件的内容(已有就跳过)。返回是否新写入。
    pub(super) fn put_blob(&self, source: &Path, sha256: &str) -> Result<bool> {
        if !is_sha256(sha256) {
            bail!("invalid content hash {sha256}");
        }
        if self.has_blob(sha256) {
            return Ok(false);
        }
        if !copy_verified(source, &self.blob_path(sha256), sha256)? {
            bail!("{} changed while being copied", source.display());
        }
        Ok(true)
    }

    fn device_dir(&self, device: &str) -> PathBuf {
        self.root.join("devices").join(device)
    }

    fn segment_path(&self, device: &str, segment: u64) -> PathBuf {
        self.device_dir(device)
            .join("changes")
            .join(format!("{segment:08}.jsonl"))
    }

    pub(super) fn ensure_device(&self, device: &str, name: &str) -> Result<()> {
        let path = self.device_dir(device).join("device.json");
        if path.is_file() {
            return Ok(());
        }
        write_atomic(
            &path,
            serde_json::to_vec_pretty(&json!({ "device_id": device, "name": name, "format": SYNC_FORMAT_VERSION }))?.as_slice(),
        )
    }

    /// 同步文件夹里的其它设备。
    pub(super) fn other_devices(&self, me: &str) -> Result<Vec<String>> {
        let dir = self.root.join("devices");
        let mut out = Vec::new();
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(out),
            Err(error) => return Err(error.into()),
        };
        for entry in entries {
            let name = entry?.file_name().to_string_lossy().to_string();
            if is_device_id(&name) && name != me {
                out.push(name);
            }
        }
        out.sort();
        Ok(out)
    }

    /// 写本机的下一段改动记录(段号已被占用就往后找)。返回段号。
    pub(super) fn write_segment(&self, device: &str, after: u64, records: &[ChangeRecord]) -> Result<u64> {
        let mut segment = after + 1;
        while self.segment_path(device, segment).exists() {
            segment += 1;
        }
        let mut bytes = Vec::new();
        for record in records {
            serde_json::to_writer(&mut bytes, record)?;
            bytes.push(b'\n');
        }
        serde_json::to_writer(&mut bytes, &json!({ SEGMENT_END: records.len() }))?;
        bytes.push(b'\n');
        write_atomic(&self.segment_path(device, segment), &bytes)?;
        Ok(segment)
    }

    pub(super) fn read_segment(&self, device: &str, segment: u64) -> Result<Segment> {
        let path = self.segment_path(device, segment);
        let file = match File::open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                // iCloud 把没下载的文件换成 `.<名字>.icloud` 占位文件。
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let placeholder = path.with_file_name(format!(".{name}.icloud"));
                return Ok(if placeholder.exists() { Segment::Incomplete } else { Segment::Missing });
            }
            Err(error) => return Err(error.into()),
        };
        let mut records = Vec::new();
        let mut ended = None;
        for line in BufReader::new(file).lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            if ended.is_some() {
                return Ok(Segment::Incomplete);
            }
            let value: Value = match serde_json::from_str(&line) {
                Ok(value) => value,
                Err(_) => return Ok(Segment::Incomplete),
            };
            if let Some(count) = value.get(SEGMENT_END).and_then(Value::as_u64) {
                ended = Some(count);
                continue;
            }
            records.push(
                serde_json::from_value(value)
                    .with_context(|| format!("invalid change record in {}", path.display()))?,
            );
        }
        match ended {
            Some(count) if count as usize == records.len() => Ok(Segment::Complete(records)),
            _ => Ok(Segment::Incomplete),
        }
    }
}
