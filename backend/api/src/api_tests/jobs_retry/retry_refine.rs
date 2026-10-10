//! `retry-stage stage=refine`：原地精修 + 重渲染。覆盖值落在任务目录的
//! `specs/refine-override.json`，不写进任务的 translation.refine。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobSnapshot, JobStatusKind, WorkflowKind};
use crate::services::credentials::api::{create_credential, CreateCredentialInput};

use super::common::{seed_translation_result_files, source_job_with_artifacts};

fn translation_credential(state: &crate::AppState, label: &str) -> String {
    create_credential(
        &state.config.data_root,
        CreateCredentialInput {
            kind: "translation_api_key".to_string(),
            provider: "deepseek".to_string(),
            label: label.to_string(),
            secret: "sk-refine-test-secret".to_string(),
            expected_revision: None,
        },
    )
    .expect("create translation credential")
    .credential
    .credential_ref
}

/// 一个已经翻译完成、译文可复用、翻译 key 走 vault 引用的任务。
fn seed_translated_job(state: &crate::AppState, job_id: &str) -> JobSnapshot {
    // 译文在任务自己的 <job_root>/translated：精修只写回这个目录。
    let mut job = source_job_with_artifacts(
        job_id,
        JobArtifacts {
            job_root: Some(format!("jobs/{job_id}")),
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            translations_dir: Some(format!("jobs/{job_id}/translated")),
            output_pdf: Some("jobs/source/output/old.pdf".to_string()),
            ..JobArtifacts::default()
        },
    );
    job.status = JobStatusKind::Succeeded;
    job.workflow = WorkflowKind::Book;
    job.request_payload.workflow = WorkflowKind::Book;
    job.request_payload.translation.api_key.clear();
    job.request_payload.translation.credential_ref = translation_credential(state, "refine");
    seed_translation_result_files(state, &job);
    state.db.save_job(&job).expect("save source job");
    job
}

fn override_path(state: &crate::AppState, job_id: &str) -> std::path::PathBuf {
    state
        .config
        .output_root
        .join(job_id)
        .join("specs")
        .join("refine-override.json")
}

fn read_override(state: &crate::AppState, job_id: &str) -> Option<Value> {
    std::fs::read(override_path(state, job_id))
        .ok()
        .map(|bytes| serde_json::from_slice(&bytes).expect("override is json"))
}

async fn retry(state: &crate::AppState, job_id: &str, body: Value) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/jobs/{job_id}/retry-stage"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("retry request"),
        )
        .await
        .expect("retry response")
}

#[tokio::test]
async fn refine_retry_defaults_to_whole_book_review_and_fix_in_place() {
    let state = test_state("retry-refine-defaults");
    let id = "job-retry-refine-defaults";
    let source = seed_translated_job(&state, id);

    // create_new_job 省略：stage=refine 默认原地执行。
    let response = retry(&state, id, json!({"stage": "refine"})).await;
    assert_eq!(response.status(), StatusCode::OK);
    // 覆盖要在启动之前写好；在任何别的 await 之前读。
    let staged = read_override(&state, id).expect("refine override staged before launch");
    let payload = read_json(response).await;

    assert_eq!(staged["mode"], "review_and_fix");
    assert!(staged["start_page"].is_null());
    assert!(staged["end_page"].is_null());
    assert_eq!(payload["data"]["job_id"], id);
    assert_eq!(payload["data"]["source_job_id"], id);
    assert_eq!(payload["data"]["workflow"], "render");
    assert_eq!(payload["data"]["rerun_from_stage"], "refine");
    assert_eq!(payload["data"]["rerun_stages"], json!(["refine", "render"]));
    assert_eq!(
        payload["data"]["reused_artifacts"],
        json!(["source_pdf", "ocr_result", "translation_result"])
    );

    let job = state.db.get_job(id).expect("retry job");
    assert_eq!(job.workflow, WorkflowKind::Render);
    assert_eq!(job.status, JobStatusKind::Queued);
    // 一次性覆盖不进任务配置：之后的普通重渲染不会再精修。
    assert_eq!(job.request_payload.translation.refine, "off");
    // 精修要调模型：凭据引用保留，内联 key 不落库，OCR 凭据照常清掉。
    assert_eq!(
        job.request_payload.translation.credential_ref,
        source.request_payload.translation.credential_ref
    );
    assert!(job.request_payload.translation.api_key.is_empty());
    assert!(job.request_payload.ocr.credential_ref.is_empty());
    assert!(job.artifacts.as_ref().expect("artifacts").output_pdf.is_none());
}

