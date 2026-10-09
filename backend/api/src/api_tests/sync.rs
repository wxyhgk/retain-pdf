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

#[tokio::test]
async fn webdav_settings_are_checked_and_the_password_never_comes_back() {
    let state = test_state("sync-webdav");
    for (url, why) in [
        ("ftp://nas/webdav", "scheme"),
        ("http://user:pass@nas:5005/webdav", "credentials in the address"),
        ("not a url", "garbage"),
    ] {
        let (status, body) = call(&state, "PUT", "/api/v1/sync", Some(json!({"transport": "webdav", "webdav_url": url}))).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{why}: {body}");
    }
    let (status, _) = call(&state, "PUT", "/api/v1/sync", Some(json!({"transport": "smb"}))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, body) = call(
        &state,
        "PUT",
        "/api/v1/sync",
        Some(json!({
            "transport": "webdav",
            "webdav_url": "http://127.0.0.1:9/dav/retainpdf",
            "webdav_username": "nas-user",
            "webdav_password": "top-secret-123",
        })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["data"]["transport"], "webdav");
    assert_eq!(body["data"]["webdav_has_password"], true);
    assert_eq!(body["data"]["sync_root"], "http://127.0.0.1:9/dav/retainpdf");
    let (_, status_body) = call(&state, "GET", "/api/v1/sync", None).await;
    for text in [body.to_string(), status_body.to_string()] {
        assert!(!text.contains("top-secret-123"), "password leaked: {text}");
    }

    // 测试连接:连不上时说清楚,不报 500;不改设置。
    let (status, tested) = call(&state, "POST", "/api/v1/sync/test", Some(json!({}))).await;
    assert_eq!(status, StatusCode::OK, "{tested}");
    assert_eq!(tested["data"]["ok"], false);
    assert!(tested["data"]["error"].as_str().unwrap().contains("连不上 WebDAV"), "{tested}");
    assert!(!tested.to_string().contains("top-secret-123"));

    // 开启后后台那一轮失败也只记在 last_run 里。
    let (status, _) = call(&state, "PUT", "/api/v1/sync", Some(json!({"enabled": true}))).await;
    assert_eq!(status, StatusCode::OK);
    let (_, ran) = call(&state, "POST", "/api/v1/sync/run", None).await;
    assert_eq!(ran["data"]["last_run"]["ok"], false, "{ran}");
    assert!(!ran.to_string().contains("top-secret-123"));
}
