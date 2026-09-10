use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobStatusKind};

use super::common::{
    seed_ambiguous_ocr_dispatch, seed_ambiguous_translation_request_journal,
    seed_ocr_checkpoint_files, seed_ocr_upload, seed_translation_result_files,
    source_job_with_artifacts,
};

#[tokio::test]
async fn rust_model_retry_cannot_bypass_receipt_recovery_with_risk_acceptance() {
    let state = test_state("rust-model-retry-fence");
    let id = "rust-model-retry-fence";
    let mut job = source_job_with_artifacts(id, JobArtifacts::default());
    job.status = JobStatusKind::Failed;
    job.request_payload.translation.execution_connection = Some(
        serde_json::from_value(json!({
            "id":"test", "revision":1, "provider":"qwen", "base_url":"https://example.org/v1",
            "model":"qwen3.8-flash", "credential_ref":"cred_test", "concurrency":2
        }))
        .unwrap(),
    );
    state.db.save_job(&job).unwrap();
    for stage in ["translation", "ocr"] {
        let response = build_app(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/jobs/{id}/retry-stage"))
                    .header("X-API-Key", "test-key")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        json!({"stage":stage,"ambiguous_request_policy":"accept_duplicate_risk"})
                            .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CONFLICT);
    }
}

#[tokio::test]
async fn ambiguous_ocr_requires_explicit_resolution_and_can_bind_existing_receipt() {
    let state = test_state("retry-stage-ambiguous-ocr");
    let source_job_id = "job-retry-stage-ambiguous-ocr";
    let upload = seed_ocr_upload(&state, "upload-ambiguous-ocr");
    let mut source_job = source_job_with_artifacts(source_job_id, JobArtifacts::default());
    source_job.status = JobStatusKind::Failed;
    source_job.request_payload.source.upload_id = upload.upload_id;
    source_job.request_payload.ocr.provider = "mineru".to_string();
    source_job.request_payload.ocr.mineru_token = "mineru-test-token".to_string();
    state.db.save_job(&source_job).expect("save source job");
    seed_ambiguous_ocr_dispatch(&state, source_job_id, "mineru", "apply_upload_url");

    let diagnostics = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/jobs/{source_job_id}/diagnostics"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("OCR ambiguity diagnostics request"),
        )
        .await
        .expect("OCR ambiguity diagnostics response");
    assert_eq!(diagnostics.status(), StatusCode::OK);
    let diagnostics_payload = read_json(diagnostics).await;
    assert_eq!(
        diagnostics_payload["data"]["failure_code"],
        "ocr_request_ambiguous"
    );
    assert_eq!(
        diagnostics_payload["data"]["ocr_ambiguity"],
        json!({
            "status": "ambiguous",
            "provider": "mineru",
            "operation": "apply_upload_url",
            "resolution_revision": 4,
            "allowed_resolutions": [
                "bind_existing_receipt",
                "accept_duplicate_risk"
            ],
            "receipt_fields": [
                {
                    "name": "batch_id",
                    "label": "Batch ID",
                    "required": true,
                    "secret": false
                },
                {
                    "name": "upload_url",
                    "label": "Upload URL",
                    "required": true,
                    "secret": true
                },
                {
                    "name": "trace_id",
                    "label": "Trace ID",
                    "required": false,
                    "secret": false
                }
            ]
        })
    );
    let diagnostics_json = serde_json::to_string(&diagnostics_payload).expect("diagnostics json");
    assert!(!diagnostics_json.contains(&"a".repeat(64)));
    assert!(!diagnostics_json.contains("mineru-test-token"));

    let blocked = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source_job_id}/retry-stage"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "stage": "ocr" }).to_string()))
                .expect("blocked OCR retry"),
        )
        .await
        .expect("blocked response");
    assert_eq!(blocked.status(), StatusCode::CONFLICT);

    let upload_url = "https://signed.example/upload?token=must-not-leak";
    let stale = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/jobs/{source_job_id}/ocr/resolve-ambiguity"
                ))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "resolution": "bind_existing_receipt",
                        "resolution_revision": 3,
                        "batch_id": "stale-batch",
                        "upload_url": upload_url
                    })
                    .to_string(),
                ))
                .expect("stale receipt request"),
        )
        .await
        .expect("stale receipt response");
    assert_eq!(stale.status(), StatusCode::CONFLICT);
    assert!(!serde_json::to_string(&read_json(stale).await)
        .expect("stale response json")
        .contains("must-not-leak"));

    let bound = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/jobs/{source_job_id}/ocr/resolve-ambiguity"
                ))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "resolution": "bind_existing_receipt",
                        "resolution_revision": 4,
                        "batch_id": "batch-from-provider-console",
                        "upload_url": upload_url,
                        "trace_id": "trace-operator"
                    })
                    .to_string(),
                ))
                .expect("bind receipt request"),
        )
        .await
        .expect("bind receipt response");
    assert_eq!(bound.status(), StatusCode::OK);
    let payload = read_json(bound).await;
    assert_eq!(payload["data"]["resolution"], "bind_existing_receipt");
    assert_eq!(payload["data"]["provider"], "mineru");
    assert_eq!(payload["data"]["operation"], "apply_upload_url");
    let recovery_job_id = payload["data"]["submission"]["job_id"]
        .as_str()
        .expect("recovery job id");
    let receipt = state
        .db
        .latest_pipeline_dispatch(recovery_job_id, "ocr-submit")
        .expect("recovery dispatch")
        .expect("seeded dispatch");
    assert_eq!(receipt.status, "receipted");
    assert_eq!(
        receipt
            .receipt
            .as_ref()
            .and_then(|value| value["batch_id"].as_str()),
        Some("batch-from-provider-console")
    );
    let public_events = state
        .db
        .list_job_events(recovery_job_id, 100, 0)
        .expect("recovery events");
    assert!(!serde_json::to_string(&public_events)
        .expect("events json")
        .contains("must-not-leak"));
    let source_events = state
        .db
        .list_job_events(source_job_id, 100, 0)
        .expect("source events");
    assert!(!serde_json::to_string(&source_events)
        .expect("source events JSON")
        .contains(&"a".repeat(64)));
    let resolution_event = source_events
        .iter()
        .find(|event| event.event == "ocr_ambiguity_resolved")
        .expect("resolution event");
    assert_eq!(
        resolution_event
            .payload
            .as_ref()
            .map(|value| &value["receipt_fields"]),
        Some(&json!(["batch_id", "trace_id", "upload_url"]))
    );
    let audit_json = serde_json::to_string(resolution_event).expect("audit json");
    assert!(!audit_json.contains("must-not-leak"));
    assert!(!audit_json.contains("batch-from-provider-console"));
    assert!(!audit_json.contains("trace-operator"));

    let resolved_diagnostics = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/jobs/{source_job_id}/diagnostics"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("resolved diagnostics request"),
        )
        .await
        .expect("resolved diagnostics response");
    let resolved_payload = read_json(resolved_diagnostics).await;
    assert_eq!(
        resolved_payload["data"]["ocr_ambiguity"],
        serde_json::Value::Null
    );
}

