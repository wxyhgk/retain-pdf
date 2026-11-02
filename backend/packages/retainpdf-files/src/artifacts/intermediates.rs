//! 成功任务目录里的纯重复文件：别处已经有一份、或者再也没人读，删了没有任何功能受影响。用户 2026-10-28 定的：成功以后就删。
//!
//! - OCR 厂商的原始压缩包（`provider_zip`，诊断里的 `provider_bundle_zip`）：解开以后就没人读了。文件列表里它是只给
//!   管理员看的 `ocr-provider/raw.zip`，列表的"有没有、多大"是存任务时记进库的，所以删了以后调用方要用
//!   [`clear_pruned_record_fields`] 把字段清掉再存一次。
//! - MinerU 解包目录（`provider_raw_dir`，`ocr/unpacked/`）里布局以外的东西：原 PDF 副本（`source/` 里有一份）、Markdown 和
//!   图片（`md/` 里有一份，阅读器只读 `md/`）、中间 JSON（规范化以后不再读）。要 `md/full.md` 在才删；任务记录里任何字段
//!   指着的文件（布局 `layout_json` 就在这里面，复用 OCR、续跑都要它）都留着。别的厂商的原始目录不动。
//! - 译文 PDF 旁边的打包副本 `<任务>.zip`：没有任何地方读，现在也不写了，删掉以前留下的。
//! - 重渲染成功以后的上一份译文（`*.previous.pdf`）：只在排队期间和这次失败时用，成功了就不再读。调用方清掉
//!   `previous_output_pdf`、`previous_finished_at`。
//! - rpr_fit 引擎的工作目录（`rendered/typst/rpr-fit-engine/`：引擎输入、版面 JSON、底图子集、叠加层）：只有渲染器自己读，
//!   每次渲染前清空重建（2026-11-02 加，481 页的书一份 49MB）。
//! - OCR 一片片公布时写的整份文档（`ocr/stream/document.v1.json`）：OCR 收尾时和规范化文档（`ocr/normalized/document.v1.json`）
//!   逐字节相同，是第二份完整拷贝（620 页的书 61MB）。翻译重跑可能还按 `ocr/stream/` 的清单读它，所以不删，内容相同时换成
//!   指向规范化文档的硬链接（只在 Unix 上：要靠 inode 认出已经链过，不然每轮都要把两份整个比一遍）。
//!
//! 调用方负责只给成功的任务，而且这个任务目录没被排队、在跑的任务引用（[`job_dirs_referenced_by`]：OCR 子任务、
//! 复用 OCR 或译文的任务都会指进别人的目录）。这里只删任务自己目录（`jobs/<任务>/`）里的东西，路径指到外面的不碰；
//! 不跟符号链接。

use std::collections::BTreeSet;
use std::path::{Component, Path, PathBuf};

use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_core::models::OcrProviderKind;
use retainpdf_core::storage_paths::{
    is_previous_output_pdf, resolve_data_path, resolve_markdown_path, resolve_output_pdf,
};
use retainpdf_data::ocr_provider::provider_artifact_layout;
use walkdir::WalkDir;

const JOBS_DIR: &str = "jobs";
/// 相对译文 PDF 所在目录（`rendered/`）。
const RPR_FIT_ENGINE_DIR: &str = "typst/rpr-fit-engine";
/// 相对 OCR 目录（规范化文档上两级）。
const OCR_STREAM_DOCUMENT: &str = "stream/document.v1.json";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct IntermediatesPruned {
    pub files: usize,
    pub bytes: u64,
    /// 该删但删不掉的文件数（权限、被占用），下一轮再试。
    pub failed: usize,
}

impl IntermediatesPruned {
    pub fn add(&mut self, other: Self) {
        self.files += other.files;
        self.bytes += other.bytes;
        self.failed += other.failed;
    }
}

