//! 任务运行时落点配置（ADR-002：壳 + 后端进程组）。
//!
//! 默认 `InProcess` —— 与拆分前逐字节同行为，单进程跑，测试与桌面现状不受
//! 任何影响。设 `RUST_API_JOBS_MODE=remote` 后，壳把 launch/cancel/terminate
//! 四个操作经内部 HTTP 交给 retain-jobsd 进程执行（契约见
//! backend-root/contracts/jobs-control.v1.schema.json）。
//!
//! 拆开的收益是**开发粒度**：改路由/服务只重启壳，jobsd 与其 worker 子进程
//! 不受影响，正在跑的翻译任务继续。

use std::path::PathBuf;
use std::time::Duration;

use super::env_vars::{env_bool, env_string, env_u16, env_u32, env_u64};

/// 任务运行时跑在哪儿。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JobsRuntimeMode {
    /// 进程内直调（默认，历史行为）
    InProcess,
    /// 经内部 HTTP 交给 retain-jobsd
    Remote,
}

#[derive(Clone, Debug)]
pub struct JobsServiceConfig {
    pub mode: JobsRuntimeMode,
    /// jobsd 监听绑定地址（RUST_API_JOBS_HOST，默认 127.0.0.1 = 仅回环）
    pub bind_host: String,
    /// jobsd 监听端口（RUST_API_JOBS_PORT，默认 41002）
    pub port: u16,
    /// 是否由壳监督 jobsd 生命周期（RUST_API_JOBS_SUPERVISE，默认 false）
    pub supervise: bool,
    /// jobsd 启动命令（RUST_API_JOBSD_COMMAND；缺省为同目录 retain-jobsd 二进制）
    pub command: String,
    /// jobsd 启动参数（RUST_API_JOBSD_ARGS，空格分隔）
    pub args: Vec<String>,
    /// jobsd 工作目录（RUST_API_JOBSD_CWD）
    pub cwd: Option<PathBuf>,
    /// healthz 就绪等待上限
    pub startup_timeout: Duration,
    /// 探活间隔
    pub health_interval: Duration,
    /// 连续失败判定阈值
    pub health_fail_threshold: u32,
    /// 重启退避（初始 → 指数翻倍 → 上限）
    pub backoff_initial: Duration,
    pub backoff_max: Duration,
    /// 健康探活 HTTP 客户端连接/整体超时
    pub health_probe_connect_timeout: Duration,
    pub health_probe_timeout: Duration,
}

impl JobsServiceConfig {
    pub fn from_env() -> Self {
        let mode = match std::env::var("RUST_API_JOBS_MODE")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "remote" => JobsRuntimeMode::Remote,
            // 任何其他取值（含未设置、拼错）一律回落进程内：这个开关只应
            // 在明确要求时改变行为，绝不因笔误把生产拓扑换掉。
            _ => JobsRuntimeMode::InProcess,
        };
        let command = std::env::var("RUST_API_JOBSD_COMMAND")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_default();
        let args = std::env::var("RUST_API_JOBSD_ARGS")
            .ok()
            .map(|v| {
                v.split_whitespace()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            })
            .filter(|v| !v.is_empty())
            .unwrap_or_default();
        let cwd = std::env::var("RUST_API_JOBSD_CWD")
            .ok()
            .map(PathBuf::from)
            .filter(|p| p.is_dir());
        Self {
            mode,
            bind_host: env_string("RUST_API_JOBS_HOST", "127.0.0.1"),
            port: env_u16("RUST_API_JOBS_PORT", 41002),
            supervise: env_bool("RUST_API_JOBS_SUPERVISE", false),
            command,
            args,
            cwd,
            startup_timeout: Duration::from_secs(env_u64(
                "RUST_API_JOBSD_STARTUP_TIMEOUT_SECS",
                30,
            )),
            health_interval: Duration::from_secs(env_u64("RUST_API_JOBSD_HEALTH_INTERVAL_SECS", 5)),
            health_fail_threshold: env_u32("RUST_API_JOBSD_HEALTH_FAIL_THRESHOLD", 3),
            backoff_initial: Duration::from_millis(env_u64(
                "RUST_API_JOBSD_BACKOFF_INITIAL_MS",
                500,
            )),
            backoff_max: Duration::from_millis(env_u64("RUST_API_JOBSD_BACKOFF_MAX_MS", 30_000)),
            health_probe_connect_timeout: Duration::from_secs(env_u64(
                "RUST_API_JOBSD_HEALTH_PROBE_CONNECT_TIMEOUT_SECS",
                1,
            )),
            health_probe_timeout: Duration::from_secs(env_u64(
                "RUST_API_JOBSD_HEALTH_PROBE_TIMEOUT_SECS",
                2,
            )),
        }
    }

    /// jobsd 内部基址；默认仅回环（bind_host 可通过 RUST_API_JOBS_HOST 覆盖）。
    pub fn base_url(&self) -> String {
        format!("http://{}:{}", self.bind_host, self.port)
    }

    pub fn health_url(&self) -> String {
        format!("{}/healthz", self.base_url())
    }

    pub fn is_remote(&self) -> bool {
        self.mode == JobsRuntimeMode::Remote
    }
}

impl Default for JobsServiceConfig {
    fn default() -> Self {
        Self {
            mode: JobsRuntimeMode::InProcess,
            bind_host: "127.0.0.1".to_string(),
            port: 41002,
            supervise: false,
            command: String::new(),
            args: Vec::new(),
            cwd: None,
            startup_timeout: Duration::from_secs(30),
            health_interval: Duration::from_secs(5),
            health_fail_threshold: 3,
            backoff_initial: Duration::from_millis(500),
            backoff_max: Duration::from_millis(30_000),
            health_probe_connect_timeout: Duration::from_secs(1),
            health_probe_timeout: Duration::from_secs(2),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_in_process_so_existing_topology_is_untouched() {
        let config = JobsServiceConfig::default();
        assert_eq!(config.mode, JobsRuntimeMode::InProcess);
        assert!(!config.is_remote());
    }

    #[test]
    fn base_url_is_loopback_only() {
        let config = JobsServiceConfig {
            mode: JobsRuntimeMode::Remote,
            ..Default::default()
        };
        assert_eq!(config.base_url(), "http://127.0.0.1:41002");
    }

    #[test]
    fn supervise_defaults_to_disabled() {
        let config = JobsServiceConfig::default();
        assert!(!config.supervise);
        assert!(config.command.is_empty());
    }
}