#[tokio::test]
async fn ambiguous_ocr_duplicate_risk_is_explicit_audited_and_single_use() {
    let state = test_state("retry-stage-ambiguous-ocr-duplicate-risk");
    let source_job_id = "job-retry-stage-ambiguous-ocr-duplicate-risk";
    let upload = seed_ocr_upload(&state, "upload-ambiguous-ocr-duplicate-risk");
    let mut source_job = source_job_with_artifacts(source_job_id, JobArtifacts::default());
    source_job.status = JobStatusKind::Failed;
    source_job.request_payload.source.upload_id = upload.upload_id;
    source_job.request_payload.ocr.provider = "mineru".to_string();
    source_job.request_payload.ocr.mineru_token = "mineru-test-token".to_string();
    state.db.save_job(&source_job).expect("save source job");
    seed_ambiguous_ocr_dispatch(&state, source_job_id, "mineru", "apply_upload_url");

    let invalid = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/jobs/{source_job_id}/ocr/resolve-ambiguity"
                ))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "resolution": "accept_duplicate_risk",
                        "resolution_revision": 4,
                        "task_id": "must-not-be-accepted"
                    })
                    .to_string(),
                ))
                .expect("invalid duplicate risk request"),
        )
        .await
        .expect("invalid response");
    assert_eq!(invalid.status(), StatusCode::BAD_REQUEST);

    let accepted = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/jobs/{source_job_id}/ocr/resolve-ambiguity"
                ))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "resolution": "accept_duplicate_risk",
                        "resolution_revision": 4
                    })
                    .to_string(),
                ))
                .expect("duplicate risk request"),
        )
        .await
        .expect("accepted response");
    assert_eq!(accepted.status(), StatusCode::OK);
    let payload = read_json(accepted).await;
    assert_eq!(payload["data"]["resolution"], "accept_duplicate_risk");
    assert_eq!(
        payload["data"]["submission"]["ambiguous_request_policy"],
        "accept_duplicate_risk"
    );
    let recovery_job_id = payload["data"]["submission"]["job_id"]
        .as_str()
        .expect("recovery job id");
    assert!(state
        .db
        .has_running_pipeline_attempt(recovery_job_id)
        .expect("recovery attempt"));
    assert_eq!(
        state
            .db
            .latest_pipeline_dispatch(source_job_id, "ocr-submit")
            .expect("source dispatch")
            .expect("source record")
            .status,
        "resolved"
    );
    let source_events = state
        .db
        .list_job_events(source_job_id, 100, 0)
        .expect("source events");
    let resolution_event = source_events
        .iter()
        .find(|event| event.event == "ocr_ambiguity_resolved")
        .expect("resolution audit event");
    assert_eq!(
        resolution_event
            .payload
            .as_ref()
            .and_then(|value| value["resolution"].as_str()),
        Some("accept_duplicate_risk")
    );

    let repeated = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/jobs/{source_job_id}/ocr/resolve-ambiguity"
                ))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "resolution": "accept_duplicate_risk",
                        "resolution_revision": 4
                    })
                    .to_string(),
                ))
                .expect("repeated resolution"),
        )
        .await
        .expect("repeated response");
    assert_eq!(repeated.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn translation_retry_requires_explicit_duplicate_risk_acceptance() {
    let state = test_state("retry-stage-ambiguous-translation");
    let source_job_id = "job-retry-stage-ambiguous-translation";
    let mut source_job = source_job_with_artifacts(
        source_job_id,
        JobArtifacts {
            job_root: Some(format!("jobs/{source_job_id}")),
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Failed;
    seed_ocr_checkpoint_files(&state, &source_job);
    seed_ambiguous_translation_request_journal(&state, &source_job);
    state.db.save_job(&source_job).expect("save source job");

    let diagnostics = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/jobs/{source_job_id}/diagnostics"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("diagnostics request"),
        )
        .await
        .expect("diagnostics response");
    assert_eq!(diagnostics.status(), StatusCode::OK);
    let diagnostics_payload = read_json(diagnostics).await;
    let recovery = &diagnostics_payload["data"]["translation_request_recovery"];
    assert_eq!(recovery["status"], "ambiguous");
    assert_eq!(recovery["unresolved_dispatches"], 1);
    assert_eq!(recovery["requires_confirmation"], true);
    assert_eq!(diagnostics_payload["data"]["resume_available"], false);

    let detail = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/jobs/{source_job_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("detail request"),
        )
        .await
        .expect("detail response");
    assert_eq!(detail.status(), StatusCode::OK);
    let detail_payload = read_json(detail).await;
    assert_eq!(
        detail_payload["data"]["translation_request_recovery"]["requires_confirmation"],
        true
    );

    let actions = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/jobs/{source_job_id}/stage-actions"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("stage actions request"),
        )
        .await
        .expect("stage actions response");
    let actions_payload = read_json(actions).await;
    let translation_action = actions_payload["data"]["stages"]
        .as_array()
        .expect("stage actions")
        .iter()
        .find(|item| item["stage"] == "translation")
        .expect("translation action");
    assert_eq!(translation_action["danger"], true);
    assert_eq!(
        translation_action["action"]["body"]["ambiguous_request_policy"],
        "block"
    );

    let blocked = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source_job_id}/retry-stage"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "stage": "translation" }).to_string()))
                .expect("blocked retry request"),
        )
        .await
        .expect("blocked retry response");
    assert_eq!(blocked.status(), StatusCode::CONFLICT);
    let blocked_payload = read_json(blocked).await;
    assert!(blocked_payload["message"]
        .as_str()
        .unwrap_or_default()
        .contains("accept_duplicate_risk"));

    let generic_rerun = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source_job_id}/rerun"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("generic rerun request"),
        )
        .await
        .expect("generic rerun response");
    assert_eq!(generic_rerun.status(), StatusCode::CONFLICT);

    let accepted = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source_job_id}/retry-stage"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "stage": "translation",
                        "ambiguous_request_policy": "accept_duplicate_risk"
                    })
                    .to_string(),
                ))
                .expect("accepted retry request"),
        )
        .await
        .expect("accepted retry response");
    assert_eq!(accepted.status(), StatusCode::OK);
    let accepted_payload = read_json(accepted).await;
    assert_eq!(
        accepted_payload["data"]["ambiguous_request_policy"],
        "accept_duplicate_risk"
    );
    let accepted_job_id = accepted_payload["data"]["job_id"]
        .as_str()
        .expect("accepted job id");
    let accepted_job = state.db.get_job(accepted_job_id).expect("accepted job");
    assert!(
        accepted_job
            .request_payload
            .translation
            .accepted_ambiguous_request_risk
    );

    let source_root = state
        .config
        .data_root
        .join("jobs")
        .join(source_job_id)
        .join("translated");
    std::fs::write(
        source_root.join("translation-request-journal.v1.jsonl"),
        b"{not-json}\n",
    )
    .expect("corrupt source journal");
    let corrupt_retry = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source_job_id}/retry-stage"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "stage": "translation",
                        "ambiguous_request_policy": "accept_duplicate_risk"
                    })
                    .to_string(),
                ))
                .expect("corrupt retry request"),
        )
        .await
        .expect("corrupt retry response");
    assert_eq!(corrupt_retry.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn retry_stage_route_creates_translation_recovery_job_with_overrides() {
    let state = test_state("retry-stage-translation");
    let mut source_job = source_job_with_artifacts(
        "job-retry-stage-translation-source",
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Succeeded;
    seed_ocr_checkpoint_files(&state, &source_job);
    state.db.save_job(&source_job).expect("save source job");

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/job-retry-stage-translation-source/retry-stage")
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "stage": "translation",
                        "overrides": {
                            "translation": {
                                "model": "deepseek-v4-flash",
                                "workers": 50
                            },
                            "render": {
                                "compile_workers": 8
                            }
                        }
                    })
                    .to_string(),
                ))
                .expect("retry stage request"),
        )
        .await
        .expect("retry stage response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(
        payload["data"]["source_job_id"],
        "job-retry-stage-translation-source"
    );
    assert_eq!(payload["data"]["workflow"], "book");
    assert_eq!(payload["data"]["rerun_from_stage"], "translation");
    assert_eq!(
        payload["data"]["reused_artifacts"],
        json!(["source_pdf", "ocr_result"])
    );
    let retry_job_id = payload["data"]["job_id"].as_str().expect("job id");
    let retry_job = state.db.get_job(retry_job_id).expect("retry job");
    assert_eq!(retry_job.workflow, crate::models::WorkflowKind::Book);
    assert_eq!(
        retry_job.request_payload.source.artifact_job_id,
        "job-retry-stage-translation-source"
    );
    assert_eq!(retry_job.request_payload.translation.workers, 50);
    assert_eq!(retry_job.request_payload.render.compile_workers, 8);
    assert!(retry_job.request_payload.translation.api_key.is_empty());
    assert!(retry_job
        .request_payload
        .translation
        .credential_ref
        .starts_with("cred_"));
}

