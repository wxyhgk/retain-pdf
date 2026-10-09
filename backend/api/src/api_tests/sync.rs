//! 同步接口:两个后端(各自的数据目录)共用一个同步文件夹。

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::jobs_common::{read_json, test_state};
use crate::app::build_app;

async fn call(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let request = Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", "test-key")
        .header(header::CONTENT_TYPE, "application/json")
        .body(body.map_or_else(Body::empty, |b| Body::from(b.to_string())))
        .expect("request");
    let response = build_app(state.clone()).oneshot(request).await.expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

fn temp_folder(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("retain-sync-api-{name}-{:016x}", fastrand::u64(..)));
    std::fs::create_dir_all(&dir).expect("create folder");
    std::fs::canonicalize(dir).expect("canonical folder")
}

#[tokio::test]
async fn sync_is_off_until_a_folder_is_chosen_and_settings_are_checked() {
    let state = test_state("sync-settings");
    let (status, body) = call(&state, "GET", "/api/v1/sync", None).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["enabled"], false);
    assert!(body["data"]["folder"].is_null());
    assert!(!body["data"]["device_name"].as_str().unwrap_or("").is_empty(), "a default device name");

    // 没有文件夹不能开;相对路径、不存在的、数据目录里面的都不行。
    let (status, _) = call(&state, "PUT", "/api/v1/sync", Some(json!({"enabled": true}))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    for folder in [
        "relative/folder".to_string(),
        "/definitely/not/here".to_string(),
        state.config.data_root.join("jobs").to_string_lossy().to_string(),
    ] {
        std::fs::create_dir_all(state.config.data_root.join("jobs")).ok();
        let (status, body) = call(&state, "PUT", "/api/v1/sync", Some(json!({"folder": folder}))).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{folder}: {body}");
    }
    // 关着时「立即同步」说明原因。
    let (status, _) = call(&state, "POST", "/api/v1/sync/run", None).await;
    assert_eq!(status, StatusCode::CONFLICT);
}

#[tokio::test]
async fn two_backends_share_a_library_through_one_folder() {
    let a = test_state("sync-a");
    let b = test_state("sync-b");
    let cloud = temp_folder("cloud");
    for (state, name) in [(&a, "Mac A"), (&b, "Mac B")] {
        let (status, body) = call(
            state,
            "PUT",
            "/api/v1/sync",
            Some(json!({"folder": cloud.to_string_lossy(), "enabled": true, "device_name": name})),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{body}");
        assert_eq!(body["data"]["enabled"], true);
        assert_eq!(
            body["data"]["sync_root"].as_str().unwrap(),
            cloud.join("RetainPDF-Sync").to_string_lossy()
        );
    }
    let (status, _) = call(&a, "POST", "/api/v1/collections", Some(json!({"name": "Reading list"}))).await;
    assert_eq!(status, StatusCode::OK);

    let (status, ran) = call(&a, "POST", "/api/v1/sync/run", None).await;
    assert_eq!(status, StatusCode::OK, "{ran}");
    assert_eq!(ran["data"]["last_run"]["ok"], true, "{ran}");
    assert_eq!(ran["data"]["last_run"]["exported"], 1);

    let (_, ran) = call(&b, "POST", "/api/v1/sync/run", None).await;
    assert_eq!(ran["data"]["last_run"]["applied"], 1, "{ran}");
    let peers = ran["data"]["peers"].as_array().unwrap();
    assert_eq!(peers.len(), 1);
    assert_eq!(peers[0]["name"], "Mac A");
    let (_, collections) = call(&b, "GET", "/api/v1/collections", None).await;
    assert!(collections.to_string().contains("Reading list"), "{collections}");

    // 已经是同步文件夹的目录直接用,不再套一层子目录。
    let direct = cloud.join("RetainPDF-Sync");
    let (_, body) = call(&b, "PUT", "/api/v1/sync", Some(json!({"folder": direct.to_string_lossy()}))).await;
    assert_eq!(body["data"]["sync_root"].as_str().unwrap(), direct.to_string_lossy());

    // 关掉之后不再同步。
    let (_, body) = call(&a, "PUT", "/api/v1/sync", Some(json!({"enabled": false}))).await;
    assert_eq!(body["data"]["enabled"], false);
    let (status, _) = call(&a, "POST", "/api/v1/sync/run", None).await;
    assert_eq!(status, StatusCode::CONFLICT);
    std::fs::remove_dir_all(cloud).ok();
}
