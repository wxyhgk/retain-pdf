//! `GET /metrics`：Prometheus 文本格式的运维指标（2026-11-24）。
//!
//! - 按接口（登记表里的路由模板，不是具体地址）的请求数、状态码分类、耗时直方图，来自 `app/route_usage.rs`；
//! - 几个运行时数，和 `GET /health` 的同一份（排队中、运行中的任务数，库、jobsd、磁盘）。
//!
//! 要 Key；多用户模式下只给管理员。接 Prometheus 的写法见 `docs/api/08-调试诊断/04-运维指标.md`。

use std::fmt::Write as _;

use axum::extract::State;
use axum::http::header;
use axum::response::{IntoResponse, Response};

use crate::error::AppError;
use crate::routes::common::{build_health_route_deps, run_state_blocking};
use crate::services::platform::{build_health_view, HealthView};
use crate::AppState;

/// Prometheus 文本格式 0.0.4 的 Content-Type。
const PROMETHEUS_CONTENT_TYPE: &str = "text/plain; version=0.0.4; charset=utf-8";

/// 运行时数要连库（数任务），放进阻塞线程。
pub async fn metrics(State(state): State<AppState>) -> Result<Response, AppError> {
    let health = run_state_blocking(&state, "metrics", |state| {
        Ok(build_health_view(&build_health_route_deps(state)))
    })
    .await?;
    let mut body = String::new();
    crate::app::render_route_metrics(&mut body);
    render_runtime(&health, &mut body);
    Ok(([(header::CONTENT_TYPE, PROMETHEUS_CONTENT_TYPE)], body).into_response())
}

fn gauge(out: &mut String, name: &str, help: &str, value: impl std::fmt::Display) {
    let _ = writeln!(out, "# HELP {name} {help}\n# TYPE {name} gauge\n{name} {value}");
}

/// `/health` 里已有的那些数。库读不出来的（`null`）不出这一项，免得看着像 0。
fn render_runtime(health: &HealthView, out: &mut String) {
    gauge(out, "retainpdf_db_up", "任务库能不能用（1 能，0 不能）。", u8::from(health.db == "ok"));
    if let Some(queued) = health.queue_depth {
        gauge(out, "retainpdf_jobs_queued", "排队中的任务数。", queued);
    }
    if let Some(running) = health.running_jobs {
        gauge(out, "retainpdf_jobs_running", "运行中的任务数。", running);
    }
    let _ = writeln!(
        out,
        "# HELP retainpdf_jobsd_status 任务服务 jobsd 的状态，取值在 status 标签里（和 /health 的 jobsd 一样）。\n\
         # TYPE retainpdf_jobsd_status gauge\n\
         retainpdf_jobsd_status{{status=\"{}\"}} 1",
        health.jobsd
    );
    if let Some(free) = health.disk.free_bytes {
        gauge(out, "retainpdf_disk_free_bytes", "数据目录所在磁盘的剩余可用空间（字节）。", free);
    }
    gauge(
        out,
        "retainpdf_disk_min_free_bytes",
        "剩余空间下限（RUST_API_MIN_FREE_DISK_MB，0 是不查）。",
        health.disk.min_free_bytes,
    );
    gauge(out, "retainpdf_disk_low", "剩余空间低于下限（1 是，此时不接新上传、新任务）。", u8::from(health.disk.low));
}
