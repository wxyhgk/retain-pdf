//! 「存文件」的本机目录实现:网盘客户端(iCloud、坚果云、Dropbox…)同步的文件夹。
//!
//! 先写临时名再改名,网盘客户端看不到写了一半的文件。iCloud 把没下载到本机的文件换成
//! `.<名字>.icloud` 占位文件:遇到时请系统下载,这一轮当作还没到。

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use sha2::{Digest, Sha256};

use super::store::{Backend, Fetched};

pub struct FolderBackend {
    root: PathBuf,
}

/// iCloud 的占位文件。
fn placeholder_of(path: &Path) -> PathBuf {
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    path.with_file_name(format!(".{name}.icloud"))
}

/// 请 iCloud 把文件下载下来(macOS;不等它下完,下一轮再看)。
fn request_download(path: &Path) {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("brctl")
            .arg("download")
            .arg(path)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map(|mut child| {
                // 不阻塞同步;子进程自己退出,后台回收。
                std::thread::spawn(move || child.wait());
            });
    }
    #[cfg(not(target_os = "macos"))]
    let _ = path;
}

/// 同目录里的临时名。
pub(super) fn temp_path(target: &Path) -> PathBuf {
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

impl FolderBackend {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    fn path(&self, relative: &str) -> PathBuf {
        relative.split('/').fold(self.root.clone(), |path, part| path.join(part))
    }
}

impl Backend for FolderBackend {
    fn describe(&self) -> String {
        self.root.display().to_string()
    }

    fn read(&self, relative: &str) -> Result<Fetched> {
        let path = self.path(relative);
        match fs::read(&path) {
            Ok(bytes) => Ok(Fetched::Bytes(bytes)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                if placeholder_of(&path).exists() {
                    request_download(&path);
                    return Ok(Fetched::Pending);
                }
                Ok(Fetched::Missing)
            }
            Err(error) => Err(error).with_context(|| format!("failed to read {}", path.display())),
        }
    }

    fn exists(&self, relative: &str) -> Result<bool> {
        let path = self.path(relative);
        Ok(path.exists() || placeholder_of(&path).exists())
    }

    fn write_atomic(&self, relative: &str, bytes: &[u8]) -> Result<()> {
        write_atomic(&self.path(relative), bytes)
    }

    fn upload(&self, relative: &str, source: &Path) -> Result<()> {
        let target = self.path(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let temp = temp_path(&target);
        let result = fs::copy(source, &temp)
            .map(|_| ())
            .and_then(|()| fs::rename(&temp, &target));
        if result.is_err() {
            let _ = fs::remove_file(&temp);
        }
        result.with_context(|| format!("failed to write {}", target.display()))
    }

    fn list(&self, relative: &str) -> Result<Vec<String>> {
        let entries = match fs::read_dir(self.path(relative)) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(error.into()),
        };
        let mut out = Vec::new();
        for entry in entries {
            out.push(entry?.file_name().to_string_lossy().to_string());
        }
        Ok(out)
    }

    fn local_copy(&self, relative: &str) -> Result<Option<PathBuf>> {
        let path = self.path(relative);
        if path.is_file() {
            return Ok(Some(path));
        }
        if placeholder_of(&path).exists() {
            request_download(&path);
        }
        Ok(None)
    }

    fn remove(&self, relative: &str) -> Result<()> {
        match fs::remove_file(self.path(relative)) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}
