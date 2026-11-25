//! 任务操作被拒的约定：当前状态不允许 = 409 + `error.details.reason`（稳定的机器可读原因），
//! 请求本身写错了 = 400。GET 里的 `disabled_code` / `reason_code` 是同一套原因。

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::models::{JobArtifacts, JobSnapshot, JobStatusKind};

use super::common::{
    seed_ambiguous_ocr_dispatch, seed_ambiguous_translation_request_journal,
    seed_translation_result_files, source_job_with_artifacts,
};

async fn call(state: &crate::AppState, method: Method, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("X-API-Key", "test-key");
    let body = match body {
        Some(body) => {
            builder = builder.header("Content-Type", "application/json");
            Body::from(body.to_string())
        }
        None => Body::empty(),
    };
    let response = build_app(state.clone())
        .oneshot(builder.body(body).expect("request"))
        .await
        .expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

async fn post(state: &crate::AppState, id: &str, action: &str, body: Option<Value>) -> (StatusCode, Value) {
    call(state, Method::POST, &format!("/api/v1/jobs/{id}/actions/{action}"), body).await
}

fn assert_conflict(result: &(StatusCode, Value), reason: &str, what: &str) {
    assert_eq!(result.0, StatusCode::CONFLICT, "{what}: {}", result.1);
    assert_eq!(result.1["code"], 40900, "{what}");
    assert_eq!(result.1["error"]["code"], "CONFLICT", "{what}");
    assert_eq!(result.1["error"]["details"]["reason"], reason, "{what}: {}", result.1);
}

/// 译文齐全、能走任何阶段的任务（译文在任务自己的目录，精修也可以）。
fn seed_ready_job(state: &crate::AppState, id: &str, status: JobStatusKind) -> JobSnapshot {
    let mut job = source_job_with_artifacts(
        id,
        JobArtifacts {
            job_root: Some(format!("jobs/{id}")),
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            translations_dir: Some(format!("jobs/{id}/translated")),
            ..JobArtifacts::default()
        },
    );
    job.status = status;
    job.request_payload.source.upload_id = "upload-reasons".to_string();
    seed_translation_result_files(state, &job);
    state.db.save_job(&job).expect("save job");
    job
}

fn stage<'a>(actions: &'a Value, name: &str) -> &'a Value {
    actions["data"]["stages"]
        .as_array()
        .expect("stages")
        .iter()
        .find(|item| item["stage"] == name)
        .unwrap_or_else(|| panic!("stage {name}"))
}

#[tokio::test]
async fn running_job_rejects_every_action_with_job_active() {
    let state = test_state("reasons-job-active");
    for (index, status) in [JobStatusKind::Queued, JobStatusKind::Running].into_iter().enumerate() {
        let id = format!("job-reasons-active-{index}");
        seed_ready_job(&state, &id, status.clone());

        for action in ["resume"] {
            assert_conflict(&post(&state, &id, action, None).await, "job_active", action);
        }
        for (name, body) in [
            ("ocr", json!({"stage": "ocr"})),
            ("translation", json!({"stage": "translation"})),
            ("render new job", json!({"stage": "render"})),
            ("render in place", json!({"stage": "render", "create_new_job": false})),
            ("refine", json!({"stage": "refine"})),
        ] {
            assert_conflict(&post(&state, &id, "retry-stage", Some(body)).await, "job_active", name);
        }

        // GET 里同一个原因：四个阶段都不可重试，续跑计划也是。
        let (_, actions) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions"), None).await;
        for name in ["ocr", "translation", "render", "refine"] {
            let item = stage(&actions, name);
            assert_eq!(item["can_retry"], false, "{name}");
            assert_eq!(item["disabled_code"], "job_active", "{name}");
            assert!(!item["disabled_reason"].as_str().unwrap().is_empty());
        }
        let (_, plan) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions/resume"), None).await;
        assert_eq!(plan["data"]["can_resume"], false);
        assert_eq!(plan["data"]["reason_code"], "job_active");

        // 被拒的请求不能动任务。
        assert_eq!(state.db.get_job(&id).expect("job").status, status);
    }
}

