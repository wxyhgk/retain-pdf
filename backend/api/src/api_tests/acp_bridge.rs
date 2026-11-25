//! 阅读页提问的 agent 列表和 ACP 桥（2026-11-25）：起一个真的后端，WebSocket 连上去。
//! 自带 agent 的 Python 换成一个回声脚本（发进去什么回来什么），正好看到桥补进 `session/new` 的东西。
use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;
use tower::ServiceExt;

use crate::app::{build_app, build_state};
use crate::test_support::config::TestDirs;

use super::jobs_common::read_json;

#[cfg(unix)]
fn echo_python(dir: &std::path::Path) -> String {
    use std::os::unix::fs::PermissionsExt;
    let path = dir.join("fake-python");
    // 参数是 `-m retainpdf_ask_agent`：不管它，把收到的每行原样回去
    std::fs::write(&path, "#!/bin/sh\nexec cat\n").unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    path.to_string_lossy().into_owned()
}

#[cfg(unix)]
fn write_vault(data_root: &std::path::Path) {
    use std::os::unix::fs::PermissionsExt;
    let dir = data_root.join("secrets");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)).unwrap();
    let path = dir.join("credentials.json");
    std::fs::write(&path, r#"{"schema":"retainpdf_credential_vault_v1","credentials":{"cred_ask":{"kind":"translation_api_key","provider":"anthropic","secret":"synthetic-secret-value"}}}"#).unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
}

#[cfg(unix)]
fn state(name: &str) -> (crate::AppState, std::path::PathBuf) {
    let dirs = TestDirs::create(&format!("rust-api-acp-{name}-{}", fastrand::u64(..)));
    let mut config = dirs.config();
    let root = config.data_root.clone();
    std::fs::create_dir_all(root.join("books")).unwrap();
    config.python_bin = echo_python(&root);
    write_vault(&root);
    (build_state(Arc::new(config)).expect("build state"), root)
}

#[cfg(unix)]
#[tokio::test]
async fn lists_agents_with_the_builtin_one_first() {
    let (state, _) = state("list");
    let response = build_app(state)
        .oneshot(Request::get("/api/v1/ai/agents").header("x-api-key", "test-key").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = read_json(response).await;
    assert_eq!(body["data"]["agents"][0]["id"], "retainpdf");
    assert_eq!(body["data"]["agents"][0]["available"], true);
    assert!(body["data"]["local_agents"]["enabled"].is_boolean());
}

#[cfg(unix)]
#[tokio::test]
async fn query_key_only_counts_for_websocket_handshakes() {
    let (state, _) = state("query-key");
    let response = build_app(state)
        .oneshot(Request::get("/api/v1/ai/agents?api_key=test-key").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[cfg(unix)]
#[tokio::test]
async fn builtin_agent_bridge_relays_and_fills_in_session_new() {
    let (state, root) = state("bridge");
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let app = build_app(state);
    let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    let base = format!("ws://{address}/api/v1/ai/agents/retainpdf/acp?model=claude-haiku-5-5&api_protocol=anthropic&credential_ref=cred_ask");

    // 没带 key、来源不对、凭据不存在：升级前就拒
    for (url, origin) in [
        (base.clone(), None),
        (format!("{base}&api_key=test-key"), Some("https://evil.example")),
        (format!("{base}&api_key=test-key").replace("cred_ask", "cred_missing"), None),
    ] {
        let mut request = url.into_client_request().unwrap();
        if let Some(origin) = origin {
            request.headers_mut().insert("origin", origin.parse().unwrap());
        }
        assert!(tokio_tungstenite::connect_async(request).await.is_err());
    }

    let mut request = format!("{base}&api_key=test%2Dkey").into_client_request().unwrap();
    request.headers_mut().insert("origin", format!("http://{address}").parse().unwrap());
    let (mut socket, _) = tokio_tungstenite::connect_async(request).await.expect("handshake");
    socket
        .send(Message::Text(json!({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {"cwd": "", "mcpServers": []}}).to_string()))
        .await
        .unwrap();
    let reply = tokio::time::timeout(std::time::Duration::from_secs(5), socket.next()).await.unwrap().unwrap().unwrap();
    let Message::Text(text) = reply else { panic!("expected text, got {reply:?}") };
    let echoed: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(echoed["params"]["cwd"], root.join("books").to_string_lossy().as_ref());
    socket.close(None).await.unwrap();
    server.abort();
}
