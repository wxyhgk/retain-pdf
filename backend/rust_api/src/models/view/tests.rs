use std::fs;

use crate::models::view::job::{
    build_artifact_manifest, build_job_actions, build_job_links_with_workflow, job_to_detail,
    job_to_list_item, summarize_list_invocation, InvocationSummaryView, JobListItemView,
};
use crate::models::{
    redact_json_value, redact_text, sensitive_values, CreateJobInput, JobArtifactRecord,
    JobArtifacts, JobFailureInfo, JobSnapshot, JobStatusKind, WorkflowKind,
};
use crate::storage_paths::{
    ARTIFACT_KEY_MARKDOWN_RAW, ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON, ARTIFACT_KEY_TRANSLATED_PDF,
    ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON,
};

fn build_job(job_id: &str, workflow: WorkflowKind) -> JobSnapshot {
    let mut input = CreateJobInput::default();
    input.workflow = workflow;
    JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()])
}

fn artifact_record(job_id: &str, artifact_key: &str) -> JobArtifactRecord {
    JobArtifactRecord {
        job_id: job_id.to_string(),
        artifact_key: artifact_key.to_string(),
        artifact_group: "test".to_string(),
        artifact_kind: "file".to_string(),
        relative_path: format!("jobs/{job_id}/{artifact_key}"),
        file_name: Some(format!("{artifact_key}.bin")),
        content_type: "application/octet-stream".to_string(),
        ready: true,
        size_bytes: Some(42),
        checksum: None,
        source_stage: Some("test".to_string()),
        created_at: "2026-04-11T00:00:00Z".to_string(),
        updated_at: "2026-04-11T00:00:00Z".to_string(),
    }
}

#[test]
fn job_detail_view_contains_request_payload() {
    let mut input = CreateJobInput::default();
    input.ocr.page_ranges = "1-5".to_string();
    input.ocr.mineru_token = "mineru-secret".to_string();
    input.source.upload_id = "upload-1".to_string();
    input.translation.api_key = "sk-secret".to_string();
    let job = JobSnapshot::new(
        "job-view-test".to_string(),
        input,
        vec!["python".to_string()],
    );

    let detail = job_to_detail(
        &job,
        "http://127.0.0.1:41000",
        std::path::Path::new("/tmp"),
        false,
        false,
        false,
    );

    assert_eq!(detail.request_payload.ocr.page_ranges, "1-5");
    assert_eq!(detail.request_payload.source.upload_id, "upload-1");
    assert!(detail.request_payload.ocr.mineru_token.is_empty());
    assert!(detail.request_payload.translation.api_key.is_empty());
    assert!(detail.request_payload.ocr.mineru_token_configured);
    assert!(detail.request_payload.translation.api_key_configured);
}

#[test]
fn redact_helpers_remove_structured_and_inline_secrets() {
    let mut input = CreateJobInput::default();
    input.translation.api_key = "sk-secret".to_string();
    input.ocr.mineru_token = "mineru-secret".to_string();
    let spec = crate::models::ResolvedJobSpec::from_input(input);
    let secrets = sensitive_values(&spec);

    let text = redact_text("token=sk-secret mineru-secret", &secrets);
    assert!(!text.contains("sk-secret"));
    assert!(!text.contains("mineru-secret"));
    assert!(text.contains("[REDACTED]"));

    let payload = serde_json::json!({
        "api_key": "sk-secret",
        "note": "contains sk-secret",
        "nested": {
            "mineru_token": "mineru-secret",
            "message": "mineru-secret inside"
        }
    });
    let redacted = redact_json_value(&payload, &secrets);
    assert_eq!(redacted["api_key"], "");
    assert_eq!(redacted["nested"]["mineru_token"], "");
    assert_eq!(redacted["note"], "contains [REDACTED]");
    assert_eq!(redacted["nested"]["message"], "[REDACTED] inside");
}

