//! 单块译文修订写回:PATCH translation/items/:item_id 与 GET .../revisions。
//!
//! 写回走真实的 `retainpdf-pipeline translation-revise`(校验必须是翻译时同一套
//! Python 代码,mock 掉就什么也没测)。渲染不真跑:只断言重渲染任务被原地提交,
//! 再用渲染侧的读取函数(按 checkpoint page_hash 校验)确认写回后的产物读得出来。

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{minimal_pdf_bytes, read_json, test_state};
use crate::app::{build_app, build_state};
use crate::config::AppConfig;
use crate::db::documents::sha256_hex;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind, WorkflowKind};
use crate::test_support::python::project_venv_bin;

pub(super) const ITEM_ID: &str = "p001-b001";
pub(super) const ORIGINAL_TEXT: &str = "谐振子是分子振动的模型体系。";
pub(super) const REVISED_TEXT: &str = "谐振子是描述分子振动的模型体系。";

pub(super) fn pipeline_source_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../pipeline")
}

/// 修订写回的代码在翻译包里(`retainpdf_translation`),同样要钉到这棵源码树,
/// 否则 worktree 里测的是主检出的旧代码。
pub(super) fn python_path() -> String {
    format!(
        "{}:{}",
        pipeline_source_root().display(),
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../translation").display()
    )
}

/// 指向本 crate 同一棵源码树的 `retainpdf-pipeline`。共享 venv 是 editable 安装,
/// 在 worktree 里会解析到主检出的代码;用 PYTHONPATH 钉住,测的才是这次改动。
fn pipeline_wrapper(root: &Path) -> String {
    let wrapper = root.join("retainpdf-pipeline-under-test");
    fs::write(
        &wrapper,
        format!(
            "#!/bin/sh\nPYTHONPATH='{}' exec '{}' -m retainpdf_pipeline.entrypoints.console \"$@\"\n",
            python_path(),
            project_venv_bin("python").display(),
        ),
    )
    .expect("write pipeline wrapper");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&wrapper, fs::Permissions::from_mode(0o755)).expect("chmod wrapper");
    }
    wrapper.to_string_lossy().into_owned()
}

pub(super) fn state_with_pipeline(name: &str) -> crate::AppState {
    let base = test_state(name);
    let command = pipeline_wrapper(&base.config.data_root);
    state_with_pipeline_command(base, command)
}

/// 用指定的 `pipeline_command` 重建状态(测试要换成会拖慢、会卡住的假子命令)。
pub(super) fn state_with_pipeline_command(base: crate::AppState, command: String) -> crate::AppState {
    let config = AppConfig {
        pipeline_command: command,
        ..(*base.config).clone()
    };
    build_state(Arc::new(config)).expect("build state")
}

fn text_item(item_id: &str, order: i64, source: &str, translated: &str) -> Value {
    json!({
        "item_id": item_id,
        "page_idx": 0,
        "block_idx": order,
        "reading_order": order,
        "bbox": [72, 100 + order * 40, 520, 130 + order * 40],
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": true,
        "asset_id": "",
        "raw_block_type": "text",
        "normalized_sub_type": "",
        "math_mode": "direct_typst",
        "formula_map": [],
        "protected_map": [],
        "source_text": source,
        "protected_source_text": source,
        "should_translate": true,
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": source,
        "translation_unit_protected_translated_text": translated,
        "translation_unit_translated_text": translated,
        "protected_translated_text": translated,
        "translated_text": translated,
        "final_status": "translated",
        "translation_diagnostics": {"final_status": "translated"}
    })
}