/// 删掉一个成功任务目录里的纯重复文件（见模块说明）。调用方之后对这个任务（和它的 OCR 子任务）调
/// [`clear_pruned_record_fields`]，有改动就存回去。
pub fn prune_succeeded_job_intermediates(data_root: &Path, job: &JobSnapshot) -> IntermediatesPruned {
    let mut pruned = IntermediatesPruned::default();
    let Some(job_root) = own_job_root(data_root, &job.job_id) else {
        return pruned;
    };
    let Some(artifacts) = job.artifacts.as_ref() else {
        return pruned;
    };
    let inside = |raw: Option<&str>| {
        raw.and_then(|raw| resolve_data_path(data_root, raw).ok())
            .filter(|path| path.starts_with(&job_root))
    };

    for zip in provider_zip_paths(job).into_iter().filter_map(|raw| inside(Some(raw))) {
        remove_file(&zip, &mut pruned);
    }

    if let Some(raw_dir) = inside(artifacts.provider_raw_dir.as_deref()) {
        let is_mineru_dir = provider_artifact_layout(&OcrProviderKind::Mineru)
            .is_some_and(|layout| raw_dir.file_name() == Some(layout.provider_raw_dir.as_ref()));
        if is_mineru_dir && resolve_markdown_path(job, data_root).is_some() {
            let kept: Vec<PathBuf> = recorded_paths(job)
                .into_iter()
                .filter_map(|raw| resolve_data_path(data_root, raw).ok())
                .filter(|path| path.starts_with(&raw_dir) && path != &raw_dir)
                .collect();
            prune_dir_except(&raw_dir, &kept, &mut pruned);
        }
    }

    let output_pdf = resolve_output_pdf(job, data_root).filter(|path| path.is_file());
    if let Some(bundle_copy) = output_pdf
        .as_deref()
        .and_then(Path::parent)
        .map(|dir| dir.join(format!("{}.zip", job.job_id)))
        .filter(|path| path.starts_with(&job_root))
    {
        remove_file(&bundle_copy, &mut pruned);
    }

    if let Some(engine_dir) = output_pdf
        .as_deref()
        .and_then(Path::parent)
        .map(|dir| dir.join(RPR_FIT_ENGINE_DIR))
        .filter(|path| path.starts_with(&job_root))
    {
        remove_dir(&engine_dir, &mut pruned);
    }

    if let Some(normalized) = inside(artifacts.normalized_document_json.as_deref()) {
        if let Some(stream_copy) = normalized
            .parent()
            .and_then(Path::parent)
            .map(|ocr_dir| ocr_dir.join(OCR_STREAM_DOCUMENT))
            .filter(|path| path.starts_with(&job_root))
        {
            link_identical_copy(&stream_copy, &normalized, &mut pruned);
        }
    }

    if let (Some(output_pdf), Some(previous)) =
        (output_pdf.as_deref(), inside(artifacts.previous_output_pdf.as_deref()))
    {
        // 重渲染失败接回来的任务 `output_pdf` 就是这个文件；`output_pdf` 不在了可能是正好又开了一次重渲染，刚挪过去。
        if is_previous_output_pdf(&previous) && previous != output_pdf && output_pdf.is_file() {
            remove_file(&previous, &mut pruned);
        }
    }
    pruned
}

/// 记录里指向已经删掉（或早就不在了）的原始压缩包、上一份译文的字段清掉，返回改了没有。
/// 只看任务自己目录里的路径：指到别人目录的不归这里管。
pub fn clear_pruned_record_fields(data_root: &Path, job: &mut JobSnapshot) -> bool {
    let Some(job_root) = job_root_of_record(data_root, job) else {
        return false;
    };
    let Some(artifacts) = job.artifacts.as_mut() else {
        return false;
    };
    let gone = |raw: &Option<String>| {
        raw.as_deref()
            .and_then(|raw| resolve_data_path(data_root, raw).ok())
            .is_some_and(|path| path.starts_with(&job_root) && !path.exists())
    };
    let mut changed = false;
    if gone(&artifacts.provider_zip) {
        artifacts.provider_zip = None;
        changed = true;
    }
    if let Some(diagnostics) = artifacts.ocr_provider_diagnostics.as_mut() {
        if gone(&diagnostics.artifacts.provider_bundle_zip) {
            diagnostics.artifacts.provider_bundle_zip = None;
            changed = true;
        }
    }
    if gone(&artifacts.previous_output_pdf) {
        artifacts.previous_output_pdf = None;
        artifacts.previous_finished_at = None;
        changed = true;
    }
    changed
}

