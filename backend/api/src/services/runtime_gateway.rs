//! 壳 ↔ 任务运行时的唯一接缝（ADR-002：壳 + 后端进程组）。
//!
//! 这里是全仓**唯一**知道"任务到底跑在哪个进程里"的地方。上层（routes /
//! services/jobs）只看见 `JobRuntimeLauncher` 与 `RuntimeControl` 两个门面，
//! 换落点不影响它们一行代码。
//!
//! 两种落点：
//! - `InProcess`（默认）：闭包直调 `spawn_job`，与拆分前逐字节同行为
//! - `Remote`：经内部 HTTP 交给 retain-jobsd 进程
//!   （契约 backend-root/contracts/jobs-control.v1.schema.json）
//!
//! 取消/清理刻意保持返回 `()`：进程内实现本就不会失败，远端失败只记日志而
//! 不改变上层控制流——否则"取消"这个高频路径会因 jobsd 抖动而向用户报错，
//! 而任务终态本来就由 DB 轮询兜底。终止进程树保留 `Result`，因为调用方
//! （control.rs）本就依赖它的失败来决定是否继续走强制终态。

use std::collections::HashSet;
use std::sync::Arc;

use tokio::sync::RwLock;

use crate::config::{JobRunnerConfig, JobsServiceConfig};
use crate::error::AppError;
use crate::job_runner::{clear_cancel_request_with_registry, request_cancel_with_registry};
pub(crate) use crate::job_runner::{
    translation_artifacts_are_ready, translation_checkpoint_candidate_is_ready, JobDriverRegistry,
};
use crate::process::terminate_job_process_tree;

/// 内部 HTTP 客户端：把接缝操作转发给 retain-jobsd。
#[derive(Clone)]
pub struct JobsClient {
    client: reqwest::Client,
    base_url: String,
    api_key: String,
}

impl JobsClient {
    pub fn new(config: &JobsServiceConfig, api_key: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: config.base_url(),
            api_key,
        }
    }

    async fn post(&self, path: &str) -> Result<(), AppError> {
        self.send(reqwest::Method::POST, path).await
    }

    async fn delete(&self, path: &str) -> Result<(), AppError> {
        self.send(reqwest::Method::DELETE, path).await
    }

    async fn send(&self, method: reqwest::Method, path: &str) -> Result<(), AppError> {
        let url = format!("{}{path}", self.base_url);
        let response = self
            .client
            .request(method, &url)
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .map_err(|error| {
                AppError::service_unavailable(format!("任务服务不可用（{path}）：{error}"))
            })?;
        if !response.status().is_success() {
            return Err(AppError::internal(format!(
                "任务服务拒绝了请求（{path}）：HTTP {}",
                response.status()
            )));
        }
        Ok(())
    }
}

/// 任务运行时落点。壳启动时装配一次，此后只读。
pub enum JobRuntime {
    InProcess {
        canceled_jobs: Arc<RwLock<HashSet<String>>>,
    },
    Remote {
        client: JobsClient,
    },
}

impl JobRuntime {
    pub fn in_process(canceled_jobs: Arc<RwLock<HashSet<String>>>) -> Self {
        Self::InProcess { canceled_jobs }
    }

    pub fn remote(config: &JobsServiceConfig, api_key: String) -> Self {
        Self::Remote {
            client: JobsClient::new(config, api_key),
        }
    }

    /// 远端发射：fire-and-forget，与进程内闭包同语义（受理即返回）。
    /// 进程内模式不走这里——它需要应用装配层的运行时依赖，闭包在
    /// app/jobs.rs 就地构造（服务层不得触碰应用状态，见架构门禁）。
    pub async fn launch_remote(&self, job_id: String) {
        let Self::Remote { client } = self else {
            tracing::error!("launch_remote 被进程内运行时调用，任务未发射 job={job_id}");
            return;
        };
        if let Err(error) = client
            .post(&format!("/internal/v1/jobs/{job_id}/launch"))
            .await
        {
            tracing::error!("launch 转发任务服务失败 job={job_id}: {error}");
        }
    }

    async fn request_cancel(&self, job_id: &str) {
        match self {
            Self::InProcess { canceled_jobs } => {
                request_cancel_with_registry(canceled_jobs, job_id).await
            }
            Self::Remote { client } => {
                if let Err(error) = client
                    .post(&format!("/internal/v1/jobs/{job_id}/cancel"))
                    .await
                {
                    tracing::warn!("cancel 转发任务服务失败 job={job_id}: {error}");
                }
            }
        }
    }

    async fn clear_cancel(&self, job_id: &str) {
        match self {
            Self::InProcess { canceled_jobs } => {
                clear_cancel_request_with_registry(canceled_jobs, job_id).await
            }
            Self::Remote { client } => {
                if let Err(error) = client
                    .delete(&format!("/internal/v1/jobs/{job_id}/cancel"))
                    .await
                {
                    tracing::warn!("clear-cancel 转发任务服务失败 job={job_id}: {error}");
                }
            }
        }
    }

    async fn terminate_process(&self, pid: u32, config: &JobRunnerConfig) -> Result<(), AppError> {
        match self {
            Self::InProcess { .. } => terminate_job_process_tree(
                pid,
                config.worker_terminate_grace_secs,
                config.worker_terminate_poll_ms,
            )
            .await
            .map_err(|e| AppError::internal(format!("failed to terminate job process tree: {e}"))),
            // 远端模式下 worker 是 jobsd 的子进程：必须由 jobsd 组杀，壳直接
            // 杀会绕过它的进程组记账。
            Self::Remote { client } => {
                client
                    .post(&format!("/internal/v1/processes/{pid}/terminate"))
                    .await
            }
        }
    }
}

#[derive(Clone)]
pub struct JobRuntimeLauncher {
    launch_job: Arc<dyn Fn(String) + Send + Sync + 'static>,
}

impl JobRuntimeLauncher {
    pub fn new(launch_job: Arc<dyn Fn(String) + Send + Sync + 'static>) -> Self {
        Self { launch_job }
    }

    pub fn launch(&self, job_id: String) {
        (self.launch_job)(job_id);
    }
}

#[derive(Clone, Copy)]
pub struct RuntimeControl<'a> {
    runtime: &'a JobRuntime,
}

impl<'a> RuntimeControl<'a> {
    pub fn new(runtime: &'a JobRuntime) -> Self {
        Self { runtime }
    }

    /// 终止进程树与取消共用同一落点：远端模式下必须由 jobsd 组杀。
    pub fn job_runtime(&self) -> &'a JobRuntime {
        self.runtime
    }

    pub async fn request_cancel(&self, job_id: &str) {
        self.runtime.request_cancel(job_id).await;
    }

    /// Removes a pending cancel-request entry for `job_id` without waiting for
    /// a runner to consume it. Used when a cancel request races a job that
    /// has already reached a terminal state, so the in-memory registry does
    /// not accumulate orphaned entries that no runner will ever clear.
    pub async fn clear_cancel(&self, job_id: &str) {
        self.runtime.clear_cancel(job_id).await;
    }
}

pub async fn terminate_runtime_process(
    runtime: &JobRuntime,
    pid: u32,
    config: &JobRunnerConfig,
) -> Result<(), AppError> {
    runtime.terminate_process(pid, config).await
}
