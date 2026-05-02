use std::collections::HashSet;
use std::path::Path;

use axum::Json;

use crate::app::AppState;
use crate::db::Db;
use crate::models::ApiResponse;

pub fn ok_json<T>(value: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse::ok(value))
}

pub struct UploadRouteDeps<'a> {
    pub db: &'a Db,
    pub uploads_dir: &'a Path,
    pub upload_max_bytes: u64,
    pub upload_max_pages: u32,
    pub python_bin: &'a str,
}

pub fn build_upload_route_deps(state: &AppState) -> UploadRouteDeps<'_> {
    UploadRouteDeps {
        db: state.db.as_ref(),
        uploads_dir: &state.config.uploads_dir,
        upload_max_bytes: state.config.upload_max_bytes,
        upload_max_pages: state.config.upload_max_pages,
        python_bin: &state.config.python_bin,
    }
}

pub struct GlossaryRouteDeps<'a> {
    pub db: &'a Db,
}

pub fn build_glossary_route_deps(state: &AppState) -> GlossaryRouteDeps<'_> {
    GlossaryRouteDeps {
        db: state.db.as_ref(),
    }
}

pub struct HealthRouteDeps<'a> {
    pub db: &'a Db,
}

pub fn build_health_route_deps(state: &AppState) -> HealthRouteDeps<'_> {
    HealthRouteDeps {
        db: state.db.as_ref(),
    }
}

pub struct AuthRouteDeps<'a> {
    pub api_keys: &'a HashSet<String>,
}

pub fn build_auth_route_deps(state: &AppState) -> AuthRouteDeps<'_> {
    AuthRouteDeps {
        api_keys: &state.config.api_keys,
    }
}