/// 这个任务的记录（和请求）指着哪些任务目录：它自己的、它从哪个任务复用 OCR 或译文的、各个产物路径落在的。
/// 清理前对排队、在跑的任务调，结果里的目录这一轮不碰。
pub fn job_dirs_referenced_by(data_root: &Path, job: &JobSnapshot) -> BTreeSet<String> {
    let mut dirs = BTreeSet::from([job.job_id.clone()]);
    if let Some(source) = job.source_job_id() {
        dirs.insert(source.to_string());
    }
    if let Some(ocr_job_id) = job.artifacts.as_ref().and_then(|a| a.ocr_job_id.as_deref()) {
        dirs.insert(ocr_job_id.to_string());
    }
    let jobs_root = data_root.join(JOBS_DIR);
    let jobs_root_resolved = std::fs::canonicalize(&jobs_root).unwrap_or_else(|_| jobs_root.clone());
    for raw in recorded_paths(job) {
        let Ok(path) = resolve_data_path(data_root, raw) else {
            continue;
        };
        let relative = path
            .strip_prefix(&jobs_root)
            .or_else(|_| path.strip_prefix(&jobs_root_resolved))
            .ok();
        if let Some(Component::Normal(dir)) = relative.and_then(|rest| rest.components().next()) {
            dirs.insert(dir.to_string_lossy().into_owned());
        }
    }
    dirs
}

/// 记录里所有存路径的字段。
fn recorded_paths(job: &JobSnapshot) -> Vec<&str> {
    let Some(artifacts) = job.artifacts.as_ref() else {
        return Vec::new();
    };
    let mut paths = vec![
        artifacts.job_root.as_deref(),
        artifacts.source_pdf.as_deref(),
        artifacts.layout_json.as_deref(),
        artifacts.normalized_document_json.as_deref(),
        artifacts.normalization_report_json.as_deref(),
        artifacts.provider_raw_dir.as_deref(),
        artifacts.provider_zip.as_deref(),
        artifacts.provider_summary_json.as_deref(),
        artifacts.translation_checkpoint_json.as_deref(),
        artifacts.translations_dir.as_deref(),
        artifacts.output_pdf.as_deref(),
        artifacts.previous_output_pdf.as_deref(),
        artifacts.cover_image_path.as_deref(),
        artifacts.thumbnail_image_path.as_deref(),
        artifacts.summary.as_deref(),
        artifacts.render_config_json.as_deref(),
        artifacts.events_jsonl.as_deref(),
    ];
    if let Some(diagnostics) = artifacts.ocr_provider_diagnostics.as_ref() {
        let set = &diagnostics.artifacts;
        paths.extend([
            set.provider_result_json.as_deref(),
            set.provider_bundle_zip.as_deref(),
            set.layout_json.as_deref(),
            set.normalized_document_json.as_deref(),
            set.normalization_report_json.as_deref(),
        ]);
    }
    paths.into_iter().flatten().filter(|raw| !raw.trim().is_empty()).collect()
}

fn provider_zip_paths(job: &JobSnapshot) -> Vec<&str> {
    let Some(artifacts) = job.artifacts.as_ref() else {
        return Vec::new();
    };
    let diagnostics = artifacts
        .ocr_provider_diagnostics
        .as_ref()
        .and_then(|diagnostics| diagnostics.artifacts.provider_bundle_zip.as_deref());
    [artifacts.provider_zip.as_deref(), diagnostics].into_iter().flatten().collect()
}

/// `jobs/<任务>/`，任务编号得是普通的名字（不带分隔符、不以点开头），目录得真的在。
fn own_job_root(data_root: &Path, job_id: &str) -> Option<PathBuf> {
    if job_id.is_empty() || job_id.contains(['/', '\\']) || job_id.starts_with('.') {
        return None;
    }
    let root = data_root.join(JOBS_DIR).join(job_id);
    root.symlink_metadata().ok().filter(|meta| meta.is_dir())?;
    Some(root)
}

/// 记录里的路径落在哪个任务目录下就算哪个（OCR 子任务的产物写在父任务目录里）。
fn job_root_of_record(data_root: &Path, job: &JobSnapshot) -> Option<PathBuf> {
    let root = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_deref())
        .and_then(|raw| resolve_data_path(data_root, raw).ok())
        .unwrap_or_else(|| data_root.join(JOBS_DIR).join(&job.job_id));
    root.starts_with(data_root.join(JOBS_DIR)).then_some(root)
}

