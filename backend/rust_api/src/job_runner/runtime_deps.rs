use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::{RwLock, Semaphore};

use crate::config::{
    AppConfig, FailureAiDiagnosisRuntimeConfig, JobRunnerConfig, MineruRuntimeConfig,
    PaddleRuntimeConfig, WorkerCommandRuntimeConfig, WorkerProcessRuntimeConfig,
};
use crate::db::Db;

#[derive(Clone)]
pub(crate) struct JobPersistDeps {
    pub db: Arc<Db>,
    pub data_root: PathBuf,
    pub output_root: PathBuf,
}

impl JobPersistDeps {
    pub(crate) fn new(db: Arc<Db>, data_root: PathBuf, output_root: PathBuf) -> Self {
        Self {
            db,
            data_root,
            output_root,
        }
    }
}

#[derive(Clone)]
pub(crate) struct ProcessRuntimeDeps {
    pub persist: JobPersistDeps,
    pub config: Arc<AppConfig>,
    pub db: Arc<Db>,
    pub canceled_jobs: Arc<RwLock<HashSet<String>>>,
    pub job_slots: Arc<Semaphore>,
}

impl ProcessRuntimeDeps {
    pub(crate) fn new(
        config: Arc<AppConfig>,
        db: Arc<Db>,
        canceled_jobs: Arc<RwLock<HashSet<String>>>,
        job_slots: Arc<Semaphore>,
    ) -> Self {
        let persist = JobPersistDeps::new(
            db.clone(),
            config.data_root.clone(),
            config.output_root.clone(),
        );
        Self {
            persist,
            config,
            db,
            canceled_jobs,
            job_slots,
        }
    }

    pub(crate) fn worker_command_runtime(&self) -> WorkerCommandRuntimeConfig<'_> {
        self.config.worker_command_runtime()
    }

    pub(crate) fn worker_process_runtime(&self) -> WorkerProcessRuntimeConfig<'_> {
        self.config.worker_process_runtime()
    }

    pub(crate) fn failure_ai_diagnosis_runtime(&self) -> FailureAiDiagnosisRuntimeConfig<'_> {
        self.config.failure_ai_diagnosis_runtime()
    }

    pub(crate) fn job_runner_config(&self) -> &JobRunnerConfig {
        &self.config.job_runner
    }

    pub(crate) fn mineru_runtime(&self) -> &MineruRuntimeConfig {
        &self.config.provider_runtime.mineru
    }

    pub(crate) fn paddle_runtime(&self) -> &PaddleRuntimeConfig {
        &self.config.provider_runtime.paddle
    }
}