/// 一个已提交翻译的任务:页文件、manifest、checkpoint(page_hash 与页文件一致)。
pub(super) fn seed_committed_job(state: &crate::AppState, job_id: &str, status: JobStatusKind) -> PathBuf {
    let job_root = state.config.output_root.join(job_id);
    let translated = job_root.join("translated");
    fs::create_dir_all(&translated).expect("translated dir");
    fs::create_dir_all(job_root.join("source")).expect("source dir");
    fs::write(job_root.join("source/input.pdf"), minimal_pdf_bytes(595, 842)).expect("source pdf");
    let page = serde_json::to_vec_pretty(&json!([
        text_item(
            ITEM_ID,
            1,
            "The harmonic oscillator is a model system for molecular vibrations.",
            ORIGINAL_TEXT,
        ),
        text_item(
            "p001-b002",
            2,
            "Its energy levels are equally spaced.",
            "它的能级是等间距的。",
        ),
    ]))
    .expect("page json");
    fs::write(translated.join("page-001-deepseek.json"), &page).expect("page file");
    fs::write(
        translated.join("translation-manifest.json"),
        serde_json::to_vec_pretty(&json!({
            "schema": "translation_manifest_v1",
            "schema_version": 1,
            "status": "complete",
            "pages": [{"page_index": 0, "page_number": 1, "path": "page-001-deepseek.json"}]
        }))
        .expect("manifest json"),
    )
    .expect("manifest file");
    fs::write(
        translated.join("translation-checkpoint.v1.json"),
        serde_json::to_vec_pretty(&json!({
            "schema": "translation_checkpoint_v1",
            "schema_version": 1,
            "status": "complete",
            "phase": "committed",
            "attempt_id": job_id,
            "generation": 7,
            "normalized_document_sha256": "b".repeat(64),
            "parameters_sha256": "a".repeat(64),
            "fingerprint": "c".repeat(64),
            "pages": [{
                "page_index": 0,
                "path": "page-001-deepseek.json",
                "item_count": 2,
                "completed_item_count": 2,
                "pending_item_ids": [],
                "page_hash": sha256_hex(&page)
            }],
            "progress": {
                "item_count": 2, "completed_item_count": 2, "pending_item_count": 0,
                "blocking_item_count": 0, "translated_item_count": 2
            },
            "committed_pages": [],
            "final_manifest": "translation-manifest.json"
        }))
        .expect("checkpoint json"),
    )
    .expect("checkpoint file");

    let mut input = CreateJobInput::default();
    input.runtime.job_id = job_id.to_string();
    let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()]);
    job.status = status;
    job.artifacts = Some(JobArtifacts {
        job_root: Some(format!("jobs/{job_id}")),
        translations_dir: Some(format!("jobs/{job_id}/translated")),
        source_pdf: Some(format!("jobs/{job_id}/source/input.pdf")),
        output_pdf: Some(format!("jobs/{job_id}/rendered/old.pdf")),
        ..JobArtifacts::default()
    });
    state.db.save_job(&job).expect("save job");
    translated
}

pub(super) async fn patch_item(
    state: &crate::AppState,
    job_id: &str,
    item_id: &str,
    body: Value,
) -> (StatusCode, Value) {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/api/v1/jobs/{job_id}/translations/{item_id}"))
                .header("X-API-Key", "test-key")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("patch request"),
        )
        .await
        .expect("patch response");
    let status = response.status();
    (status, read_json(response).await)
}

async fn get_revisions(
    state: &crate::AppState,
    job_id: &str,
    item_id: &str,
) -> (StatusCode, Value) {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{job_id}/translations/{item_id}/revisions"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("revisions request"),
        )
        .await
        .expect("revisions response");
    let status = response.status();
    (status, read_json(response).await)
}

pub(super) fn checkpoint(translated: &Path) -> Value {
    let bytes = fs::read(translated.join("translation-checkpoint.v1.json")).expect("read checkpoint");
    serde_json::from_slice(&bytes)
        .expect("parse checkpoint")
}

pub(super) fn contract() -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../contracts/translation-revisions.v1.schema.json");
    serde_json::from_str(&fs::read_to_string(path).expect("read revisions contract"))
        .expect("parse revisions contract")
}