#[tokio::test]
async fn retry_stage_route_creates_render_job_by_default() {
    let state = test_state("retry-stage-render");
    let mut source_job = source_job_with_artifacts(
        "job-retry-stage-render-source",
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            translations_dir: Some("jobs/source/translated".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Succeeded;
    seed_translation_result_files(&state, &source_job);
    state.db.save_job(&source_job).expect("save source job");

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/job-retry-stage-render-source/retry-stage")
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "stage": "render" }).to_string()))
                .expect("retry render request"),
        )
        .await
        .expect("retry render response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["workflow"], "render");
    assert_eq!(payload["data"]["rerun_stages"], json!(["render"]));
    let retry_job_id = payload["data"]["job_id"].as_str().expect("job id");
    assert_ne!(retry_job_id, "job-retry-stage-render-source");
    let retry_job = state.db.get_job(retry_job_id).expect("retry job");
    assert_eq!(retry_job.workflow, crate::models::WorkflowKind::Render);
    assert_eq!(
        retry_job.request_payload.source.artifact_job_id,
        "job-retry-stage-render-source"
    );
}

#[tokio::test]
async fn retry_stage_route_allows_in_place_render_when_requested() {
    let state = test_state("retry-stage-render-in-place");
    let mut source_job = source_job_with_artifacts(
        "job-retry-stage-render-in-place",
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            translations_dir: Some("jobs/source/translated".to_string()),
            output_pdf: Some("jobs/source/output/old.pdf".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Succeeded;
    seed_translation_result_files(&state, &source_job);
    state.db.save_job(&source_job).expect("save source job");

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/job-retry-stage-render-in-place/retry-stage")
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "stage": "render",
                        "create_new_job": false
                    })
                    .to_string(),
                ))
                .expect("retry render in place request"),
        )
        .await
        .expect("retry render in place response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["job_id"], "job-retry-stage-render-in-place");
    assert_eq!(payload["data"]["workflow"], "render");
    let retry_job = state
        .db
        .get_job("job-retry-stage-render-in-place")
        .expect("retry job");
    assert_eq!(retry_job.workflow, crate::models::WorkflowKind::Render);
    assert_eq!(retry_job.status, JobStatusKind::Queued);
    assert!(retry_job
        .artifacts
        .as_ref()
        .expect("artifacts")
        .output_pdf
        .is_none());
}