fn remove_file(path: &Path, pruned: &mut IntermediatesPruned) {
    let Ok(metadata) = path.symlink_metadata() else {
        return;
    };
    if !metadata.is_file() {
        return;
    }
    match std::fs::remove_file(path) {
        Ok(()) => {
            pruned.files += 1;
            pruned.bytes += metadata.len();
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => pruned.failed += 1,
    }
}

/// 整个目录删掉（不跟符号链接；`dir` 本身是符号链接就不碰）。
fn remove_dir(dir: &Path, pruned: &mut IntermediatesPruned) {
    if !dir.symlink_metadata().is_ok_and(|meta| meta.is_dir()) {
        return;
    }
    prune_dir_except(dir, &[], pruned);
    if std::fs::remove_dir(dir).is_err() && dir.exists() {
        pruned.failed += 1;
    }
}

/// `copy` 和 `original` 内容一字不差、还不是同一个文件时，把 `copy` 换成指向 `original` 的硬链接（先链到旁边再改名，
/// 读的一方任何时候都看得到完整文件）。省下的算进 `bytes`。
#[cfg(unix)]
fn link_identical_copy(copy: &Path, original: &Path, pruned: &mut IntermediatesPruned) {
    use std::os::unix::fs::MetadataExt;

    let (Ok(copy_meta), Ok(original_meta)) = (copy.symlink_metadata(), original.symlink_metadata()) else {
        return;
    };
    if !copy_meta.is_file() || !original_meta.is_file() || copy_meta.len() != original_meta.len() {
        return;
    }
    if (copy_meta.dev(), copy_meta.ino()) == (original_meta.dev(), original_meta.ino()) {
        return; // 已经链过
    }
    match same_contents(copy, original) {
        Ok(true) => {}
        Ok(false) => return,
        Err(_) => {
            pruned.failed += 1;
            return;
        }
    }
    let staged = copy.with_extension("json.link-tmp");
    let _ = std::fs::remove_file(&staged);
    let linked = std::fs::hard_link(original, &staged).and_then(|()| std::fs::rename(&staged, copy));
    match linked {
        Ok(()) => {
            pruned.files += 1;
            pruned.bytes += copy_meta.len();
        }
        Err(_) => {
            let _ = std::fs::remove_file(&staged);
            pruned.failed += 1;
        }
    }
}

#[cfg(not(unix))]
fn link_identical_copy(_copy: &Path, _original: &Path, _pruned: &mut IntermediatesPruned) {}

#[cfg(unix)]
fn same_contents(left: &Path, right: &Path) -> std::io::Result<bool> {
    use std::io::Read;

    let (mut left, mut right) = (std::fs::File::open(left)?, std::fs::File::open(right)?);
    let (mut left_buf, mut right_buf) = (vec![0u8; 1 << 16], vec![0u8; 1 << 16]);
    loop {
        let read = left.read(&mut left_buf)?;
        if read == 0 {
            return Ok(right.read(&mut right_buf[..1])? == 0);
        }
        right.read_exact(&mut right_buf[..read])?;
        if left_buf[..read] != right_buf[..read] {
            return Ok(false);
        }
    }
}

/// 删掉 `dir` 下面除了 `kept`（以及装着它们的目录）以外的所有东西。符号链接只删链接本身。
fn prune_dir_except(dir: &Path, kept: &[PathBuf], pruned: &mut IntermediatesPruned) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if kept.iter().any(|keep| keep == &path) {
            continue;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            if kept.iter().any(|keep| keep.starts_with(&path)) {
                prune_dir_except(&path, kept, pruned);
                continue;
            }
            let mut inside = IntermediatesPruned::default();
            for file in WalkDir::new(&path).follow_links(false).into_iter().flatten() {
                if let Ok(metadata) = file.path().symlink_metadata() {
                    if !metadata.is_dir() {
                        inside.files += 1;
                        inside.bytes += metadata.len();
                    }
                }
            }
            match std::fs::remove_dir_all(&path) {
                Ok(()) => pruned.add(inside),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => pruned.failed += 1,
            }
        } else {
            remove_file(&path, pruned);
            if kind.is_symlink() {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}

#[cfg(test)]
#[path = "intermediates_tests.rs"]
mod tests;
