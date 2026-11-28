use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;

/// 没打开按需下载（测试、Docker、开发环境）：照样报每份资源的状态，不去下。
#[tokio::test]
async fn runtime_assets_report_their_state_without_downloading() {
    let state = test_state("runtime-assets-status");
    let data_root = state.config.data_root.clone();
    let app = build_app(state);
    let get = |uri: &str, method: &str| {
        Request::builder().method(method).uri(uri).header("x-api-key", "test-key").body(Body::empty()).unwrap()
    };
    let response = app.clone().oneshot(get("/api/v1/runtime-assets", "GET")).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["downloads_enabled"], false);
    let assets = payload["data"]["assets"].as_array().expect("assets");
    let fonts = assets.iter().find(|asset| asset["id"] == "fonts").expect("fonts listed");
    assert_eq!(fonts["version"], "2.003R-w300");
    assert!(["bundled", "missing"].contains(&fonts["state"].as_str().unwrap()), "{fonts}");
    assert!(fonts["bytes_total"].as_u64().unwrap() > 40_000_000);

    let response = app.oneshot(get("/api/v1/runtime-assets/download", "POST")).await.expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    assert!(!data_root.join("runtime-assets/.download.lock").exists(), "开关没开就不下");
}