#[tokio::test]
async fn refine_retry_accepts_mode_and_one_based_page_range() {
    let state = test_state("retry-refine-pages");
    let id = "job-retry-refine-pages";
    seed_translated_job(&state, id);

    let response = retry(
        &state,
        id,
        json!({
            "stage": "refine",
            "create_new_job": false,
            "refine": {"mode": "review_only", "start_page": 3, "end_page": 5}
        }),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    let staged = read_override(&state, id).expect("refine override staged");
    assert_eq!(staged["mode"], "review_only");
    assert_eq!(staged["start_page"], 3);
    assert_eq!(staged["end_page"], 5);
}

#[tokio::test]
async fn refine_retry_rejects_bad_requests() {
    let state = test_state("retry-refine-bad-requests");
    let id = "job-retry-refine-bad-requests";
    seed_translated_job(&state, id);

    for (body, needle) in [
        (
            json!({"stage": "refine", "create_new_job": true}),
            "create_new_job=false",
        ),
        (
            json!({"stage": "refine", "refine": {"mode": "off"}}),
            "refine.mode",
        ),
        (
            json!({"stage": "refine", "refine": {"mode": "rewrite"}}),
            "refine.mode",
        ),
        (
            json!({"stage": "refine", "refine": {"start_page": 0}}),
            "1-based",
        ),
        (
            json!({"stage": "refine", "refine": {"start_page": 6, "end_page": 5}}),
            "start_page must be <=",
        ),
        (
            json!({"stage": "render", "create_new_job": false, "refine": {"mode": "review_only"}}),
            "only accepted with stage=refine",
        ),
        (
            json!({"stage": "refine", "overrides": {"translation": {"api_key": "sk-inline"}}}),
            "inline",
        ),
    ] {
        let response = retry(&state, id, body.clone()).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{body}");
        let payload = read_json(response).await;
        assert!(
            payload.to_string().contains(needle),
            "{body} 的报错应当提到 {needle:?}: {payload}"
        );
    }
    let response = retry(
        &state,
        id,
        json!({"stage": "refine", "refine": {"unknown": 1}}),
    )
    .await;
    assert!(
        response.status().is_client_error(),
        "refine 对象拒绝未知字段，免得拼错的字段被静默忽略"
    );
    assert!(read_override(&state, id).is_none(), "被拒的请求不能留下覆盖");
    let job = state.db.get_job(id).expect("job");
    assert_eq!(job.status, JobStatusKind::Succeeded, "被拒的请求不能改动任务");
}

#[tokio::test]
async fn refine_retry_conflicts_while_job_is_running() {
    let state = test_state("retry-refine-running");
    let id = "job-retry-refine-running";
    let mut job = seed_translated_job(&state, id);
    job.status = JobStatusKind::Running;
    state.db.save_job(&job).expect("save running job");

    let response = retry(&state, id, json!({"stage": "refine"})).await;
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert!(read_override(&state, id).is_none());
}

#[tokio::test]
async fn refine_retry_requires_committed_translations() {
    let state = test_state("retry-refine-no-translation");
    let id = "job-retry-refine-no-translation";
    let mut job = source_job_with_artifacts(
        id,
        JobArtifacts {
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            ..JobArtifacts::default()
        },
    );
    job.status = JobStatusKind::Failed;
    state.db.save_job(&job).expect("save job");

    let response = retry(&state, id, json!({"stage": "refine"})).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let payload = read_json(response).await;
    assert!(payload.to_string().contains("committed translations"), "{payload}");

    let actions = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{id}/stage-actions"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("stage actions request"),
        )
        .await
        .expect("stage actions response");
    let actions = read_json(actions).await;
    let refine = actions["data"]["stages"]
        .as_array()
        .expect("stages")
        .iter()
        .find(|item| item["stage"] == "refine")
        .cloned()
        .expect("refine action");
    assert_eq!(refine["can_retry"], false);
    assert!(refine["action"].is_null());
}