#[test]
fn workflow_contract_uses_expected_route_prefixes() {
    let cases = [
        (WorkflowKind::Book, "/api/v1/jobs"),
        (WorkflowKind::Translate, "/api/v1/jobs"),
        (WorkflowKind::Render, "/api/v1/jobs"),
        (WorkflowKind::Ocr, "/api/v1/ocr/jobs"),
    ];

    for (workflow, prefix) in cases {
        let job = build_job("job-contract", workflow.clone());
        let links = build_job_links_with_workflow("job-contract", &workflow, "https://api.example");
        let pdf_ready = !matches!(workflow, WorkflowKind::Ocr);
        let actions = build_job_actions(&job, "https://api.example", pdf_ready, false, false);
        let item = job_to_list_item(
            &job,
            "https://api.example",
            "paper.pdf".to_string(),
            std::path::Path::new("/tmp"),
        );

        assert_eq!(links.self_path, format!("{prefix}/job-contract"));
        assert_eq!(links.events_path, format!("{prefix}/job-contract/events"));
        assert_eq!(actions.open_job.path, format!("{prefix}/job-contract"));
        assert_eq!(actions.rerun.path, format!("{prefix}/job-contract/rerun"));
        assert!(!actions.rerun.enabled);
        assert_eq!(
            actions.open_artifacts.path,
            format!("{prefix}/job-contract/artifacts")
        );
        assert_eq!(
            actions.download_pdf.path,
            format!("{prefix}/job-contract/pdf")
        );
        assert_eq!(actions.download_pdf.enabled, pdf_ready);
        assert!(!actions.open_markdown.enabled);
        assert_eq!(item.detail_path, format!("{prefix}/job-contract"));
    }
}

#[test]
fn job_actions_enable_rerun_for_reusable_checkpoints_only() {
    let mut translate_job = build_job("job-rerun-ready", WorkflowKind::Translate);
    translate_job.artifacts = Some(JobArtifacts {
        source_pdf: Some("jobs/job-rerun-ready/source/input.pdf".to_string()),
        normalized_document_json: Some("jobs/job-rerun-ready/ocr/document.v1.json".to_string()),
        ..JobArtifacts::default()
    });
    let actions = build_job_actions(&translate_job, "https://api.example", false, false, false);
    assert!(actions.rerun.enabled);
    assert_eq!(actions.rerun.method, "POST");
    assert_eq!(actions.rerun.path, "/api/v1/jobs/job-rerun-ready/rerun");

    let mut ocr_job = build_job("ocr-rerun-disabled", WorkflowKind::Ocr);
    ocr_job.artifacts = translate_job.artifacts.clone();
    let actions = build_job_actions(&ocr_job, "https://api.example", false, false, false);
    assert!(!actions.rerun.enabled);
}

#[test]
fn summarize_list_invocation_counts_stage_spec_and_unknown() {
    let items = vec![
        JobListItemView {
            job_id: "job-1".to_string(),
            display_name: "a.pdf".to_string(),
            workflow: WorkflowKind::Translate,
            status: JobStatusKind::Succeeded,
            trace_id: None,
            stage: Some("done".to_string()),
            stage_detail: Some("任务完成".to_string()),
            progress: crate::models::JobProgressView {
                current: Some(10),
                total: Some(10),
                percent: Some(100.0),
            },
            page_count: Some(10),
            source_file_name: Some("a.pdf".to_string()),
            cover_url: Some("https://api.example/api/v1/jobs/job-1/cover".to_string()),
            thumbnail_url: Some("https://api.example/api/v1/jobs/job-1/thumbnail".to_string()),
            output_pdf_ready: true,
            markdown_ready: true,
            bundle_ready: true,
            invocation: Some(InvocationSummaryView {
                stage: "translate".to_string(),
                input_protocol: "stage_spec".to_string(),
                stage_spec_schema_version: "translate.stage.v1".to_string(),
            }),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            detail_path: "/api/v1/jobs/job-1".to_string(),
            detail_url: "https://api.example/api/v1/jobs/job-1".to_string(),
        },
        JobListItemView {
            job_id: "job-2".to_string(),
            display_name: "b.pdf".to_string(),
            workflow: WorkflowKind::Book,
            status: JobStatusKind::Queued,
            trace_id: None,
            stage: None,
            stage_detail: None,
            progress: crate::models::JobProgressView {
                current: None,
                total: None,
                percent: None,
            },
            page_count: None,
            source_file_name: Some("b.pdf".to_string()),
            cover_url: None,
            thumbnail_url: None,
            output_pdf_ready: false,
            markdown_ready: false,
            bundle_ready: false,
            invocation: None,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            detail_path: "/api/v1/jobs/job-2".to_string(),
            detail_url: "https://api.example/api/v1/jobs/job-2".to_string(),
        },
    ];

    let summary = summarize_list_invocation(&items);

    assert_eq!(summary.stage_spec_count, 1);
    assert_eq!(summary.unknown_count, 1);
}

