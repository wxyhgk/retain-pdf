//! AI 专用密钥（`RUST_API_AGENT_KEYS`，2026-11-25）：只能调接口登记表里 `by(…)` 写了 `agent` 的接口，
//! 改译文只能 `source: "agent"`；主密钥照旧什么都能调。

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::read_json;
use crate::app::{build_app, build_state};
use crate::test_support::config::TestDirs;

const AGENT_KEY: &str = "agent-test-key";

fn state_with_agent_key(name: &str) -> crate::AppState {
    let dirs = TestDirs::create(&format!("rust-api-agent-key-{name}-{}", fastrand::u64(..)));
    let mut config = dirs.config();
    config.agent_keys = [AGENT_KEY.to_string()].into_iter().collect();
    build_state(Arc::new(config)).expect("build state")
}

async fn call(state: &crate::AppState, key: &str, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri).header("X-API-Key", key);
    if body.is_some() {
        builder = builder.header("content-type", "application/json");
    }
    let request = builder
        .body(body.map(|value| Body::from(value.to_string())).unwrap_or_else(Body::empty))
        .expect("request");
    let response = build_app(state.clone()).oneshot(request).await.expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

#[tokio::test]
async fn agent_key_reaches_only_endpoints_registered_for_agent() {
    let state = state_with_agent_key("scope");

    // 登记了 agent 的：放行（书库是空的，照样 200）。
    for uri in ["/api/v1/documents", "/api/v1/search?q=oscillator"] {
        let (status, body) = call(&state, AGENT_KEY, "GET", uri, None).await;
        assert_eq!(status, StatusCode::OK, "{uri}: {body}");
    }

    // 没登记 agent 的：403，带稳定原因；同一个地址换个没登记的方法也一样。
    for (method, uri) in [
        ("GET", "/api/v1/jobs"),
        ("POST", "/api/v1/backups"),
        ("GET", "/api/v1/credentials"),
        ("DELETE", "/api/v1/documents/doc-x"),
        ("PATCH", "/api/v1/documents/doc-x"),
    ] {
        let (status, body) = call(&state, AGENT_KEY, method, uri, Some(json!({}))).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{method} {uri}: {body}");
        assert_eq!(body["code"], 40300, "{method} {uri}");
        assert_eq!(body["error"]["details"]["reason"], "agent_key_not_allowed", "{method} {uri}");
    }

    // 地址不存在的照常 404，不说成 403。
    let (status, _) = call(&state, AGENT_KEY, "GET", "/api/v1/no-such-route", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // 主密钥不受影响。
    let (status, body) = call(&state, "test-key", "GET", "/api/v1/jobs", None).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    // 不在任何一边的 key 照旧 401。
    let (status, _) = call(&state, "wrong-key", "GET", "/api/v1/documents", None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn agent_key_revisions_must_be_recorded_as_agent() {
    let state = state_with_agent_key("source");
    let uri = "/api/v1/jobs/job-missing/translations/p001-b001";

    for source in ["user", "refine"] {
        let (status, body) =
            call(&state, AGENT_KEY, "PATCH", uri, Some(json!({"translated_text": "译文", "source": source}))).await;
        assert_eq!(status, StatusCode::FORBIDDEN, "{source}: {body}");
        assert_eq!(body["error"]["details"]["reason"], "agent_source_required", "{source}");
    }
    // source 写 agent 就过了这一关，往下走到「没有这个任务」。
    let (status, body) =
        call(&state, AGENT_KEY, "PATCH", uri, Some(json!({"translated_text": "译文", "source": "agent"}))).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
    // 主密钥写什么来源都行（前端编辑框写 user）。
    let (status, body) =
        call(&state, "test-key", "PATCH", uri, Some(json!({"translated_text": "译文", "source": "user"}))).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
}
