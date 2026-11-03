use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{RwLock, Semaphore};
use tracing::info;

use super::jobs::{adopt_unlinked_job_documents, install_restore_recovery, reconcile_owned_runtime};
use crate::config::AppConfig;
use crate::db::Db;
use crate::services::jobs::{JobDriverRegistry, JobRuntime};
use crate::services::ingest::{UploadService, UploadServiceConfig};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub db: Arc<Db>,
    pub(crate) uploads: Arc<UploadService>,
    pub download_generation: Arc<crate::services::files::DownloadGeneration>,
    pub(crate) query_execution: Arc<crate::services::jobs::QueryExecution>,
    pub canceled_jobs: Arc<RwLock<HashSet<String>>>,
    pub job_slots: Arc<Semaphore>,
    pub job_drivers: Arc<JobDriverRegistry>,
    /// 任务运行时落点（ADR-002）：进程内或远端 jobsd，装配一次此后只读。
    pub job_runtime: Arc<JobRuntime>,
    /// Staged rollout: disabled until worker pause/resume integration is enabled.
    pub model_executor: Option<Arc<crate::services::providers::ModelExecutor>>,
    /// 多设备同步(设置、后台定时同步、状态)。
    pub(crate) sync: Arc<crate::services::platform::SyncService>,
    pub(crate) backup: Arc<crate::services::platform::BackupService>,
    /// 账号、会话（多用户模式）；单机模式下只用来报告模式。
    pub(crate) accounts: Arc<crate::services::accounts::AccountsService>,
}

pub fn build_state(config: Arc<AppConfig>) -> Result<AppState> {
    let db = Arc::new(Db::new(
        config.jobs_db_path.clone(),
        config.data_root.clone(),
    ));
    db.init()?;
    reconcile_owned_runtime(config.as_ref(), db.as_ref())?;
    let adopted = adopt_unlinked_job_documents(config.as_ref(), db.as_ref())?;
    if adopted > 0 {
        info!("library: registered {adopted} job source pdf(s) as documents");
    }

    let canceled_jobs = Arc::new(RwLock::new(HashSet::new()));
    let job_runtime = Arc::new(if config.jobs_service.is_remote() {
        // 钥匙单源：下发壳自己的 key 集合首项
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
            crate::services::providers::ModelExecutor::new(
                db.clone(),
                config.data_root.clone(),
            )?,
        ))
    } else {
        None
    };
    let sync = Arc::new(crate::services::platform::SyncService::new(
        db.clone(),
        config.data_root.clone(),
    ));
    let accounts = Arc::new(crate::services::accounts::AccountsService::new(
        db.clone(),
        config.accounts.clone(),
    ));
    if let Some(admin) = accounts.bootstrap_admin().map_err(|error| anyhow::anyhow!("{error}"))? {
        info!("multi-user mode: created the first administrator `{admin}` from RETAIN_BOOTSTRAP_ADMIN_*");
    }
    let state = AppState {
        accounts,
        uploads: Arc::new(UploadService::new(
            db.clone(),
            UploadServiceConfig {
                uploads_dir: config.uploads_dir.clone(),
                python_bin: config.python_bin.clone(),
                upload_max_bytes: config.upload_max_bytes,
                upload_max_pages: config.upload_max_pages,
                min_free_disk_bytes: config.min_free_disk_bytes,
                processing: config.upload_processing.clone(),
            },
        )),
        model_executor,
        sync: sync.clone(),
        backup: Arc::new(crate::services::platform::BackupService::new(db.clone(), sync)),
        config: config.clone(),
        db,
        download_generation: Arc::default(),
        query_execution: Arc::default(),
        canceled_jobs,
        job_slots: Arc::new(Semaphore::new(config.max_running_jobs)),
        job_drivers: Arc::default(),
        job_runtime,
    };
    install_restore_recovery(&state);
    Ok(state)
}

#[cfg(test)]
mod tests;
