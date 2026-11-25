//! Application facade for font discovery（上传字体的接口 2026-11-25 删了）.

use std::path::Path;


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