#[tokio::test]
async fn retry_stage_route_applies_overrides_for_in_place_render() {
    let state = test_state("retry-stage-render-in-place-overrides");
    let mut source_job = source_job_with_artifacts(
        "job-retry-stage-render-in-place-overrides",
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            translations_dir: Some("jobs/source/translated".to_string()),
            output_pdf: Some("jobs/source/output/old.pdf".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Succeeded;
    source_job.request_payload.render.compile_workers = 1;
    source_job.request_payload.render.render_mode = "overlay".to_string();
    source_job.request_payload.runtime.timeout_seconds = 10;
    seed_translation_result_files(&state, &source_job);
    state.db.save_job(&source_job).expect("save source job");

    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/jobs/job-retry-stage-render-in-place-overrides/retry-stage")
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "stage": "render",
                        "create_new_job": false,
                        "overrides": {
                            "render": {
                                "render_mode": "typst",
                                "compile_workers": 8
                            },
                            "runtime": {
                                "timeout_seconds": 120
                            }
                        }
                    })
                    .to_string(),
                ))
                .expect("retry render in place request"),
        )
        .await
        .expect("retry render in place response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(
        payload["data"]["job_id"],
        "job-retry-stage-render-in-place-overrides"
    );
    let retry_job = state
        .db
        .get_job("job-retry-stage-render-in-place-overrides")
        .expect("retry job");
    assert_eq!(retry_job.request_payload.render.render_mode, "typst");
    assert_eq!(retry_job.request_payload.render.compile_workers, 8);
    assert_eq!(retry_job.request_payload.runtime.timeout_seconds, 120);
    assert!(retry_job.request_payload.translation.api_key.is_empty());
    assert!(retry_job
        .request_payload
        .translation
        .credential_ref
        .is_empty());
    assert!(retry_job.request_payload.ocr.credential_ref.is_empty());
    assert_eq!(
        retry_job.request_payload.runtime.job_id,
        "job-retry-stage-render-in-place-overrides"
    );
}
