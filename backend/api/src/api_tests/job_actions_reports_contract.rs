//! 任务操作 `job-actions.v1`、任务报告 `job-reports.v1` 的生产者锁（第 1b 期，2026-10-22）。
//!
//! 照 `library_documents_contract.rs` 的做法：打真实接口，拿 serde 实际写出来的 JSON，对着
//! backend-root/contracts 里的定义核对类型和键集合（多一个键、少一个键都红）；请求类型的字段集合
//! 和契约的 `properties` 对上。续跑的请求体 `RerunRequest` 是路由私有的，经接口的 400 报错核对。

use std::collections::BTreeSet;
use std::fs;

use axum::http::StatusCode;
use serde_json::{json, Value};

use super::job_view_contract::{
    assert_definition, assert_exact_object_keys, assert_object_keys_allowing_absent, contract,
    definition, object_keys, schema_keys,
};
use super::jobs_common::test_state;
use super::jobs_retry::common::{
    seed_ambiguous_ocr_dispatch, seed_ambiguous_translation_request_journal, seed_ocr_upload,
    seed_translation_result_files, source_job_with_artifacts,
};
use super::library_documents_contract::assert_request_fields_match;
use super::library_paging::send;
use crate::models::api::{OcrAmbiguityResolutionRequest, RefineRetryRequest, RetryStageRequest};
use crate::models::{JobArtifacts, JobStatusKind};
use crate::routes::jobs::reports::QualityItemsParams;
use crate::storage_paths::{attach_job_paths, build_job_paths};

const ACTIONS: &str = "job-actions.v1.schema.json";
const REPORTS: &str = "job-reports.v1.schema.json";

