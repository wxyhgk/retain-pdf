use std::path::{Path, PathBuf};

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::JobSnapshot;

mod freshness;
pub(crate) mod pdf;
pub(crate) mod preview;
pub(crate) mod retention;
pub(crate) mod side_by_side;
pub(crate) mod watermark;
pub(crate) mod word;

pub(crate) use freshness::cached_output_is_fresh;

#[derive(Clone, Copy)]
pub struct DerivedArtifactDeps<'a> {
    pub python_bin: &'a str,
    pub pipeline_command: &'a str,
}

impl<'a> DerivedArtifactDeps<'a> {
    pub fn new(python_bin: &'a str) -> Self {
        Self {
            python_bin,
            pipeline_command: "retainpdf-pipeline",
        }
    }

    pub fn with_pipeline_command(python_bin: &'a str, pipeline_command: &'a str) -> Self {
        Self {
            python_bin,
            pipeline_command,
        }
    }
}

pub(crate) fn job_artifacts_dir(data_root: &Path, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    let output_dir = job_artifacts_dir_path(data_root, job)?;
    std::fs::create_dir_all(&output_dir)?;
    Ok(output_dir)
}

/// 任务派生产物（Word、双栏 PDF、缩略图…）的缓存目录。
///
/// 普通任务是 `data/jobs/<job_id>/artifacts`。合并结果的虚拟 id 不能这么拼 —— 会在
/// `jobs/` 下凭空多出一个假任务目录 —— 它的缓存放进合并目录自己的 `artifacts/`：合并目录
/// 按内容指纹命名、不可变，缓存天然跟着内容走。
pub fn job_artifacts_dir_path(data_root: &Path, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    if retainpdf_api_base::job_loading::is_virtual_job_id(&job.job_id) {
        let root = retainpdf_core::storage_paths::resolve_job_root(job, data_root)
            .ok_or_else(|| AppError::internal(format!("merged job has no root: {}", job.job_id)))?;
        return Ok(root.join("artifacts"));
    }
    Ok(data_root.join("jobs").join(&job.job_id).join("artifacts"))
}

// 派生缓存的文件名。生成和回收（`retention.rs`）都从这里拿，改了名字回收那边跟着认得。

pub(crate) fn side_by_side_file_name(job_id: &str) -> String {
    format!("{job_id}-side-by-side.pdf")
}

pub(crate) fn layout_docx_file_name(job_id: &str, cache_suffix: &str) -> String {
    format!("{job_id}-layout-{cache_suffix}.docx")
}

/// 盖了水印的 PDF：`<label>.watermarked-v<版本>.pdf`（版本见 `watermark.rs`）。
pub(crate) fn watermarked_file_name(label: &str) -> String {
    format!("{}.watermarked-v{}.pdf", label.replace('/', "_"), watermark::WATERMARK_VERSION)
}

pub(crate) fn linearized_file_name(label: &str) -> String {
    format!("{}.linearized.pdf", label.replace('/', "_"))
}

/// 任务的页预览：`artifacts/preview-<source|translated>-p0001-w1200-d0.jpg`。
pub fn job_page_preview_file_name(kind: &str, page: u32, width_px: u32, dpi: u32) -> String {
    format!("preview-{kind}-p{page:04}-w{width_px}-d{dpi}.jpg")
}

/// 书的页预览：`documents/<文档>/pages/p0001-w1200-d0.jpg`。
pub fn document_page_preview_path(
    data_root: &Path,
    document_id: &str,
    page: u32,
    width_px: u32,
    dpi: u32,
) -> Result<PathBuf, AppError> {
    Ok(document_artifacts_dir(data_root, document_id)?
        .join(retention::DOCUMENT_PAGES_DIR)
        .join(format!("p{page:04}-w{width_px}-d{dpi}.jpg")))
}

/// 文档级缓存目录（无 job 时封面/缩略图仍可落盘）。
pub fn document_artifacts_dir(
    data_root: &Path,
    document_id: &str,
) -> Result<PathBuf, AppError> {
    let output_dir = data_root.join("documents").join(document_id);
    std::fs::create_dir_all(&output_dir)?;
    Ok(output_dir)
}
