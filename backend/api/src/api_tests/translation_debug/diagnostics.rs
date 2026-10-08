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
                .uri(format!("/api/v1/jobs/{JOB_ID}/translation/diagnostics"))
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

#[tokio::test]
async fn translation_qa_and_fit_report_routes_return_reports_redacted() {
    let state = test_state("debug-qa-fit-report");
    seed_translation_debug_job(&state);
    let artifacts_dir = state.config.output_root.join(JOB_ID).join("artifacts");
    std::fs::write(
        artifacts_dir.join("translation_qa.v1.json"),
        r#"{"schema":"translation_qa_v1","summary":{"by_severity":{"major":1}},
            "violations":[{"type":"length_ratio_low","evidence":{"source_excerpt":"leaks sk-debug-secret"}}]}"#,
    )
    .expect("qa report");
    std::fs::write(
        artifacts_dir.join("fit_report.v1.json"),
        r#"{"schema":"fit_report_v1","status":"ok","summary":{"overflow_blocks":16}}"#,
    )
    .expect("fit report");

    let qa = get_report(state.clone(), "translation/qa").await;
    assert_eq!(qa.status(), StatusCode::OK);
    let qa = read_json(qa).await;
    assert_eq!(qa["data"]["job_id"], JOB_ID);
    assert_eq!(qa["data"]["report"]["summary"]["by_severity"]["major"], 1);
    assert_eq!(
        qa["data"]["report"]["violations"][0]["evidence"]["source_excerpt"],
        "leaks [REDACTED]"
    );

    let fit = get_report(state, "render/fit-report").await;
    assert_eq!(fit.status(), StatusCode::OK);
    let fit = read_json(fit).await;
    assert_eq!(fit["data"]["report"]["status"], "ok");
    assert_eq!(fit["data"]["report"]["summary"]["overflow_blocks"], 16);
}

#[tokio::test]
async fn translation_qa_and_fit_report_routes_are_404_when_missing() {
    let state = test_state("debug-qa-fit-report-missing");
    seed_translation_debug_job(&state);

    assert_eq!(
        get_report(state.clone(), "translation/qa").await.status(),
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        get_report(state, "render/fit-report").await.status(),
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn refine_report_route_returns_report_redacted() {
    let state = test_state("debug-refine-report");
    seed_translation_debug_job(&state);
    let artifacts_dir = state.config.output_root.join(JOB_ID).join("artifacts");
    std::fs::write(
        artifacts_dir.join("refine_report.v1.json"),
        r#"{"schema":"refine_report_v1","mode":"review_and_fix","trigger":"manual",
            "summary":{"findings":2,"applied":1,"rejected":1},
            "fixes":[{"item_id":"p043-b006","status":"applied","before":"leaks sk-debug-secret","after":"ok"}]}"#,
    )
    .expect("refine report");

    let response = get_report(state, "translation/refine-report").await;
    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["job_id"], JOB_ID);
    assert_eq!(payload["data"]["report"]["schema"], "refine_report_v1");
    assert_eq!(payload["data"]["report"]["summary"]["applied"], 1);
    assert_eq!(
        payload["data"]["report"]["fixes"][0]["before"],
        "leaks [REDACTED]"
    );
}

#[tokio::test]
async fn refine_report_route_is_404_when_missing() {
    let state = test_state("debug-refine-report-missing");
    seed_translation_debug_job(&state);

    assert_eq!(
        get_report(state, "translation/refine-report").await.status(),
        StatusCode::NOT_FOUND
    );
}
