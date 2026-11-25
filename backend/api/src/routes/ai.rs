//! 阅读页提问：列 agent、ACP 桥（WebSocket）。逻辑在 providers 领域的 `acp`（列表、闸门、起进程、两头转）；
//! 这里只接 HTTP：取配置、查来源、升级 WebSocket、把 WebSocket 接到桥的两个通道上。
//! 方案：docs/ops/planning/reader-ask/20261125-后端ACP桥和自带agent.md。
use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_acp_config, run_job_query, websocket_origin_allowed, ApiPath, ApiQuery};
use crate::services::providers::{
    agents_view, ask_job_id, prepare_agent, run_bridge, AcpConnectQuery, AgentProcess, AgentsView, AskBook,
    BridgeOut, SessionDefaults, BUILTIN_AGENT_ID,
};
use crate::AppState;

/// 一条 ACP 消息最大多少字节（带几张截图的 prompt）。
const MAX_MESSAGE_BYTES: usize = 32 * 1024 * 1024;

/// GET /api/v1/ai/agents —— 能用哪些 agent（自带的、本机装的）。
pub async fn list_agents(State(state): State<AppState>) -> Result<Json<ApiResponse<AgentsView>>, AppError> {
    let config = build_acp_config(&state);
    let view = tokio::task::spawn_blocking(move || agents_view(&config))
        .await
        .map_err(|_| AppError::internal("listing agents failed"))?;
    Ok(Json(ApiResponse::ok(view)))
}

/// GET /api/v1/ai/agents/:agent_id/acp —— ACP 桥（WebSocket）：一条文字消息就是一条 JSON-RPC 2.0。
pub async fn acp_socket(
    State(state): State<AppState>,
    ApiPath(agent_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<AcpConnectQuery>,
    headers: HeaderMap,
    upgrade: WebSocketUpgrade,
) -> Result<Response, AppError> {
    if !websocket_origin_allowed(&state, &headers) {
        return Err(AppError::forbidden("origin is not allowed"));
    }
    let config = build_acp_config(&state);
    // 自带 agent 读哪本书：`?job_id=`（阅读页的任务，合并阅读的虚拟任务也行）。没有这个任务 404；多用户下归属由
    // enforce_access 按查询串里的 job_id 核过了。本机 agent 不看它。
    let book = match ask_job_id(&query)? {
        Some(job_id) if agent_id == BUILTIN_AGENT_ID => {
            let lookup = job_id.clone();
            let document_id = run_job_query(&state, format!("ask-book:{job_id}"), move |jobs| {
                jobs.ask_book_document_id(&lookup)
            })
            .await?;
            Some(AskBook { job_id, document_id })
        }
        _ => None,
    };
    let (process, defaults) = prepare_agent(&config, &agent_id, &headers, &query, book.as_ref())?;
    tracing::info!(agent = %agent_id, program = %process.program.display(), book = book.is_some(), "acp bridge: connecting");
    Ok(upgrade
        .max_message_size(MAX_MESSAGE_BYTES)
        .max_frame_size(MAX_MESSAGE_BYTES)
        .on_upgrade(move |socket| relay(socket, process, defaults)))
}

async fn relay(socket: WebSocket, process: AgentProcess, defaults: SessionDefaults) {
    let (mut sink, mut stream) = socket.split();
    let (to_bridge, incoming) = mpsc::channel::<String>(64);
    let (outgoing, mut from_bridge) = mpsc::channel::<BridgeOut>(64);
    let bridge = tokio::spawn(run_bridge(process, defaults, incoming, outgoing));
    let reader = async move {
        while let Some(Ok(message)) = stream.next().await {
            match message {
                Message::Text(text) => {
                    if to_bridge.send(text).await.is_err() {
                        break;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
        // to_bridge 在这里丢掉：桥看到客户端断开，结束 agent
    };
    let writer = async move {
        while let Some(out) = from_bridge.recv().await {
            match out {
                BridgeOut::Text(text) => {
                    if sink.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
                BridgeOut::Close { code, reason } => {
                    let _ = sink.send(Message::Close(Some(CloseFrame { code, reason: reason.into() }))).await;
                    break;
                }
            }
        }
    };
    // 哪头先结束都行：另一头的 future 被丢掉，通道跟着关，桥收尾
    tokio::select! {
        _ = reader => {}
        _ = writer => {}
    }
    let _ = bridge.await;
}
