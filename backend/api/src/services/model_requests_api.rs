//! Application boundary for job-scoped model requests. Frozen job policy lives
//! here, not in HTTP handlers; the executor owns reservations and transport.
use std::sync::Arc;

pub use super::model_executor::{ModelConnection, ModelRequest};
use super::model_executor::{ModelConnectionPolicy, ModelExecutor, ModelExecutorError};
use crate::{
    db::Db,
    error::AppError,
    models::domain::{JobSnapshot, JobStatusKind},
};
use retain_data::db::ModelOperation;
use serde_json::{json, Value};

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
            return Err(AppError::conflict("job is not active"));
        }
        Ok(job)
    }

    pub fn issue(&self, job_id: &str, profile: ModelConnection) -> Result<Value, AppError> {
        let executor = self.executor()?;
        let job = self.active_job(job_id)?;
        let translation = &job.request_payload.translation;
        if translation.execution_connection.as_ref() != Some(&profile) {
            return Err(AppError::conflict(
                "model connection must match the complete submission snapshot",
            ));
        }
        if profile.model != translation.model
            || profile.base_url.trim_end_matches('/') != translation.base_url.trim_end_matches('/')
            || profile.credential_ref != translation.credential_ref
            || profile.concurrency as i64 != translation.workers
        {
            return Err(AppError::conflict(
                "connection does not match frozen job configuration",
            ));
        }
        profile
            .validate()
            .map_err(|_| AppError::bad_request("invalid model connection"))?;
        let capability = executor
            .register_job(job_id, &profile, 3600)
            .map_err(map_executor_error)?;
        Ok(json!({"token_type":"Bearer","capability":capability,"expires_in":3600}))
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
        ModelExecutorError::Conflict(reason) => AppError::conflict(reason),
        ModelExecutorError::Internal(category) => {
            tracing::error!(category, "model executor internal failure");
            AppError::internal("model executor internal failure")
        }
    }
}
