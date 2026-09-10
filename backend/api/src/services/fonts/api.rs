//! Application facade for font discovery and uploads.

use std::path::Path;

use crate::error::AppError;

pub use super::service::FontInfo;

pub struct FontApiDeps<'a> {
    project_root: &'a Path,
    data_root: &'a Path,
}

impl<'a> FontApiDeps<'a> {
    pub fn new(project_root: &'a Path, data_root: &'a Path) -> Self {
        Self {
            project_root,
            data_root,
        }
    }
}

pub fn list_fonts(deps: &FontApiDeps<'_>) -> Vec<FontInfo> {
    super::service::list_fonts(deps.project_root, deps.data_root)
}

pub fn upload_font(
    deps: &FontApiDeps<'_>,
    filename: &str,
    bytes: &[u8],
) -> Result<FontInfo, AppError> {
    super::service::save_uploaded_font(deps.data_root, filename, bytes)
}
