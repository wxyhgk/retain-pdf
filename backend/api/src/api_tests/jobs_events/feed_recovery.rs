use std::fs::{self, OpenOptions};
use std::io::Write;

use axum::http::StatusCode;
use chrono::{Duration, SecondsFormat, Utc};
use rusqlite::{params, Connection};
use serde_json::json;

use crate::api_tests::jobs_common::test_state;
use crate::app::{build_app, build_state};
use crate::models::{JobStatusKind, WorkflowKind};

use super::feed_support::{append_events, cursor, items, page, pipeline_line, response, seed_job};

#[tokio::test]
async fn bootstrap_stage_basis_matches_published_order_across_chunk_boundaries() {
    let state = test_state("events-v2-bootstrap-stage-order");
    let job_id = "bootstrap-stage-order";
    seed_job(&state, job_id, WorkflowKind::Book);
    let mut job = state.db.get_job(job_id).expect("job");
    job.status = JobStatusKind::Running;
    job.sync_runtime_state();
    state.db.save_job(&job).expect("running job");
    let ts = "2026-09-14T00:00:00Z";
    let conn = Connection::open(&state.config.jobs_db_path).expect("fixture database");
    conn.execute(
        "INSERT INTO events (job_id, seq, ts, level, stage, stage_detail, provider_stage,
             event, message, progress_current, progress_total)
         VALUES (?1, 5000, ?2, 'info', 'rendering', 'DB final source position',
             'render_pages', 'stage_progress', 'DB final source position', 5000, 10000)",
        params![job_id, ts],
    )
    .expect("insert final-position DB event");
    drop(conn);
    let line = |seq, timestamp: &str| {
        json!({
            "job_id": job_id, "seq": seq, "ts": timestamp, "level": "info",
            "stage": "rendering", "substage": "render_pages",
            "stage_detail": format!("JSONL page {seq}"), "event_type": "stage_progress",
            "message": format!("JSONL page {seq}"), "progress_current": seq,
            "progress_total": 10000, "progress_unit": "page",
            // 撑过 1 MiB：文件按字节分批，1025 行照样分成两批导入（建事件流时按条数一批 16384 条，单靠条数分不出两批）
            "padding": "x".repeat(1100),
        })
        .to_string()
            + "\n"
    };
    let path = state
        .config
        .output_root
        .join(job_id)
        .join("logs/pipeline_events.jsonl");
    let history: String = (1..=1025).map(|seq| line(seq, ts)).collect();
    fs::write(&path, history).expect("write two import chunks");

    // In temporary import order, line 1025 follows the DB event. Publication
    // puts DB source_seq 5000 last, and stage reduction must use that order too.
    let app = build_app(state);
    let detail_path = format!("/api/v1/jobs/{job_id}");
    let (status, cold) = response(&app, &detail_path).await;
    assert_eq!(status, StatusCode::OK, "{cold}");
    assert_eq!(cold["data"]["stage_snapshot"]["progress"]["current"], 5000);
    let tail = page(&app, job_id, "start=tail").await;
    assert_eq!(items(&tail).len(), 500);
    let last = items(&tail).last().expect("published tail event");
    assert_eq!(last["seq"], 1026);
    assert_eq!(last["raw"]["source_seq"], 5000);
    assert_eq!(last["message"], "DB final source position");
    assert_eq!(
        cold["data"]["stage_snapshot"]["progress"]["current"],
        last["progress"]["current"]
    );
    let (status, warm) = response(&app, &detail_path).await;
    assert_eq!(status, StatusCode::OK, "{warm}");
    assert_eq!(warm["data"]["stage_snapshot"]["progress"]["current"], 5000);

    let mut file = OpenOptions::new()
        .append(true)
        .open(&path)
        .expect("event log");
    file.write_all(line(1026, "2026-09-14T00:00:01Z").as_bytes())
        .expect("append later stage event");
    drop(file);
    let next = page(&app, job_id, &format!("cursor={}", cursor(&tail))).await;
    assert_eq!(items(&next).len(), 1);
    assert_eq!(items(&next)[0]["seq"], 1027);
    assert_eq!(items(&next)[0]["progress"]["current"], 1026);
    let (status, updated) = response(&app, &detail_path).await;
    assert_eq!(status, StatusCode::OK, "{updated}");
    assert_eq!(
        updated["data"]["stage_snapshot"]["progress"]["current"],
        1026
    );
}

