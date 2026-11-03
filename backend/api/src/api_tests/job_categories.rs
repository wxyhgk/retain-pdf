//! `/jobs/:job_id` 下按 8 类分前缀的地址：每一类都要能走到处理函数。
//!
//! 只发不改状态的请求（GET，和一定被拒的 POST），对同一个任务各发一次，看状态码。
//! 地址要是注册错了（漏了、挂错处理函数、参数名没归类被多用户中间件拦下），这里会红。

use axum::body::{to_bytes, Body};
use axum::http::{header, Request};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::test_state;
use crate::api_tests::jobs_retry::common::{seed_translation_result_files, source_job_with_artifacts};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobStatusKind};

const JOB: &str = "job-categories";

/// (方法, 地址)，相对 `/api/v1/jobs/:job_id`。
const PATHS: &[(&str, &str)] = &[
    ("GET", "/actions"),
    ("GET", "/actions/resume"),
    ("GET", "/progress/events"),
    ("GET", "/progress/layout"),
    ("GET", "/progress/pages/0"),
    ("GET", "/progress/editorial"),
    ("GET", "/reports/quality"),
    ("GET", "/reports/quality/items?kind=layout"),
    ("GET", "/reports/translation-qa"),
    ("GET", "/reports/translation"),
    ("GET", "/reports/layout-fit"),
    ("GET", "/reports/refine"),
    ("GET", "/reports/failure"),
    ("GET", "/reports/usage"),
    ("GET", "/reader/markdown"),
    ("GET", "/translations"),
    ("GET", "/translations/p001-b001"),
    ("GET", "/translations/p001-b001/revisions"),
    // 请求体不合法，一定在动任务之前被拒。
    ("POST", "/actions/retry-stage"),
    ("POST", "/actions/resolve-ocr-ambiguity"),
];

async fn send(app: axum::Router, method: &str, uri: &str) -> (u16, String, Vec<u8>) {
    let mut request = Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", "test-key");
    let body = if method == "POST" {
        request = request.header(header::CONTENT_TYPE, "application/json");
        Body::from(r#"{"not_a_field": true}"#)
    } else {
        Body::empty()
    };
    let response = app.oneshot(request.body(body).unwrap()).await.unwrap();
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap().to_vec();
    (status, content_type, body)
}

#[tokio::test]
async fn every_category_path_is_registered_and_answers() {
    let state = test_state("job-categories");
    let mut job = source_job_with_artifacts(
        JOB,
        JobArtifacts {
            job_root: Some(format!("jobs/{JOB}")),
            source_pdf: Some(format!("jobs/{JOB}/source/input.pdf")),
            normalized_document_json: Some(format!("jobs/{JOB}/ocr/document.v1.json")),
            translations_dir: Some(format!("jobs/{JOB}/translated")),
            ..JobArtifacts::default()
        },
    );
    job.status = JobStatusKind::Succeeded;
    seed_translation_result_files(&state, &job);
    state.db.save_job(&job).unwrap();
    let app = build_app(state);

    let mut statuses = Vec::new();
    for (method, path) in PATHS {
        let (status, _, _) = send(app.clone(), method, &format!("/api/v1/jobs/{JOB}{path}")).await;
        assert_ne!(status, 405, "{method} {path}: not registered for this method");
        statuses.push(status);
    }
    // 不能全是 404：那说明任务没找到，比的只是一堆"找不到"。
    assert!(statuses.iter().filter(|status| **status == 200).count() >= 5, "{statuses:?}");

    // 已经删掉的地址：没有路由，不是"任务没找到"也不是"还没生成"。
    for path in ["/ai/reading-path", "/ai/canvas", "/ai/board", "/ai/board/missing.html"] {
        let (status, _, body) = send(app.clone(), "GET", &format!("/api/v1/jobs/{JOB}{path}")).await;
        assert_eq!(status, 404, "{path} 应该已经没有路由");
        assert!(!String::from_utf8_lossy(&body).contains("not generated yet"), "{path}: 还有处理函数在答");
    }
}
