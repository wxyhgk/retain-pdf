//! `GET /metrics`：要 Key；按路由模板（不是具体地址）出请求数、状态码分类、耗时直方图，再加 `/health` 的那几个运行时数。

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use super::jobs_common::test_state;
use crate::app::build_app;

#[tokio::test]
async fn metrics_need_a_key_and_use_route_templates() {
    let app = build_app(test_state("metrics"));
    let get = |uri: &str, key: Option<&str>| {
        let mut request = Request::builder().uri(uri);
        if let Some(key) = key {
            request = request.header("X-API-Key", key);
        }
        app.clone().oneshot(request.body(Body::empty()).unwrap())
    };

    let anonymous = get("/metrics", None).await.unwrap();
    assert_eq!(anonymous.status(), StatusCode::UNAUTHORIZED);

    // 一个不存在的任务：404，记在模板 `/api/v1/jobs/:job_id` 下，具体编号不出现。
    let missing = get("/api/v1/jobs/metrics-no-such-job-8d1f", Some("test-key")).await.unwrap();
    assert_eq!(missing.status(), StatusCode::NOT_FOUND);

    let response = get("/metrics", Some("test-key")).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()["content-type"],
        "text/plain; version=0.0.4; charset=utf-8"
    );
    let body = String::from_utf8(to_bytes(response.into_body(), usize::MAX).await.unwrap().to_vec()).unwrap();
    assert!(!body.contains("metrics-no-such-job-8d1f"), "不许用具体地址当标签：\n{body}");
    let template = r#"method="GET",route="/api/v1/jobs/:job_id""#;
    assert!(
        body.lines().any(|line| line.starts_with(&format!("retainpdf_http_requests_total{{{template},status=\"4xx\"}} "))),
        "{body}"
    );
    assert!(
        body.lines().any(|line| line.starts_with(&format!(
            "retainpdf_http_request_duration_seconds_bucket{{{template},le=\"+Inf\"}} "
        ))),
        "{body}"
    );
    for line in ["retainpdf_db_up 1", "retainpdf_jobs_queued 0", "retainpdf_jobs_running 0", "retainpdf_disk_low 0"] {
        assert!(body.lines().any(|l| l == line), "缺 {line}\n{body}");
    }
    assert!(body.contains("# TYPE retainpdf_http_request_duration_seconds histogram"));
    assert!(body.contains("retainpdf_jobsd_status{status=\""));
}