#[test]
fn artifact_manifest_maps_canonical_resource_paths() {
    let job = build_job("job-artifacts", WorkflowKind::Translate);
    let manifest = build_artifact_manifest(
        &job,
        "https://api.example",
        &[
            artifact_record("job-artifacts", ARTIFACT_KEY_TRANSLATED_PDF),
            artifact_record("job-artifacts", ARTIFACT_KEY_MARKDOWN_RAW),
            artifact_record("job-artifacts", ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON),
        ],
    );

    let translated_pdf = manifest
        .items
        .iter()
        .find(|item| item.artifact_key == ARTIFACT_KEY_TRANSLATED_PDF)
        .expect("translated pdf item");
    assert_eq!(
        translated_pdf.resource_path.as_deref(),
        Some("/api/v1/jobs/job-artifacts/pdf")
    );
    assert_eq!(
        translated_pdf.resource_url.as_deref(),
        Some("https://api.example/api/v1/jobs/job-artifacts/pdf")
    );

    let markdown_raw = manifest
        .items
        .iter()
        .find(|item| item.artifact_key == ARTIFACT_KEY_MARKDOWN_RAW)
        .expect("markdown raw item");
    assert_eq!(
        markdown_raw.resource_path.as_deref(),
        Some("/api/v1/jobs/job-artifacts/markdown?raw=true")
    );

    let translation_manifest = manifest
        .items
        .iter()
        .find(|item| item.artifact_key == ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON)
        .expect("translation manifest item");
    assert_eq!(
        translation_manifest.resource_path.as_deref(),
        Some("/api/v1/jobs/job-artifacts/artifacts/translation_manifest_json")
    );
}

#[test]
fn ocr_artifact_manifest_uses_ocr_route_family() {
    let job = build_job("ocr-artifacts", WorkflowKind::Ocr);
    let manifest = build_artifact_manifest(
        &job,
        "https://api.example",
        &[artifact_record(
            "ocr-artifacts",
            ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON,
        )],
    );

    let document = manifest.items.first().expect("normalized document item");
    assert_eq!(
        document.resource_path.as_deref(),
        Some("/api/v1/ocr/jobs/ocr-artifacts/normalized-document")
    );
}

#[test]
fn job_detail_view_exposes_runtime_and_failure_contract() {
    let mut job = build_job("job-failure", WorkflowKind::Render);
    job.status = JobStatusKind::Failed;
    job.stage = Some("rendering".to_string());
    job.stage_detail = Some("render failed".to_string());
    job.error = Some("TypstCompileError".to_string());
    job.updated_at = "2026-04-11T00:00:10Z".to_string();
    job.replace_failure_info(Some(JobFailureInfo {
        stage: "rendering".to_string(),
        category: "render_failure".to_string(),
        code: Some("typst_compile_error".to_string()),
        failed_stage: Some("rendering".to_string()),
        failure_code: Some("render_failure".to_string()),
        failure_category: Some("render".to_string()),
        provider_stage: Some("typst_compile".to_string()),
        provider_code: Some("typst_compile_error".to_string()),
        summary: "渲染阶段失败".to_string(),
        root_cause: Some("Typst syntax error".to_string()),
        retryable: false,
        upstream_host: None,
        provider: None,
        suggestion: Some("检查渲染输入".to_string()),
        last_log_line: Some("compile error".to_string()),
        raw_excerpt: Some("compile error".to_string()),
        raw_error_excerpt: Some("compile error".to_string()),
        raw_diagnostic: None,
        ai_diagnostic: None,
    }));
    job.sync_runtime_state();

    let detail = job_to_detail(
        &job,
        "https://api.example",
        std::path::Path::new("/tmp"),
        false,
        false,
        false,
    );

    assert_eq!(detail.status, JobStatusKind::Failed);
    assert_eq!(detail.workflow, WorkflowKind::Render);
    assert_eq!(
        detail.failure.as_ref().map(|item| item.category.as_str()),
        Some("render_failure")
    );
    assert_eq!(
        detail
            .failure
            .as_ref()
            .and_then(|item| item.failed_stage.as_deref()),
        Some("rendering")
    );
    assert_eq!(
        detail
            .failure
            .as_ref()
            .and_then(|item| item.failure_code.as_deref()),
        Some("render_failure")
    );
    assert_eq!(
        detail
            .failure
            .as_ref()
            .and_then(|item| item.failure_category.as_deref()),
        Some("render")
    );
    assert_eq!(
        detail
            .failure_diagnostic
            .as_ref()
            .map(|item| item.failed_stage.as_str()),
        Some("rendering")
    );
    assert_eq!(
        detail
            .failure_diagnostic
            .as_ref()
            .map(|item| item.error_kind.as_str()),
        Some("render_failure")
    );
    assert_eq!(detail.error.as_deref(), Some("TypstCompileError"));
    assert_eq!(
        detail
            .runtime
            .as_ref()
            .and_then(|runtime| runtime.terminal_reason.as_deref()),
        Some("failed")
    );
    assert_eq!(detail.actions.cancel.enabled, false);
    assert_eq!(detail.artifacts.pdf.ready, false);
}