#[tokio::test]
async fn refine_retry_needs_a_model_credential_and_accepts_a_reference_override() {
    let state = test_state("retry-refine-credential");
    let id = "job-retry-refine-credential";
    let mut job = seed_translated_job(&state, id);
    // 之前的普通重渲染已经清掉了任务上的凭据引用。
    job.request_payload.translation.credential_ref.clear();
    state.db.save_job(&job).expect("save job");

    let response = retry(&state, id, json!({"stage": "refine"})).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert!(read_json(response).await.to_string().contains("credential"));

    let response = retry(
        &state,
        id,
        json!({"stage": "refine", "overrides": {"translation": {"credential_ref": "cred_missing"}}}),
    )
    .await;
    assert!(response.status().is_client_error(), "不存在的引用要拒绝");
    assert!(read_override(&state, id).is_none());

    let credential_ref = translation_credential(&state, "refine-override");
    let response = retry(
        &state,
        id,
        json!({"stage": "refine", "overrides": {"translation": {"credential_ref": credential_ref}}}),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(read_override(&state, id).is_some());
    let job = state.db.get_job(id).expect("job");
    assert_eq!(job.request_payload.translation.credential_ref, credential_ref);
}

#[tokio::test]
async fn refine_retry_is_unavailable_for_rust_model_execution_jobs() {
    let state = test_state("retry-refine-rust-model");
    let id = "job-retry-refine-rust-model";
    let mut job = seed_translated_job(&state, id);
    job.request_payload.translation.execution_connection = Some(
        serde_json::from_value(json!({
            "id":"test", "revision":1, "provider":"qwen", "base_url":"https://example.org/v1",
            "model":"qwen3.8-flash", "credential_ref":"cred_test", "concurrency":2
        }))
        .unwrap(),
    );
    state.db.save_job(&job).expect("save job");

    let response = retry(&state, id, json!({"stage": "refine"})).await;
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert!(read_override(&state, id).is_none());
}

/// 普通原地重渲染永远不精修：上一次精修没用完的覆盖（例如运行时重启时被判成 failed）
/// 必须在提交前清掉。
#[tokio::test]
async fn plain_render_retry_clears_a_stale_refine_override() {
    let state = test_state("retry-render-clears-refine");
    let id = "job-retry-render-clears-refine";
    seed_translated_job(&state, id);
    let path = override_path(&state, id);
    std::fs::create_dir_all(path.parent().expect("specs dir")).expect("specs dir");
    std::fs::write(&path, br#"{"mode":"review_and_fix","requested_at":"stale"}"#)
        .expect("stale override");

    let response = retry(
        &state,
        id,
        json!({"stage": "render", "create_new_job": false}),
    )
    .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert!(!path.exists(), "普通重渲染不能带上残留的精修覆盖");
}

/// create_new_job=true 派生出来的渲染任务读的是源任务的译文目录；精修只写回任务
/// 自己的 <job_root>/translated，所以这类任务不能精修，要去精修源任务。
#[tokio::test]
async fn refine_retry_rejects_jobs_rendering_another_jobs_translations() {
    let state = test_state("retry-refine-foreign-translations");
    let id = "job-retry-refine-foreign";
    let mut job = seed_translated_job(&state, id);
    let artifacts = job.artifacts.as_mut().expect("artifacts");
    artifacts.translations_dir = Some("jobs/source/translated".to_string());
    seed_translation_result_files(&state, &job);
    state.db.save_job(&job).expect("save job");

    let response = retry(&state, id, json!({"stage": "refine"})).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert!(read_json(response).await.to_string().contains("source job"));
    assert!(read_override(&state, id).is_none());
}

/// 原地精修 + 重渲染不动 render.engine：rpr 任务精修后仍用 rpr 渲染。
#[tokio::test]
async fn refine_retry_keeps_render_engine() {
    let state = test_state("retry-refine-render-engine");
    let id = "job-retry-refine-render-engine";
    let mut source = seed_translated_job(&state, id);
    source.request_payload.render.engine = "rpr".to_string();
    state.db.save_job(&source).expect("save rpr job");

    let response = retry(&state, id, json!({"stage": "refine"})).await;
    assert_eq!(response.status(), StatusCode::OK);
    let job = state.db.get_job(id).expect("refine job");
    assert_eq!(job.workflow, WorkflowKind::Render);
    assert_eq!(job.request_payload.render.engine, "rpr");
}

async fn refine_action(state: &crate::AppState, id: &str) -> Value {
    let actions = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{id}/stage-actions"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("stage actions request"),
        )
        .await
        .expect("stage actions response");
    read_json(actions).await["data"]["stages"]
        .as_array()
        .expect("stages")
        .iter()
        .find(|item| item["stage"] == "refine")
        .cloned()
        .expect("refine action")
}

#[tokio::test]
async fn stage_actions_show_how_far_the_last_refine_got() {
    let state = test_state("retry-refine-last");
    let id = "job-retry-refine-last";
    seed_translated_job(&state, id);
    // 还没精修过:没有摘要。
    assert!(refine_action(&state, id).await.get("last_refine").is_none());

    let report_path = state.config.data_root.join(format!("jobs/{id}/artifacts/refine_report.v1.json"));
    std::fs::create_dir_all(report_path.parent().unwrap()).unwrap();
    std::fs::write(
        &report_path,
        json!({
            "status": "stopped", "generated_at": "2026-10-09T05:25:54+00:00", "stopped_reason": "max_tokens",
            "review": {"candidate_item_count": 330, "reviewed_item_count": 300, "unreviewed_item_count": 30,
                       "next_page": 24, "summary": {"finding_count": 4}},
            "fix_summary": {"applied": 2},
        })
        .to_string(),
    )
    .unwrap();
    let last = refine_action(&state, id).await["last_refine"].clone();
    assert_eq!(last["status"], "stopped");
    assert_eq!(last["next_page"], 24);
    assert_eq!(last["unreviewed_item_count"], 30);
    assert_eq!((last["finding_count"].as_i64(), last["applied"].as_i64()), (Some(4), Some(2)));
    assert_eq!(last["stopped_reason"], "max_tokens");
    assert_eq!((last["mode"].as_str(), last["escalated_count"].as_i64()), (Some(""), Some(0)), "老报告：没有模式、没有待确认");

    // 编辑部报告：带上留给人确认的块。
    std::fs::write(
        &report_path,
        json!({
            "status": "completed", "generated_at": "2026-10-09T18:00:00+00:00", "mode": "editorial",
            "review": {"candidate_item_count": 330, "reviewed_item_count": 330, "summary": {"finding_count": 9}},
            "fix_summary": {"applied": 5},
            "editorial": {"escalated": [
                {"item_id": "p014-b019", "page_number": 14, "reason": "达到修改次数上限，仍未解决", "finding_ids": [], "categories": [], "attempts": []},
                {"item_id": "p019-b017", "page_number": 19, "reason": "术语有争议，需要人定：Cartesian coordinates（现译「笛卡尔坐标」）", "finding_ids": [], "categories": [], "attempts": []},
            ]},
        })
        .to_string(),
    )
    .unwrap();
    let last = refine_action(&state, id).await["last_refine"].clone();
    assert_eq!((last["mode"].as_str(), last["escalated_count"].as_i64()), (Some("editorial"), Some(2)));
    assert_eq!(last["escalated"][1]["page_number"], 19);
    assert!(last["escalated"][1]["reason"].as_str().unwrap().starts_with("术语有争议"));

    // 接着精修:从没审到的那一页开始,上限可以随这次请求给,负数不行。
    let response = retry(&state, id, json!({"stage": "refine", "refine": {"start_page": 24, "max_items": 0}})).await;
    assert_eq!(response.status(), StatusCode::OK);
    let staged = read_override(&state, id).expect("override staged");
    assert_eq!((staged["start_page"].as_i64(), staged["max_items"].as_i64()), (Some(24), Some(0)));
    assert!(staged["max_tokens"].is_null(), "not given: no limit (0) when the spec is written");
}

#[tokio::test]
async fn refine_limits_must_not_be_negative() {
    let state = test_state("retry-refine-negative");
    let id = "job-retry-refine-negative";
    seed_translated_job(&state, id);
    let response = retry(&state, id, json!({"stage": "refine", "refine": {"max_tokens": -1}})).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert!(read_json(response).await.to_string().contains("max_tokens"));
}
