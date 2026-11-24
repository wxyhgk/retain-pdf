//! `Idempotency-Key` 请求头（2026-11-24，见 `app/idempotency.rs`）：不带行为不变；带了同一次请求只执行一次，
//! 第二次原样重放并带 `Idempotent-Replayed: true`；同一把 key 换了请求 409 `idempotency_key_reused`；
//! 还在处理 409 `idempotency_key_in_flight`；失败后同一把 key 可以重试；过期了当新请求。

use std::sync::Arc;

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tower::util::ServiceExt;

use super::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::build_app;
use crate::db::{
    IdempotencyClaim, IdempotencyFingerprint, IdempotencyScope, StoredIdempotentResponse,
};
use crate::models::domain::JobStatusKind;
use crate::models::{CreateJobInput, JobSnapshot};

const BOUNDARY: &str = "retainpdf-idempotency-boundary";

async fn upload(state: &crate::AppState) -> String {
    let mut body = format!(
        "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"idem.pdf\"\r\nContent-Type: application/pdf\r\n\r\n"
    )
    .into_bytes();
    body.extend_from_slice(&minimal_pdf_bytes(595, 842));
    body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/uploads")
                .header("X-API-Key", "test-key")
                .header(
                    header::CONTENT_TYPE,
                    format!("multipart/form-data; boundary={BOUNDARY}"),
                )
                .body(Body::from(body))
                .expect("upload request"),
        )
        .await
        .expect("upload response");
    assert_eq!(response.status(), StatusCode::OK);
    read_json(response).await["data"]["upload_id"]
        .as_str()
        .expect("upload id")
        .to_string()
}

fn create_body(upload_id: &str) -> String {
    json!({
        "workflow": "ocr",
        "source": { "upload_id": upload_id },
        "ocr": { "provider": "local" }
    })
    .to_string()
}

struct Sent {
    status: StatusCode,
    replayed: Option<String>,
    payload: Value,
}

async fn create(state: &crate::AppState, body: &str, key: Option<&str>) -> Sent {
    let mut request = Request::builder()
        .method("POST")
        .uri("/api/v1/jobs")
        .header("X-API-Key", "test-key")
        .header(header::CONTENT_TYPE, "application/json");
    if let Some(key) = key {
        request = request.header("Idempotency-Key", key);
    }
    let response = build_app(state.clone())
        .oneshot(
            request
                .body(Body::from(body.to_string()))
                .expect("create request"),
        )
        .await
        .expect("create response");
    let status = response.status();
    let replayed = response
        .headers()
        .get("idempotent-replayed")
        .map(|value| value.to_str().unwrap().to_string());
    Sent {
        status,
        replayed,
        payload: read_json(response).await,
    }
}

