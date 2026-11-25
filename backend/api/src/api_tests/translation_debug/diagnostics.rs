use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;

use super::common::{seed_translation_debug_job, JOB_ID};

#[tokio::test]
async fn translation_diagnostics_route_redacts_secrets() {
    let state = test_state("debug-diagnostics-redaction");
    seed_translation_debug_job(&state);

    let response = build_app(state)
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{JOB_ID}/reports/translation"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("diagnostics request"),
        )
        .await
        .expect("diagnostics response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["summary"]["api_key"], "");
    assert_eq!(payload["data"]["summary"]["message"], "contains [REDACTED]");
}

async fn get_report(state: crate::AppState, path: &str) -> axum::response::Response {
    build_app(state)
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{JOB_ID}/{path}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("report request"),
        )
        .await
        .expect("report response")
}

/// 翻译质检、排版缩放、精修报告三个接口 2026-11-25 删了（以前给 RetainPDF 自己的 AI 读，之后没有调用方）：
/// 任务在、报告也在，照样是「没有这个地址」的 404。报告文件照旧落盘。
#[tokio::test]
async fn removed_report_routes_are_unknown() {
    let state = test_state("debug-removed-report-routes");
    seed_translation_debug_job(&state);
    for path in ["reports/translation-qa", "reports/layout-fit", "reports/refine"] {
        let response = get_report(state.clone(), path).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
        let payload = read_json(response).await;
        assert_eq!(payload["message"], "route not found", "{path}: {payload}");
    }
}
