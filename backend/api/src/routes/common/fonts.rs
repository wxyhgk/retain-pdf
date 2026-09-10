use std::num::NonZeroU64;

use crate::app::AppState;
use crate::services::fonts::api::FontApiDeps;

const FONT_UPLOAD_MAX_BYTES: u64 = 64 * 1024 * 1024;

pub struct FontsRouteDeps<'a> {
    pub font_api: FontApiDeps<'a>,
    pub upload_max_bytes: NonZeroU64,
}

pub fn build_fonts_route_deps(state: &AppState) -> FontsRouteDeps<'_> {
    FontsRouteDeps {
        font_api: FontApiDeps::new(&state.config.project_root, &state.config.data_root),
        upload_max_bytes: NonZeroU64::new(FONT_UPLOAD_MAX_BYTES)
            .expect("font upload limit must be non-zero"),
    }
}
