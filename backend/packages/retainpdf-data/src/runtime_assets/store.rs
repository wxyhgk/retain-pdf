//! 本机这边：缓存目录、下好的记录（current.json，Python 读）、进度（progress.json，接口读）、
//! 下载锁（rust_api 和 retain-jobsd 是两个进程，同一时间只让一个下），包里是不是已经带了。

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::manifest::AssetSpec;

pub(crate) const ROOT_DIR_NAME: &str = "runtime-assets";
const CURRENT_FILE: &str = "current.json";
const PROGRESS_FILE: &str = "progress.json";
const LOCK_FILE: &str = ".download.lock";
/// 下载中的进程每收到一段就改一次进度文件；进度文件这么久没动、锁还在，当成那个进程已经没了。
pub(crate) const STALE_AFTER: Duration = Duration::from_secs(120);

pub(crate) fn root(data_root: &Path) -> PathBuf {
    data_root.join(ROOT_DIR_NAME)
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub(crate) struct CurrentEntry {
    pub version: String,
    pub dir: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bin: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct CurrentFile {
    #[serde(default)]
    schema: String,
    #[serde(default)]
    assets: BTreeMap<String, CurrentEntry>,
}

pub(crate) fn read_current(data_root: &Path) -> BTreeMap<String, CurrentEntry> {
    std::fs::read_to_string(root(data_root).join(CURRENT_FILE))
        .ok()
        .and_then(|text| serde_json::from_str::<CurrentFile>(&text).ok())
        .map(|file| file.assets)
        .unwrap_or_default()
}

/// 记下这份资源下好了（先写临时文件再改名，读的人不会读到半份）。
pub(crate) fn record_current(data_root: &Path, id: &str, entry: CurrentEntry) -> Result<()> {
    let mut assets = read_current(data_root);
    assets.insert(id.to_string(), entry);
    let file = CurrentFile { schema: "runtime_assets.current.v1".into(), assets };
    write_atomically(&root(data_root).join(CURRENT_FILE), &serde_json::to_vec_pretty(&file)?)
}

/// 下好的这份还在不在、是不是清单这个版本：目录在、清单列的文件都在且大小对得上。
pub(crate) fn installed_dir(data_root: &Path, spec: &AssetSpec) -> Option<PathBuf> {
    let entry = read_current(data_root).remove(spec.id)?;
    if entry.version != spec.version || entry.dir != format!("{}/{}", spec.id, spec.dir_name) {
        return None;
    }
    let dir = root(data_root).join(&entry.dir);
    let complete = spec.package.files.iter().all(|file| {
        std::fs::metadata(dir.join(&file.path)).map(|meta| meta.len() == file.size).unwrap_or(false)
    });
    complete.then_some(dir)
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct AssetProgress {
    /// `downloading`、`failed`；下好了就从进度里去掉（看 current.json）。
    pub state: String,
    pub bytes_done: u64,
    pub bytes_total: u64,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub error: String,
    #[serde(default)]
    pub updated_at: String,
}

pub(crate) fn read_progress(data_root: &Path) -> BTreeMap<String, AssetProgress> {
    std::fs::read_to_string(root(data_root).join(PROGRESS_FILE))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub(crate) fn write_progress(data_root: &Path, id: &str, progress: Option<AssetProgress>) -> Result<()> {
    let mut all = read_progress(data_root);
    match progress {
        Some(progress) => {
            all.insert(id.to_string(), progress);
        }
        None => {
            all.remove(id);
        }
    }
    write_atomically(&root(data_root).join(PROGRESS_FILE), &serde_json::to_vec_pretty(&all)?)
}

fn write_atomically(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().context("runtime assets path has no parent")?;
    std::fs::create_dir_all(parent)?;
    let temp = parent.join(format!(".{}.{:016x}.tmp", path.file_name().unwrap_or_default().to_string_lossy(), fastrand::u64(..)));
    std::fs::write(&temp, bytes)?;
    std::fs::rename(&temp, path)?;
    Ok(())
}

/// 下载锁：拿到了返回 Some，放下时删掉锁文件。锁在、但进度文件很久没动（下载的进程没了），收回来再拿。
pub(crate) struct DownloadLock {
    path: PathBuf,
}

impl Drop for DownloadLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

pub(crate) fn try_lock(data_root: &Path) -> Result<Option<DownloadLock>> {
    let dir = root(data_root);
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(LOCK_FILE);
    for _ in 0..2 {
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(_) => return Ok(Some(DownloadLock { path })),
            Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {
                if lock_is_stale(data_root) {
                    let _ = std::fs::remove_file(&path);
                    continue;
                }
                return Ok(None);
            }
            Err(err) => return Err(err.into()),
        }
    }
    Ok(None)
}

pub(crate) fn lock_held(data_root: &Path) -> bool {
    root(data_root).join(LOCK_FILE).exists() && !lock_is_stale(data_root)
}

fn lock_is_stale(data_root: &Path) -> bool {
    let dir = root(data_root);
    let newest = [dir.join(LOCK_FILE), dir.join(PROGRESS_FILE)]
        .iter()
        .filter_map(|path| std::fs::metadata(path).and_then(|meta| meta.modified()).ok())
        .max();
    match newest {
        Some(time) => SystemTime::now().duration_since(time).map(|age| age > STALE_AFTER).unwrap_or(false),
        None => true,
    }
}

/// 旧版本的目录（清单升级后留下的）删掉，只留现在这一份。
pub(crate) fn remove_other_versions(data_root: &Path, spec: &AssetSpec) {
    let dir = root(data_root).join(spec.id);
    let Ok(entries) = std::fs::read_dir(&dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name != spec.dir_name {
            let _ = std::fs::remove_dir_all(entry.path());
        }
    }
}

/// 包里（或环境变量指定的地方）已经带着这份资源，就不用下：Docker 镜像、开发环境、还带着字体的旧安装包。
pub(crate) fn bundled_elsewhere(spec: &AssetSpec, project_root: Option<&Path>) -> bool {
    match spec.id {
        "fonts" => bundled_fonts(spec, project_root),
        "typst" => bundled_typst(),
        _ => false,
    }
}

fn bundled_fonts(spec: &AssetSpec, project_root: Option<&Path>) -> bool {
    let Some(probe) = spec.package.files.iter().find(|file| file.path.ends_with(".otf") || file.path.ends_with(".ttf")) else {
        return false;
    };
    if let Ok(path) = std::env::var("RETAIN_PDF_FONT_PATH") {
        if Path::new(path.trim()).file_name() == Path::new(&probe.path).file_name() && Path::new(path.trim()).is_file() {
            return true;
        }
    }
    let mut dirs: Vec<PathBuf> = Vec::new();
    for name in ["RETAIN_PDF_FONTS_DIR", "RETAIN_PDF_TYPST_FONT_DIRS"] {
        if let Ok(raw) = std::env::var(name) {
            let separator = if cfg!(windows) { ';' } else { ':' };
            dirs.extend(
                raw.split([',', separator])
                    .map(str::trim)
                    .filter(|part| !part.is_empty())
                    .map(PathBuf::from),
            );
        }
    }
    if let Some(project_root) = project_root {
        for relative in ["fonts", "resources/fonts", "infra/fonts"] {
            dirs.push(project_root.join(relative));
        }
    }
    dirs.iter().any(|dir| dir.join(&probe.path).is_file())
}

fn bundled_typst() -> bool {
    if let Ok(path) = std::env::var("TYPST_BIN") {
        let path = path.trim();
        if !path.is_empty() && Path::new(path).is_file() {
            return true;
        }
    }
    let name = if cfg!(windows) { "typst.exe" } else { "typst" };
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|dir| dir.join(name).is_file()))
        .unwrap_or(false)
}
