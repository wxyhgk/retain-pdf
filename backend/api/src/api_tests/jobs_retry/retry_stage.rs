use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::json;
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobStatusKind};

use super::common::{
    seed_ambiguous_ocr_dispatch, seed_ambiguous_translation_request_journal,
    hold_job_drivers, seed_ocr_checkpoint_files, seed_ocr_upload, seed_translation_result_files,
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
                    .uri(format!("/api/v1/jobs/{id}/actions/retry-stage"))
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
        assert_eq!(
            read_json(response).await["error"]["details"]["reason"],
            "model_executor_unsupported"
        );
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
    // upload 没有 content_hash，恢复任务又只带 upload_id：归属只能从源任务继承。
    state
        .db
        .set_job_document_id(source_job_id, "doc-sha-ambiguous-ocr")
        .expect("link source job");
    seed_ambiguous_ocr_dispatch(&state, source_job_id, "mineru", "apply_upload_url");

    let diagnostics = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/jobs/{source_job_id}/reports/failure"))
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
                .uri(format!("/api/v1/jobs/{source_job_id}/actions/retry-stage"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "stage": "ocr" }).to_string()))
                .expect("blocked OCR retry"),
        )
        .await
        .expect("blocked response");
    assert_eq!(blocked.status(), StatusCode::CONFLICT);
    assert_eq!(
        read_json(blocked).await["error"]["details"]["reason"],
        "ambiguous_ocr_dispatch"
    );

    let upload_url = "https://signed.example/upload?token=must-not-leak";
    let stale = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/jobs/{source_job_id}/actions/resolve-ocr-ambiguity"
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
    let stale = read_json(stale).await;
    assert_eq!(stale["error"]["details"]["reason"], "stale_resolution");
    assert!(!serde_json::to_string(&stale)
        .expect("stale response json")
        .contains("must-not-leak"));

    let bound = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/jobs/{source_job_id}/actions/resolve-ocr-ambiguity"
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
    // 恢复任务是 book，OCR 在 `<恢复任务>-ocr` 子任务里跑：回执种在子任务名下。
    let receipt = state
        .db
        .latest_pipeline_dispatch(&format!("{recovery_job_id}-ocr"), "ocr-submit")
        .expect("recovery dispatch")
        .expect("seeded dispatch");
    assert_eq!(receipt.status, "receipted");
    assert_eq!(
        state.db.document_id_for_job(recovery_job_id).expect("lookup"),
        Some("doc-sha-ambiguous-ocr".to_string()),
        "绑定已有回执建出来的恢复任务没归到源任务那本书下"
    );
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
                .uri(format!("/api/v1/jobs/{source_job_id}/reports/failure"))
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
                    "/api/v1/jobs/{source_job_id}/actions/resolve-ocr-ambiguity"
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
                    "/api/v1/jobs/{source_job_id}/actions/resolve-ocr-ambiguity"
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
    // 种下的 ocr attempt 在真正跑 OCR 的 `<恢复任务>-ocr` 子任务名下（driver 可能已经在跑它，
    // 所以只看有没有，不看是不是还在 running）；父任务名下不留。
    assert!(state
        .db
        .has_pipeline_attempt(&format!("{recovery_job_id}-ocr"))
        .expect("recovery attempt"));
    assert!(!state
        .db
        .has_pipeline_attempt(recovery_job_id)
        .expect("parent attempt"));
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
                    "/api/v1/jobs/{source_job_id}/actions/resolve-ocr-ambiguity"
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
                .uri(format!("/api/v1/jobs/{source_job_id}/reports/failure"))
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
                .uri(format!("/api/v1/jobs/{source_job_id}/actions"))
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
    // 请求结果不确定：仍可重试（带 accept_duplicate_risk），disabled_code 说明为什么要确认。
    assert_eq!(translation_action["can_retry"], true);
    assert_eq!(translation_action["disabled_code"], "ambiguous_translation_request");
    assert_eq!(
        translation_action["action"]["body"]["ambiguous_request_policy"],
        "block"
    );

    let blocked = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source_job_id}/actions/retry-stage"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "stage": "translation" }).to_string()))
                .expect("blocked retry request"),
        )
        .await
        .expect("blocked retry response");
    assert_eq!(blocked.status(), StatusCode::CONFLICT);
    let blocked_payload = read_json(blocked).await;
    assert_eq!(blocked_payload["error"]["details"]["reason"], "ambiguous_translation_request");
    assert!(blocked_payload["message"]
        .as_str()
        .unwrap_or_default()
        .contains("accept_duplicate_risk"));

    let generic_rerun = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source_job_id}/actions/rerun"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("generic rerun request"),
        )
        .await
        .expect("generic rerun response");
    assert_eq!(generic_rerun.status(), StatusCode::CONFLICT);
    assert_eq!(
        read_json(generic_rerun).await["error"]["details"]["reason"],
        "ambiguous_translation_request"
    );

    let accepted = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{source_job_id}/actions/retry-stage"))
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
                .uri(format!("/api/v1/jobs/{source_job_id}/actions/retry-stage"))
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
    assert_eq!(
        read_json(corrupt_retry).await["error"]["details"]["reason"],
        "request_journal_corrupt"
    );
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
                .uri("/api/v1/jobs/job-retry-stage-translation-source/actions/retry-stage")
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "stage": "translation",
                        "overrides": {
                            "translation": {
                                "model": "deepseek-flash",
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
                .uri("/api/v1/jobs/job-retry-stage-render-source/actions/retry-stage")
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

/// 重新渲染出来的任务要归到同一本书下。它没有 upload_id，lifecycle 补不上归属；不写的话
/// 它不在 list_jobs_for_document 里，阅读页的打开计划看不见它，点「阅读」一直打开重新
/// 渲染之前的旧任务（实测：连点两次重新渲染，阅读页始终停在旧任务上）。
#[tokio::test]
async fn retry_stage_render_jobs_inherit_the_source_document() {
    let state = test_state("retry-stage-render-document");
    let mut source_job = source_job_with_artifacts(
        "job-retry-render-doc-source",
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
    state
        .db
        .set_job_document_id("job-retry-render-doc-source", "doc-sha-render")
        .expect("link source job");

    let retry = |source: String| {
        let state = state.clone();
        async move {
            let response = build_app(state)
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/api/v1/jobs/{source}/actions/retry-stage"))
                        .header("X-API-Key", "test-key")
                        .header("Content-Type", "application/json")
                        .body(Body::from(json!({ "stage": "render" }).to_string()))
                        .expect("retry render request"),
                )
                .await
                .expect("retry render response");
            assert_eq!(response.status(), StatusCode::OK);
            read_json(response).await["data"]["job_id"]
                .as_str()
                .expect("job id")
                .to_string()
        }
    };
    let first = retry("job-retry-render-doc-source".to_string()).await;
    assert_eq!(
        state.db.document_id_for_job(&first).expect("lookup"),
        Some("doc-sha-render".to_string()),
        "重新渲染的任务没归到源任务那本书下"
    );

    // 在重新渲染的结果上再重新渲染一次：源任务自己就是派生出来的，归属也要接得上。
    let mut first_job = state.db.get_job(&first).expect("first retry job");
    first_job.status = JobStatusKind::Succeeded;
    first_job.artifacts = source_job.artifacts.clone();
    state.db.save_job(&first_job).expect("finish first retry");
    let second = retry(first.clone()).await;

    let listed: Vec<String> = state
        .db
        .list_jobs_for_document("doc-sha-render", 50, 0)
        .expect("list jobs")
        .into_iter()
        .map(|job| job.job_id.clone())
        .collect();
    assert!(listed.contains(&first), "第一次重新渲染不在这本书的任务里：{listed:?}");
    assert!(listed.contains(&second), "第二次重新渲染不在这本书的任务里：{listed:?}");
}

#[tokio::test]
async fn retry_stage_route_allows_in_place_render_when_requested() {
    let mut state = test_state("retry-stage-render-in-place");
    hold_job_drivers(&mut state);
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
                .uri("/api/v1/jobs/job-retry-stage-render-in-place/actions/retry-stage")
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
                .uri("/api/v1/jobs/job-retry-stage-render-in-place-overrides/actions/retry-stage")
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

/// 边识别边翻译的书翻译失败：以前 runner 没把 OCR 子任务的产物并回父任务，父任务记录里没有原文 PDF、规范化文档，
/// 「重试翻译」灰着（2026-11-03，6574 页的书翻完 6.86 万条后失败）。现在从 OCR 子任务补回来：能做的操作里重试翻译
/// 可用，提交重试时写回父任务，新任务能复用 OCR 结果。
#[tokio::test]
async fn translation_retry_recovers_ocr_artifacts_from_the_streamed_ocr_child() {
    let state = test_state("retry-stage-streamed-ocr-child");
    let parent_id = "job-streamed-ocr-parent";
    let mut parent = source_job_with_artifacts(
        parent_id,
        JobArtifacts {
            job_root: Some(format!("jobs/{parent_id}")),
            ..JobArtifacts::default()
        },
    );
    parent.status = JobStatusKind::Failed;
    state.db.save_job(&parent).expect("save parent");
    let mut child = source_job_with_artifacts(
        &format!("{parent_id}-ocr"),
        JobArtifacts {
            source_pdf: Some(format!("jobs/{parent_id}/source/book.pdf")),
            normalized_document_json: Some(format!("jobs/{parent_id}/ocr/normalized/document.v1.json")),
            ..JobArtifacts::default()
        },
    );
    child.workflow = crate::models::WorkflowKind::Ocr;
    child.status = JobStatusKind::Succeeded;
    seed_ocr_checkpoint_files(&state, &child);
    state.db.save_job(&child).expect("save ocr child");
    let app = build_app(state.clone());

    let actions = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{parent_id}/actions"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("actions request"),
        )
        .await
        .expect("actions response");
    assert_eq!(actions.status(), StatusCode::OK);
    let actions = read_json(actions).await;
    let translation = actions["data"]["stages"]
        .as_array()
        .expect("stages")
        .iter()
        .find(|stage| stage["stage"] == "translation")
        .expect("translation stage")
        .clone();
    assert_eq!(translation["can_retry"], true, "{translation}");
    // 只看不写：父任务的记录还没动
    assert!(state.db.get_job(parent_id).unwrap().artifacts.unwrap().normalized_document_json.is_none());

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{parent_id}/actions/retry-stage"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(json!({ "stage": "translation" }).to_string()))
                .expect("retry stage request"),
        )
        .await
        .expect("retry stage response");
    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    assert_eq!(payload["data"]["rerun_from_stage"], "translation");
    let artifacts = state.db.get_job(parent_id).unwrap().artifacts.unwrap();
    assert_eq!(
        artifacts.normalized_document_json.as_deref(),
        Some(format!("jobs/{parent_id}/ocr/normalized/document.v1.json").as_str())
    );
    assert_eq!(artifacts.source_pdf.as_deref(), Some(format!("jobs/{parent_id}/source/book.pdf").as_str()));
    assert_eq!(artifacts.ocr_job_id.as_deref(), Some(format!("{parent_id}-ocr").as_str()));
    let retry_job = state.db.get_job(payload["data"]["job_id"].as_str().unwrap()).unwrap();
    assert_eq!(retry_job.request_payload.source.artifact_job_id, parent_id);
}
