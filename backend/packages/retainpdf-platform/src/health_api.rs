//! Application facade for liveness and readiness projections.

use std::path::Path;

use serde::Serialize;

use retainpdf_data::db::Db;
use retainpdf_core::models::domain::{now_iso, JobStatusKind};
use retainpdf_api_base::disk_space::free_space_bytes;
use retainpdf_api_base::supervisor::{supervisor_status_label, SUPERVISOR_HEALTHY};
use retainpdf_data::ocr_provider::supported_provider_keys;

/// 健康检查里 `ai_service` 的值。RetainPDF 自己的 AI 服务 2026-11-03 删了（产品里只留 Studio 的 AI），
/// 键照旧留着（旧字段不删），值固定。
const AI_SERVICE_REMOVED: &str = "disabled";

pub struct HealthApiDeps<'a> {
    db: &'a Db,
    jobsd_supervised: bool,
    /// 建依赖那一刻 jobsd 监督器的状态（`retainpdf_api_base::supervisor`），由调用方从 runtime 读来传进来。
    jobsd_status: u8,
    data_root: Option<&'a Path>,
    min_free_disk_bytes: u64,
}

impl<'a> HealthApiDeps<'a> {
    pub fn new(db: &'a Db, jobsd_supervised: bool, jobsd_status: u8) -> Self {
        Self {
            db,
            jobsd_supervised,
            jobsd_status,
            data_root: None,
            min_free_disk_bytes: 0,
        }
    }

    /// 健康检查里报数据目录所在磁盘的剩余空间（`disk`）。
    pub fn with_disk(mut self, data_root: &'a Path, min_free_disk_bytes: u64) -> Self {
        self.data_root = Some(data_root);
        self.min_free_disk_bytes = min_free_disk_bytes;
        self
    }
}

/// 数据目录所在磁盘。只是报告：低于下限时上传、建任务、原地重跑会 503（`insufficient_storage`），
/// 但 `status` 和 `/ready` 不跟着变——web 容器等后端就绪才启动，磁盘满了更要能打开页面删任务腾空间。
#[derive(Debug, Serialize)]
pub struct DiskSpaceView {
    /// 剩余可用空间（字节）；拿不到（Windows、没配数据目录）是 `null`。
    pub free_bytes: Option<u64>,
    /// 下限（`RUST_API_MIN_FREE_DISK_MB`）；0 是不查。
    pub min_free_bytes: u64,
    /// 剩余空间低于下限。
    pub low: bool,
}

fn disk_space_view(deps: &HealthApiDeps<'_>) -> DiskSpaceView {
    let free_bytes = deps.data_root.and_then(free_space_bytes);
    DiskSpaceView {
        free_bytes,
        min_free_bytes: deps.min_free_disk_bytes,
        low: deps.min_free_disk_bytes > 0 && free_bytes.is_some_and(|free| free < deps.min_free_disk_bytes),
    }
}

#[derive(Serialize)]
pub struct HealthView {
    pub status: &'static str,
    pub db: &'static str,
    /// 排队的任务数。库读不出来时是 `null`（以前当 0，看着像「空闲」）。
    pub queue_depth: Option<i64>,
    /// 在跑的任务数。库读不出来时是 `null`。
    pub running_jobs: Option<i64>,
    pub provider_backends: Vec<String>,
    /// 固定 `disabled`（AI 服务 2026-11-03 删了，键留着）。
    pub ai_service: &'static str,
    pub jobsd: &'static str,
    pub disk: DiskSpaceView,
    pub time: String,
}

#[derive(Debug, Serialize)]
pub struct ReadinessComponentView {
    pub required: bool,
    pub status: &'static str,
}

#[derive(Debug, Serialize)]
pub struct ReadinessComponentsView {
    pub db: ReadinessComponentView,
    /// 固定不需要（AI 服务 2026-11-03 删了，键留着）。
    pub ai_service: ReadinessComponentView,
    pub jobsd: ReadinessComponentView,
}

#[derive(Debug, Serialize)]
pub struct ReadinessView {
    pub status: &'static str,
    pub components: ReadinessComponentsView,
    pub reasons: Vec<&'static str>,
    pub time: String,
}

impl ReadinessView {
    pub fn is_ready(&self) -> bool {
        self.reasons.is_empty()
    }
}

pub fn build_health_view(deps: &HealthApiDeps<'_>) -> HealthView {
    let db_ok = deps.db.ping().is_ok();
    let queued = deps.db.count_jobs_with_status(&JobStatusKind::Queued).ok();
    let running = deps.db.count_jobs_with_status(&JobStatusKind::Running).ok();
    HealthView {
        status: if db_ok { "up" } else { "degraded" },
        db: if db_ok { "ok" } else { "error" },
        queue_depth: queued,
        running_jobs: running,
        provider_backends: supported_provider_keys(),
        ai_service: AI_SERVICE_REMOVED,
        jobsd: supervisor_status_label(deps.jobsd_status),
        disk: disk_space_view(deps),
        time: now_iso(),
    }
}

pub fn build_current_readiness_view(deps: &HealthApiDeps<'_>) -> ReadinessView {
    build_readiness_view(deps, deps.jobsd_status)
}

pub fn build_readiness_view(deps: &HealthApiDeps<'_>, jobsd_status: u8) -> ReadinessView {
    let db_ok = deps.db.ping().is_ok();
    let jobsd_required = deps.jobsd_supervised;
    let jobsd_ok = !jobsd_required || jobsd_status == SUPERVISOR_HEALTHY;

    let mut reasons = Vec::new();
    if !db_ok {
        reasons.push("db_unavailable");
    }
    if !jobsd_ok {
        reasons.push("jobsd_not_healthy");
    }

    ReadinessView {
        status: if reasons.is_empty() {
            "ready"
        } else {
            "not_ready"
        },
        components: ReadinessComponentsView {
            db: ReadinessComponentView {
                required: true,
                status: if db_ok { "healthy" } else { "unhealthy" },
            },
            ai_service: ReadinessComponentView {
                required: false,
                status: "not_required",
            },
            jobsd: ReadinessComponentView {
                required: jobsd_required,
                status: if jobsd_required {
                    supervisor_status_label(jobsd_status)
                } else {
                    "not_required"
                },
            },
        },
        reasons,
        time: now_iso(),
    }
}
