//! 阅读页区块（`reader/regions`）的指纹和内存缓存（2026-11-03）。
//!
//! 大书每次都要把规范化文档和每页译文整个解析一遍（726 页的书两份加起来 145MB，release 下约 0.7 秒），
//! 结果却只在这些文件变了时才变。指纹只看文件的大小和修改时间（不读内容，几毫秒）：规范化文档、翻译清单所在
//! 目录里的每个文件、OCR 图片目录，再加上任务编号、这些文件的路径和本程序自己（换了版本，返回的样子可能变）。
//! 路由拿指纹当 ETag，浏览器带着它再来、文件没变就回 304；内存里留最近几本，引用单个区块时也不用重算整本。

use std::collections::VecDeque;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;

use sha2::{Digest, Sha256};

use retainpdf_core::models::domain::JobSnapshot;

use crate::views::ReaderRegionsView;
use crate::{stored_path, StoredFile};

/// 内存里最多留几本（726 页的书约十几 MB）。
const CACHED_VIEWS: usize = 4;

struct CachedView {
    key: String,
    fingerprint: String,
    view: ReaderRegionsView,
}

fn cache() -> &'static Mutex<VecDeque<CachedView>> {
    static CACHE: OnceLock<Mutex<VecDeque<CachedView>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(VecDeque::new()))
}

fn cache_key(data_root: &Path, job: &JobSnapshot) -> String {
    format!("{}\u{0}{}", data_root.display(), job.job_id)
}

/// 区块数据的指纹：输入文件没变就不变。
pub(crate) fn regions_fingerprint(data_root: &Path, job: &JobSnapshot) -> String {
    let mut hasher = Sha256::new();
    hasher.update(job.job_id.as_bytes());
    hasher.update(program_identity().as_bytes());
    let normalized = stored_path(job, data_root, StoredFile::NormalizedDocument);
    hash_entry(&mut hasher, "normalized", normalized.as_deref());
    let manifest = stored_path(job, data_root, StoredFile::TranslationManifest);
    hash_entry(&mut hasher, "manifest", manifest.as_deref());
    // 每页译文和清单在同一个目录里；清单不变、某页重译了也要变。
    if let Some(dir) = manifest.as_deref().and_then(Path::parent) {
        let mut names: Vec<_> = std::fs::read_dir(dir)
            .map(|entries| entries.filter_map(Result::ok).map(|entry| entry.path()).collect())
            .unwrap_or_default();
        names.sort();
        for path in names {
            hash_entry(&mut hasher, "translated", Some(&path));
        }
    }
    let images = stored_path(job, data_root, StoredFile::OcrImagesDir);
    hash_entry(&mut hasher, "images", images.as_deref());
    hasher
        .finalize()
        .iter()
        .take(16)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn hash_entry(hasher: &mut Sha256, label: &str, path: Option<&Path>) {
    hasher.update(label.as_bytes());
    let Some(path) = path else {
        hasher.update(b"\x00none");
        return;
    };
    hasher.update(path.to_string_lossy().as_bytes());
    hasher.update(file_stamp(path).as_bytes());
}

fn file_stamp(path: &Path) -> String {
    match std::fs::metadata(path) {
        Ok(meta) => {
            let modified = meta
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|value| value.as_nanos())
                .unwrap_or_default();
            format!("\x00{}:{modified}", meta.len())
        }
        Err(_) => "\x00missing".to_string(),
    }
}

/// 本程序的身份（可执行文件的大小和修改时间）：重新编译、升级以后旧的 ETag 一律作废。
fn program_identity() -> &'static str {
    static IDENTITY: OnceLock<String> = OnceLock::new();
    IDENTITY.get_or_init(|| {
        std::env::current_exe()
            .map(|path| file_stamp(&path))
            .unwrap_or_default()
    })
}

pub(crate) fn cached_view(data_root: &Path, job: &JobSnapshot, fingerprint: &str) -> Option<ReaderRegionsView> {
    let key = cache_key(data_root, job);
    let cache = cache().lock().ok()?;
    cache
        .iter()
        .find(|entry| entry.key == key && entry.fingerprint == fingerprint)
        .map(|entry| entry.view.clone())
}

pub(crate) fn store_view(data_root: &Path, job: &JobSnapshot, fingerprint: &str, view: &ReaderRegionsView) {
    let key = cache_key(data_root, job);
    let Ok(mut cache) = cache().lock() else {
        return;
    };
    cache.retain(|entry| entry.key != key);
    cache.push_front(CachedView {
        key,
        fingerprint: fingerprint.to_string(),
        view: view.clone(),
    });
    cache.truncate(CACHED_VIEWS);
}