pub(super) fn assert_keys_match(value: &Value, contract: &Value, definition: &str) {
    let schema = &contract["definitions"][definition];
    let declared: std::collections::BTreeSet<String> = schema["properties"]
        .as_object()
        .unwrap_or_else(|| panic!("contract definition missing: {definition}"))
        .keys()
        .cloned()
        .collect();
    let actual: std::collections::BTreeSet<String> =
        value.as_object().expect("object").keys().cloned().collect();
    assert_eq!(actual, declared, "{definition} keys drifted from contract");
    for required in schema["required"].as_array().into_iter().flatten() {
        assert!(value.get(required.as_str().unwrap()).is_some(), "{definition} missing {required}");
    }
}

/// 渲染侧读取译文用的是 render/translation_loader.py:按 checkpoint 的 page_hash
/// 校验每一页,对不上直接拒读。这里跑的就是它。
pub(super) fn render_loader_text(translated: &Path, item_id: &str) -> String {
    let output = Command::new(project_venv_bin("python"))
        .env("PYTHONPATH", pipeline_source_root())
        .arg("-c")
        .arg(
            "import sys\n\
             from pathlib import Path\n\
             from retainpdf_pipeline.render.translation_loader import load_translated_pages\n\
             pages = load_translated_pages(Path(sys.argv[1]))\n\
             items = [i for page in pages.values() for i in page]\n\
             print(next(i['translated_text'] for i in items if i['item_id'] == sys.argv[2]))",
        )
        .arg(translated)
        .arg(item_id)
        .output()
        .expect("run render loader");
    assert!(
        output.status.success(),
        "render loader failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).expect("utf8").trim().to_string()
}

#[tokio::test]
async fn revision_writes_back_and_keeps_page_hash_and_checkpoint_consistent() {
    let state = state_with_pipeline("translation-revision-commit");
    let translated = seed_committed_job(&state, "job-revision-commit", JobStatusKind::Succeeded);

    let (status, payload) = patch_item(
        &state,
        "job-revision-commit",
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user", "reason": "措辞"}),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{payload}");
    let data = &payload["data"];
    assert_eq!(data["changed"], true);
    assert_eq!(data["generation"], 8);
    assert_eq!(data["item"]["translated_text"], REVISED_TEXT);
    assert!(data["rerender"].is_null());
    let contract = contract();
    assert_keys_match(data, &contract, "TranslationRevisionView");
    assert_keys_match(&data["revision"], &contract, "TranslationRevisionRecord");
    // 这个任务没有持久的 pipeline 记录,实时译文本来就读不到它。
    assert_eq!(data["live_publication"]["status"], "unavailable");
    assert_eq!(data["live_publication"]["pages"][0]["status"], "no_durable_attempt");

    let page_bytes = fs::read(translated.join("page-001-deepseek.json")).expect("page");
    let page_hash = sha256_hex(&page_bytes);
    let checkpoint = checkpoint(&translated);
    assert_eq!(checkpoint["generation"], 8);
    assert_eq!(checkpoint["status"], "complete");
    assert_eq!(checkpoint["phase"], "committed");
    assert_eq!(checkpoint["pages"][0]["page_hash"], page_hash);
    assert_eq!(data["page_hashes"]["page-001-deepseek.json"], page_hash);
    let snapshot_path = checkpoint["pages"][0]["snapshot_path"].as_str().expect("snapshot path");
    let snapshot = translated.join(snapshot_path);
    assert_eq!(sha256_hex(&fs::read(snapshot).expect("snapshot")), page_hash);

    let journal = fs::read_to_string(translated.join("revisions.v1.jsonl")).expect("revisions");
    let lines: Vec<Value> = journal
        .lines()
        .map(|line| serde_json::from_str(line).expect("revision line"))
        .collect();
    assert_eq!(lines.len(), 1);
    assert_eq!(lines[0], data["revision"]);
    assert_eq!(lines[0]["previous_text"], ORIGINAL_TEXT);
    assert_eq!(lines[0]["new_text"], REVISED_TEXT);
    assert_eq!(lines[0]["source"], "user");
    assert_eq!(lines[0]["generation"], 8);
}

#[tokio::test]
async fn revision_rejected_by_validation_is_422_and_writes_nothing() {
    let state = state_with_pipeline("translation-revision-422");
    let translated = seed_committed_job(&state, "job-revision-422", JobStatusKind::Succeeded);
    let before = fs::read(translated.join("page-001-deepseek.json")).expect("page");

    let (status, payload) = patch_item(
        &state,
        "job-revision-422",
        ITEM_ID,
        json!({"translated_text": "谐振子 $x^2 是模型体系。", "source": "agent"}),
    )
    .await;

    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{payload}");
    assert_eq!(payload["error"]["code"], "TRANSLATION_REVISION_REJECTED");
    let details = &payload["error"]["details"];
    assert_eq!(details["reason"], "validation_failed");
    assert_eq!(details["validation"]["passed"], false);
    assert_eq!(details["validation"]["issues"][0]["kind"], "math_delimiter_unbalanced");
    assert_eq!(fs::read(translated.join("page-001-deepseek.json")).expect("page"), before);
    assert_eq!(checkpoint(&translated)["generation"], 7);
    assert!(!translated.join("revisions.v1.jsonl").exists());
}

#[tokio::test]
async fn revision_is_refused_with_409_while_the_job_runs() {
    let state = state_with_pipeline("translation-revision-409");
    let translated = seed_committed_job(&state, "job-revision-409", JobStatusKind::Running);

    let (status, payload) = patch_item(
        &state,
        "job-revision-409",
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user"}),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["code"], "TRANSLATION_REVISION_CONFLICT");
    assert_eq!(payload["error"]["details"]["reason"], "job_running");
    assert_eq!(checkpoint(&translated)["generation"], 7);
}

#[tokio::test]
async fn stale_expected_generation_is_409_with_current_generation() {
    let state = state_with_pipeline("translation-revision-stale");
    seed_committed_job(&state, "job-revision-stale", JobStatusKind::Succeeded);

    let (status, payload) = patch_item(
        &state,
        "job-revision-stale",
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user", "expected_generation": 3}),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT, "{payload}");
    assert_eq!(payload["error"]["details"]["reason"], "generation_mismatch");
    assert_eq!(payload["error"]["details"]["current_generation"], 7);
}

#[tokio::test]
async fn revision_request_shape_is_strict() {
    let state = state_with_pipeline("translation-revision-400");
    seed_committed_job(&state, "job-revision-400", JobStatusKind::Succeeded);

    for body in [
        json!({"translated_text": REVISED_TEXT, "source": "robot"}),
        json!({"translated_text": REVISED_TEXT}),
    ] {
        // 字段值或缺字段不合 schema 走 ApiJson 的统一 400(BAD_REQUEST + reason schema_mismatch,
        // 2026-11-24 以前是 422),和校验不过的 422 TRANSLATION_REVISION_REJECTED 靠状态码和 error.code 都能区分。
        let (status, payload) = patch_item(&state, "job-revision-400", ITEM_ID, body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
        assert_eq!(payload["error"]["code"], "BAD_REQUEST");
        assert_eq!(payload["error"]["details"]["reason"], "schema_mismatch");
    }
    // 不认识的字段是请求写错了：400，message 带字段名。
    let (status, payload) = patch_item(
        &state,
        "job-revision-400",
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user", "unknown": 1}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
    assert!(payload["message"].as_str().unwrap_or_default().contains("unknown field `unknown`"), "{payload}");
    let (status, payload) = patch_item(
        &state,
        "job-revision-400",
        ITEM_ID,
        json!({"translated_text": "长".repeat(20_001), "source": "user"}),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{payload}");
    let (status, _) = patch_item(
        &state,
        "job-revision-400",
        "p009-b009",
        json!({"translated_text": REVISED_TEXT, "source": "user"}),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn revision_history_lists_only_this_items_revisions_in_order() {
    let state = state_with_pipeline("translation-revision-history");
    seed_committed_job(&state, "job-revision-history", JobStatusKind::Succeeded);

    let (status, payload) = get_revisions(&state, "job-revision-history", ITEM_ID).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["total"], 0);

    for (item_id, text, source) in [
        (ITEM_ID, REVISED_TEXT, "user"),
        ("p001-b002", "它的能级彼此等距。", "agent"),
        (ITEM_ID, "谐振子是分子振动的经典模型。", "refine"),
    ] {
        let (status, payload) = patch_item(
            &state,
            "job-revision-history",
            item_id,
            json!({"translated_text": text, "source": source}),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "{payload}");
    }

    let (status, payload) = get_revisions(&state, "job-revision-history", ITEM_ID).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let data = &payload["data"];
    assert_keys_match(data, &contract(), "TranslationRevisionHistoryView");
    assert_eq!(data["total"], 2);
    let revisions = data["revisions"].as_array().expect("revisions");
    assert_eq!(
        revisions.iter().map(|r| r["source"].clone()).collect::<Vec<_>>(),
        vec![json!("user"), json!("refine")]
    );
    assert_eq!(revisions[1]["previous_text"], REVISED_TEXT);
    assert_eq!(revisions[0]["generation"], 8);
    assert_eq!(revisions[1]["generation"], 10);

    let (status, _) = get_revisions(&state, "job-revision-history", "p009-b009").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn rerender_reuses_in_place_render_retry_and_render_reads_the_revision() {
    let state = state_with_pipeline("translation-revision-rerender");
    let translated = seed_committed_job(&state, "job-revision-rerender", JobStatusKind::Succeeded);
    let prewarm = state
        .config
        .output_root
        .join("job-revision-rerender/artifacts/render_prewarm/render_source_prewarm_manifest.json");
    fs::create_dir_all(prewarm.parent().expect("prewarm dir")).expect("prewarm dir");
    fs::write(&prewarm, b"{}").expect("prewarm manifest");

    let (status, payload) = patch_item(
        &state,
        "job-revision-rerender",
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user", "rerender": true}),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{payload}");
    let rerender = &payload["data"]["rerender"];
    assert!(payload["data"]["rerender_error"].is_null(), "{payload}");
    assert_eq!(rerender["job_id"], "job-revision-rerender");
    assert_eq!(rerender["workflow"], "render");
    let job = state.db.get_job("job-revision-rerender").expect("job");
    assert_eq!(job.workflow, WorkflowKind::Render);
    assert!(job.artifacts.as_ref().expect("artifacts").output_pdf.is_none());
    // 原地重渲染不能清背景清理缓存。
    assert!(prewarm.exists());
    // 渲染按 checkpoint page_hash 读页文件,读到的是修订后的译文。
    assert_eq!(render_loader_text(&translated, ITEM_ID), REVISED_TEXT);
}

async fn get_list(state: &crate::AppState, job_id: &str, query: &str) -> Value {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{job_id}/translations{query}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("list request"),
        )
        .await
        .expect("list response");
    assert_eq!(response.status(), StatusCode::OK);
    read_json(response).await
}

/// 列表不能停在翻译结束时写的索引上:PATCH 之后 `translated_preview` 和 `?q=` 都要是新译文。
#[tokio::test]
async fn translation_list_reflects_a_revision_even_when_a_stale_index_file_exists() {
    let state = state_with_pipeline("translation-revision-list");
    let job_id = "job-revision-list";
    seed_committed_job(&state, job_id, JobStatusKind::Succeeded);
    // 翻译阶段结束时写的索引:修订不会更新它。
    let artifacts = state.config.output_root.join(job_id).join("artifacts");
    fs::create_dir_all(&artifacts).expect("artifacts dir");
    fs::write(
        artifacts.join("translation_debug_index.json"),
        serde_json::to_vec(&json!({
            "schema": "translation_debug_index_v1",
            "schema_version": 1,
            "items": [
                {"item_id": ITEM_ID, "page_idx": 0, "block_idx": 1, "final_status": "translated",
                 "translated_preview": ORIGINAL_TEXT},
                {"item_id": "p001-b002", "page_idx": 0, "block_idx": 2, "final_status": "translated",
                 "translated_preview": "它的能级是等间距的。"}
            ]
        }))
        .expect("index json"),
    )
    .expect("write index");

    let before = get_list(&state, job_id, "").await;
    assert_eq!(before["data"]["items"][0]["translated_preview"], ORIGINAL_TEXT);

    let (status, payload) = patch_item(
        &state,
        job_id,
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user", "reason": "措辞"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");

    let after = get_list(&state, job_id, "").await;
    assert_eq!(after["data"]["total"], 2);
    assert_eq!(after["data"]["items"][0]["item_id"], ITEM_ID);
    assert_eq!(after["data"]["items"][0]["translated_preview"], REVISED_TEXT);
    assert_eq!(after["data"]["items"][1]["translated_preview"], "它的能级是等间距的。");
    let found = get_list(&state, job_id, "?q=%E6%8F%8F%E8%BF%B0").await; // “描述”,只在新译文里
    assert_eq!(found["data"]["total"], 1);
    let stale = get_list(&state, job_id, "?q=%E6%98%AF%E5%88%86%E5%AD%90").await; // “是分子”,只在旧译文里
    assert_eq!(stale["data"]["total"], 0);
}

async fn get_item(state: &crate::AppState, job_id: &str, item_id: &str) -> (StatusCode, Value) {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/jobs/{job_id}/translations/{item_id}"))
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("item request"),
        )
        .await
        .expect("item response");
    let status = response.status();
    (status, read_json(response).await)
}

/// 阅读页的四位块号（`p001-b0001`，reader_item_id 同一规则）也能取、改、查修订（2026-11-19）；
/// 返回的 item_id 是条目里实际存的写法，修订日志也记这个写法。
#[tokio::test]
async fn reader_block_ids_reach_the_stored_translation_item() {
    let state = state_with_pipeline("translation-revision-reader-id");
    let translated = seed_committed_job(&state, "job-revision-reader-id", JobStatusKind::Succeeded);

    for alias in ["p001-b0001", "p001-b1", ITEM_ID] {
        let (status, payload) = get_item(&state, "job-revision-reader-id", alias).await;
        assert_eq!(status, StatusCode::OK, "{alias}: {payload}");
        assert_eq!(payload["data"]["item_id"], ITEM_ID, "{alias}");
    }

    let (status, payload) = patch_item(
        &state,
        "job-revision-reader-id",
        "p001-b0001",
        json!({"translated_text": REVISED_TEXT, "source": "user", "reason": "措辞"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["item_id"], ITEM_ID);
    assert_eq!(payload["data"]["changed"], true);
    assert_eq!(render_loader_text(&translated, ITEM_ID), REVISED_TEXT);
    let journal = fs::read_to_string(translated.join("revisions.v1.jsonl")).expect("revisions");
    assert!(journal.contains(&format!("\"item_id\": \"{ITEM_ID}\"")) || journal.contains(&format!("\"item_id\":\"{ITEM_ID}\"")), "{journal}");

    let (status, payload) = get_revisions(&state, "job-revision-reader-id", "p001-b0001").await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["item_id"], ITEM_ID);
    assert_eq!(payload["data"]["total"], 1);

    for missing in ["p001-b0009", "p009-b0001"] {
        let (status, _) = get_item(&state, "job-revision-reader-id", missing).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{missing}");
        let (status, _) = patch_item(
            &state,
            "job-revision-reader-id",
            missing,
            json!({"translated_text": REVISED_TEXT, "source": "user"}),
        )
        .await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{missing}");
    }
}
