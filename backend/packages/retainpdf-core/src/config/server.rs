use super::env_vars::{env_string, env_u16, env_u64_allow_zero};

#[derive(Clone, Debug)]
pub struct ServerRuntimeConfig {
    pub python_bin: String,
    pub bind_host: String,
    pub port: u16,
    pub shutdown_grace_secs: u64,
}

/// 收到停机信号以后最多等还没结束的请求多少秒（`RUST_API_SHUTDOWN_GRACE_SECS`）。
///
/// 桌面壳和 `docker stop` 都只给 10 秒就 SIGKILL。进程内模式最坏要：这段等待 + 停 tokio 运行时 1 秒 + 并行停 worker
/// 3 秒多（`worker_terminate_grace_secs`；Python 翻译在这段里最多等 2 秒把在途请求等回来），取 3 秒合计约 7.5 秒。
/// 远端模式（打包桌面版）停 jobsd 和这段等待同时进行，jobsd 最多给 `worker_terminate_grace_secs` + 3 秒
/// （见 rust_api 的 `jobsd_supervisor`），之后停运行时 1 秒，合计约 7 秒。改大要一起看这笔账。
pub const DEFAULT_SHUTDOWN_GRACE_SECS: u64 = 3;

impl ServerRuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            python_bin: env_string("PYTHON_BIN", "python"),
            // Default to loopback-only: binding 0.0.0.0 by default combined with
            // a single static API key would expose the API to the network
            // unintentionally (single-mode CORS and the Host check are in
            // config/origin_policy.rs). Docker deployments need
            // 0.0.0.0 inside the container, so they set RUST_API_BIND_HOST=0.0.0.0
            // explicitly (see docker/delivery/docker/app.env).
            bind_host: env_string("RUST_API_BIND_HOST", "127.0.0.1"),
            port: env_u16("RUST_API_PORT", 41000),
            shutdown_grace_secs: shutdown_grace_secs_from_env(),
        }
    }

    pub fn from_desktop(python_bin: String, port: u16) -> Self {
        Self {
            python_bin,
            bind_host: "127.0.0.1".to_string(),
            port,
            shutdown_grace_secs: shutdown_grace_secs_from_env(),
        }
    }
}

/// `0` 是收到信号就不等（连接直接断开）。
fn shutdown_grace_secs_from_env() -> u64 {
    env_u64_allow_zero("RUST_API_SHUTDOWN_GRACE_SECS", DEFAULT_SHUTDOWN_GRACE_SECS)
}
