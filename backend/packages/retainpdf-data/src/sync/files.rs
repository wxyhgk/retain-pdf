//! 一个实体带哪些文件,以及把收到的文件放回数据目录。
//!
//! 路径一律相对数据目录、用 `/` 分隔。收到的路径先检查:不能是绝对路径、不能有 `..`,
//! 只能落在下面几个目录里——同步文件夹里的内容不能让本机写到数据目录以外,也不能碰
//! 数据库与凭据。

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use anyhow::{bail, Result};
use serde_json::Value;

use super::engine::DATA_ROOT_TOKEN;
use super::folder::sha256_file;
use super::SyncFileEntry;
use crate::db::sync::SyncRows;
use crate::db::Db;

/// 收到的文件只能放在这些目录下。
const SYNCED_ROOTS: &[&str] = &[
    "jobs",
    "uploads",
    "documents",
    "assets",
    "agent-calculations",
    "operations",
];

/// 任务目录里不带的东西(相对任务目录):渲染中间文件与可随时重新生成的下载。
/// 登记成产物的单个文件不受此限(比如 Typst 叠加层 PDF)。
const JOB_EXCLUDED_PREFIXES: &[&str] = &[
    "artifacts/render_prewarm/",
    "artifacts/render_prepare/",
    "rendered/typst/",
    "rendered/docx/",
];

/// 排除目录里仍要带上的文件:阅读页的实时译文布局读它(排版后的文字块框与字号)。
const JOB_KEPT_IN_EXCLUDED: &[&str] = &["artifacts/render_prewarm/render_source_prewarm_manifest.json"];

fn excluded_in_job(relative: &str) -> bool {
    if JOB_KEPT_IN_EXCLUDED.contains(&relative) {
        return false;
    }
    if JOB_EXCLUDED_PREFIXES.iter().any(|prefix| relative.starts_with(prefix)) {
        return true;
    }
    let name = relative.rsplit('/').next().unwrap_or(relative);
    if name.starts_with('.') && (name.contains(".tmp") || name.ends_with(".lock")) {
        return true;
    }
    if name.ends_with(".docx") || name.ends_with(".tmp") || name.ends_with(".part") {
        return true;
    }
    // rendered/ 下直接放的 zip 是打包下载(rendered/<job>.zip)。
    relative.starts_with("rendered/") && relative.matches('/').count() == 1 && name.ends_with(".zip")
}

