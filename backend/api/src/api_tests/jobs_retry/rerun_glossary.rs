//! 重跑、阶段重试时的术语表：用现在的表，加上用户当时内联的条目（2026-10-22）。
//! 以前把源任务的整份快照当内联条目再并一次：表里改了的译法不生效、删了的词又回来，表删了 404。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::api::GlossaryUpsertInput;
use crate::models::{GlossaryEntryInput, JobArtifacts, JobSnapshot, JobStatusKind};
use crate::services::glossaries::{
    create_glossary_view, resolve_task_glossary_request, update_glossary_view, GlossaryApiDeps,
};

use super::common::{seed_ocr_checkpoint_files, source_job_with_artifacts};

fn entry(source: &str, target: &str) -> GlossaryEntryInput {
    GlossaryEntryInput {
        source: source.to_string(),
        target: target.to_string(),
        note: String::new(),
        level: "canonical".to_string(),
        match_mode: "case_insensitive".to_string(),
        context: String::new(),
    }
}

fn create_glossary(state: &crate::AppState, entries: Vec<GlossaryEntryInput>) -> String {
    create_glossary_view(
        &GlossaryApiDeps::new(state.db.as_ref()),
        &GlossaryUpsertInput { name: "chem".to_string(), entries, ..GlossaryUpsertInput::default() },
        crate::db::LOCAL_OWNER,
    )
    .expect("create glossary")
    .glossary_id
}

fn replace_entries(state: &crate::AppState, glossary_id: &str, entries: Vec<GlossaryEntryInput>) {
    update_glossary_view(
        &GlossaryApiDeps::new(state.db.as_ref()),
        glossary_id,
        &GlossaryUpsertInput { name: "chem".to_string(), entries, ..GlossaryUpsertInput::default() },
    )
    .expect("update glossary");
}

/// 失败的整本任务，术语照建任务时那样解析过（快照 + 内联条目）。
fn failed_source_with_glossary(
    state: &crate::AppState,
    job_id: &str,
    glossary_id: &str,
    inline: Vec<GlossaryEntryInput>,
) -> JobSnapshot {
    let mut source_job = source_job_with_artifacts(
        job_id,
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            ..JobArtifacts::default()
        },
    );
    source_job.status = JobStatusKind::Failed;
    let mut input = crate::models::CreateJobInput::default();
    input.translation = source_job.request_payload.translation.clone();
    input.translation.glossary_id = glossary_id.to_string();
    input.translation.glossary_entries = inline;
    source_job.request_payload.translation = resolve_task_glossary_request(state.db.as_ref(), &input)
        .expect("resolve source glossary")
        .translation;
    seed_ocr_checkpoint_files(state, &source_job);
    state.db.save_job(&source_job).expect("save source job");
    source_job
}

async fn post(state: &crate::AppState, uri: String, body: Value) -> (StatusCode, Value) {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("X-API-Key", "test-key")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("request"),
        )
        .await
        .expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

fn targets(job: &JobSnapshot) -> Vec<(String, String)> {
    job.request_payload
        .translation
        .glossary_entries
        .iter()
        .map(|entry| (entry.source.clone(), entry.target.clone()))
        .collect()
}

fn pairs(items: &[(&str, &str)]) -> Vec<(String, String)> {
    items.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect()
}

#[tokio::test]
async fn rerun_uses_the_current_glossary_plus_the_original_inline_entries() {
    let state = test_state("rerun-glossary-current");
    let glossary_id = create_glossary(&state, vec![entry("DNA", "脱氧核糖核酸"), entry("abstract", "摘要")]);
    failed_source_with_glossary(&state, "job-rerun-glossary-current", &glossary_id, vec![entry("band gap", "带隙")]);
    // 建完任务以后改了一个词的译法、删了一个词（例如 AI 终端 term-set）。
    replace_entries(&state, &glossary_id, vec![entry("DNA", "DNA 分子")]);

    let (status, payload) = post(&state, "/api/v1/jobs/job-rerun-glossary-current/actions/resume".to_string(), json!({})).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let rerun_job = state.db.get_job(payload["data"]["job_id"].as_str().unwrap()).expect("rerun job");
    assert_eq!(targets(&rerun_job), pairs(&[("DNA", "DNA 分子"), ("band gap", "带隙")]));
    let translation = &rerun_job.request_payload.translation;
    assert_eq!(translation.glossary_inline_entry_count, 1);
    assert_eq!(translation.glossary_resource_entry_count, 1);
    assert_eq!(translation.glossary_overridden_entry_count, 0);
    assert_eq!(translation.glossary_inline_entries, vec![entry("band gap", "带隙")]);
}

