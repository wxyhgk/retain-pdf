//! Application boundary for job-scoped model requests. Frozen job policy lives
//! here, not in HTTP handlers; the executor owns reservations and transport.
use std::sync::Arc;

pub use super::model_executor::{ModelConnection, ModelRequest};
use super::model_executor::{ModelExecutor, ModelExecutorError};
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind};
use retainpdf_data::db::Db;
use retainpdf_data::db::ModelOperation;

pub struct ModelRequestsApi {
    db: Arc<Db>,
    executor: Option<Arc<ModelExecutor>>,
}

impl ModelRequestsApi {
    pub fn new(db: Arc<Db>, executor: Option<Arc<ModelExecutor>>) -> Self {
        Self { db, executor }
    }

    fn executor(&self) -> Result<&Arc<ModelExecutor>, AppError> {
        self.executor
            .as_ref()
            .ok_or_else(|| AppError::service_unavailable("model executor rollout is not enabled"))
    }

    fn active_job(&self, job_id: &str) -> Result<JobSnapshot, AppError> {
        let job = self.db.get_job(job_id).map_err(|error| {
            if matches!(
                error.downcast_ref::<rusqlite::Error>(),
                Some(rusqlite::Error::QueryReturnedNoRows)
            ) {
                AppError::not_found("job not found")
            } else {
                tracing::error!(
                    category = "job_storage",
                    "model request application failure"
                );
                AppError::internal("model request storage unavailable")
            }
        })?;
        if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
            return Err(AppError::conflict_because("job_not_active", "job is not active"));
        }
        Ok(job)
    }

    /// 只验令牌（属于这个任务、没过期），不查任务、不碰请求体。HTTP 层先调它，再解析请求体，
    /// 没有有效令牌的请求拿不到「哪个字段写错了」的回答。能力令牌由任务运行时在进程内直接发
    /// （`retainpdf-runner` 的 `worker_process.rs`），没有签发接口。
    pub fn authorize(&self, job_id: &str, token: &str) -> Result<(), AppError> {
        self.executor()?
            .authorize(job_id, token)
            .map(|_| ())
            .map_err(map_executor_error)
    }

    pub async fn submit(
        &self,
        job_id: &str,
        token: &str,
        request: ModelRequest,
    ) -> Result<ModelOperation, AppError> {
        let executor = self.executor()?;
        // Authorize before job lookup, validation or disclosure of existence.
        executor
            .authorize(job_id, token)
            .map_err(map_executor_error)?;
        self.active_job(job_id)?;
        executor
            .submit(job_id, token, request)
            .await
            .map_err(map_executor_error)
    }

    pub fn status(
        &self,
        job_id: &str,
        token: &str,
        operation: &str,
    ) -> Result<ModelOperation, AppError> {
        self.executor()?
            .status(job_id, token, operation)
            .map_err(map_executor_error)?
            .ok_or_else(|| AppError::not_found("model operation not found"))
    }

    pub fn cancel(&self, job_id: &str, token: &str, operation: &str) -> Result<bool, AppError> {
        // Preserve the idempotent wire contract: missing operation => changed:false.
        self.executor()?
            .cancel(job_id, token, operation)
            .map_err(map_executor_error)
    }
}

fn map_executor_error(error: ModelExecutorError) -> AppError {
    match error {
        ModelExecutorError::Unauthorized => AppError::unauthorized("invalid worker capability"),
        ModelExecutorError::BadRequest(reason) => AppError::bad_request(reason),
        ModelExecutorError::Conflict { reason, message } => {
            AppError::conflict_because(reason, message)
        }
        ModelExecutorError::Internal(category) => {
            tracing::error!(category, "model executor internal failure");
            AppError::internal("model executor internal failure")
        }
    }
}