#[cfg(test)]
thread_local! {
    /// 测试里扮演旧版本设备（书的同步实体连缓存一起发）。只影响本线程，引擎在调用线程里同步跑。
    pub(super) static LEGACY_SENDS_DOCUMENT_CACHES: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

/// 书目录里不带的东西（相对 `documents/<书>/`，2026-11-26 S52）：本机能重建的缓存。合并阅读 `merged/`
/// （目录名是本机算的指纹，带本机路径和文件时间，别的设备用不上；整本合并 PDF + 译文很大）、页预览 `pages/`。
/// 封面、缩略图照旧带上（书架要用、很小）。书目录里现在没有用户写的东西。
const DOCUMENT_EXCLUDED_PREFIXES: &[&str] = &["merged/", "pages/"];

fn excluded_in_document(relative: &str) -> bool {
    if DOCUMENT_EXCLUDED_PREFIXES.iter().any(|prefix| relative.starts_with(prefix)) {
        return true;
    }
    let name = relative.rsplit('/').next().unwrap_or(relative);
    (name.starts_with('.') && (name.contains(".tmp") || name.ends_with(".lock")))
        || name.ends_with(".tmp")
        || name.ends_with(".part")
}

/// 收到的文件清单里只该留在本机的（旧版本设备还会把书的缓存一起发来）：不写进本机，本机同名的也不按
/// 清单删——本机的合并目录少了文件、目录还在，阅读会把它当成完整的。
pub(super) fn local_only_file(kind: &str, key: &str, path: &str) -> bool {
    match kind {
        "document" => path
            .strip_prefix("documents/")
            .and_then(|rest| rest.strip_prefix(key))
            .and_then(|rest| rest.strip_prefix('/'))
            .is_some_and(excluded_in_document),
        _ => false,
    }
}

/// 检查并转换收到的相对路径。
pub(super) fn checked_relative(path: &str) -> Result<PathBuf> {
    let candidate = Path::new(path);
    let mut out = PathBuf::new();
    for component in candidate.components() {
        match component {
            Component::Normal(part) => out.push(part),
            _ => bail!("refusing sync path {path}"),
        }
    }
    let first = out
        .components()
        .next()
        .map(|c| c.as_os_str().to_string_lossy().to_string())
        .unwrap_or_default();
    if !SYNCED_ROOTS.contains(&first.as_str()) || out.components().count() < 2 {
        bail!("refusing sync path {path}");
    }
    Ok(out)
}

fn relative_string(data_root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(data_root).ok()?;
    let parts: Vec<String> = relative
        .components()
        .map(|c| match c {
            Component::Normal(part) => Some(part.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Option<_>>()?;
    (!parts.is_empty()).then(|| parts.join("/"))
}

/// 数据库里记的路径(相对数据目录,或旧记录里的绝对路径;发出前已换成 `{{data_root}}/…`)
/// -> 数据目录下的绝对路径。
fn resolve_stored(data_root: &Path, stored: &str) -> Option<PathBuf> {
    let stored = stored
        .strip_prefix(DATA_ROOT_TOKEN)
        .map(|rest| rest.trim_start_matches('/'))
        .unwrap_or(stored);
    let path = Path::new(stored);
    if path.components().any(|c| matches!(c, Component::ParentDir)) {
        return None;
    }
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        data_root.join(path)
    };
    absolute.starts_with(data_root).then_some(absolute)
}

/// 收到的行里记文件路径的列：(表, 列)。下载、阅读、续跑都按这些列去读文件。
const PATH_COLUMNS: &[(&str, &str)] = &[
    ("uploads", "stored_path"),
    ("job_artifact_entries", "relative_path"),
];

/// 发出前数据目录下的路径都换成了 `{{data_root}}/…` 或本来就是相对路径；剩下的绝对路径、带 `..` 的路径
/// 都指向数据目录以外。
fn portable_path_is_confined(stored: &str) -> bool {
    let rest = match stored.strip_prefix(DATA_ROOT_TOKEN) {
        Some(rest) => rest.trim_start_matches('/'),
        None => stored,
    };
    let rest = rest.replace('\\', "/");
    let bytes = rest.as_bytes();
    let drive_letter = bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':';
    !drive_letter
        && Path::new(&rest)
            .components()
            .all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

fn first_unconfined_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) if text.contains('/') || text.contains('\\') => {
            (!portable_path_is_confined(text)).then(|| text.clone())
        }
        Value::Array(items) => items.iter().find_map(first_unconfined_string),
        Value::Object(map) => map.values().find_map(first_unconfined_string),
        _ => None,
    }
}

/// 别的设备发来的行（可移植形式）里，有没有指向数据目录以外的文件路径。有就返回"表.列: 路径"。
/// WebDAV 可能是共享账号：不能让对方写进来的一行把下载接口指到本机任意文件上。
/// 产物清单 `artifacts.artifacts_json` 里的字段多，凡是带 `/` 的字符串都按路径查（编号、时间、状态里没有 `/`）。
pub(super) fn path_outside_data_root(rows: &SyncRows) -> Option<String> {
    for (table, column) in PATH_COLUMNS {
        for row in rows.get(*table).map(Vec::as_slice).unwrap_or(&[]) {
            if let Some(stored) = row.get(*column).and_then(Value::as_str) {
                if !portable_path_is_confined(stored) {
                    return Some(format!("{table}.{column}: {stored}"));
                }
            }
        }
    }
    for row in rows.get("artifacts").map(Vec::as_slice).unwrap_or(&[]) {
        let Some(raw) = row.get("artifacts_json").and_then(Value::as_str) else {
            continue;
        };
        let Ok(parsed) = serde_json::from_str::<Value>(raw) else {
            return Some("artifacts.artifacts_json: not JSON".to_string());
        };
        if let Some(stored) = first_unconfined_string(&parsed) {
            return Some(format!("artifacts.artifacts_json: {stored}"));
        }
    }
    None
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };
    for entry in entries {
        let entry = entry?;
        let kind = entry.file_type()?;
        if kind.is_dir() {
            walk(&entry.path(), out)?;
        } else if kind.is_file() {
            out.push(entry.path());
        }
    }
    Ok(())
}

/// `path` 相对 `dir` 的路径（`/` 分隔）；不在 `dir` 下为 None。
fn relative_in(dir: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(dir).ok().map(|p| {
        p.components()
            .map(|c| c.as_os_str().to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join("/")
    })
}

fn text<'a>(rows: &'a SyncRows, table: &str, column: &str) -> Option<&'a str> {
    rows.get(table)?.first()?.get(column)?.as_str()
}

