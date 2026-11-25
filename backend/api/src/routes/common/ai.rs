//! 阅读页提问（`routes/ai.rs`）要的配置：ACP 桥的后端配置、WebSocket 握手的来源检查。
use axum::http::{header, HeaderMap};

use crate::app::AppState;
use crate::services::providers::{loopback_base_url, AcpConfig};

use super::request_origin_is_allowed;

pub fn build_acp_config(state: &AppState) -> AcpConfig {
    let config = &state.config;
    AcpConfig {
        multi_user: config.accounts.mode.is_multi(),
        listens_on_loopback: config.listens_on_loopback(),
        data_root: config.data_root.clone(),
        python_bin: config.python_bin.clone(),
        agent_keys: config.agent_keys.clone(),
        api_keys: config.api_keys.clone(),
        backend_url: loopback_base_url(&config.bind_host, config.port),
        local_agents_flag: std::env::var("RUST_API_LOCAL_AGENTS").ok(),
        path_var: std::env::var_os("PATH"),
        current_exe: std::env::current_exe().ok(),
    }
}

/// 浏览器发来的 `Origin`：单机照 CORS 那套（回环页面、同主机、`RUST_API_ALLOWED_ORIGINS`）；多用户只认配置里的来源。
/// 没带 `Origin` 的（命令行、桌面壳）放行，认证已经过了。
pub fn websocket_origin_allowed(state: &AppState, headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(header::ORIGIN) else {
        return true;
    };
    if state.config.accounts.mode.is_multi() {
        return origin
            .to_str()
            .is_ok_and(|origin| state.config.accounts.allowed_origins.iter().any(|allowed| allowed == origin));
    }
    request_origin_is_allowed(&state.config.origin_policy, headers, origin)
}