fn job_count(state: &crate::AppState) -> usize {
    state.db.list_jobs(100, 0, None, None).unwrap().len()
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[tokio::test]
async fn without_the_header_every_request_creates_a_job() {
    let state = test_state("idem-no-header");
    let upload_id = upload(&state).await;
    let body = create_body(&upload_id);
    let first = create(&state, &body, None).await;
    let second = create(&state, &body, None).await;
    assert_eq!(first.status, StatusCode::OK, "{}", first.payload);
    assert_eq!(second.status, StatusCode::OK, "{}", second.payload);
    assert_eq!(first.replayed, None);
    assert_eq!(second.replayed, None);
    assert_ne!(
        first.payload["data"]["job_id"],
        second.payload["data"]["job_id"]
    );
    assert_eq!(job_count(&state), 2);
}

#[tokio::test]
async fn a_repeated_key_replays_the_first_result_without_creating_another_job() {
    let state = test_state("idem-replay");
    let upload_id = upload(&state).await;
    let body = create_body(&upload_id);
    let key = "5b1a1c4e-6d0a-4f43-9a51-6f3c2c1d9e01";

    let first = create(&state, &body, Some(key)).await;
    assert_eq!(first.status, StatusCode::OK, "{}", first.payload);
    assert_eq!(first.replayed, None, "第一次不是重放");

    // 同一把 key、同一个请求（也接受草案的引号写法）：不再建任务，原样回第一次的结果。
    for key in [key.to_string(), format!("\"{key}\"")] {
        let again = create(&state, &body, Some(&key)).await;
        assert_eq!(again.status, StatusCode::OK, "{}", again.payload);
        assert_eq!(again.replayed.as_deref(), Some("true"));
        assert_eq!(again.payload, first.payload);
    }
    assert_eq!(job_count(&state), 1);

    // 同一把 key 换了请求体：409 idempotency_key_reused，不建任务。
    let other_body = json!({
        "workflow": "ocr",
        "source": { "upload_id": upload_id },
        "ocr": { "provider": "local", "language": "en" }
    })
    .to_string();
    let reused = create(&state, &other_body, Some(key)).await;
    assert_eq!(reused.status, StatusCode::CONFLICT, "{}", reused.payload);
    assert_eq!(
        reused.payload["error"]["details"]["reason"],
        "idempotency_key_reused"
    );
    assert_eq!(job_count(&state), 1);

    // 换一把 key：是新请求。
    let fresh = create(&state, &body, Some("another-key")).await;
    assert_eq!(fresh.status, StatusCode::OK, "{}", fresh.payload);
    assert_eq!(fresh.replayed, None);
    assert_eq!(job_count(&state), 2);
}

#[tokio::test]
async fn invalid_keys_are_400() {
    let state = test_state("idem-invalid");
    let upload_id = upload(&state).await;
    let body = create_body(&upload_id);
    for key in ["".to_string(), "has space".to_string(), "k".repeat(256)] {
        let sent = create(&state, &body, Some(&key)).await;
        assert_eq!(
            sent.status,
            StatusCode::BAD_REQUEST,
            "{key:?}: {}",
            sent.payload
        );
        assert_eq!(sent.payload["error"]["code"], "BAD_REQUEST");
    }
    assert_eq!(job_count(&state), 0);
}

#[tokio::test]
async fn a_key_still_being_processed_is_409_in_flight() {
    let state = test_state("idem-in-flight");
    let upload_id = upload(&state).await;
    let body = create_body(&upload_id);
    let body_sha256 = sha256_hex(body.as_bytes());
    // 另一个请求刚占了这把 key、还没处理完。
    let claim = state
        .db
        .claim_idempotency_key(
            IdempotencyScope {
                owner_user_id: "local",
                route: "POST /api/v1/jobs",
                key: "busy-key",
            },
            IdempotencyFingerprint {
                method: "POST",
                path: "/api/v1/jobs",
                body_sha256: &body_sha256,
            },
            chrono::Utc::now(),
            chrono::Duration::hours(24),
        )
        .unwrap();
    assert_eq!(claim, IdempotencyClaim::Claimed);

    let sent = create(&state, &body, Some("busy-key")).await;
    assert_eq!(sent.status, StatusCode::CONFLICT, "{}", sent.payload);
    assert_eq!(sent.payload["code"], 40900);
    assert_eq!(
        sent.payload["error"]["details"]["reason"],
        "idempotency_key_in_flight"
    );
    assert_eq!(job_count(&state), 0);
}

#[tokio::test]
async fn a_failed_request_releases_its_key_for_a_retry() {
    let mut state = test_state("idem-retry-after-failure");
    let upload_id = upload(&state).await;
    let body = create_body(&upload_id);

    // 排队满了：429，占位删掉。
    let mut config = (*state.config).clone();
    config.job_runner.max_queued_jobs = 1;
    state.config = Arc::new(config);
    let mut queued = JobSnapshot::new(
        "job-idem-queued".into(),
        CreateJobInput::default(),
        vec!["python".into()],
    );
    queued.status = JobStatusKind::Queued;
    state.db.save_job(&queued).expect("save queued job");
    let refused = create(&state, &body, Some("retry-key")).await;
    assert_eq!(
        refused.status,
        StatusCode::TOO_MANY_REQUESTS,
        "{}",
        refused.payload
    );

    // 排队的那个走了：同一把 key、同一个请求重试，真的执行（不是重放那次 429）。
    state
        .db
        .delete_job("job-idem-queued")
        .expect("delete queued job");
    let retried = create(&state, &body, Some("retry-key")).await;
    assert_eq!(retried.status, StatusCode::OK, "{}", retried.payload);
    assert_eq!(retried.replayed, None);
    assert_eq!(job_count(&state), 1);
}

#[tokio::test]
async fn an_expired_key_counts_as_a_new_request() {
    let state = test_state("idem-expired");
    let upload_id = upload(&state).await;
    let body = create_body(&upload_id);
    let body_sha256 = sha256_hex(body.as_bytes());
    let scope = IdempotencyScope {
        owner_user_id: "local",
        route: "POST /api/v1/jobs",
        key: "old-key",
    };
    let fingerprint = IdempotencyFingerprint {
        method: "POST",
        path: "/api/v1/jobs",
        body_sha256: &body_sha256,
    };
    // 25 小时前处理过的同一个请求。
    let then = chrono::Utc::now() - chrono::Duration::hours(25);
    state
        .db
        .claim_idempotency_key(scope, fingerprint, then, chrono::Duration::hours(24))
        .unwrap();
    let stale = StoredIdempotentResponse {
        status: 200,
        content_type: Some("application/json".into()),
        body: br#"{"code":0,"data":{"job_id":"stale"}}"#.to_vec(),
    };
    assert!(state
        .db
        .complete_idempotency_key(scope, &stale, then)
        .unwrap());

    let sent = create(&state, &body, Some("old-key")).await;
    assert_eq!(sent.status, StatusCode::OK, "{}", sent.payload);
    assert_eq!(sent.replayed, None, "过期了不重放");
    assert_ne!(sent.payload["data"]["job_id"], "stale");
    assert_eq!(job_count(&state), 1);
}

/// 续跑带同一把 key 重发：回第一次的结果（重放），不是 409 derived_job_active。
#[tokio::test]
async fn resume_with_a_repeated_key_replays_instead_of_conflicting() {
    let mut state = test_state("idem-resume");
    super::jobs_retry::common::hold_job_drivers(&mut state);
    let source = "job-idem-resume-source";
    let mut source_job = super::jobs_retry::common::source_job_with_artifacts(
        source,
        crate::models::JobArtifacts {
            source_pdf: Some(format!("jobs/{source}/source/input.pdf")),
            normalized_document_json: Some(format!("jobs/{source}/ocr/document.v1.json")),
            ..Default::default()
        },
    );
    source_job.status = JobStatusKind::Failed;
    super::jobs_retry::common::seed_ocr_checkpoint_files(&state, &source_job);
    state.db.save_job(&source_job).expect("save source job");

    let resume = |key: Option<&'static str>| {
        let state = state.clone();
        async move {
            let mut request = Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source}/actions/resume"))
                .header("X-API-Key", "test-key");
            if let Some(key) = key {
                request = request.header("Idempotency-Key", key);
            }
            let response = build_app(state)
                .oneshot(request.body(Body::empty()).unwrap())
                .await
                .unwrap();
            let status = response.status();
            let replayed = response.headers().contains_key("idempotent-replayed");
            (status, replayed, read_json(response).await)
        }
    };
    let (status, replayed, first) = resume(Some("click-1")).await;
    assert_eq!(status, StatusCode::OK, "{first}");
    assert!(!replayed);
    let (status, replayed, again) = resume(Some("click-1")).await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert!(replayed);
    assert_eq!(again, first);
    // 另一次点击（新 key）：续跑查重照样挡住。
    let (status, _, blocked) = resume(Some("click-2")).await;
    assert_eq!(status, StatusCode::CONFLICT, "{blocked}");
    assert_eq!(blocked["error"]["details"]["reason"], "derived_job_active");
}