/// 一个实体现在在磁盘上的文件(绝对路径,排好序、去重)。
pub(super) fn entity_files(data_root: &Path, kind: &str, key: &str, rows: &SyncRows) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    match kind {
        "upload" => {
            if let Some(path) = text(rows, "uploads", "stored_path").and_then(|p| resolve_stored(data_root, p)) {
                if path.is_file() {
                    out.push(path);
                }
            }
        }
        "document" => {
            let dir = data_root.join("documents").join(key);
            let mut found = Vec::new();
            walk(&dir, &mut found)?;
            #[cfg(test)]
            let legacy = LEGACY_SENDS_DOCUMENT_CACHES.with(std::cell::Cell::get);
            #[cfg(not(test))]
            let legacy = false;
            out.extend(found.into_iter().filter(|path| {
                legacy || !relative_in(&dir, path).is_some_and(|relative| excluded_in_document(&relative))
            }));
        }
        "job" => {
            let job_dir = data_root.join("jobs").join(key);
            let mut found = Vec::new();
            walk(&job_dir, &mut found)?;
            let mut registered_dirs = Vec::new();
            for entry in rows.get("job_artifact_entries").map(Vec::as_slice).unwrap_or(&[]) {
                if entry.get("ready").and_then(Value::as_i64) != Some(1) {
                    continue;
                }
                let Some(path) = entry
                    .get("relative_path")
                    .and_then(Value::as_str)
                    .and_then(|p| resolve_stored(data_root, p))
                else {
                    continue;
                };
                if path.is_file() {
                    // 登记成产物的文件总是带上(可能在任务目录外,比如续跑引用的原任务文件)。
                    out.push(path);
                } else if path.is_dir() && path != job_dir && !path.starts_with(&job_dir) {
                    registered_dirs.push(path);
                }
            }
            for dir in registered_dirs {
                walk(&dir, &mut found)?;
            }
            for path in found {
                match relative_in(&job_dir, &path) {
                    Some(relative) if excluded_in_job(&relative) => {}
                    _ => out.push(path),
                }
            }
        }
        _ => {}
    }
    out.retain(|path| relative_string(data_root, path).is_some_and(|p| checked_relative(&p).is_ok()));
    out.sort();
    out.dedup();
    Ok(out)
}

fn mtime_ns(meta: &fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_nanos() as i64)
        .unwrap_or(0)
}

/// 文件的指纹(大小与修改时间没变就用缓存)。
pub(super) fn file_hash(db: &Db, data_root: &Path, path: &Path) -> Result<Option<SyncFileEntry>> {
    let Some(relative) = relative_string(data_root, path) else {
        return Ok(None);
    };
    let meta = match fs::metadata(path) {
        Ok(meta) if meta.is_file() => meta,
        _ => return Ok(None),
    };
    let (size, mtime) = (meta.len(), mtime_ns(&meta));
    let sha256 = match db.sync_cached_hash(&relative, size, mtime)? {
        Some(sha256) => sha256,
        None => {
            let sha256 = sha256_file(path)?;
            db.sync_cache_hash(&relative, size, mtime, &sha256)?;
            sha256
        }
    };
    Ok(Some(SyncFileEntry {
        path: relative,
        sha256,
        size,
    }))
}

/// 本机这个路径上的文件是否已经是这份内容。
pub(super) fn has_content(db: &Db, data_root: &Path, entry: &SyncFileEntry) -> Result<bool> {
    let path = data_root.join(checked_relative(&entry.path)?);
    Ok(file_hash(db, data_root, &path)?.is_some_and(|local| local.sha256 == entry.sha256))
}

/// 删掉文件后,顺手删掉因此变空的上级目录(到 SYNCED_ROOTS 那一层为止)。
pub(super) fn remove_file(data_root: &Path, relative: &str) -> Result<()> {
    let path = data_root.join(checked_relative(relative)?);
    match fs::remove_file(&path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.into()),
    }
    let mut dir = path.parent().map(Path::to_path_buf);
    while let Some(current) = dir {
        let depth = current.strip_prefix(data_root).map(|p| p.components().count()).unwrap_or(0);
        if depth < 2 || fs::remove_dir(&current).is_err() {
            break;
        }
        dir = current.parent().map(Path::to_path_buf);
    }
    Ok(())
}
