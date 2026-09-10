//! retainpdf-ai 子服务监督配置（Phase 2：监督统一，见 docs/core/backend/ARCHITECTURE.md）。
//!
//! 默认关闭（`RUST_API_AI_SUPERVISE` 未开时保持现状：开发模式手动跑
//! ai_service / 桌面端自己拉起）。开启后 rust_api 成为 ai_service 的唯一
//! supervisor：拉起、readyz 探活、崩溃退避重启、随服务优雅退出回收——
//! 桌面端只需拉 rust 一个进程。

use std::path::PathBuf;
use std::time::Duration;

use super::env_vars::{env_bool, env_string, env_u16, env_u32, env_u64};

#[derive(Clone, Debug)]
pub struct AiServiceConfig {
    /// 监督开关（RUST_API_AI_SUPERVISE，默认 false = 完全不介入）
    pub supervise: bool,
    /// 启动命令（RUST_API_AI_COMMAND；缺省用 python_bin）
    pub command: String,
    /// 启动参数（RUST_API_AI_ARGS，空格分隔；缺省 `-m retainpdf_ai`）
    pub args: Vec<String>,
    /// 工作目录（RUST_API_AI_CWD；缺省 <project_root>/backend/ai）
    pub cwd: Option<PathBuf>,
    /// ai_service 监听绑定地址（RUST_API_AI_HOST，默认 127.0.0.1 = 仅回环）
    pub bind_host: String,
    /// ai_service 监听端口（RUST_API_AI_PORT，默认 41100，与 ai_proxy 缺省一致）
    pub port: u16,
    /// readyz 就绪等待上限
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

impl AiServiceConfig {
    pub fn from_env(project_root: &std::path::Path, python_bin: &str) -> Self {
        let command = std::env::var("RUST_API_AI_COMMAND")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| python_bin.to_string());
        let args = std::env::var("RUST_API_AI_ARGS")
            .ok()
            .map(|v| {
                v.split_whitespace()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            })
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| vec!["-m".to_string(), "retainpdf_ai".to_string()]);
        let cwd = std::env::var("RUST_API_AI_CWD")
            .ok()
            .map(PathBuf::from)
            .filter(|p| p.is_dir())
            .or_else(|| {
                let fallback_candidates = [project_root.join("backend").join("ai")];
                fallback_candidates.into_iter().find(|p| p.is_dir())
            });
        Self {
            supervise: env_bool("RUST_API_AI_SUPERVISE", false),
            command,
            args,
            cwd,
            bind_host: env_string("RUST_API_AI_HOST", "127.0.0.1"),
            port: env_u16("RUST_API_AI_PORT", 41100),
            startup_timeout: Duration::from_secs(env_u64("RUST_API_AI_STARTUP_TIMEOUT_SECS", 30)),
            health_interval: Duration::from_secs(env_u64("RUST_API_AI_HEALTH_INTERVAL_SECS", 5)),
            health_fail_threshold: env_u32("RUST_API_AI_HEALTH_FAIL_THRESHOLD", 3),
            backoff_initial: Duration::from_millis(env_u64("RUST_API_AI_BACKOFF_INITIAL_MS", 500)),
            backoff_max: Duration::from_millis(env_u64("RUST_API_AI_BACKOFF_MAX_MS", 30_000)),
            health_probe_connect_timeout: Duration::from_secs(env_u64(
                "RUST_API_AI_HEALTH_PROBE_CONNECT_TIMEOUT_SECS",
                1,
            )),
            health_probe_timeout: Duration::from_secs(env_u64(
                "RUST_API_AI_HEALTH_PROBE_TIMEOUT_SECS",
                2,
            )),
        }
    }

    /// ai_service 内部基址；默认仅回环（bind_host 可通过 RUST_API_AI_HOST 覆盖）。
    pub fn base_url(&self) -> String {
        format!("http://{}:{}", self.bind_host, self.port)
    }

    pub fn health_url(&self) -> String {
        format!("{}/readyz", self.base_url())
    }
}

impl Default for AiServiceConfig {
    /// 测试/嵌入场景的安全默认：监督关闭，其余取生产缺省。
    fn default() -> Self {
        Self {
            supervise: false,
            command: "python3".to_string(),
            args: vec!["-m".to_string(), "retainpdf_ai".to_string()],
            cwd: None,
            bind_host: "127.0.0.1".to_string(),
            port: 41100,
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
    fn defaults_are_off_and_sane() {
        // 不设 env 时：监督关闭、端口与 ai_proxy 缺省一致、退避递增有上限
        let config = AiServiceConfig::from_env(std::path::Path::new("/nonexistent"), "python3");
        assert!(!config.supervise, "监督必须默认关闭（现状兼容）");
        assert_eq!(config.port, 41100);
        assert_eq!(config.command, "python3");
        assert_eq!(config.args, vec!["-m", "retainpdf_ai"]);
        assert_eq!(config.health_url(), "http://127.0.0.1:41100/readyz");
        assert!(config.backoff_initial < config.backoff_max);
        assert!(config.health_fail_threshold >= 1);
    }
}
