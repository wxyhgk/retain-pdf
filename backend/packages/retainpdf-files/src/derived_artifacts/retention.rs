//! 派生缓存的定期回收：Word、对照 PDF、线性化 PDF、页预览这些下载时按需生成、删了下次请求会重新生成的文件。
//!
//! 只认得出名字的才删。任务的 `artifacts/` 里还有管线自己写的东西（`pipeline_summary.json`、渲染预热、
//! 准备阶段的中间文件……），删了就重建不回来，所以不能整个目录清。名字都从 `derived_artifacts.rs` 的
//! 那几个函数来，生成那边改了名字，这里的测试会红。
//!
//! 渲染的准备缓存 `artifacts/render_prepare/` 和预热 `artifacts/render_prewarm/` 也算（2026-10-28 起，用户定的）：
//! 管线按指纹找缓存，找不到就重新准备，下次原地重渲染多算一会儿。按里面每一项（文件或子目录，子目录看里面最新的那个
//! 文件）的修改时间算；预热的清单 `render_source_prewarm_manifest.json` 不删，阅读器的排版接口要读它。
//! 这两个目录可能正被别的任务读（重渲染用的是译文所在任务的目录），调用方对排队、在跑的任务引用着的目录不调。
//!
//! 封面、缩略图不删：每张不大，书库列表一打开就要几十张，删了是成批重渲染。
//! 生成到一半的临时文件（`.<名字>-<随机>.<扩展名>.tmp`）不删：它们名字对不上，生成结束会自己删。
//!
//! 按缓存文件自己的修改时间算：生成以后超过保留天数就删，哪怕这期间一直有人下载。
//! 下载中的文件在 Unix 上删了不影响已经打开的那次读；删不掉的（Windows 上被占用）记进 `failed`，下一轮再试。

use std::path::Path;
use std::time::SystemTime;

/// 书的页预览放在 `documents/<文档>/pages/`，这个目录里只有页预览和它们的记录文件。
pub(crate) const DOCUMENT_PAGES_DIR: &str = "pages";

/// 渲染缓存目录（名字和管线一致：`render/prepare/store.py` 的 `PREPARE_DIR_NAME`、
/// `render/source/prewarm_contracts.py` 的 `RENDER_PREWARM_DIR_NAME`）。
const RENDER_CACHE_DIRS: [&str; 2] = ["render_prepare", "render_prewarm"];
/// 预热清单（`RENDER_PREWARM_MANIFEST_NAME`），阅读器排版接口读它（`progress/live_translation/typography.rs`）。
const RENDER_PREWARM_MANIFEST: &str = "render_source_prewarm_manifest.json";

/// 记录文件：`.<产物名>.inputs.json`（见 `freshness.rs`）。
const RECORD_PREFIX: &str = ".";
const RECORD_SUFFIX: &str = ".inputs.json";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct DerivedCachePruned {
    pub files: usize,
    pub bytes: u64,
    /// 到期了但删不掉的文件数（权限、被占用）。
    pub failed: usize,
}

impl DerivedCachePruned {
    pub fn add(&mut self, other: Self) {
        self.files += other.files;
        self.bytes += other.bytes;
        self.failed += other.failed;
    }
}

/// 任务 `artifacts/` 里的派生缓存是不是这个名字（产物本身或者它的记录文件）。
fn is_job_derived_cache(job_id: &str, name: &str) -> bool {
    let name = record_target(name).unwrap_or(name);
    if name == super::side_by_side_file_name(job_id) {
        return true;
    }
    if name.starts_with(&format!("{job_id}-layout-")) && name.ends_with(".docx") {
        return true;
    }
    if name.ends_with(".linearized.pdf") {
        return true;
    }
    (name.starts_with("preview-source-p") || name.starts_with("preview-translated-p"))
        && name.ends_with(".jpg")
}

fn is_document_page_preview(name: &str) -> bool {
    let name = record_target(name).unwrap_or(name);
    name.starts_with('p') && name.ends_with(".jpg")
}

fn record_target(name: &str) -> Option<&str> {
    name.strip_prefix(RECORD_PREFIX)?.strip_suffix(RECORD_SUFFIX)
}

