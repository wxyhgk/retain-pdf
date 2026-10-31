use std::collections::HashSet;
use std::process::ExitStatus;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use anyhow::{Context, Result};
use tokio::sync::{Mutex, RwLock};
use tokio::time::{timeout, Duration};

use crate::config::WorkerProcessRuntimeConfig;
use crate::models::domain::JobRuntimeState;

use super::super::worker_process::max_runtime_secs;
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

/// 三条互相独立的超时。
///
/// `NoProgress` 是 `timeout_seconds`:多久没有进展(完成一页、一批,进了一个新阶段,提交了检查点,
/// 见 `io_support::read_stdout`)。以前它从进程启动算整段时长,前端默认发 1800 秒,翻译 agent 按页顺序翻、
/// 每页十几秒,一百二三十页的书就在半路被杀(2026-10-31)。现在一直出页就一直跑,半小时一页都没出来才算卡住。
/// `MaxRuntime` 是绝对上限(`RUST_API_WORKER_MAX_RUNTIME_SECS`,默认 24 小时;请求的 `timeout_seconds`
/// 更大时以请求为准),防死循环一直烧钱。`NoOutput` 是 `no_output_timeout_seconds`,盯的是"有没有任何输出"。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum TimeoutKind {
    NoProgress,
    MaxRuntime,
    NoOutput,
}

/// 三条超时的阈值(秒,`0` 是不查)。
#[derive(Clone, Copy, Debug)]
pub(super) struct TimeoutLimits {
    pub(super) no_progress_secs: i64,
    pub(super) max_runtime_secs: i64,
    pub(super) no_output_secs: i64,
}

impl TimeoutLimits {
    fn for_job(job: &JobRuntimeState, worker_max_runtime_secs: u64) -> Self {
        Self {
            no_progress_secs: job.request_payload.runtime.timeout_seconds,
            max_runtime_secs: i64::try_from(max_runtime_secs(job, worker_max_runtime_secs))
                .unwrap_or(i64::MAX),
            no_output_secs: job.request_payload.runtime.no_output_timeout_seconds,
        }
    }

    /// 给用户看的那句话:三种超时的排查方向不同,要分开说。
    pub(super) fn detail(&self, kind: TimeoutKind) -> String {
        match kind {
            TimeoutKind::NoProgress => format!("no progress for {}s", self.no_progress_secs),
            TimeoutKind::MaxRuntime => format!("max runtime {}s exceeded", self.max_runtime_secs),
            TimeoutKind::NoOutput => format!("no output for {}s", self.no_output_secs),
        }
    }
}

fn elapsed_at_least(since: Instant, secs: i64) -> bool {
    secs > 0 && since.elapsed() >= Duration::from_secs(secs as u64)
}

enum WaitOutcome {
    Exited(ExitStatus),
    TimedOut(TimeoutKind),
    /// 任务行被删了（强制删除）：没有人再关心这个 worker 的结果，必须停掉它。
    RowGone,
    /// 读 stdout 的任务出错退出了（落库连续失败、和 worker 的约定对不上……）：没人再读管道，
    /// 这次运行的结果也不会被认，停掉 worker，别让它白跑（白花模型的钱）到总超时。
    ReaderFailed,
}

/// 同时盯进展、总时长与空闲时长。轮询而不是 select,因为进展和空闲的截止时刻会随输出往后推,
/// 没法预先算出一个固定的 sleep。
///
/// `child.wait()` 是 cancel-safe 的(tokio 文档明写),所以每轮重建它是安全的。
async fn wait_with_limits(
    child: &mut tokio::process::Child,
    limits: TimeoutLimits,
    last_output_at: &Mutex<Instant>,
    last_progress_at: &Mutex<Instant>,
    started: Instant,
    row_gone: &AtomicBool,
    reader_failed: &AtomicBool,
) -> Result<WaitOutcome> {
    let poll = Duration::from_millis(250);
    loop {
        if let Ok(status) = timeout(poll, child.wait()).await {
            return Ok(WaitOutcome::Exited(status?));
        }
        if row_gone.load(Ordering::SeqCst) {
            return Ok(WaitOutcome::RowGone);
        }
        if reader_failed.load(Ordering::SeqCst) {
            return Ok(WaitOutcome::ReaderFailed);
        }
        if elapsed_at_least(started, limits.max_runtime_secs) {
            return Ok(WaitOutcome::TimedOut(TimeoutKind::MaxRuntime));
        }
        if elapsed_at_least(*last_progress_at.lock().await, limits.no_progress_secs) {
            return Ok(WaitOutcome::TimedOut(TimeoutKind::NoProgress));
        }
        if elapsed_at_least(*last_output_at.lock().await, limits.no_output_secs) {
            return Ok(WaitOutcome::TimedOut(TimeoutKind::NoOutput));
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
    let limits = TimeoutLimits::for_job(&job, worker_runtime.worker_max_runtime_secs);
    let started = Instant::now();
    let last_output_at = Arc::new(Mutex::new(started));
    let last_progress_at = Arc::new(Mutex::new(started));
    let row_gone = Arc::new(AtomicBool::new(false));
    let reader_failed = Arc::new(AtomicBool::new(false));
    let reader = read_stdout(
        persist.clone(),
        canceled_jobs.clone(),
        job,
        stdout,
        runtime_secrets.clone(),
        extra_cancel_job_ids.to_vec(),
        last_output_at.clone(),
        last_progress_at.clone(),
        row_gone.clone(),
    );
    let stdout_handle = tokio::spawn({
        let reader_failed = reader_failed.clone();
        async move {
            let result = reader.await;
            if result.is_err() {
                reader_failed.store(true, Ordering::SeqCst);
            }
            result
        }
    });
    let stderr_handle = tokio::spawn(read_stream(stderr, runtime_secrets));

    let status = {
        match wait_with_limits(
            &mut child,
            limits,
            &last_output_at,
            &last_progress_at,
            started,
            &row_gone,
            &reader_failed,
        )
        .await?
        {
            WaitOutcome::Exited(status) => status,
            WaitOutcome::RowGone => {
                // 任务被强制删除：终止整棵进程树并回收，之后照常收尾（收尾会认出行已删，不再写任何东西）。
                tracing::warn!("job={job_id}: 任务行已被删除，终止 worker 进程");
                terminate_child_process_tree(&mut child, worker_runtime.worker_terminate_grace_secs)
                    .await;
                child.wait().await?
            }
            WaitOutcome::ReaderFailed => {
                // 下面的 drain_stdout 把读取任务的错误原样带出去，任务按失败收尾（检查点还在，可以续跑）。
                tracing::warn!("job={job_id}: stdout 读取任务出错，终止 worker 进程");
                terminate_child_process_tree(&mut child, worker_runtime.worker_terminate_grace_secs)
                    .await;
                child.wait().await?
            }
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
                    limits.detail(kind),
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
