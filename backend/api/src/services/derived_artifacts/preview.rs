use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::models::domain::JobSnapshot;

use super::{job_artifacts_dir, DerivedArtifactDeps};

#[derive(Clone, Copy)]
pub(crate) enum BookImageKind {
    Cover,
    Thumbnail,
}

impl BookImageKind {
    pub(crate) fn file_name(self) -> &'static str {
        match self {
            Self::Cover => "cover.jpg",
            Self::Thumbnail => "thumbnail.jpg",
        }
    }

    pub(crate) fn width_px(self) -> u32 {
        match self {
            Self::Cover => 900,
            Self::Thumbnail => 360,
        }
    }
}

pub(crate) fn ensure_book_image(
    deps: DerivedArtifactDeps<'_>,
    data_root: &Path,
    job: &JobSnapshot,
    source_pdf: &Path,
    kind: BookImageKind,
) -> Result<PathBuf, AppError> {
    let output_dir = job_artifacts_dir(data_root, job)?;
    let output_path = output_dir.join(kind.file_name());
    ensure_book_image_at_path(deps, source_pdf, &output_path, kind)
}

/// 文档级封面/缩略图：从源 PDF 首页渲染，缓存到 documents/<id>/。
pub(crate) fn ensure_document_book_image(
    deps: DerivedArtifactDeps<'_>,
    data_root: &Path,
    document_id: &str,
    source_pdf: &Path,
    kind: BookImageKind,
) -> Result<PathBuf, AppError> {
    let output_dir = super::document_artifacts_dir(data_root, document_id)?;
    let output_path = output_dir.join(kind.file_name());
    ensure_book_image_at_path(deps, source_pdf, &output_path, kind)
}

fn ensure_book_image_at_path(
    deps: DerivedArtifactDeps<'_>,
    source_pdf: &Path,
    output_path: &Path,
    kind: BookImageKind,
) -> Result<PathBuf, AppError> {
    if output_path.exists() && output_path.is_file() {
        return Ok(output_path.to_path_buf());
    }
    render_book_image(deps.python_bin, source_pdf, output_path, kind.width_px())?;
    Ok(output_path.to_path_buf())
}

pub(crate) fn ensure_page_preview(
    deps: DerivedArtifactDeps<'_>,
    output_path: &Path,
    source_pdf: &Path,
    page_index: u32,
    width_px: u32,
    dpi: u32,
) -> Result<PathBuf, AppError> {
    if output_path.exists() && output_path.is_file() {
        return Ok(output_path.to_path_buf());
    }
    render_pdf_page_preview(
        deps.python_bin,
        source_pdf,
        output_path,
        page_index,
        width_px,
        dpi,
    )?;
    Ok(output_path.to_path_buf())
}

fn render_book_image(
    python_bin: &str,
    source_pdf: &Path,
    output_path: &Path,
    width_px: u32,
) -> Result<(), AppError> {
    let script = r#"
import sys
from pathlib import Path
import fitz

source = Path(sys.argv[1])
output = Path(sys.argv[2])
width_px = int(sys.argv[3])

with fitz.open(source) as doc:
    if doc.page_count < 1:
        raise RuntimeError("source pdf has no pages")
    page = doc[0]
    scale = width_px / max(float(page.rect.width), 1.0)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    pix.save(output)
"#;
    let status = std::process::Command::new(python_bin)
        .arg("-c")
        .arg(script)
        .arg(source_pdf)
        .arg(output_path)
        .arg(width_px.to_string())
        .status()
        .map_err(|error| AppError::internal(format!("failed to render book image: {error}")))?;
    if !status.success() || !output_path.exists() {
        return Err(AppError::internal("failed to render book image"));
    }
    Ok(())
}

fn render_pdf_page_preview(
    python_bin: &str,
    source_pdf: &Path,
    output_path: &Path,
    page_index: u32,
    width_px: u32,
    dpi: u32,
) -> Result<(), AppError> {
    let script = r#"
import sys
from pathlib import Path
import fitz

source = Path(sys.argv[1])
output = Path(sys.argv[2])
page_index = int(sys.argv[3])
width_px = int(sys.argv[4])
dpi = int(sys.argv[5])

with fitz.open(source) as doc:
    if page_index < 0 or page_index >= doc.page_count:
        raise RuntimeError(f"page out of range: {page_index + 1}/{doc.page_count}")
    page = doc[page_index]
    if dpi > 0:
        scale = dpi / 72.0
    else:
        scale = width_px / max(float(page.rect.width), 1.0)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    pix.save(output, jpg_quality=82)
"#;
    let status = std::process::Command::new(python_bin)
        .arg("-c")
        .arg(script)
        .arg(source_pdf)
        .arg(output_path)
        .arg(page_index.to_string())
        .arg(width_px.to_string())
        .arg(dpi.to_string())
        .status()
        .map_err(|error| AppError::internal(format!("failed to render page preview: {error}")))?;
    if !status.success() || !output_path.exists() {
        return Err(AppError::internal("failed to render page preview"));
    }
    Ok(())
}
