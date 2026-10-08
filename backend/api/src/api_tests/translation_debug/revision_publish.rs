//! 修订登记进实时译文读模型:PATCH 写回后,实时译文的页快照、提交事件流看到新
//! 文本和新 page_hash;失败、取消的任务同样如此;登记失败时写回不回滚,之后重发
//! 同一请求或打开实时译文时自愈。
//!
//! 写回走真实的 `retainpdf-pipeline translation-revise`(同一棵源码树,见
//! revisions.rs 的 wrapper)。

use std::fs;
use std::path::{Path, PathBuf};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use rusqlite::Connection;
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::read_json;
use crate::app::{build_app, build_jobs_facade_from_state};
use crate::db::documents::sha256_hex;
use crate::db::PipelineUnitCommit;
use crate::models::JobStatusKind;

use super::revisions::{
    assert_keys_match, checkpoint, contract, patch_item, render_loader_text, seed_committed_job,
    state_with_pipeline, ITEM_ID, ORIGINAL_TEXT, REVISED_TEXT,
};

const SECOND_ITEM_ID: &str = "p001-b002";
const SECOND_REVISED_TEXT: &str = "它的能级彼此等距。";
const PAGE_FILE: &str = "page-001-deepseek.json";

/// 实时译文对外的块 id 是规范化过的(块号补到四位)。
fn live_id(item_id: &str) -> String {
    let (page, block) = item_id.split_once("-b").expect("item id");
    format!("{page}-b{:04}", block.parse::<u32>().expect("block number"))
}

/// 在 `seed_committed_job` 的文件之上补齐实时译文需要的持久状态:generation-7 快照、
/// 版面,以及一次以 `status` 收尾的 translate attempt(page:0 登记的是原始 page_hash)。
fn seed_live_job(state: &crate::AppState, job_id: &str, status: JobStatusKind) -> PathBuf {
    let translated = seed_committed_job(state, job_id, JobStatusKind::Running);
    let page = fs::read(translated.join(PAGE_FILE)).expect("page");
    let snapshot_dir = translated.join(".translation-checkpoints/generation-7");
    fs::create_dir_all(&snapshot_dir).expect("snapshot dir");
    fs::write(snapshot_dir.join(PAGE_FILE), &page).expect("snapshot");

    let job_root = translated.parent().expect("job root");
    let normalized = job_root.join("ocr/normalized/document.v1.json");
    fs::create_dir_all(normalized.parent().expect("normalized dir")).expect("normalized dir");
    fs::write(
        &normalized,
        serde_json::to_vec(&json!({
            "pages": [{
                "page_index": 0,
                "width": 595.0,
                "height": 842.0,
                "blocks": [
                    {"block_id": ITEM_ID, "bbox": [72, 140, 520, 170], "text": "The harmonic oscillator."},
                    {"block_id": SECOND_ITEM_ID, "bbox": [72, 180, 520, 210], "text": "Its energy levels."}
                ]
            }]
        }))
        .expect("normalized json"),
    )
    .expect("normalized document");

    let cursor = state
        .db
        .acquire_pipeline_attempt(job_id, "worker-a", "translate", 1)
        .expect("claim attempt");
    let committed = state
        .db
        .commit_pipeline_units(
            &cursor,
            &[PipelineUnitCommit {
                unit_key: "page:0".to_string(),
                unit_order: 0,
                page_index: Some(0),
                page_hash: sha256_hex(&page),
                producer_generation: Some(7),
                payload: json!({"changed_item_ids": [ITEM_ID, SECOND_ITEM_ID]}),
            }],
        )
        .expect("commit page");
    state
        .db
        .complete_pipeline_stage(&crate::db::PipelineAttemptCursor {
            generation: committed.generation,
            ..cursor
        })
        .expect("complete stage");
    let terminal = match status {
        JobStatusKind::Succeeded => "succeeded",
        JobStatusKind::Canceled => "canceled",
        _ => "failed",
    };
    assert!(state
        .db
        .finish_latest_pipeline_attempt(job_id, terminal)
        .expect("finish attempt"));

    let mut job = state.db.get_job(job_id).expect("job");
    job.status = status;
    job.artifacts.as_mut().expect("artifacts").normalized_document_json =
        Some(format!("jobs/{job_id}/ocr/normalized/document.v1.json"));
    state.db.save_job(&job).expect("save job");
    translated
}

