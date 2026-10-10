//! 不经 `build_state` 的 `AppState` 装配。
//!
//! 服务层单测（glossaries、jobs/creation）要的是「一个字段齐全的 AppState」，
//! 不想要 `build_state` 附带的建库、旧 workflow 清理、启动对账与远端 jobsd 判定；
//! AI 网关的健康探针也固定报 0，避免碰真实的 AI 服务状态。两处原本各抄一份，
//! 收在这里后 `AppState` 加字段只需改一处。

use std::collections::HashSet;
use std::sync::Arc;

use tokio::sync::{RwLock, Semaphore};

use crate::config::AppConfig;
use crate::db::Db;
use crate::AppState;

/// 按 `config` 装配：库不初始化（需要的测试自己 `state.db.init()`），
/// 任务运行时固定 in-process，并发槽固定 1。
pub(crate) fn assemble_app_state(config: Arc<AppConfig>) -> AppState {
    let db = Arc::new(Db::new(
        config.jobs_db_path.clone(),
        config.data_root.clone(),
    ));
    let sync = Arc::new(crate::services::sync::SyncService::new(
        db.clone(),
        config.data_root.clone(),
    ));
    AppState {
        accounts: Arc::new(crate::services::accounts::AccountsService::new(
            db.clone(),
            config.accounts.clone(),
        )),
        ai_gateway: Arc::new(
            crate::services::ai::AiGateway::new(
                &config.ai_proxy,
                config.ai_service.base_url(),
                || 0,
            )
            .unwrap(),
        ),
        uploads: Arc::new(crate::services::uploads::UploadService::new(
            db.clone(),
            crate::services::uploads::UploadServiceConfig {
                uploads_dir: config.uploads_dir.clone(),
                python_bin: config.python_bin.clone(),
                upload_max_bytes: config.upload_max_bytes,
                upload_max_pages: config.upload_max_pages,
                processing: config.upload_processing.clone(),
            },
        )),
        model_executor: None,
        sync: sync.clone(),
        backup: Arc::new(crate::services::backup::BackupService::new(db.clone(), sync)),
        config,
        db,
        download_generation: Arc::default(),
        query_execution: Arc::default(),
        canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
        job_slots: Arc::new(Semaphore::new(1)),
        job_drivers: Arc::default(),
        job_runtime: Arc::new(crate::services::runtime_gateway::JobRuntime::in_process(
            Arc::new(RwLock::new(HashSet::new())),
        )),
        agent_capabilities: Arc::new(
            crate::services::agent_capabilities::AgentCapabilityAuthority::new_random()
                .expect("agent capability authority"),
        ),
    }
}