#[tokio::test]
async fn first_parent_feed_after_cleanup_does_not_resurrect_expired_terminal_child_events() {
    let state = test_state("events-v2-first-parent-feed-retention");
    let parent_id = "retention-parent";
    let child_id = "retention-child";
    seed_job(&state, parent_id, WorkflowKind::Book);
    seed_job(&state, child_id, WorkflowKind::Ocr);
    let mut parent = state.db.get_job(parent_id).expect("parent");
    parent.status = JobStatusKind::Running;
    parent.artifacts.as_mut().expect("artifacts").ocr_job_id = Some(child_id.into());
    parent.sync_runtime_state();
    state.db.save_job(&parent).expect("running parent");
    let mut child = state.db.get_job(child_id).expect("child");
    child.status = JobStatusKind::Succeeded;
    child.sync_runtime_state();
    state.db.save_job(&child).expect("terminal child");

    let now = Utc::now();
    let old_parent_ts = (now - Duration::days(60)).to_rfc3339_opts(SecondsFormat::Secs, true);
    let old_child_ts = (now - Duration::days(40)).to_rfc3339_opts(SecondsFormat::Secs, true);
    let conn = Connection::open(&state.config.jobs_db_path).expect("fixture database");
    for (job_id, ts, stage_detail) in [
        (parent_id, &old_parent_ts, "parent still working"),
        (child_id, &old_child_ts, "expired child DB progress"),
    ] {
        conn.execute(
            "INSERT INTO events (job_id, seq, ts, level, stage, stage_detail, event, message)
             VALUES (?1, 1, ?2, 'info', 'translating', ?3, 'stage_progress', ?3)",
            params![job_id, ts, stage_detail],
        )
        .expect("insert old event");
    }
    drop(conn);
    let path = state
        .config
        .output_root
        .join(child_id)
        .join("logs/pipeline_events.jsonl");
    let line = |seq, ts: &str, detail: &str| {
        json!({
            "job_id": child_id, "seq": seq, "ts": ts, "level": "info",
            "stage": "ocr_processing", "stage_detail": detail,
            "event_type": "stage_progress", "message": detail,
            "progress_current": seq, "progress_total": 10, "progress_unit": "page",
        })
        .to_string()
            + "\n"
    };
    fs::write(
        &path,
        line(1, &old_child_ts, "expired child JSONL progress"),
    )
    .expect("write retained raw child log");
    assert!(state
        .db
        .load_event_feed(parent_id)
        .expect("parent feed")
        .is_none());
    assert!(state
        .db
        .load_event_feed(child_id)
        .expect("child feed")
        .is_none());
    assert_eq!(state.db.cleanup_expired_events(30).expect("cleanup"), 1);
    assert!(path.exists(), "cleanup must preserve raw JSONL files");
    assert!(state
        .db
        .load_event_feed(parent_id)
        .expect("parent feed")
        .is_none());
    assert!(state
        .db
        .load_event_feed(child_id)
        .expect("child feed")
        .is_none());

    let app = build_app(state.clone());
    let (status, detail) = response(&app, &format!("/api/v1/jobs/{parent_id}")).await;
    assert_eq!(status, StatusCode::OK, "{detail}");
    assert_eq!(
        detail["data"]["stage_snapshot"]["stage_detail"],
        "parent still working"
    );
    let first = page(&app, parent_id, "start=head").await;
    assert_eq!(items(&first).len(), 1);
    assert_eq!(items(&first)[0]["message"], "parent still working");
    assert!(!first.to_string().contains("expired child"));

    state
        .db
        .append_event(
            child_id,
            "info",
            Some("ocr_processing".into()),
            Some("fresh child DB progress".into()),
            None,
            None,
            "stage_progress",
            None,
            "fresh child DB progress",
            Some(2),
            Some(10),
            None,
            None,
            None,
        )
        .expect("append new child DB event");
    let fresh_ts = (Utc::now() + Duration::seconds(1)).to_rfc3339_opts(SecondsFormat::Secs, true);
    let mut file = OpenOptions::new()
        .append(true)
        .open(&path)
        .expect("child log");
    file.write_all(line(2, &fresh_ts, "fresh child JSONL progress").as_bytes())
        .expect("append new child JSONL event");
    drop(file);
    // Cleanup removed the child's only DB row. append_event therefore reused
    // seq 1, which mutates the source revision and must expire the old cursor.
    let (status, expired) = response(
        &app,
        &format!("/api/v1/jobs/{parent_id}/progress/events?cursor={}", cursor(&first)),
    )
    .await;
    assert_eq!(status, StatusCode::GONE, "{expired}");
    assert_eq!(expired["error"]["code"], "EVENT_CURSOR_EXPIRED");
    let reloaded = page(&app, parent_id, "start=head").await;
    assert_eq!(items(&reloaded).len(), 3);
    assert_eq!(items(&reloaded)[0]["message"], "parent still working");
    assert!(!reloaded.to_string().contains("expired child"));
    let messages: Vec<_> = items(&reloaded)[1..]
        .iter()
        .map(|event| {
            assert_eq!(event["payload"]["source_job_id"], child_id);
            event["message"].as_str().expect("message")
        })
        .collect();
    assert_eq!(
        messages,
        ["fresh child DB progress", "fresh child JSONL progress"]
    );
    let unchanged = page(&app, parent_id, &format!("cursor={}", cursor(&reloaded))).await;
    assert!(items(&unchanged).is_empty());
    assert_eq!(unchanged["has_more"], false);
    let (status, detail) = response(&app, &format!("/api/v1/jobs/{parent_id}")).await;
    assert_eq!(status, StatusCode::OK, "{detail}");
    assert_eq!(
        detail["data"]["stage_snapshot"]["stage_detail"],
        "fresh child JSONL progress"
    );
}