#[tokio::test]
async fn running_job_with_in_place_ocr_request_is_still_a_malformed_request() {
    let state = test_state("reasons-400-wins");
    seed_ready_job(&state, "job-reasons-400-wins", JobStatusKind::Running);

    // create_new_job=false 对 ocr / translation 不支持：请求写错了，和任务在不在跑无关，一律 400。
    for stage in ["ocr", "translation"] {
        let (status, payload) = post(
            &state,
            "job-reasons-400-wins",
            "retry-stage",
            Some(json!({"stage": stage, "create_new_job": false})),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{stage}: {payload}");
        assert_eq!(payload["error"]["details"], json!({}));
    }
}

#[tokio::test]
async fn missing_artifacts_reject_with_artifacts_missing() {
    let state = test_state("reasons-artifacts-missing");
    let id = "job-reasons-artifacts-missing";
    // 记了产物路径但磁盘上没有文件，也没有可重提的来源。
    let mut job = source_job_with_artifacts(
        id,
        JobArtifacts {
            job_root: Some(format!("jobs/{id}")),
            source_pdf: Some("jobs/source/source/input.pdf".to_string()),
            normalized_document_json: Some("jobs/source/ocr/document.v1.json".to_string()),
            translations_dir: Some(format!("jobs/{id}/translated")),
            ..JobArtifacts::default()
        },
    );
    job.status = JobStatusKind::Failed;
    state.db.save_job(&job).expect("save job");

    assert_conflict(&post(&state, id, "resume", None).await, "artifacts_missing", "rerun");
    assert_conflict(&post(&state, id, "resume", None).await, "artifacts_missing", "resume");
    for stage in ["ocr", "translation", "render"] {
        assert_conflict(
            &post(&state, id, "retry-stage", Some(json!({"stage": stage}))).await,
            "artifacts_missing",
            stage,
        );
    }
    assert_conflict(
        &post(&state, id, "retry-stage", Some(json!({"stage": "render", "create_new_job": false}))).await,
        "artifacts_missing",
        "render in place",
    );
    assert_conflict(
        &post(&state, id, "retry-stage", Some(json!({"stage": "refine"}))).await,
        "artifacts_missing",
        "refine",
    );

    let (_, actions) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions"), None).await;
    for name in ["ocr", "translation", "render", "refine"] {
        let item = stage(&actions, name);
        assert_eq!(item["can_retry"], false, "{name}");
        assert_eq!(item["disabled_code"], "artifacts_missing", "{name}");
    }
    let (_, plan) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions/resume"), None).await;
    assert_eq!(plan["data"]["reason_code"], "artifacts_missing");
}

#[tokio::test]
async fn enabled_actions_have_null_codes() {
    let state = test_state("reasons-enabled");
    let id = "job-reasons-enabled";
    seed_ready_job(&state, id, JobStatusKind::Succeeded);

    let (_, actions) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions"), None).await;
    for name in ["ocr", "translation", "render", "refine"] {
        let item = stage(&actions, name);
        assert_eq!(item["can_retry"], true, "{name}");
        assert_eq!(item["disabled_reason"], "", "{name}");
        assert!(item["disabled_code"].is_null(), "{name}: {item}");
    }
    let (_, plan) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions/resume"), None).await;
    assert_eq!(plan["data"]["can_resume"], true);
    assert!(plan["data"]["reason_code"].is_null());
}

#[tokio::test]
async fn ambiguous_requests_reject_with_a_reason_per_kind() {
    let state = test_state("reasons-ambiguous");

    // OCR 派发结果不确定：处理办法是 resolve-ocr-ambiguity，和翻译的歧义分开报。
    let ocr_id = "job-reasons-ambiguous-ocr";
    let mut job = source_job_with_artifacts(ocr_id, JobArtifacts::default());
    job.status = JobStatusKind::Failed;
    job.request_payload.source.upload_id = super::common::seed_ocr_upload(&state, "upload-reasons-ocr").upload_id;
    job.request_payload.ocr.provider = "mineru".to_string();
    state.db.save_job(&job).expect("save ocr job");
    seed_ambiguous_ocr_dispatch(&state, ocr_id, "mineru", "apply_upload_url");
    assert_conflict(
        &post(&state, ocr_id, "retry-stage", Some(json!({"stage": "ocr"}))).await,
        "ambiguous_ocr_dispatch",
        "ocr retry",
    );
    assert_conflict(&post(&state, ocr_id, "resume", None).await, "ambiguous_ocr_dispatch", "ocr rerun");

    // 翻译请求结果不确定：通用续跑和不带 policy 的重试都挡住。
    let id = "job-reasons-ambiguous-translation";
    let mut job = seed_ready_job(&state, id, JobStatusKind::Failed);
    job.artifacts.as_mut().unwrap().translations_dir = None;
    state.db.save_job(&job).expect("save translation job");
    seed_ambiguous_translation_request_journal(&state, &job);
    assert_conflict(&post(&state, id, "resume", None).await, "ambiguous_translation_request", "translation rerun");
    assert_conflict(
        &post(&state, id, "retry-stage", Some(json!({"stage": "translation"}))).await,
        "ambiguous_translation_request",
        "translation retry",
    );
    let (_, plan) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions/resume"), None).await;
    assert_eq!(plan["data"]["can_resume"], false);
    assert_eq!(plan["data"]["reason_code"], "ambiguous_translation_request");
}

#[tokio::test]
async fn corrupt_translation_journal_rejects_with_request_journal_corrupt() {
    let state = test_state("reasons-journal-corrupt");
    let id = "job-reasons-journal-corrupt";
    let mut job = seed_ready_job(&state, id, JobStatusKind::Failed);
    job.artifacts.as_mut().unwrap().translations_dir = None;
    state.db.save_job(&job).expect("save job");
    seed_ambiguous_translation_request_journal(&state, &job);
    std::fs::write(
        state
            .config
            .data_root
            .join("jobs")
            .join(id)
            .join("translated")
            .join("translation-request-journal.v1.jsonl"),
        b"{not-json}\n",
    )
    .expect("corrupt journal");

    for body in [
        json!({"stage": "translation"}),
        json!({"stage": "translation", "ambiguous_request_policy": "accept_duplicate_risk"}),
    ] {
        assert_conflict(
            &post(&state, id, "retry-stage", Some(body)).await,
            "request_journal_corrupt",
            "translation retry",
        );
    }
    assert_conflict(&post(&state, id, "resume", None).await, "request_journal_corrupt", "rerun");
    let (_, actions) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions"), None).await;
    let translation = stage(&actions, "translation");
    assert_eq!(translation["can_retry"], false);
    assert_eq!(translation["disabled_code"], "request_journal_corrupt");
    let (_, plan) = call(&state, Method::GET, &format!("/api/v1/jobs/{id}/actions/resume"), None).await;
    assert_eq!(plan["data"]["reason_code"], "request_journal_corrupt");
}

#[tokio::test]
async fn cancel_of_a_job_that_is_not_active_is_job_not_active() {
    let state = test_state("reasons-job-not-active");
    for (index, status) in [JobStatusKind::Succeeded, JobStatusKind::Failed, JobStatusKind::Canceled]
        .into_iter()
        .enumerate()
    {
        let id = format!("job-reasons-not-active-{index}");
        seed_ready_job(&state, &id, status);
        assert_conflict(&post(&state, &id, "cancel", None).await, "job_not_active", "cancel");
    }
}

#[tokio::test]
async fn resolving_ocr_ambiguity_reports_why_it_cannot() {
    let state = test_state("reasons-ocr-resolution");
    let body = json!({"resolution": "accept_duplicate_risk", "resolution_revision": 1});

    seed_ready_job(&state, "job-reasons-resolve-running", JobStatusKind::Running);
    assert_conflict(
        &post(&state, "job-reasons-resolve-running", "resolve-ocr-ambiguity", Some(body.clone())).await,
        "job_active",
        "running",
    );
    seed_ready_job(&state, "job-reasons-resolve-succeeded", JobStatusKind::Succeeded);
    assert_conflict(
        &post(&state, "job-reasons-resolve-succeeded", "resolve-ocr-ambiguity", Some(body.clone())).await,
        "no_ocr_dispatch",
        "succeeded",
    );
    seed_ready_job(&state, "job-reasons-resolve-none", JobStatusKind::Failed);
    assert_conflict(
        &post(&state, "job-reasons-resolve-none", "resolve-ocr-ambiguity", Some(body)).await,
        "no_ocr_dispatch",
        "failed without dispatch",
    );
}

#[tokio::test]
async fn unknown_request_fields_are_400_and_change_nothing() {
    let state = test_state("reasons-unknown-fields");
    let id = "job-reasons-unknown-fields";
    seed_ready_job(&state, id, JobStatusKind::Succeeded);

    // 把 create_new_job 写成 createNewJob，以前会悄悄变成「新建任务」。
    for (action, body) in [
        ("retry-stage", json!({"stage": "render", "createNewJob": false})),
        ("retry-stage", json!({"stage": "render", "create_new_job": false, "extra": 1})),
        ("resolve-ocr-ambiguity", json!({"resolution": "accept_duplicate_risk", "resolution_revision": 1, "extra": 1})),
    ] {
        let (status, payload) = post(&state, id, action, Some(body.clone())).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{action} {body}: {payload}");
        assert_eq!(payload["error"]["code"], "BAD_REQUEST");
        let message = payload["message"].as_str().unwrap();
        assert!(message.contains("unknown field"), "{message}");
    }
    assert_eq!(state.db.get_job(id).expect("job").status, JobStatusKind::Succeeded);
    // 没有新任务被建出来。
    assert!(state.db.get_job(&format!("{id}-retry")).is_err());
}

/// 几种不是「状态不允许」的错误仍是 400：mode 不支持、refine 放错阶段、未知阶段。
#[tokio::test]
async fn malformed_retry_requests_stay_400() {
    let state = test_state("reasons-malformed");
    let id = "job-reasons-malformed";
    seed_ready_job(&state, id, JobStatusKind::Succeeded);
    for (name, body) in [
        ("bad mode", json!({"stage": "render", "mode": "whole_book"})),
        ("refine options on render", json!({"stage": "render", "refine": {"mode": "review_only"}})),
        ("refine as new job", json!({"stage": "refine", "create_new_job": true})),
        ("in-place ocr", json!({"stage": "ocr", "create_new_job": false})),
    ] {
        let (status, payload) = post(&state, id, "retry-stage", Some(body)).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{name}: {payload}");
        assert_eq!(payload["error"]["details"], json!({}), "{name}");
    }
}

/// OCR 上传到一半被用户取消：派发记录会标成拿不准（请求可能已经到了服务商）。处理入口
/// （失败诊断里的 `ocr_ambiguity`、resolve-ocr-ambiguity）以前只认失败的任务，已取消的任务
/// 续跑被 409 `ambiguous_ocr_dispatch` 拦住、提示去处理，处理入口却又说「任务不是失败态」。
#[tokio::test]
async fn canceled_job_with_ambiguous_ocr_dispatch_can_be_resolved() {
    let state = test_state("reasons-canceled-ocr");
    let id = "job-reasons-canceled-ocr";
    let mut job = source_job_with_artifacts(id, JobArtifacts::default());
    job.status = JobStatusKind::Canceled;
    job.request_payload.source.upload_id = super::common::seed_ocr_upload(&state, "upload-canceled-ocr").upload_id;
    job.request_payload.ocr.provider = "mineru".to_string();
    job.request_payload.ocr.mineru_token = "mineru-test-token".to_string();
    state.db.save_job(&job).expect("save canceled job");
    seed_ambiguous_ocr_dispatch(&state, id, "mineru", "apply_upload_url");

    assert_conflict(&post(&state, id, "resume", None).await, "ambiguous_ocr_dispatch", "canceled rerun");
    let (status, diagnostics) =
        call(&state, Method::GET, &format!("/api/v1/jobs/{id}/reports/failure"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(diagnostics["data"]["failure_code"], "ocr_request_ambiguous", "{diagnostics}");
    let revision = diagnostics["data"]["ocr_ambiguity"]["resolution_revision"].clone();
    assert!(revision.is_number(), "已取消的任务也要给出歧义处理入口：{diagnostics}");

    let (status, resolved) = post(
        &state,
        id,
        "resolve-ocr-ambiguity",
        Some(json!({"resolution": "accept_duplicate_risk", "resolution_revision": revision})),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{resolved}");
}