async fn get(state: &crate::AppState, uri: String) -> (StatusCode, Value) {
    let response = build_app(state.clone())
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

/// 实时译文页快照:(attempt, generation, page_hash, item_id -> 文本)。
async fn live_page(state: &crate::AppState, job_id: &str) -> Value {
    let (status, payload) = get(state, format!("/api/v1/jobs/{job_id}/live-translation/pages/0")).await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    payload["data"].clone()
}

fn live_text(page: &Value, item_id: &str) -> String {
    page["items"]
        .as_array()
        .expect("items")
        .iter()
        .find(|item| item["item_id"] == live_id(item_id))
        .and_then(|item| item["translated_text"].as_str())
        .unwrap_or_default()
        .to_string()
}

fn commit_events(state: &crate::AppState, job_id: &str) -> Vec<Value> {
    build_jobs_facade_from_state(state)
        .live_translation_events_after(job_id, 0, 100)
        .expect("live events")
        .into_iter()
        .map(|event| serde_json::to_value(event).expect("event json"))
        .collect()
}

fn snapshot_generations(translated: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(translated.join(".translation-checkpoints"))
        .expect("snapshots")
        .filter_map(Result::ok)
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

fn db_connection(state: &crate::AppState) -> Connection {
    Connection::open(&state.config.jobs_db_path).expect("open jobs db")
}

fn current_page_hash(translated: &Path) -> String {
    sha256_hex(&fs::read(translated.join(PAGE_FILE)).expect("page"))
}

#[tokio::test]
async fn revision_is_published_to_the_live_page_snapshot_and_commit_events() {
    let state = state_with_pipeline("revision-publish-live");
    let job_id = "job-revision-publish-live";
    let translated = seed_live_job(&state, job_id, JobStatusKind::Succeeded);
    let before = live_page(&state, job_id).await;
    assert_eq!(live_text(&before, ITEM_ID), ORIGINAL_TEXT);
    let events_before = commit_events(&state, job_id).len();

    let (status, payload) = patch_item(
        &state,
        job_id,
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user"}),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{payload}");
    let data = &payload["data"];
    let contract = contract();
    assert_keys_match(data, &contract, "TranslationRevisionView");
    let publication = &data["live_publication"];
    assert_keys_match(publication, &contract, "TranslationRevisionLivePublication");
    assert_eq!(publication["status"], "published", "{publication}");
    assert!(publication["error"].is_null());
    let page_hash = current_page_hash(&translated);
    let published_page = &publication["pages"][0];
    assert_keys_match(published_page, &contract, "TranslationRevisionLivePage");
    assert_eq!(published_page["page_idx"], 0);
    assert_eq!(published_page["status"], "published");
    assert_eq!(published_page["page_hash"], page_hash);
    assert_eq!(published_page["attempt"], 1);

    // 页快照:新文本、新 page_hash,版本比修订前新(前端按 (attempt, generation) 比较)。
    let after = live_page(&state, job_id).await;
    assert_eq!(live_text(&after, ITEM_ID), REVISED_TEXT);
    assert_eq!(live_text(&after, SECOND_ITEM_ID), "它的能级是等间距的。");
    assert_eq!(after["page_hash"], page_hash);
    assert_eq!(after["page_hash"], checkpoint(&translated)["pages"][0]["page_hash"]);
    assert_eq!(after["attempt"], before["attempt"]);
    assert!(after["generation"].as_u64() > before["generation"].as_u64());
    assert_eq!(after["generation"], published_page["generation"]);

    // 事件流多一条 translation_units_committed,指向同一版本。
    let events = commit_events(&state, job_id);
    assert_eq!(events.len(), events_before + 1);
    let event = events.last().expect("revision event");
    assert_eq!(event["event"], "translation_units_committed");
    assert_eq!(event["page_idx"], 0);
    assert_eq!(event["page_hash"], page_hash);
    assert_eq!(event["attempt"], after["attempt"]);
    assert_eq!(event["generation"], after["generation"]);
    assert_eq!(event["changed_item_ids"], json!([live_id(ITEM_ID)]));

    // 登记完成后旧 generation 的快照不再被引用,被清掉;任务状态不变。
    assert_eq!(snapshot_generations(&translated), vec!["generation-8".to_string()]);
    let job = state.db.get_job(job_id).expect("job");
    assert_eq!(job.status, JobStatusKind::Succeeded);
    assert!(!state.db.has_running_pipeline_attempt(job_id).expect("running attempt"));
}

#[tokio::test]
async fn failed_and_canceled_jobs_show_the_revision_in_live_translation() {
    for (name, status) in [
        ("failed", JobStatusKind::Failed),
        ("canceled", JobStatusKind::Canceled),
    ] {
        let state = state_with_pipeline(&format!("revision-publish-{name}"));
        let job_id = format!("job-revision-publish-{name}");
        let translated = seed_live_job(&state, &job_id, status.clone());

        let (code, payload) = patch_item(
            &state,
            &job_id,
            ITEM_ID,
            json!({"translated_text": REVISED_TEXT, "source": "agent"}),
        )
        .await;

        assert_eq!(code, StatusCode::OK, "{name}: {payload}");
        assert_eq!(payload["data"]["live_publication"]["status"], "published", "{name}");
        let page = live_page(&state, &job_id).await;
        assert_eq!(live_text(&page, ITEM_ID), REVISED_TEXT, "{name}");
        assert_eq!(page["page_hash"], current_page_hash(&translated), "{name}");
        assert_eq!(state.db.get_job(&job_id).expect("job").status, status, "{name}");
    }
}

#[tokio::test]
async fn consecutive_revisions_publish_each_page_version_in_order() {
    let state = state_with_pipeline("revision-publish-consecutive");
    let job_id = "job-revision-publish-consecutive";
    let translated = seed_live_job(&state, job_id, JobStatusKind::Succeeded);
    let events_before = commit_events(&state, job_id).len();

    let (status, first) = patch_item(
        &state,
        job_id,
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user", "expected_generation": 7}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{first}");
    let first_page = live_page(&state, job_id).await;
    let (status, second) = patch_item(
        &state,
        job_id,
        SECOND_ITEM_ID,
        json!({"translated_text": SECOND_REVISED_TEXT, "source": "user", "expected_generation": 8}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{second}");
    assert_eq!(second["data"]["generation"], 9);
    assert_eq!(second["data"]["live_publication"]["status"], "published");

    let page = live_page(&state, job_id).await;
    assert_eq!(live_text(&page, ITEM_ID), REVISED_TEXT);
    assert_eq!(live_text(&page, SECOND_ITEM_ID), SECOND_REVISED_TEXT);
    assert_eq!(page["page_hash"], current_page_hash(&translated));
    assert!(page["generation"].as_u64() > first_page["generation"].as_u64());
    let events = commit_events(&state, job_id);
    assert_eq!(events.len(), events_before + 2);
    assert_eq!(events[events.len() - 2]["page_hash"], first_page["page_hash"]);
    assert_eq!(events[events.len() - 1]["page_hash"], page["page_hash"]);
    assert_eq!(
        events[events.len() - 1]["changed_item_ids"],
        json!([live_id(SECOND_ITEM_ID)])
    );
    let unit = state
        .db
        .latest_pipeline_unit_for_page(job_id, "translate", 0)
        .expect("unit")
        .expect("row");
    assert_eq!(unit.producer_generation, Some(9));
    assert_eq!(snapshot_generations(&translated), vec!["generation-9".to_string()]);

    // 同一文本重发:不写文件、不登记、不发事件。
    let (status, again) = patch_item(
        &state,
        job_id,
        SECOND_ITEM_ID,
        json!({"translated_text": SECOND_REVISED_TEXT, "source": "user"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert_eq!(again["data"]["changed"], false);
    assert_eq!(again["data"]["live_publication"]["status"], "current");
    assert_eq!(commit_events(&state, job_id).len(), events_before + 2);
}

#[tokio::test]
async fn concurrent_revisions_leave_the_live_view_on_the_final_file_state() {
    let state = state_with_pipeline("revision-publish-concurrent");
    let job_id = "job-revision-publish-concurrent";
    let translated = seed_live_job(&state, job_id, JobStatusKind::Succeeded);

    let (first, second) = tokio::join!(
        patch_item(
            &state,
            job_id,
            ITEM_ID,
            json!({"translated_text": REVISED_TEXT, "source": "user"}),
        ),
        patch_item(
            &state,
            job_id,
            SECOND_ITEM_ID,
            json!({"translated_text": SECOND_REVISED_TEXT, "source": "agent"}),
        ),
    );

    // Python 的 checkpoint 锁让两者串行;撞上锁的那个是 409 checkpoint_locked,
    // 什么都没写。不管谁先谁后,读模型最终落在页文件的最终状态上。
    let mut applied = Vec::new();
    for ((status, payload), item_id, text) in [
        (first, ITEM_ID, REVISED_TEXT),
        (second, SECOND_ITEM_ID, SECOND_REVISED_TEXT),
    ] {
        match status {
            StatusCode::OK => applied.push((item_id, text)),
            StatusCode::CONFLICT => {
                assert_eq!(payload["error"]["details"]["reason"], "checkpoint_locked", "{payload}")
            }
            other => panic!("unexpected status {other}: {payload}"),
        }
    }
    assert!(!applied.is_empty());
    let page = live_page(&state, job_id).await;
    assert_eq!(page["page_hash"], current_page_hash(&translated));
    for (item_id, text) in applied {
        assert_eq!(live_text(&page, item_id), text);
    }
}

#[tokio::test]
async fn failed_registration_keeps_the_write_and_heals_on_resend() {
    let state = state_with_pipeline("revision-publish-heal-resend");
    let job_id = "job-revision-publish-heal-resend";
    let translated = seed_live_job(&state, job_id, JobStatusKind::Succeeded);
    let original_hash = current_page_hash(&translated);
    db_connection(&state)
        .execute_batch(
            "CREATE TRIGGER fail_revision_publish BEFORE UPDATE ON pipeline_units \
             BEGIN SELECT RAISE(ABORT, 'injected registration failure'); END;",
        )
        .expect("install failure trigger");

    let (status, payload) = patch_item(
        &state,
        job_id,
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user"}),
    )
    .await;

    // 写回成功(文件是权威),登记失败如实报告。
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["changed"], true);
    let publication = &payload["data"]["live_publication"];
    assert_eq!(publication["status"], "failed", "{publication}");
    assert!(publication["error"]
        .as_str()
        .is_some_and(|error| error.contains("injected registration failure")));
    assert_eq!(render_loader_text(&translated, ITEM_ID), REVISED_TEXT);
    // 读模型还是修订前那一版,而且仍然读得出来:旧快照没被清。
    let stale = live_page(&state, job_id).await;
    assert_eq!(stale["page_hash"], original_hash);
    assert_eq!(live_text(&stale, ITEM_ID), ORIGINAL_TEXT);
    assert!(snapshot_generations(&translated).contains(&"generation-7".to_string()));

    db_connection(&state)
        .execute_batch("DROP TRIGGER fail_revision_publish;")
        .expect("drop failure trigger");
    let (status, resent) = patch_item(
        &state,
        job_id,
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user"}),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{resent}");
    assert_eq!(resent["data"]["changed"], false);
    assert_eq!(resent["data"]["live_publication"]["status"], "published");
    let healed = live_page(&state, job_id).await;
    assert_eq!(live_text(&healed, ITEM_ID), REVISED_TEXT);
    assert_eq!(healed["page_hash"], current_page_hash(&translated));
    assert_eq!(
        commit_events(&state, job_id).last().expect("event")["page_hash"],
        healed["page_hash"]
    );
    assert_eq!(snapshot_generations(&translated), vec!["generation-8".to_string()]);
}

#[tokio::test]
async fn failed_registration_heals_when_live_translation_is_opened() {
    let state = state_with_pipeline("revision-publish-heal-read");
    let job_id = "job-revision-publish-heal-read";
    let translated = seed_live_job(&state, job_id, JobStatusKind::Failed);
    db_connection(&state)
        .execute_batch(
            "CREATE TRIGGER fail_revision_publish BEFORE UPDATE ON pipeline_units \
             BEGIN SELECT RAISE(ABORT, 'injected registration failure'); END;",
        )
        .expect("install failure trigger");
    let (status, payload) = patch_item(
        &state,
        job_id,
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["live_publication"]["status"], "failed");
    db_connection(&state)
        .execute_batch("DROP TRIGGER fail_revision_publish;")
        .expect("drop failure trigger");
    let events_before = commit_events(&state, job_id).len();

    // 阅读页打开实时译文先取版面:这一步补登记,随后的事件回放与页快照都是新文本。
    let (status, layout) = get(&state, format!("/api/v1/jobs/{job_id}/live-translation/layout")).await;
    assert_eq!(status, StatusCode::OK, "{layout}");

    let events = commit_events(&state, job_id);
    assert_eq!(events.len(), events_before + 1);
    let page = live_page(&state, job_id).await;
    assert_eq!(live_text(&page, ITEM_ID), REVISED_TEXT);
    assert_eq!(page["page_hash"], current_page_hash(&translated));
    assert_eq!(events.last().expect("event")["generation"], page["generation"]);
    // 再打开一次不会重复登记。
    get(&state, format!("/api/v1/jobs/{job_id}/live-translation/layout")).await;
    assert_eq!(commit_events(&state, job_id).len(), events_before + 1);
}

#[tokio::test]
async fn revision_then_rerender_keeps_the_published_text_and_blocks_further_writes() {
    let state = state_with_pipeline("revision-publish-rerender");
    let job_id = "job-revision-publish-rerender";
    let translated = seed_live_job(&state, job_id, JobStatusKind::Succeeded);

    let (status, payload) = patch_item(
        &state,
        job_id,
        ITEM_ID,
        json!({"translated_text": REVISED_TEXT, "source": "user", "rerender": true}),
    )
    .await;

    assert_eq!(status, StatusCode::OK, "{payload}");
    assert!(payload["data"]["rerender_error"].is_null(), "{payload}");
    assert_eq!(payload["data"]["live_publication"]["status"], "published");
    // 重渲染排上队后,实时译文仍是修订后的文本(render attempt 不带 translate 行)。
    let page = live_page(&state, job_id).await;
    assert_eq!(live_text(&page, ITEM_ID), REVISED_TEXT);
    assert_eq!(page["page_hash"], current_page_hash(&translated));
    // 渲染排队/运行期间不许再写回。
    let (status, refused) = patch_item(
        &state,
        job_id,
        SECOND_ITEM_ID,
        json!({"translated_text": SECOND_REVISED_TEXT, "source": "user"}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{refused}");
    assert_eq!(refused["error"]["details"]["reason"], "job_running");
    assert_eq!(live_text(&live_page(&state, job_id).await, SECOND_ITEM_ID), "它的能级是等间距的。");
}