#[tokio::test]
async fn translation_retry_uses_the_current_glossary_too() {
    let state = test_state("retry-glossary-current");
    let glossary_id = create_glossary(&state, vec![entry("DNA", "脱氧核糖核酸")]);
    failed_source_with_glossary(&state, "job-retry-glossary-current", &glossary_id, vec![]);
    replace_entries(&state, &glossary_id, vec![entry("DNA", "DNA 分子")]);

    let (status, payload) = post(
        &state,
        "/api/v1/jobs/job-retry-glossary-current/actions/retry-stage".to_string(),
        json!({"stage": "translation"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let retry_job = state.db.get_job(payload["data"]["job_id"].as_str().unwrap()).expect("retry job");
    assert_eq!(targets(&retry_job), pairs(&[("DNA", "DNA 分子")]));
    assert_eq!(retry_job.request_payload.translation.glossary_inline_entry_count, 0);
}

#[tokio::test]
async fn rerun_after_the_glossary_was_deleted_is_409_glossary_missing() {
    let state = test_state("rerun-glossary-deleted");
    let glossary_id = create_glossary(&state, vec![entry("DNA", "脱氧核糖核酸")]);
    failed_source_with_glossary(&state, "job-rerun-glossary-deleted", &glossary_id, vec![]);
    state.db.delete_glossary(&glossary_id).expect("delete glossary");

    let (status, payload) = post(&state, "/api/v1/jobs/job-rerun-glossary-deleted/actions/resume".to_string(), json!({})).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "glossary_missing");

    let (status, payload) = post(
        &state,
        "/api/v1/jobs/job-rerun-glossary-deleted/actions/retry-stage".to_string(),
        json!({"stage": "translation"}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "glossary_missing");

    // 阶段重试换一张表（或清空）就能接着跑。
    let (status, payload) = post(
        &state,
        "/api/v1/jobs/job-rerun-glossary-deleted/actions/retry-stage".to_string(),
        json!({"stage": "translation", "overrides": {"translation": {"glossary_id": ""}}}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
}

/// 2026-10-22 以前的任务没存 `glossary_inline_entries`。
#[tokio::test]
async fn old_jobs_without_stored_inline_entries_keep_the_old_behavior() {
    let state = test_state("rerun-glossary-legacy");
    let glossary_id = create_glossary(&state, vec![entry("DNA", "脱氧核糖核酸")]);

    // 没有内联（条数 0）：照样用现在的表。
    let mut no_inline = failed_source_with_glossary(&state, "job-rerun-glossary-legacy-a", &glossary_id, vec![]);
    no_inline.request_payload.translation.glossary_inline_entries.clear();
    state.db.save_job(&no_inline).expect("save");
    // 有内联（条数 1）：分不清快照里哪条是内联的，整份快照当内联（旧行为）。
    let mut with_inline =
        failed_source_with_glossary(&state, "job-rerun-glossary-legacy-b", &glossary_id, vec![entry("band gap", "带隙")]);
    with_inline.request_payload.translation.glossary_inline_entries.clear();
    state.db.save_job(&with_inline).expect("save");
    replace_entries(&state, &glossary_id, vec![entry("DNA", "DNA 分子")]);

    let (status, payload) = post(&state, "/api/v1/jobs/job-rerun-glossary-legacy-a/actions/resume".to_string(), json!({})).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let job = state.db.get_job(payload["data"]["job_id"].as_str().unwrap()).expect("rerun job");
    assert_eq!(targets(&job), pairs(&[("DNA", "DNA 分子")]));

    let (status, payload) = post(&state, "/api/v1/jobs/job-rerun-glossary-legacy-b/actions/resume".to_string(), json!({})).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let job = state.db.get_job(payload["data"]["job_id"].as_str().unwrap()).expect("rerun job");
    assert_eq!(targets(&job), pairs(&[("DNA", "脱氧核糖核酸"), ("band gap", "带隙")]));
}