#[tokio::test]
async fn cursor_and_event_identity_survive_an_api_state_restart() {
    let state = test_state("events-v2-restart");
    seed_job(&state, "restart-feed", WorkflowKind::Book);
    append_events(&state, "restart-feed", 1, 2);
    let first = page(
        &build_app(state.clone()),
        "restart-feed",
        "start=head&limit=1",
    )
    .await;
    let restarted = build_state(state.config.clone()).expect("rebuild application state");
    let app = build_app(restarted);
    let next = page(&app, "restart-feed", &format!("cursor={}", cursor(&first))).await;
    assert_eq!(items(&next).len(), 1);
    assert_eq!(items(&next)[0]["message"], "event-2");
    let reloaded = page(&app, "restart-feed", "start=head").await;
    assert_eq!(
        items(&first)[0]["event_id"],
        items(&reloaded)[0]["event_id"]
    );
    assert_eq!(items(&next)[0]["event_id"], items(&reloaded)[1]["event_id"]);
}

#[tokio::test]
async fn late_jsonl_event_is_appended_after_cursor_without_renumbering_old_events() {
    let state = test_state("events-v2-late-jsonl");
    seed_job(&state, "late-feed", WorkflowKind::Book);
    append_events(&state, "late-feed", 1, 1);
    let path = state
        .config
        .output_root
        .join("late-feed/logs/pipeline_events.jsonl");
    fs::write(&path, "").expect("create event source before polling");
    let app = build_app(state.clone());
    let first = page(&app, "late-feed", "start=head").await;
    let mut file = OpenOptions::new()
        .append(true)
        .open(&path)
        .expect("open event log");
    file.write_all(pipeline_line("late-feed", 1, "2025-01-01T00:00:00Z", "late event").as_bytes())
        .expect("append late event");
    drop(file);
    let late = page(&app, "late-feed", &format!("cursor={}", cursor(&first))).await;
    assert_eq!(items(&late).len(), 1);
    assert_eq!(items(&late)[0]["message"], "late event");
    assert!(items(&late)[0]["seq"].as_i64().unwrap() > items(&first)[0]["seq"].as_i64().unwrap());
    let full = page(&app, "late-feed", "start=head").await;
    assert_eq!(items(&full)[0]["event_id"], items(&first)[0]["event_id"]);
    assert_eq!(items(&full)[0]["seq"], items(&first)[0]["seq"]);
}

#[tokio::test]
async fn partial_jsonl_waits_for_newline_and_bad_complete_lines_do_not_block_progress() {
    let state = test_state("events-v2-partial-jsonl");
    seed_job(&state, "partial-feed", WorkflowKind::Book);
    let path = state
        .config
        .output_root
        .join("partial-feed/logs/pipeline_events.jsonl");
    let first_line = pipeline_line("partial-feed", 1, "2026-01-01T00:00:00Z", "complete later");
    fs::write(&path, first_line.trim_end_matches('\n')).expect("write incomplete line");
    let app = build_app(state);
    let empty = page(&app, "partial-feed", "start=head").await;
    assert!(items(&empty).is_empty(), "a newline commits a JSONL record");

    let mut file = OpenOptions::new()
        .append(true)
        .open(&path)
        .expect("open event log");
    write!(
        file,
        "\nnot-json\n{}",
        pipeline_line(
            "partial-feed",
            2,
            "2026-01-01T00:00:01Z",
            "after malformed line"
        )
    )
    .expect("finish line and append another");
    drop(file);
    let next = page(&app, "partial-feed", &format!("cursor={}", cursor(&empty))).await;
    assert_eq!(items(&next).len(), 2);
    assert_eq!(items(&next)[0]["message"], "complete later");
    assert_eq!(items(&next)[1]["message"], "after malformed line");
    let repeated = page(&app, "partial-feed", &format!("cursor={}", cursor(&next))).await;
    assert!(items(&repeated).is_empty());
}

