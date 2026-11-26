//! 阅读页提问（`routes/ai.rs`）要的配置：ACP 桥的后端配置、WebSocket 握手的来源检查。
use axum::http::{header, HeaderMap};

use crate::app::AppState;
use crate::error::AppError;
use crate::models::api::AskModelConnectionInput;
use crate::services::providers::{
    summarize_ask_conversation, AcpConnectQuery, default_openui_check_dir, default_openui_dir, loopback_base_url, AcpConfig, AGENTS_DIR_NAME, NODE_BIN_ENV, NODE_DIR_ENV, OPENUI_CHECK_DIR_ENV,
    OPENUI_DIR_ENV,
};

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
        // retainpdf-pi 的扩展、包装脚本和自带 agent 的提示词在仓库的 backend/ 下
        backend_root: Some(config.project_root.join("backend")).filter(|dir| dir.is_dir()),
        agents_dir: config.data_root.join(AGENTS_DIR_NAME),
        node_dir: std::env::var_os(NODE_DIR_ENV).filter(|dir| !dir.is_empty()).map(std::path::PathBuf::from),
        node_bin: std::env::var_os(NODE_BIN_ENV).filter(|bin| !bin.is_empty()).map(std::path::PathBuf::from),
        // 互动块：说明文件（contracts/openui）和检查器（backend/openui-check），桌面版、Docker 用环境变量指过来
        openui_dir: default_openui_dir(std::env::var_os(OPENUI_DIR_ENV).as_deref(), &config.project_root),
        openui_check_dir: default_openui_check_dir(std::env::var_os(OPENUI_CHECK_DIR_ENV).as_deref(), &config.project_root),
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

/// 阅读页提问第二期（2026-11-26）：后端生成摘要（压缩主对话、副对话结论）用的那一步——拿「哪条模型」去起 summarize 子命令。
/// 书库那边（`ask_compactions.rs`）只认这个闭包，不碰 ACP 桥的配置；在阻塞线程里调（子进程要等模型）。
pub fn ask_summarizer(state: &AppState) -> impl Fn(&AskModelConnectionInput, &serde_json::Value) -> Result<String, AppError> + Send + 'static {
    let config = build_acp_config(state);
    move |connection, request| {
        let query = AcpConnectQuery {
            model: connection.model.clone(),
            base_url: connection.base_url.clone(),
            api_protocol: connection.api_protocol.clone(),
            thinking: connection.thinking.clone(),
            credential_ref: connection.credential_ref.clone(),
            ..Default::default()
        };
        summarize_ask_conversation(&config, &query, request).map(|summary| summary.summary)
    }
}
