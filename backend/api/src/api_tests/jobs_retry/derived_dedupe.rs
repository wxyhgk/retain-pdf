//! 续跑、重试阶段的查重（2026-11-24）：同一个源任务已经派生出一个排队中 / 运行中的新任务时，再续跑、再重试
//! 409 `derived_job_active`，`error.details.active_job_id` 是那个任务；它结束了（成功、失败、取消）就能再来。
//! 两个请求同时到也只建成一个。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobStatusKind};

use super::common::{hold_job_drivers, seed_ocr_checkpoint_files, source_job_with_artifacts};

fn failed_source_with_ocr(state: &crate::AppState, job_id: &str) {
    let mut source_job = source_job_with_artifacts(
        job_id,
        JobArtifacts {
            source_pdf: Some(format!("jobs/{job_id}/source/input.pdf")),
            normalized_document_json: Some(format!("jobs/{job_id}/ocr/document.v1.json")),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Failed;
    seed_ocr_checkpoint_files(state, &source_job);
    state.db.save_job(&source_job).expect("save source job");
}

async fn post(state: &crate::AppState, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut request = Request::builder()
        .method("POST")
        .uri(uri)
        .header("X-API-Key", "test-key");
    let body = match body {
        Some(body) => {
            request = request.header("Content-Type", "application/json");
            Body::from(body.to_string())
        }
        None => Body::empty(),
    };
    let response = build_app(state.clone())
        .oneshot(request.body(body).expect("request"))
        .await
        .expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

fn set_status(state: &crate::AppState, job_id: &str, status: JobStatusKind) {
    let mut job = state.db.get_job(job_id).expect("job");
    job.status = status;
    state.db.save_job(&job).expect("save job");
}

#[tokio::test]
async fn resuming_again_while_the_resumed_job_runs_is_409_with_its_id() {
    let mut state = test_state("derived-dedupe-resume");
    hold_job_drivers(&mut state);
    let source = "job-derived-dedupe-resume";
    failed_source_with_ocr(&state, source);
    let uri = format!("/api/v1/jobs/{source}/actions/resume");

    let (status, first) = post(&state, &uri, None).await;
    assert_eq!(status, StatusCode::OK, "{first}");
    let derived = first["data"]["job_id"]
        .as_str()
        .expect("job id")
        .to_string();
    assert_ne!(derived, source, "续跑出的是新任务");

    // 第二次（双击、网络重试）：409，带着在跑的那个任务。
    for uri in [uri.clone()] {
        let (status, payload) = post(&state, &uri, None).await;
        assert_eq!(status, StatusCode::CONFLICT, "{payload}");
        assert_eq!(payload["code"], 40900);
        assert_eq!(payload["error"]["details"]["reason"], "derived_job_active");
        assert_eq!(
            payload["error"]["details"]["active_job_id"],
            derived.as_str()
        );
    }
    assert_eq!(
        state
            .db
            .count_jobs_with_status(&JobStatusKind::Queued)
            .unwrap(),
        1,
        "没有多建任务"
    );

    // 派生任务结束了（失败、取消、成功都一样）：可以再续跑。
    let mut latest = derived;
    for finished in [
        JobStatusKind::Failed,
        JobStatusKind::Canceled,
        JobStatusKind::Succeeded,
    ] {
        set_status(&state, &latest, finished);
        let (status, payload) = post(&state, &uri, None).await;
        assert_eq!(status, StatusCode::OK, "{payload}");
        latest = payload["data"]["job_id"]
            .as_str()
            .expect("job id")
            .to_string();
    }
}

#[tokio::test]
async fn retrying_a_stage_again_while_the_retry_runs_is_409() {
    let mut state = test_state("derived-dedupe-retry");
    hold_job_drivers(&mut state);
    let source = "job-derived-dedupe-retry";
    failed_source_with_ocr(&state, source);
    let uri = format!("/api/v1/jobs/{source}/actions/retry-stage");

    let (status, first) = post(&state, &uri, Some(json!({ "stage": "translation" }))).await;
    assert_eq!(status, StatusCode::OK, "{first}");
    let derived = first["data"]["job_id"]
        .as_str()
        .expect("job id")
        .to_string();

    let (status, payload) = post(&state, &uri, Some(json!({ "stage": "translation" }))).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "derived_job_active");
    assert_eq!(
        payload["error"]["details"]["active_job_id"],
        derived.as_str()
    );

    // 重试出来的任务还在跑时，续跑同一个源任务也一样被挡住（同一个源任务只许有一个在跑的派生任务）。
    let (status, payload) = post(
        &state,
        &format!("/api/v1/jobs/{source}/actions/resume"),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(
        payload["error"]["details"]["active_job_id"],
        derived.as_str()
    );

    // 别的源任务不受影响。
    let other = "job-derived-dedupe-retry-other";
    failed_source_with_ocr(&state, other);
    let (status, payload) = post(
        &state,
        &format!("/api/v1/jobs/{other}/actions/retry-stage"),
        Some(json!({ "stage": "translation" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
}

/// 两个续跑同时到：只建成一个，另一个 409。
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_resumes_create_only_one_job() {
    let mut state = test_state("derived-dedupe-concurrent");
    hold_job_drivers(&mut state);
    let source = "job-derived-dedupe-concurrent";
    failed_source_with_ocr(&state, source);
    let uri = format!("/api/v1/jobs/{source}/actions/resume");

    let requests = (0..6).map(|_| {
        let state = state.clone();
        let uri = uri.clone();
        tokio::spawn(async move { post(&state, &uri, None).await })
    });
    let mut results = Vec::new();
    for request in requests.collect::<Vec<_>>() {
        results.push(request.await.expect("request task"));
    }
    let created: Vec<_> = results
        .iter()
        .filter(|(status, _)| *status == StatusCode::OK)
        .collect();
    assert_eq!(created.len(), 1, "{results:?}");
    let derived = created[0].1["data"]["job_id"].as_str().expect("job id");
    for (status, payload) in results
        .iter()
        .filter(|(status, _)| *status != StatusCode::OK)
    {
        assert_eq!(*status, StatusCode::CONFLICT, "{payload}");
        assert_eq!(
            payload["error"]["details"]["reason"], "derived_job_active",
            "{payload}"
        );
        assert_eq!(
            payload["error"]["details"]["active_job_id"], derived,
            "{payload}"
        );
    }
    assert_eq!(
        state
            .db
            .count_jobs_with_status(&JobStatusKind::Queued)
            .unwrap(),
        1
    );
}