async fn ok_data(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> Value {
    let (status, payload) = send(state, method, uri, body).await;
    assert_eq!(status, StatusCode::OK, "{method} {uri}: {payload}");
    payload["data"].clone()
}

/// 类型对、键集合正好等于契约的全部属性。
fn assert_exact(value: &Value, contract: &Value, name: &str, path: &str) {
    assert_definition(value, contract, name, path);
    assert_exact_object_keys(value, contract, name, path);
}

fn required_keys(contract: &Value, name: &str) -> BTreeSet<String> {
    definition(contract, name)["required"]
        .as_array()
        .unwrap_or_else(|| panic!("{name} 没写 required"))
        .iter()
        .map(|key| key.as_str().unwrap().to_string())
        .collect()
}

/// 409 的 `error.details.reason` 是契约里 ActionBlockReason 的一个值。
fn assert_block_reason(payload: &Value, contract: &Value, expected: &str) {
    assert_eq!(payload["error"]["details"]["reason"], expected, "{payload}");
    let reasons = definition(contract, "ActionBlockReason")["enum"].as_array().unwrap();
    assert!(reasons.contains(&json!(expected)), "{expected} 不在 ActionBlockReason 里");
}

/// 能原地重渲染、也能重翻的成功任务（产物都在任务目录下）。
fn seed_renderable_job(state: &crate::AppState, job_id: &str) -> crate::models::JobSnapshot {
    let mut job = source_job_with_artifacts(
        job_id,
        JobArtifacts {
            job_root: Some(format!("jobs/{job_id}")),
            source_pdf: Some(format!("jobs/{job_id}/source/input.pdf")),
            normalized_document_json: Some(format!("jobs/{job_id}/ocr/document.v1.json")),
            translations_dir: Some(format!("jobs/{job_id}/translated")),
            ..JobArtifacts::default()
        },
    );
    job.status = JobStatusKind::Succeeded;
    seed_translation_result_files(state, &job);
    state.db.save_job(&job).expect("save job");
    job
}

#[tokio::test]
async fn stage_actions_and_resume_plan_match_published_schema() {
    let state = test_state("job-actions-contract-read");
    let contract = contract(ACTIONS);
    let job_id = "job-actions-contract-read";
    seed_renderable_job(&state, job_id);
    // 精修过：refine 那一项带 last_refine（键集合正好是契约的全部属性）。
    let artifacts = state.config.data_root.join(format!("jobs/{job_id}/artifacts"));
    fs::create_dir_all(&artifacts).unwrap();
    fs::write(
        artifacts.join("refine_report.v1.json"),
        json!({
            "status": "stopped",
            "generated_at": "2026-10-22T00:00:00Z",
            "mode": "editorial",
            "stopped_reason": "max_items",
            "review": {"candidate_item_count": 10, "reviewed_item_count": 4, "next_page": 3, "summary": {"finding_count": 2}},
            "fix_summary": {"applied": 1},
            "editorial": {"escalated": [{"item_id": "p002-b001", "page_number": 2, "reason": "max_rounds"}]},
        })
        .to_string(),
    )
    .unwrap();

    let actions = ok_data(&state, "GET", &format!("/api/v1/jobs/{job_id}/actions"), None).await;
    assert_exact(&actions, &contract, "StageActionsView", "actions");
    let stages = actions["stages"].as_array().expect("stages");
    let names: Vec<_> = stages.iter().map(|stage| stage["stage"].as_str().unwrap()).collect();
    assert_eq!(names, ["ocr", "translation", "render", "refine"], "{actions}");
    let mut with_action = 0;
    for (index, stage) in stages.iter().enumerate() {
        let path = format!("actions.stages[{index}]");
        assert_definition(stage, &contract, "StageRetryActionView", &path);
        if stage["stage"] == "refine" {
            assert_exact_object_keys(stage, &contract, "StageRetryActionView", &path);
            assert_exact(&stage["last_refine"], &contract, "LastRefineView", &format!("{path}.last_refine"));
            assert_exact_object_keys(
                &stage["last_refine"]["escalated"][0],
                &contract,
                "EscalatedItemView",
                &format!("{path}.last_refine.escalated[0]"),
            );
        } else {
            assert_eq!(object_keys(stage, &path), required_keys(&contract, "StageRetryActionView"), "{path}");
        }
        if stage["action"].is_null() {
            assert!(stage["disabled_code"].is_string(), "不能重试时有 disabled_code：{stage}");
            continue;
        }
        with_action += 1;
        assert_exact(&stage["action"], &contract, "StageRetryActionLinkView", &format!("{path}.action"));
        // action.body 能原样发给 retry-stage。
        let body = stage["action"]["body"].clone();
        assert_definition(&body, &contract, "RetryStageRequest", &format!("{path}.action.body"));
        serde_json::from_value::<RetryStageRequest>(body.clone())
            .unwrap_or_else(|error| panic!("{path}.action.body 不是合法的 RetryStageRequest：{error}；{body}"));
    }
    assert!(with_action >= 2, "至少翻译、渲染两项能重试：{actions}");

    let plan = ok_data(&state, "GET", &format!("/api/v1/jobs/{job_id}/actions/resume"), None).await;
    assert_exact(&plan, &contract, "JobResumePlanView", "resume plan");
    assert_eq!(plan["can_resume"], true, "{plan}");
    assert!(plan["reason_code"].is_null() && plan["reason"].is_null(), "{plan}");

    // 在跑的任务：不能续跑，reason_code 是 job_active。
    let mut running = source_job_with_artifacts("job-actions-contract-running", JobArtifacts::default());
    running.status = JobStatusKind::Running;
    state.db.save_job(&running).unwrap();
    let blocked = ok_data(&state, "GET", "/api/v1/jobs/job-actions-contract-running/actions/resume", None).await;
    assert_exact(&blocked, &contract, "JobResumePlanView", "resume plan (running)");
    assert_eq!(blocked["reason_code"], "job_active", "{blocked}");
    assert!(blocked["resume_workflow"].is_null() && blocked["from_stage"].is_null(), "{blocked}");
}

#[tokio::test]
async fn retry_resume_and_cancel_submissions_match_published_schema() {
    // 一个运行名额都不给：续跑以后原任务得一直排着队，下面才测得到「在排队时续跑、重试都 409」。
    // 以前给 1 个名额，原地重渲染的任务被拉起来、很快失败结束，重试就照常建了新任务（200），并发跑时偶发（2026-11-04）。
    let dirs = crate::test_support::config::TestDirs::create(&format!(
        "rust-api-query-routes-job-actions-contract-submit-{}",
        fastrand::u64(..)
    ));
    let state = crate::app::build_state(std::sync::Arc::new(crate::config::AppConfig {
        max_running_jobs: 0,
        ..dirs.config()
    }))
    .expect("build state");
    let contract = contract(ACTIONS);
    let job_id = "job-actions-contract-submit";
    seed_renderable_job(&state, job_id);
    let uri = |action: &str| format!("/api/v1/jobs/{job_id}/actions/{action}");

    // 重试渲染（新建任务），overrides 的四段都带上：契约写的段名都认。
    let retried = ok_data(
        &state,
        "POST",
        &uri("retry-stage"),
        Some(json!({
            "stage": "render",
            "mode": "from_stage",
            "ambiguous_request_policy": "block",
            "overrides": {"ocr": {}, "translation": {}, "render": {}, "runtime": {}},
        })),
    )
    .await;
    assert_exact(&retried, &contract, "RetryStageSubmissionView", "retry-stage");
    assert_exact(&retried["links"], &contract, "JobLinksView", "retry-stage.links");
    assert_exact(&retried["actions"], &contract, "JobActionsView", "retry-stage.actions");
    assert_ne!(retried["job_id"], job_id, "默认新建任务");
    assert_eq!(retried["source_job_id"], job_id);
    let sections: BTreeSet<String> =
        schema_keys(&contract, "RetryStageOverrides").into_iter().collect();
    assert_eq!(sections, BTreeSet::from(["ocr", "render", "runtime", "translation"].map(String::from)));
    let (status, payload) = send(
        &state,
        "POST",
        &uri("retry-stage"),
        Some(json!({"stage": "render", "overrides": {"glossary": {}}})),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "契约外的 overrides 段 400：{payload}");

    // 续跑（原地重渲染），请求体发 {}。
    let resumed = ok_data(&state, "POST", &uri("resume"), Some(json!({}))).await;
    assert_definition(&resumed, &contract, "JobSubmissionView", "resume");
    assert_object_keys_allowing_absent(&resumed, &contract, "JobSubmissionView", "resume", &["sibling_job_ids"]);
    assert_eq!(object_keys(&resumed, "resume"), required_keys(&contract, "JobSubmissionView"), "没拆任务时没有 sibling_job_ids");
    assert_eq!(resumed["job_id"], job_id, "能原地重渲染时续跑的就是原任务");
    assert_exact(&resumed["stages"], &contract, "JobStagesView", "resume.stages");
    assert_exact(&resumed["links"], &contract, "JobLinksView", "resume.links");
    assert_exact(&resumed["actions"], &contract, "JobActionsView", "resume.actions");

    // 在排队：续跑、重试都 409 job_active。
    let (status, payload) = send(&state, "POST", &uri("resume"), None).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_block_reason(&payload, &contract, "job_active");
    let (status, payload) = send(&state, "POST", &uri("retry-stage"), Some(json!({"stage": "render"}))).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_block_reason(&payload, &contract, "job_active");

    // 取消排队中的任务；再取消一次 409 job_not_active。
    let canceled = ok_data(&state, "POST", &uri("cancel"), Some(json!({}))).await;
    assert_definition(&canceled, &contract, "JobSubmissionView", "cancel");
    assert_eq!(object_keys(&canceled, "cancel"), required_keys(&contract, "JobSubmissionView"));
    assert_eq!(canceled["status"], "canceled");
    let (status, payload) = send(&state, "POST", &uri("cancel"), None).await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_block_reason(&payload, &contract, "job_not_active");
}

#[tokio::test]
async fn ocr_ambiguity_diagnostics_and_resolution_match_published_schemas() {
    let state = test_state("job-actions-contract-ocr");
    let actions = contract(ACTIONS);
    let reports = contract(REPORTS);
    let job_id = "job-actions-contract-ocr";
    let upload = seed_ocr_upload(&state, "upload-actions-contract-ocr");
    let mut job = source_job_with_artifacts(job_id, JobArtifacts::default());
    job.status = JobStatusKind::Failed;
    job.request_payload.source.upload_id = upload.upload_id;
    job.request_payload.ocr.provider = "mineru".to_string();
    job.request_payload.ocr.mineru_token = "mineru-test-token".to_string();
    state.db.save_job(&job).unwrap();
    seed_ambiguous_ocr_dispatch(&state, job_id, "mineru", "apply_upload_url");

    let failure = ok_data(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/failure"), None).await;
    assert_definition(&failure, &reports, "JobDiagnosticsView", "failure");
    assert_eq!(object_keys(&failure, "failure"), required_keys(&reports, "JobDiagnosticsView"), "没有渲染诊断、翻译请求日志时那两个键不出现");
    assert_eq!(failure["failure_code"], "ocr_request_ambiguous");
    let ambiguity = &failure["ocr_ambiguity"];
    assert_exact(ambiguity, &reports, "OcrAmbiguityView", "failure.ocr_ambiguity");
    for (index, field) in ambiguity["receipt_fields"].as_array().unwrap().iter().enumerate() {
        assert_exact(field, &reports, "OcrAmbiguityReceiptFieldView", &format!("receipt_fields[{index}]"));
    }

    let resolved = ok_data(
        &state,
        "POST",
        &format!("/api/v1/jobs/{job_id}/actions/resolve-ocr-ambiguity"),
        Some(json!({
            "resolution": "bind_existing_receipt",
            "resolution_revision": ambiguity["resolution_revision"],
            "batch_id": "batch-contract",
            "upload_url": "https://signed.example/upload",
            "trace_id": "trace-contract",
        })),
    )
    .await;
    assert_exact(&resolved, &actions, "OcrAmbiguityResolutionView", "resolve");
    assert_exact(&resolved["submission"], &actions, "RetryStageSubmissionView", "resolve.submission");
    assert_eq!(resolved["submission"]["source_job_id"], job_id);

    // 处理过了：同一个 revision 再交一次 409（stale_resolution 或 no_ocr_dispatch，都在契约的原因里）。
    let (status, payload) = send(
        &state,
        "POST",
        &format!("/api/v1/jobs/{job_id}/actions/resolve-ocr-ambiguity"),
        Some(json!({"resolution": "accept_duplicate_risk", "resolution_revision": ambiguity["resolution_revision"]})),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    let reason = payload["error"]["details"]["reason"].as_str().expect("reason");
    assert_block_reason(&payload, &actions, reason);
}

#[tokio::test]
async fn failure_report_with_every_optional_key_matches_published_schema() {
    let state = test_state("job-reports-contract-failure");
    let contract = contract(REPORTS);
    let job_id = "job-reports-contract-failure";
    let mut job = source_job_with_artifacts(
        job_id,
        JobArtifacts {
            job_root: Some(format!("jobs/{job_id}")),
            summary: Some(format!("jobs/{job_id}/artifacts/pipeline_summary.json")),
            ..JobArtifacts::default()
        },
    );
    job.status = JobStatusKind::Failed;
    job.error = Some("translation failed".to_string());
    seed_ambiguous_translation_request_journal(&state, &job);
    let summary = state.config.data_root.join(format!("jobs/{job_id}/artifacts/pipeline_summary.json"));
    fs::create_dir_all(summary.parent().unwrap()).unwrap();
    fs::write(&summary, json!({"render_diagnostics": {"engine": "typst", "pages": 2}}).to_string()).unwrap();
    state.db.save_job(&job).unwrap();

    let failure = ok_data(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/failure"), None).await;
    assert_exact(&failure, &contract, "JobDiagnosticsView", "failure");
    assert_exact(
        &failure["translation_request_recovery"],
        &contract,
        "TranslationRequestRecoveryView",
        "failure.translation_request_recovery",
    );
    assert_eq!(failure["render_diagnostics"]["engine"], "typst");
    assert!(failure["ocr_ambiguity"].is_null(), "{failure}");
}

#[tokio::test]
async fn quality_and_translation_reports_match_published_schema() {
    let state = test_state("job-reports-contract-quality");
    let contract = contract(REPORTS);
    let job_id = "job-reports-contract-quality";
    let mut job = source_job_with_artifacts(job_id, JobArtifacts::default());
    job.artifacts = None;
    let paths = build_job_paths(&state.config.output_root, job_id).unwrap();
    attach_job_paths(&mut job, &paths);
    job.status = JobStatusKind::Succeeded;
    state.db.save_job(&job).unwrap();

    // 还没有任何报告：各段 null、清单为空。
    let empty = ok_data(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/quality"), None).await;
    assert_exact(&empty, &contract, "QualitySummaryView", "quality (empty)");
    for key in ["preparation", "qa", "layout", "refine"] {
        assert!(empty[key].is_null(), "{key}: {empty}");
    }
    let (status, payload) = send(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/translation"), None).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "not_ready", "{payload}");

    let artifacts = &paths.artifacts_dir;
    let translated = paths.root.join("translated");
    fs::create_dir_all(&translated).unwrap();
    fs::write(
        artifacts.join("fit_report.v1.json"),
        json!({
            "summary": {"blocks": 3, "shrunk_blocks": 2, "overflow_blocks": 1, "min_scale": 0.6, "min_final_font_size": 7.5, "math_formulas": 4, "math_failed": 1},
            "blocks": [
                {"item_id": "p001-b002", "page": 1, "measured": true, "scale": 0.9, "final_font_size": 9.0, "overflow": true, "overflow_pt": 3.5},
                {"item_id": "p002-b001", "page": 2, "measured": true, "scale": 0.6, "overflow": false},
            ],
        })
        .to_string(),
    )
    .unwrap();
    fs::write(
        artifacts.join("translation_qa.v1.json"),
        json!({
            "generated_at": "2026-10-22T00:00:00Z",
            "summary": {"item_count": 5, "checked_item_count": 5, "violation_count": 1,
                "by_severity": {"critical": 0, "major": 1, "minor": 0}, "by_check": {"numbers": 1}, "by_type": {"number_mismatch": 1}},
            "violations": [{"id": "qa-00001", "check": "numbers", "type": "number_mismatch", "severity": "major", "message": "数字对不上",
                "location": {"item_id": "p001-b002", "page_number": 1}}],
        })
        .to_string(),
    )
    .unwrap();
    fs::write(
        artifacts.join("refine_report.v1.json"),
        json!({
            "mode": "editorial", "status": "completed", "stopped_reason": null, "generated_at": "2026-10-22T00:00:00Z",
            "qa_before": {"violation_count": 2, "by_severity": {"major": 2}},
            "qa_after": {"violation_count": 1, "by_severity": {"major": 1}},
            "fix_summary": {"applied": 1, "rejected": 1, "skipped": 0, "reject_reasons": {"crosses_protected_token": 1}, "skip_reasons": {}},
            "editorial": {"escalated": [{"item_id": "p002-b001", "page_number": 2, "reason": "max_rounds",
                "categories": ["terminology"], "attempts": ["patch:rejected/crosses_protected_token"]}]},
        })
        .to_string(),
    )
    .unwrap();
    fs::write(
        translated.join("term-base.v1.json"),
        json!({"preparation_mode": "full", "complete": false,
            "summary": {"term_count": 12, "locked_count": 3, "conflict_count": 1},
            "extraction": {"batch_count": 2, "failed_batch_ids": ["batch-2"]}})
        .to_string(),
    )
    .unwrap();
    fs::write(translated.join("style-guide.v1.json"), json!({"complete": true, "llm_status": "ok", "rules": [{}, {}]}).to_string()).unwrap();
    fs::write(
        translated.join("page-001-deepseek.json"),
        json!([
            {"item_id": "p001-b003", "page_idx": 0, "final_status": "failed", "skip_reason": ""},
            {"item_id": "p001-b004", "page_idx": 0, "final_status": "kept_origin", "skip_reason": "skip_formula"},
            {"item_id": "p001-b005", "page_idx": 0, "final_status": "translated"},
        ])
        .to_string(),
    )
    .unwrap();
    fs::write(
        artifacts.join("translation_diagnostics.json"),
        json!({"schema": "translation_diagnostics_v1", "counts": {"translated": 1}}).to_string(),
    )
    .unwrap();

    let summary = ok_data(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/quality"), None).await;
    assert_exact(&summary, &contract, "QualitySummaryView", "quality");
    for (key, name) in [
        ("preparation", "PreparationStatus"),
        ("qa", "QaSummary"),
        ("layout", "LayoutSummary"),
        ("refine", "RefineSummary"),
        ("untranslated", "UntranslatedSummary"),
    ] {
        assert_exact(&summary[key], &contract, name, &format!("quality.{key}"));
    }
    assert_exact(&summary["preparation"]["term_base"], &contract, "TermBaseStatus", "quality.preparation.term_base");
    assert_exact(&summary["preparation"]["style_guide"], &contract, "StyleGuideStatus", "quality.preparation.style_guide");
    assert_exact(&summary["refine"]["qa_before"], &contract, "QaSnapshot", "quality.refine.qa_before");
    assert_eq!(summary["preparation"]["problems"], json!(["term_base_incomplete"]));
    assert_eq!(summary["untranslated"]["failed"], 1);

    // 清单：前四个键总在，其余按 kind 出现。
    let base = required_keys(&contract, "QualityItem");
    let declared = schema_keys(&contract, "QualityItem");
    for (kind, extra) in [
        ("layout", &["scale", "final_font_size", "overflow_pt"][..]),
        ("untranslated", &["skip_reason"][..]),
        ("qa", &["id", "check", "type", "severity", "message"][..]),
        ("escalated", &["categories", "attempts"][..]),
    ] {
        let view = ok_data(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/quality/items?kind={kind}"), None).await;
        assert_exact(&view, &contract, "QualityItemsView", &format!("items ({kind})"));
        let items = view["items"].as_array().unwrap();
        assert!(!items.is_empty(), "{kind}: {view}");
        let mut expected = base.clone();
        expected.extend(extra.iter().map(|key| key.to_string()));
        assert!(expected.is_subset(&declared), "{kind} 的键 {expected:?} 契约里没写全");
        for (index, item) in items.iter().enumerate() {
            let path = format!("items ({kind})[{index}]");
            assert_definition(item, &contract, "QualityItem", &path);
            assert_eq!(object_keys(item, &path), expected, "{path}");
        }
    }
    let (status, payload) =
        send(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/quality/items?kind=qa&bogus=1"), None).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");

    let diagnostics = ok_data(&state, "GET", &format!("/api/v1/jobs/{job_id}/reports/translation"), None).await;
    assert_exact(&diagnostics, &contract, "TranslationDiagnosticsView", "translation");
    assert_eq!(diagnostics["summary"]["counts"]["translated"], 1);
}

/// serde 报错里反引号括着的字段名（"unknown field `x`, expected one of `a`, `b`"）。
fn backticked(message: &str, probe: &str) -> BTreeSet<String> {
    message.split('`').skip(1).step_by(2).filter(|name| *name != probe).map(str::to_string).collect()
}

#[tokio::test]
async fn request_bodies_and_queries_accept_exactly_the_contract_fields() {
    let actions = contract(ACTIONS);
    let reports = contract(REPORTS);
    assert_request_fields_match::<RetryStageRequest>(&actions, "RetryStageRequest");
    assert_request_fields_match::<RefineRetryRequest>(&actions, "RefineRetryRequest");
    assert_request_fields_match::<OcrAmbiguityResolutionRequest>(&actions, "OcrAmbiguityResolutionRequest");
    assert_request_fields_match::<QualityItemsParams>(&reports, "QualityItemsQuery");

    // 续跑的请求体（路由私有的 RerunRequest）：先解析请求体再找任务，所以对不存在的任务发也能看到 400。
    let state = test_state("job-actions-contract-requests");
    let uri = "/api/v1/jobs/job-missing/actions/resume";
    const PROBE: &str = "__contract_probe__";
    let probe = Value::Object(serde_json::Map::from_iter([(PROBE.to_string(), json!(0))]));
    let (status, payload) = send(&state, "POST", uri, Some(probe)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
    let message = payload["message"].as_str().unwrap_or_default();
    assert_eq!(backticked(message, PROBE), schema_keys(&actions, "ResumeJobInput"), "续跑请求体的字段：{message}");
    let (status, payload) = send(&state, "POST", uri, Some(json!({"overrides": {"render": {}}}))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "translation 以外的段 400：{payload}");
    assert_eq!(schema_keys(&actions, "ResumeOverrides"), BTreeSet::from(["translation".to_string()]));
    let (status, payload) = send(&state, "POST", uri, Some(json!({"overrides": {"translation": {"model": "x"}}}))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
    let message = payload["message"].as_str().unwrap_or_default();
    let allowed = message
        .split_once('{')
        .and_then(|(_, rest)| rest.split_once('}'))
        .map(|(inside, _)| inside.split(',').map(str::to_string).collect::<BTreeSet<_>>())
        .unwrap_or_else(|| panic!("报错里没列出允许的字段：{message}"));
    assert_eq!(allowed, schema_keys(&actions, "ResumeTranslationOverrides"), "{message}");
    for body in [None, Some(json!({})), Some(json!({"overrides": null})), Some(json!({"overrides": {"translation": {"credential_ref": "cred-x"}}}))] {
        let (status, payload) = send(&state, "POST", uri, body.clone()).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "契约允许的请求体 {body:?} 过了解析、找不到任务：{payload}");
    }

    // 端点清单里的 input / query 都有定义且是封闭的，output 都有定义。
    for contract in [&actions, &reports] {
        for endpoint in contract["endpoints"].as_array().expect("endpoints") {
            assert!(endpoint["output"].is_string(), "{endpoint}");
            for role in ["input", "query", "output"] {
                let Some(name) = endpoint.get(role).and_then(Value::as_str) else { continue };
                let schema = definition(contract, name);
                if role != "output" {
                    assert_eq!(schema["additionalProperties"], false, "{name}（{role}）要写 additionalProperties: false");
                }
            }
        }
    }
}
