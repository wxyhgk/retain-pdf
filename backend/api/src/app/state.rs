use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{RwLock, Semaphore};
use tracing::warn;

use super::jobs::reconcile_owned_runtime;
use crate::config::AppConfig;
use crate::db::Db;
use crate::services::agent_capabilities::AgentCapabilityAuthority;
use crate::services::runtime_gateway::{JobDriverRegistry, JobRuntime};
use crate::services::uploads::{UploadService, UploadServiceConfig};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub db: Arc<Db>,
    pub(crate) ai_gateway: Arc<crate::services::ai::AiGateway>,
    pub(crate) uploads: Arc<UploadService>,
    pub download_generation: Arc<crate::services::download_generation::DownloadGeneration>,
    pub(crate) query_execution: Arc<crate::services::query_execution::QueryExecution>,
    pub canceled_jobs: Arc<RwLock<HashSet<String>>>,
    pub job_slots: Arc<Semaphore>,
    pub job_drivers: Arc<JobDriverRegistry>,
    /// 任务运行时落点（ADR-002）：进程内或远端 jobsd，装配一次此后只读。
    pub job_runtime: Arc<JobRuntime>,
    /// Per-process signing authority for short-lived, least-privilege agent capabilities.
    pub agent_capabilities: Arc<AgentCapabilityAuthority>,
    /// Staged rollout: disabled until worker pause/resume integration is enabled.
    pub model_executor: Option<Arc<crate::services::model_executor::ModelExecutor>>,
    /// 多设备同步(设置、后台定时同步、状态)。
    pub(crate) sync: Arc<crate::services::sync::SyncService>,
}

pub fn build_state(config: Arc<AppConfig>) -> Result<AppState> {
    let db = Arc::new(Db::new(
        config.jobs_db_path.clone(),
        config.data_root.clone(),
    ));
    db.init()?;
    let cleaned_legacy_workflows = db.cleanup_legacy_workflows()?;
    if cleaned_legacy_workflows > 0 {
        warn!(
            "startup cleanup migrated {cleaned_legacy_workflows} legacy workflow row(s) from mineru to book"
        );
    }
    reconcile_owned_runtime(config.as_ref(), db.as_ref())?;

    let canceled_jobs = Arc::new(RwLock::new(HashSet::new()));
    let job_runtime = Arc::new(if config.jobs_service.is_remote() {
        // 钥匙单源：下发壳自己的 key 集合首项，与 ai_supervisor 同规则
        let api_key = {
            let mut sorted: Vec<_> = config.api_keys.iter().cloned().collect();
            sorted.sort();
            sorted.first().cloned().unwrap_or_default()
        };
        JobRuntime::remote(&config.jobs_service, api_key)
    } else {
        JobRuntime::in_process(canceled_jobs.clone())
    });

    let model_executor = if std::env::var("RETAIN_MODEL_EXECUTOR_ENABLED").as_deref() == Ok("1") {
        Some(Arc::new(
            crate::services::model_executor::ModelExecutor::new(
                db.clone(),
                config.data_root.clone(),
            )?,
        ))
    } else {
        None
    };
    Ok(AppState {
        ai_gateway: Arc::new(crate::services::ai::AiGateway::new(
            &config.ai_proxy,
            config.ai_service.base_url(),
            crate::runtime::ai_supervisor::ai_service_status,
        )?),
        uploads: Arc::new(UploadService::new(
            db.clone(),
            UploadServiceConfig {
                uploads_dir: config.uploads_dir.clone(),
                python_bin: config.python_bin.clone(),
                upload_max_bytes: config.upload_max_bytes,
                upload_max_pages: config.upload_max_pages,
                processing: config.upload_processing.clone(),
            },
        )),
        model_executor,
        sync: Arc::new(crate::services::sync::SyncService::new(
            db.clone(),
            config.data_root.clone(),
        )),
        config: config.clone(),
        db,
        download_generation: Arc::default(),
        query_execution: Arc::default(),
        canceled_jobs,
        job_slots: Arc::new(Semaphore::new(config.max_running_jobs)),
        job_drivers: Arc::default(),
        job_runtime,
        agent_capabilities: Arc::new(AgentCapabilityAuthority::new_random()?),
    })
}

#[cfg(test)]
mod tests;
