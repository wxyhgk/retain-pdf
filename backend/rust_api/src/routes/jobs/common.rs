use axum::http::{header, HeaderMap};
use axum::Json;

use crate::app::build_jobs_facade_from_state;
use crate::models::ApiResponse;
use crate::services::jobs::JobsFacade;
use crate::AppState;

pub struct JobsRouteDeps<'a> {
    pub jobs: JobsFacade<'a>,
    pub default_port: u16,
}

pub fn build_jobs_route_deps(state: &AppState) -> JobsRouteDeps<'_> {
    JobsRouteDeps {
        jobs: build_jobs_facade_from_state(state),
        default_port: state.config.port,
    }
}

pub fn jobs_facade(deps: JobsRouteDeps<'_>) -> JobsFacade<'_> {
    deps.jobs
}

pub fn ok_json<T>(value: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse::ok(value))
}

pub fn request_base_url(headers: &HeaderMap, default_port: u16) -> String {
    let scheme = forwarded_header(headers, "x-forwarded-proto")
        .or_else(|| forwarded_header(headers, "x-scheme"))
        .unwrap_or_else(|| "http".to_string());
    let mut host = forwarded_header(headers, "x-forwarded-host")
        .or_else(|| forwarded_header(headers, header::HOST.as_str()))
        .unwrap_or_else(|| format!("127.0.0.1:{default_port}"));
    let forwarded_port = forwarded_header(headers, "x-forwarded-port");
    if !host.contains(':') {
        if let Some(port) = forwarded_port.filter(|value| !value.is_empty()) {
            host = format!("{host}:{port}");
        }
    }
    format!("{scheme}://{host}")
}

fn forwarded_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string())
        .filter(|v| !v.is_empty())
}