#[test]
fn job_detail_view_loads_glossary_summary_from_translation_manifest() {
    let temp = std::env::temp_dir().join(format!("view-glossary-{}", fastrand::u64(..)));
    let data_root = temp.join("data");
    let translations_dir = data_root.join("jobs/job-glossary/translated");
    fs::create_dir_all(&translations_dir).expect("create translations dir");
    fs::write(
        translations_dir.join("translation-manifest.json"),
        r#"{
          "schema": "translation_manifest_v1",
          "schema_version": 1,
          "pages": [],
          "glossary": {
            "enabled": true,
            "glossary_id": "glossary-123",
            "glossary_name": "materials",
            "entry_count": 2,
            "resource_entry_count": 1,
            "inline_entry_count": 1,
            "overridden_entry_count": 1,
            "source_hit_entry_count": 2,
            "target_hit_entry_count": 1,
            "unused_entry_count": 0,
            "unapplied_source_hit_entry_count": 1
          }
        }"#,
    )
    .expect("write manifest");

    let mut job = build_job("job-glossary", WorkflowKind::Translate);
    job.artifacts = Some(crate::models::JobArtifacts {
        translations_dir: Some("jobs/job-glossary/translated".to_string()),
        ..Default::default()
    });

    let detail = job_to_detail(&job, "https://api.example", &data_root, false, false, false);

    assert_eq!(
        detail
            .glossary_summary
            .as_ref()
            .map(|item| item.glossary_id.as_str()),
        Some("glossary-123")
    );
    assert_eq!(
        detail
            .glossary_summary
            .as_ref()
            .map(|item| item.target_hit_entry_count),
        Some(1)
    );
}

#[test]
fn job_detail_view_loads_invocation_from_translation_manifest() {
    let temp = std::env::temp_dir().join(format!("view-invocation-{}", fastrand::u64(..)));
    let data_root = temp.join("data");
    let translations_dir = data_root.join("jobs/job-invocation/translated");
    fs::create_dir_all(&translations_dir).expect("create translations dir");
    fs::write(
        translations_dir.join("translation-manifest.json"),
        r#"{
          "schema": "translation_manifest_v1",
          "schema_version": 1,
          "pages": [],
          "invocation": {
            "stage": "translate",
            "input_protocol": "stage_spec",
            "stage_spec_schema_version": "translate.stage.v1"
          }
        }"#,
    )
    .expect("write manifest");

    let mut job = build_job("job-invocation", WorkflowKind::Translate);
    job.artifacts = Some(crate::models::JobArtifacts {
        translations_dir: Some("jobs/job-invocation/translated".to_string()),
        ..Default::default()
    });

    let detail = job_to_detail(&job, "https://api.example", &data_root, false, false, false);

    assert_eq!(
        detail.invocation.as_ref().map(|item| item.stage.as_str()),
        Some("translate")
    );
    assert_eq!(
        detail
            .invocation
            .as_ref()
            .map(|item| item.input_protocol.as_str()),
        Some("stage_spec")
    );
    assert_eq!(
        detail
            .invocation
            .as_ref()
            .map(|item| item.stage_spec_schema_version.as_str()),
        Some("translate.stage.v1")
    );
}

#[test]
fn job_detail_view_loads_invocation_from_pipeline_summary_fallback() {
    let temp = std::env::temp_dir().join(format!("view-invocation-summary-{}", fastrand::u64(..)));
    let data_root = temp.join("data");
    let artifacts_dir = data_root.join("jobs/job-invocation-summary/artifacts");
    fs::create_dir_all(&artifacts_dir).expect("create artifacts dir");
    fs::write(
        artifacts_dir.join("pipeline_summary.json"),
        r#"{
          "invocation": {
            "stage": "render",
            "input_protocol": "stage_spec",
            "stage_spec_schema_version": "render.stage.v1"
          }
        }"#,
    )
    .expect("write summary");

    let mut job = build_job("job-invocation-summary", WorkflowKind::Render);
    job.artifacts = Some(crate::models::JobArtifacts {
        summary: Some("jobs/job-invocation-summary/artifacts/pipeline_summary.json".to_string()),
        ..Default::default()
    });

    let detail = job_to_detail(&job, "https://api.example", &data_root, false, false, false);

    assert_eq!(
        detail.invocation.as_ref().map(|item| item.stage.as_str()),
        Some("render")
    );
    assert_eq!(
        detail
            .invocation
            .as_ref()
            .map(|item| item.input_protocol.as_str()),
        Some("stage_spec")
    );
    assert_eq!(
        detail
            .invocation
            .as_ref()
            .map(|item| item.stage_spec_schema_version.as_str()),
        Some("render.stage.v1")
    );
}
