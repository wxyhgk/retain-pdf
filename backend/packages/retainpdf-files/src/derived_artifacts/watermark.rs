//! 下载的 PDF 盖水印（2026-11-20 用户定：默认开、右下角「logo + RetainPDF」）。
//!
//! 只在下载出口按需生成、缓存：渲染产物本身、阅读页、页预览都不带水印，开关水印不用重新渲染。
//! 盖章是 Python 的 `retainpdf-pipeline watermark-pdf`（`render/output/watermark/pdf.py`），水印是纯矢量、不含文字。

use std::path::{Path, PathBuf};
use std::time::Duration;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::JobSnapshot;

use super::side_by_side::build_with_command;
use super::{cached_output_is_fresh, job_artifacts_dir, DerivedArtifactDeps};

/// 整本几百页也只是每页引用同一个对象，很快；给足余量。
const BUILD_TIMEOUT: Duration = Duration::from_secs(300);

/// 水印的版本。**换了水印图案、位置就加一**：缓存只看输入文件变没变，代码和素材改动不是输入（同 `word.rs` 的说明）。
pub(crate) const WATERMARK_VERSION: u32 = 1;

/// `input_pdf` 盖好水印的那一份（缓存在任务的 `artifacts/`）。`label` 区分是哪份 PDF（译文、对照）。
pub fn ensure_watermarked_pdf(
    deps: DerivedArtifactDeps<'_>,
    data_root: &Path,
    job: &JobSnapshot,
    input_pdf: &Path,
    label: &str,
) -> Result<PathBuf, AppError> {
    let output_dir = job_artifacts_dir(data_root, job)?;
    let output_pdf = output_dir.join(super::watermarked_file_name(label));
    if !cached_output_is_fresh(&output_pdf, &[input_pdf])? {
        build_with_command(&output_pdf, "watermark-pdf", BUILD_TIMEOUT, &[input_pdf], |temporary| {
            let mut command = std::process::Command::new(deps.pipeline_command);
            command
                .arg("watermark-pdf")
                .arg("--input-pdf")
                .arg(input_pdf)
                .arg("--output-pdf")
                .arg(temporary);
            command
        })?;
    }
    Ok(output_pdf)
}