/// 删掉一个终态任务 `jobs/<任务>/artifacts/` 里修改时间早于 `older_than` 的派生缓存。
/// 只看这一层，不进子目录。调用方负责只给终态任务（排队、在跑的任务可能正要读它们）。
pub fn prune_job_derived_cache(
    data_root: &Path,
    job_id: &str,
    older_than: SystemTime,
) -> DerivedCachePruned {
    if job_id.is_empty() || job_id.contains(['/', '\\']) || job_id.starts_with('.') {
        return DerivedCachePruned::default();
    }
    let dir = data_root.join("jobs").join(job_id).join("artifacts");
    let mut pruned = prune_matching(&dir, older_than, |name| is_job_derived_cache(job_id, name));
    for cache_dir in RENDER_CACHE_DIRS {
        pruned.add(prune_render_cache(&dir.join(cache_dir), older_than));
    }
    pruned
}

/// 渲染缓存目录里修改时间早于 `older_than` 的项（文件，或者里面最新的文件也早于它的子目录），清单除外。
fn prune_render_cache(dir: &Path, older_than: SystemTime) -> DerivedCachePruned {
    let mut pruned = DerivedCachePruned::default();
    let Ok(metadata) = dir.symlink_metadata() else {
        return pruned;
    };
    if !metadata.is_dir() {
        return pruned;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return pruned;
    };
    for entry in entries.flatten() {
        if entry.file_name() == RENDER_PREWARM_MANIFEST {
            continue;
        }
        let path = entry.path();
        let Ok(metadata) = path.symlink_metadata() else {
            continue;
        };
        if metadata.is_dir() {
            let (newest, files, bytes) = newest_file_in(&path);
            if newest.is_some_and(|modified| modified >= older_than) {
                continue;
            }
            match std::fs::remove_dir_all(&path) {
                Ok(()) => {
                    pruned.files += files;
                    pruned.bytes += bytes;
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => pruned.failed += 1,
            }
        } else if metadata.modified().is_ok_and(|modified| modified < older_than) {
            match std::fs::remove_file(&path) {
                Ok(()) => {
                    pruned.files += 1;
                    pruned.bytes += metadata.len();
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => pruned.failed += 1,
            }
        }
    }
    pruned
}

/// 目录里（含子目录，不跟符号链接）最新的文件修改时间、文件数、字节数。没有文件就用目录自己的修改时间
/// （往目录里写文件会改目录的时间，所以有文件时不看它）。
fn newest_file_in(dir: &Path) -> (Option<SystemTime>, usize, u64) {
    let mut newest: Option<SystemTime> = None;
    let (mut files, mut bytes) = (0, 0);
    let mut pending = vec![dir.to_path_buf()];
    while let Some(current) = pending.pop() {
        let Ok(entries) = std::fs::read_dir(&current) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(metadata) = entry.path().symlink_metadata() else {
                continue;
            };
            if metadata.is_dir() {
                pending.push(entry.path());
                continue;
            }
            files += 1;
            bytes += metadata.len();
            if let Ok(modified) = metadata.modified() {
                newest = Some(newest.map_or(modified, |seen| seen.max(modified)));
            }
        }
    }
    if files == 0 {
        newest = dir.symlink_metadata().and_then(|meta| meta.modified()).ok();
    }
    (newest, files, bytes)
}

/// 删掉所有书的 `documents/<文档>/pages/` 里修改时间早于 `older_than` 的页预览。
pub fn prune_document_page_previews(data_root: &Path, older_than: SystemTime) -> DerivedCachePruned {
    let mut pruned = DerivedCachePruned::default();
    let Ok(entries) = std::fs::read_dir(data_root.join("documents")) else {
        return pruned;
    };
    for entry in entries.flatten() {
        let is_dir = entry.file_type().is_ok_and(|kind| kind.is_dir());
        if is_dir {
            let dir = entry.path().join(DOCUMENT_PAGES_DIR);
            pruned.add(prune_matching(&dir, older_than, is_document_page_preview));
        }
    }
    pruned
}

/// 打包下载的 zip（`downloads/<任务>.zip`）每次请求都重新生成（先写临时文件再换名），留着没人用；生成到一半进程被杀
/// 留下的临时文件（`.retain-bundle-<随机>.tmp`）也是。修改时间早于 `older_than` 的删掉：留出余量，不删正要发出去的那个
/// （生成完到打开发送之间有一小段）。
pub fn prune_stale_download_bundles(downloads_dir: &Path, older_than: SystemTime) -> DerivedCachePruned {
    prune_matching(downloads_dir, older_than, |name| {
        name.ends_with(".zip") || (name.starts_with(".retain-bundle-") && name.ends_with(".tmp"))
    })
}

fn prune_matching(
    dir: &Path,
    older_than: SystemTime,
    matches: impl Fn(&str) -> bool,
) -> DerivedCachePruned {
    let mut pruned = DerivedCachePruned::default();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return pruned;
    };
    for entry in entries.flatten() {
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if !matches(&name) {
            continue;
        }
        // 不跟符号链接：只删普通文件本身。
        let Ok(metadata) = entry.path().symlink_metadata() else {
            continue;
        };
        if !metadata.is_file() || metadata.modified().map_or(true, |modified| modified >= older_than) {
            continue;
        }
        match std::fs::remove_file(entry.path()) {
            Ok(()) => {
                pruned.files += 1;
                pruned.bytes += metadata.len();
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => pruned.failed += 1,
        }
    }
    pruned
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::time::Duration;

    use super::*;
    use crate::derived_artifacts::word::LayoutDocxOptions;
    use crate::derived_artifacts::{
        document_page_preview_path, job_page_preview_file_name, layout_docx_file_name,
        linearized_file_name, side_by_side_file_name,
    };
    use retainpdf_core::storage_paths::ARTIFACT_KEY_SOURCE_PDF;

    const JOB: &str = "20261024120000-abcdef";
    const DAY: Duration = Duration::from_secs(24 * 3600);

    fn data_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "retainpdf-cache-retention-{name}-{}",
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(root.join("jobs").join(JOB).join("artifacts")).unwrap();
        root
    }

    fn write_aged(path: &Path, age: Duration) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, b"cache").unwrap();
        std::fs::File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(SystemTime::now() - age)
            .unwrap();
    }

    fn record_of(name: &str) -> String {
        format!("{RECORD_PREFIX}{name}{RECORD_SUFFIX}")
    }

    /// 生成那边真正用的名字（不是这里手写的字面量）。
    fn generated_job_cache_names() -> Vec<String> {
        vec![
            side_by_side_file_name(JOB),
            layout_docx_file_name(JOB, &LayoutDocxOptions::default().cache_suffix()),
            linearized_file_name(ARTIFACT_KEY_SOURCE_PDF),
            linearized_file_name("output"),
            linearized_file_name("side-by-side"),
            job_page_preview_file_name("source", 1, 1200, 0),
            job_page_preview_file_name("translated", 12, 360, 150),
        ]
    }

    #[test]
    fn old_derived_caches_and_their_records_are_removed_and_pipeline_outputs_are_kept() {
        let root = data_root("job");
        let artifacts = root.join("jobs").join(JOB).join("artifacts");
        let mut caches = Vec::new();
        for name in generated_job_cache_names() {
            caches.push(artifacts.join(record_of(&name)));
            caches.push(artifacts.join(name));
        }
        // 渲染缓存：准备的指纹目录、预热的源 PDF 和页图（清单留着，见上面 kept）。
        caches.push(artifacts.join("render_prepare").join("0123abcd").join("source_base").join("base.pdf"));
        caches.push(artifacts.join("render_prewarm").join("source.pdf"));
        caches.push(artifacts.join("render_prewarm").join("preview-source-p0001-w1200-d0.jpg"));
        // 管线写的、重建不回来的，和不删的封面、生成中的临时文件。
        let kept = [
            artifacts.join("pipeline_summary.json"),
            artifacts.join("cover.jpg"),
            artifacts.join("thumbnail.jpg"),
            artifacts.join(".side-by-side-0123456789abcdef.pdf.tmp"),
            artifacts.join("render_prewarm").join(RENDER_PREWARM_MANIFEST),
            artifacts.join("other-job-side-by-side.pdf"),
        ];
        for path in caches.iter().chain(kept.iter()) {
            write_aged(path, 40 * DAY);
        }

        let pruned = prune_job_derived_cache(&root, JOB, SystemTime::now() - 30 * DAY);

        for path in &caches {
            assert!(!path.exists(), "{} 应该删掉", path.display());
        }
        for path in &kept {
            assert!(path.exists(), "{} 不该删", path.display());
        }
        assert_eq!(pruned.files, caches.len());
        assert_eq!(pruned.bytes, 5 * caches.len() as u64);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn old_download_bundles_and_leftover_temporaries_are_removed() {
        let root = data_root("downloads");
        let downloads = root.join("downloads");
        let old_zip = downloads.join(format!("{JOB}.zip"));
        let old_tmp = downloads.join(".retain-bundle-0123456789abcdef0123456789abcdef.tmp");
        let fresh_zip = downloads.join("20261028000000-ffffff.zip");
        let other = downloads.join("notes.txt");
        write_aged(&old_zip, 2 * DAY);
        write_aged(&old_tmp, 2 * DAY);
        write_aged(&fresh_zip, Duration::from_secs(60));
        write_aged(&other, 2 * DAY);

        let pruned = prune_stale_download_bundles(&downloads, SystemTime::now() - DAY);

        assert!(!old_zip.exists());
        assert!(!old_tmp.exists());
        assert!(fresh_zip.exists());
        assert!(other.exists());
        assert_eq!(pruned.files, 2);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn caches_generated_within_the_retention_window_are_kept() {
        let root = data_root("fresh");
        let cache = root
            .join("jobs")
            .join(JOB)
            .join("artifacts")
            .join(side_by_side_file_name(JOB));
        write_aged(&cache, 29 * DAY);
        // 准备缓存的一个指纹目录里只要有一个新文件，整个目录都留着。
        let prepare = root.join("jobs").join(JOB).join("artifacts").join("render_prepare").join("0123abcd");
        write_aged(&prepare.join("old.pdf"), 40 * DAY);
        write_aged(&prepare.join("fresh.json"), DAY);
        let prewarm = root.join("jobs").join(JOB).join("artifacts").join("render_prewarm").join("source.pdf");
        write_aged(&prewarm, DAY);

        let pruned = prune_job_derived_cache(&root, JOB, SystemTime::now() - 30 * DAY);

        assert!(cache.exists());
        assert!(prepare.join("old.pdf").exists());
        assert!(prewarm.exists());
        assert_eq!(pruned, DerivedCachePruned::default());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_symlink_named_like_a_cache_is_not_followed() {
        let root = data_root("symlink");
        let outside = root.join("outside.pdf");
        write_aged(&outside, 40 * DAY);
        let link = root
            .join("jobs")
            .join(JOB)
            .join("artifacts")
            .join(side_by_side_file_name(JOB));
        std::os::unix::fs::symlink(&outside, &link).unwrap();

        let pruned = prune_job_derived_cache(&root, JOB, SystemTime::now() - 30 * DAY);

        assert!(outside.exists());
        assert_eq!(pruned.files, 0);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_job_id_that_is_not_a_plain_name_prunes_nothing() {
        let root = data_root("escape");
        let outside = root.join("artifacts").join(side_by_side_file_name(".."));
        write_aged(&outside, 40 * DAY);

        for job_id in ["..", "../x", "", "a/b"] {
            let pruned = prune_job_derived_cache(&root, job_id, SystemTime::now());
            assert_eq!(pruned.files, 0, "{job_id}");
        }
        assert!(outside.exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn old_document_page_previews_are_removed_and_covers_are_kept() {
        let root = data_root("documents");
        let old_page = document_page_preview_path(&root, "doc-a", 3, 1200, 0).unwrap();
        let old_record = old_page.with_file_name(record_of(old_page.file_name().unwrap().to_str().unwrap()));
        let fresh_page = document_page_preview_path(&root, "doc-b", 1, 1200, 0).unwrap();
        let cover = root.join("documents").join("doc-a").join("cover.jpg");
        let ai_workspace = root.join("documents").join("doc-a").join("ai").join("p0001.jpg");
        write_aged(&old_page, 40 * DAY);
        write_aged(&old_record, 40 * DAY);
        write_aged(&fresh_page, DAY);
        write_aged(&cover, 40 * DAY);
        write_aged(&ai_workspace, 40 * DAY);

        let pruned = prune_document_page_previews(&root, SystemTime::now() - 30 * DAY);

        assert!(!old_page.exists());
        assert!(!old_record.exists());
        assert!(fresh_page.exists());
        assert!(cover.exists());
        assert!(ai_workspace.exists());
        assert_eq!(pruned.files, 2);
        std::fs::remove_dir_all(root).unwrap();
    }
}
