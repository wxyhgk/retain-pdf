use std::collections::HashSet;
use std::process::ExitStatus;
use std::sync::Arc;
use std::time::Instant;

use anyhow::{Context, Result};
use tokio::sync::{Mutex, RwLock};
use tokio::time::{timeout, Duration};

use crate::config::WorkerProcessRuntimeConfig;
use crate::models::domain::JobRuntimeState;

use super::super::{terminate_child_process_tree, JobPersistDeps};
use super::io_support::{read_stdout, read_stream};
use super::timeout_support::persist_timeout_failure;

/// 进程退出(或被杀并 reap)之后,还要等 stdout / stderr 的读取任务收尾。
///
/// 正常情况下写端一关,`next_line()` 立刻返回 `None`,这两个 join 是瞬时的。
/// 但 worker 派生的孙进程若自己 `setpgid` 脱出了进程组、又继承着这两个管道
/// 的写端,`terminate_job_process_tree` 的组杀就打不到它——管道永远不关闭,
/// `next_line()` 也就永远不返回。无条件 `await` 会让 runner 在这里无限期挂住:
/// 这个 job 再不推进,DB 里停在 running,而且没有任何日志说明发生了什么。
///
/// 所以给收尾 join 一个上限(`RUST_API_WORKER_OUTPUT_DRAIN_SECS`,默认 30 秒),
/// 超时就放弃那段输出、abort 掉读取任务,带着已知信息走完终态。少收一段
/// stdout 远好过一个永远卡死的 runner。
pub(super) struct CompletedProcess {
    pub(super) status: ExitStatus,
    pub(super) started: Instant,
    pub(super) stdout_text: String,
    pub(super) stderr_text: String,
    pub(super) latest_job: JobRuntimeState,
}

pub(super) enum ProcessExecution {
    Completed(CompletedProcess),
    TimedOut(JobRuntimeState),
}

/// 两条互相独立的超时。
///
/// `Total` 是 `timeout_seconds`,整段执行的上限,必须按最坏情况给——一本大
/// 部头翻译几个小时是正常的。`NoOutput` 是 `no_output_timeout_seconds`,盯的
/// 是"还在不在动":卡在第一页之后没有任何 stdout,不该等满那几个小时才被
/// 发现。两者阈值差一两个数量级是常态,所以不能合并成一个。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum TimeoutKind {
    Total,
    NoOutput,
}

enum WaitOutcome {
    Exited(ExitStatus),
    TimedOut(TimeoutKind),
}

/// 同时盯总时长与空闲时长。轮询而不是 select,因为空闲的截止时刻会随每一行
/// 输出往后推,没法预先算出一个固定的 sleep。
///
/// `child.wait()` 是 cancel-safe 的(tokio 文档明写),所以每轮重建它是安全的。
async fn wait_with_limits(
    child: &mut tokio::process::Child,
    total_secs: i64,
    no_output_secs: i64,
    last_output_at: &Mutex<Instant>,
    started: Instant,
) -> Result<WaitOutcome> {
    if total_secs <= 0 && no_output_secs <= 0 {
        return Ok(WaitOutcome::Exited(child.wait().await?));
    }
    let poll = Duration::from_millis(250);
    loop {
        if let Ok(status) = timeout(poll, child.wait()).await {
            return Ok(WaitOutcome::Exited(status?));
        }
        if total_secs > 0 && started.elapsed() >= Duration::from_secs(total_secs as u64) {
            return Ok(WaitOutcome::TimedOut(TimeoutKind::Total));
        }
        if no_output_secs > 0 {
            let idle = last_output_at.lock().await.elapsed();
            if idle >= Duration::from_secs(no_output_secs as u64) {
                return Ok(WaitOutcome::TimedOut(TimeoutKind::NoOutput));
            }
        }
    }
}

