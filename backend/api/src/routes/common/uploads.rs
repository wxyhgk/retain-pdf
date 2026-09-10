use std::num::NonZeroU64;

use retain_core::config::effective_upload_max_bytes;

use crate::app::AppState;
use crate::services::uploads::api::UploadApiDeps;

pub struct UploadRouteDeps<'a> {
    pub(crate) uploads: UploadApiDeps<'a>,
    pub upload_max_bytes: NonZeroU64,
}

pub fn build_upload_route_deps(state: &AppState) -> UploadRouteDeps<'_> {
    UploadRouteDeps {
        uploads: UploadApiDeps::new(state.uploads.as_ref()),
        upload_max_bytes: effective_upload_max_bytes(state.config.upload_max_bytes),
    }
}