#[tokio::test]
async fn modifying_a_db_event_expires_cursor_but_preserves_its_stable_identity() {
    let state = test_state("events-v2-db-modification");
    seed_job(&state, "modify-feed", WorkflowKind::Book);
    append_events(&state, "modify-feed", 1, 1);
    let app = build_app(state.clone());
    let first = page(&app, "modify-feed", "").await;
    let conn = Connection::open(&state.config.jobs_db_path).expect("open database");
    conn.execute(
        "UPDATE events SET message = ?1 WHERE job_id = ?2 AND seq = 1",
        params!["repaired message", "modify-feed"],
    )
    .expect("modify event source");
    let (status, error) = response(
        &app,
        &format!("/api/v1/jobs/modify-feed/progress/events?cursor={}", cursor(&first)),
    )
    .await;
    assert_eq!(status, StatusCode::GONE, "{error}");
    assert_eq!(error["error"]["code"], "EVENT_CURSOR_EXPIRED");
    let reloaded = page(&app, "modify-feed", "start=head").await;
    assert_eq!(items(&reloaded)[0]["message"], "repaired message");
    assert_eq!(
        items(&reloaded)[0]["event_id"],
        items(&first)[0]["event_id"]
    );
}

#[tokio::test]
async fn terminal_context_change_expires_cursor_without_replacing_source_identity() {
    let state = test_state("events-v2-terminal-context");
    seed_job(&state, "terminal-feed", WorkflowKind::Book);
    append_events(&state, "terminal-feed", 1, 1);
    let app = build_app(state.clone());
    let first = page(&app, "terminal-feed", "").await;
    let mut job = state.db.get_job("terminal-feed").expect("load job");
    job.status = JobStatusKind::Failed;
    job.error = Some("upstream timed out".to_owned());
    state.db.save_job(&job).expect("publish terminal context");
    let (status, error) = response(
        &app,
        &format!(
            "/api/v1/jobs/terminal-feed/progress/events?cursor={}",
            cursor(&first)
        ),
    )
    .await;
    assert_eq!(status, StatusCode::GONE, "{error}");
    assert_eq!(error["error"]["code"], "EVENT_CURSOR_EXPIRED");
    let reloaded = page(&app, "terminal-feed", "start=head").await;
    assert_eq!(
        items(&reloaded)[0]["event_id"],
        items(&first)[0]["event_id"]
    );
}

#[tokio::test]
async fn db_sequence_reuse_after_deletion_does_not_reuse_event_identity() {
    let state = test_state("events-v2-db-delete-reuse");
    seed_job(&state, "reuse-feed", WorkflowKind::Book);
    append_events(&state, "reuse-feed", 1, 1);
    let app = build_app(state.clone());
    let first = page(&app, "reuse-feed", "").await;
    let conn = Connection::open(&state.config.jobs_db_path).expect("open database");
    conn.execute("DELETE FROM events WHERE job_id = ?1", ["reuse-feed"])
        .expect("delete source event");
    append_events(&state, "reuse-feed", 1, 1);
    let (status, error) = response(
        &app,
        &format!("/api/v1/jobs/reuse-feed/progress/events?cursor={}", cursor(&first)),
    )
    .await;
    assert_eq!(status, StatusCode::GONE, "{error}");
    assert_eq!(error["error"]["code"], "EVENT_CURSOR_EXPIRED");
    let reloaded = page(&app, "reuse-feed", "start=head").await;
    assert_eq!(items(&reloaded).len(), 1);
    assert_ne!(
        items(&reloaded)[0]["event_id"],
        items(&first)[0]["event_id"]
    );
}

#[tokio::test]
async fn replacing_jsonl_invalidates_cursor_even_when_replacement_has_same_length() {
    let state = test_state("events-v2-jsonl-replacement");
    seed_job(&state, "replace-feed", WorkflowKind::Book);
    let path = state
        .config
        .output_root
        .join("replace-feed/logs/pipeline_events.jsonl");
    let old_line = pipeline_line("replace-feed", 1, "2026-01-01T00:00:00Z", "old event");
    let new_line = pipeline_line("replace-feed", 1, "2026-01-01T00:00:00Z", "new event");
    assert_eq!(old_line.len(), new_line.len());
    fs::write(&path, old_line).expect("write initial log");
    let app = build_app(state);
    let first = page(&app, "replace-feed", "").await;
    let replacement = path.with_extension("replacement");
    fs::write(&replacement, new_line).expect("write replacement log");
    fs::rename(replacement, path).expect("replace event log");
    let (status, error) = response(
        &app,
        &format!("/api/v1/jobs/replace-feed/progress/events?cursor={}", cursor(&first)),
    )
    .await;
    assert_eq!(status, StatusCode::GONE, "{error}");
    assert_eq!(error["error"]["code"], "EVENT_CURSOR_EXPIRED");
    let reloaded = page(&app, "replace-feed", "start=head").await;
    assert_eq!(items(&reloaded).len(), 1);
    assert_eq!(items(&reloaded)[0]["message"], "new event");
    assert_ne!(
        items(&reloaded)[0]["event_id"],
        items(&first)[0]["event_id"]
    );
}