pub(super) async fn collect_process_execution(
    persist: &JobPersistDeps,
    canceled_jobs: &Arc<RwLock<HashSet<String>>>,
    worker_runtime: &WorkerProcessRuntimeConfig<'_>,
    mut child: tokio::process::Child,
    job: JobRuntimeState,
    runtime_secrets: Vec<String>,
    extra_cancel_job_ids: &[String],
) -> Result<ProcessExecution> {
    let job_id = job.job_id.clone();
    let drain_secs = worker_runtime.worker_output_drain_secs;
    let stdout = child.stdout.take().context("missing stdout pipe")?;
    let stderr = child.stderr.take().context("missing stderr pipe")?;
    let timeout_secs = job.request_payload.runtime.timeout_seconds;
    let no_output_secs = job.request_payload.runtime.no_output_timeout_seconds;
    let started = Instant::now();
    let last_output_at = Arc::new(Mutex::new(started));
    let stdout_handle = tokio::spawn(read_stdout(
        persist.clone(),
        canceled_jobs.clone(),
        job,
        stdout,
        runtime_secrets.clone(),
        extra_cancel_job_ids.to_vec(),
        last_output_at.clone(),
    ));
    let stderr_handle = tokio::spawn(read_stream(stderr, runtime_secrets));

    let status = {
        match wait_with_limits(
            &mut child,
            timeout_secs,
            no_output_secs,
            &last_output_at,
            started,
        )
        .await?
        {
            WaitOutcome::Exited(status) => status,
            WaitOutcome::TimedOut(kind) => {
                // 边发信号边 wait()：退出即返回并回收，不会留下僵尸（child
                // 没有 kill_on_drop，下面丢弃它之前必须回收）；SIGKILL 后的
                // 回收等待有上限，卡死的子进程不会把 runner 挂住。
                if terminate_child_process_tree(
                    &mut child,
                    worker_runtime.worker_terminate_grace_secs,
                )
                .await
                .is_none()
                {
                    tracing::warn!(
                        "timed out waiting to reap worker process after termination; it may remain a zombie until the server exits"
                    );
                }
                let (stdout_text, stdout_job) =
                    drain_stdout(stdout_handle, persist, &job_id, drain_secs).await?;
                let stderr_text = drain_stderr(stderr_handle, &job_id, drain_secs).await;
                return Ok(ProcessExecution::TimedOut(persist_timeout_failure(
                    persist,
                    worker_runtime.project_root,
                    stdout_job,
                    started,
                    stdout_text,
                    stderr_text,
                    kind,
                    no_output_secs,
                )?));
            }
        }
    };

    let (stdout_text, latest_job) =
        drain_stdout(stdout_handle, persist, &job_id, drain_secs).await?;
    let stderr_text = drain_stderr(stderr_handle, &job_id, drain_secs).await;
    Ok(ProcessExecution::Completed(CompletedProcess {
        status,
        started,
        stdout_text,
        stderr_text,
        latest_job,
    }))
}

/// 见 [`collect_process_execution`] 顶部关于收尾上限的说明。放弃时的 job 状态从 DB 重读——读取任务
/// 已经把它一路 checkpoint 进去了,内存里那份没有额外信息。
async fn drain_stdout(
    mut handle: tokio::task::JoinHandle<Result<(String, JobRuntimeState)>>,
    persist: &JobPersistDeps,
    job_id: &str,
    drain_secs: u64,
) -> Result<(String, JobRuntimeState)> {
    match timeout(Duration::from_secs(drain_secs), &mut handle).await {
        Ok(joined) => joined?,
        Err(_) => {
            handle.abort();
            tracing::warn!(
                "job={job_id}: 进程已退出但 stdout 读取任务 {drain_secs}s 未结束，\
                 疑有脱离进程组的孙进程仍持有管道写端；放弃收集 stdout 继续收尾"
            );
            Ok((String::new(), persist.db.get_job(job_id)?.into_runtime()))
        }
    }
}

/// 见 [`collect_process_execution`] 顶部关于收尾上限的说明。stderr 只用于附在失败信息里,拿不到就
/// 空着,不值得为它让整个收尾失败。
async fn drain_stderr(
    mut handle: tokio::task::JoinHandle<Result<String>>,
    job_id: &str,
    drain_secs: u64,
) -> String {
    match timeout(Duration::from_secs(drain_secs), &mut handle).await {
        Ok(Ok(Ok(text))) => text,
        Ok(Ok(Err(error))) => {
            tracing::warn!("job={job_id}: 读取 stderr 失败: {error:#}");
            String::new()
        }
        Ok(Err(error)) => {
            tracing::warn!("job={job_id}: stderr 读取任务异常退出: {error:#}");
            String::new()
        }
        Err(_) => {
            handle.abort();
            tracing::warn!(
                "job={job_id}: 进程已退出但 stderr 读取任务 {drain_secs}s 未结束；\
                 放弃收集 stderr 继续收尾"
            );
            String::new()
        }
    }
}
