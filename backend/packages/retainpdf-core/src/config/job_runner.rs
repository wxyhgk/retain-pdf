use super::env_vars::{env_u64, env_u64_allow_zero};

/// 排队任务最多多少个（`RUST_API_MAX_QUEUED_JOBS` 的默认值）。批量交几百本书够用；再多就是脚本跑飞了。
pub const DEFAULT_MAX_QUEUED_JOBS: u64 = 1000;

/// 阶段进程的绝对时长上限默认值（`RUST_API_WORKER_MAX_RUNTIME_SECS`）：24 小时。
pub const DEFAULT_WORKER_MAX_RUNTIME_SECS: u64 = 24 * 3600;

/// 跑 job 的 tokio worker 线程栈大小。
///
/// tokio 默认沿用 std 的 2 MiB，而 book 工作流在 2 MiB 下**必然**栈溢出:
/// `run_job_with_ocr` 内联 await 了 `execute_ocr_job` → `execute_process_job`
/// → `collect_process_execution`,之后再接翻译与渲染,整条链的 async 状态机
/// 嵌套进同一个 Future(实测 60 KB),而 `JobSnapshot` 本身 3.6 KB 还在链上
/// 层层传递。溢出的表现是 `fatal runtime error: stack overflow` + SIGABRT,
/// 进程整个没掉——不是某个 job 失败,是运行时死亡。supervisor 重启后
/// `reconcile_stale_running_jobs` 又把当时正在跑的父任务判成"未记录 worker
/// pid"的孤儿,于是用户看到的错误完全指向了别处。
///
/// 实测(book + paddle,同一份 4 页 PDF):
///
/// | build   | 栈     | 结果            |
/// |---------|--------|-----------------|
/// | debug   | 2 MiB  | 崩,launch 后 2.4s |
/// | debug   | 4 MiB  | 通过            |
/// | debug   | 16 MiB | 通过            |
/// | release | 2 MiB  | 崩              |
///
/// release 同样会崩,所以这不是 debug 构建的取舍问题。4 MiB 已经够用,取
/// 8 MiB 留一倍余量——线程栈是虚拟内存预留,只有真正用到的页才会占物理内存,
/// 加大它几乎没有成本。
///
/// 这是把工作流跑起来的下限,不是"调用链该有多深"的结论;收敛那条链是另一
/// 件事。
pub const JOB_WORKER_THREAD_STACK_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone, Debug)]
pub struct JobRunnerConfig {
    pub queue_poll_interval_ms: u64,
    /// 排队（还没开跑）的任务到这么多就不接新任务、不原地重跑，429 `queue_full`
    /// （`RUST_API_MAX_QUEUED_JOBS`，默认 1000，`0` 不限）。在跑的不算。
    pub max_queued_jobs: u64,
    pub worker_terminate_grace_secs: u64,
    pub worker_terminate_poll_ms: u64,
    /// 进程退出后,等 stdout / stderr 读取任务收尾的上限(秒)。
    /// 正常情况下这两个 join 是瞬时的;设上限是为了防脱离进程组的孙进程
    /// 继承管道写端后把 runner 永久挂住。详见
    /// `job_runner::process_runner::execution` 里的说明。
    pub worker_output_drain_secs: u64,
    /// 一个阶段进程最多跑多久(秒),不管有没有进展(`RUST_API_WORKER_MAX_RUNTIME_SECS`,默认 24 小时)。
    ///
    /// `timeout_seconds` 从 2026-10-31 起按"多久没有进展"算,一直出页就一直不停;这道是防死循环一直
    /// 烧钱的绝对上限。请求里的 `timeout_seconds` 比它还大时以请求为准。
    pub worker_max_runtime_secs: u64,
    pub failure_ai_diagnosis_timeout_secs: u64,
    pub sync_bundle_wait_interval_ms: u64,
}

impl JobRunnerConfig {
    pub fn from_env() -> Self {
        Self {
            queue_poll_interval_ms: env_u64("RUST_API_QUEUE_POLL_INTERVAL_MS", 250),
            max_queued_jobs: env_u64_allow_zero("RUST_API_MAX_QUEUED_JOBS", DEFAULT_MAX_QUEUED_JOBS),
            worker_terminate_grace_secs: env_u64("RUST_API_WORKER_TERMINATE_GRACE_SECS", 3),
            worker_terminate_poll_ms: env_u64("RUST_API_WORKER_TERMINATE_POLL_MS", 100),
            worker_output_drain_secs: env_u64("RUST_API_WORKER_OUTPUT_DRAIN_SECS", 30),
            worker_max_runtime_secs: env_u64(
                "RUST_API_WORKER_MAX_RUNTIME_SECS",
                DEFAULT_WORKER_MAX_RUNTIME_SECS,
            ),
            failure_ai_diagnosis_timeout_secs: env_u64(
                "RUST_API_FAILURE_AI_DIAGNOSIS_TIMEOUT_SECS",
                60,
            ),
            sync_bundle_wait_interval_ms: env_u64("RUST_API_SYNC_BUNDLE_WAIT_INTERVAL_MS", 1500),
        }
    }
}

impl Default for JobRunnerConfig {
    fn default() -> Self {
        Self::from_env()
    }
}
