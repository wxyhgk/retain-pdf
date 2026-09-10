//! Cross-module durable pipeline regression tests.

use serde_json::{json, Value};

use super::types::{
    PipelineDispatchBegin, PipelineDispatchIntent, PipelineStageObservation, PipelineUnitCommit,
};
use crate::db::Db;
use std::fs;
use std::sync::{Arc, Barrier};
use std::thread;

use crate::models::domain::JobSnapshot;
use crate::models::request::CreateJobInput;

struct Fixture {
    root: std::path::PathBuf,
    db: Db,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "retain-pipeline-state-{name}-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        fs::create_dir_all(&root).expect("fixture root");
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().expect("init db");
        db.save_job(&JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        ))
        .expect("seed job");
        Self { root, db }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn unit(order: u64, key: &str, hash_digit: char) -> PipelineUnitCommit {
    PipelineUnitCommit {
        unit_key: key.to_string(),
        unit_order: order,
        page_index: Some(order as u32),
        page_hash: hash_digit.to_string().repeat(64),
        producer_generation: Some(order + 10),
        payload: json!({"phase": "translating"}),
    }
}

fn observation(seq: u64, raw_stage: &str, current: i64) -> PipelineStageObservation {
    PipelineStageObservation {
        producer_seq: seq,
        producer_ts: "2026-08-26T00:00:00Z".to_string(),
        event_type: "stage_progress".to_string(),
        raw_stage: raw_stage.to_string(),
        substage: Some(raw_stage.to_string()),
        stage_detail: Some(format!("{raw_stage} {current}/10")),
        message: format!("{raw_stage} {current}/10"),
        provider: None,
        provider_stage: None,
        progress_current: Some(current),
        progress_total: Some(10),
        progress_unit: Some("page".to_string()),
        payload: json!({"source": "worker"}),
    }
}

fn dispatch_intent() -> PipelineDispatchIntent {
    PipelineDispatchIntent {
        dispatch_key: "ocr-submit".to_string(),
        provider: "mineru".to_string(),
        operation: "create_extract_task".to_string(),
        request_hash: "a".repeat(64),
    }
}

#[test]
fn crash_after_request_dispatch_does_not_advance_checkpoint() {
    let fixture = Fixture::new("request-before-commit");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    let checkpoint = fixture
        .db
        .pipeline_checkpoint("job-1", cursor.attempt, "translate")
        .expect("checkpoint")
        .expect("stage checkpoint");
    assert_eq!(checkpoint.generation, 1);
    assert_eq!(checkpoint.last_committed_unit_key, None);
    assert!(fixture
        .db
        .list_pipeline_units("job-1", cursor.attempt, "translate")
        .expect("units")
        .is_empty());
}

#[test]
fn page_saved_but_not_committed_resumes_from_last_committed_unit() {
    let fixture = Fixture::new("page-before-checkpoint");
    let mut cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    let checkpoint = fixture
        .db
        .commit_pipeline_unit(&cursor, &unit(1, "page-1:item-1", 'a'))
        .expect("commit one");
    cursor.generation = checkpoint.generation;
    // Simulate a page file becoming visible with no durable commit.
    fs::write(fixture.root.join("page-2.json"), b"new page bytes").expect("page write");
    let resumed = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-b", "translate", 1)
        .expect("restart claim");
    let durable = fixture
        .db
        .pipeline_checkpoint("job-1", resumed.attempt, "translate")
        .expect("checkpoint")
        .expect("checkpoint exists");
    assert_eq!(
        durable.last_committed_unit_key.as_deref(),
        Some("page-1:item-1")
    );
    let first_hash = "a".repeat(64);
    assert_eq!(durable.last_page_hash.as_deref(), Some(first_hash.as_str()));
}

#[test]
fn repair_updates_same_committed_unit_without_regressing_order() {
    let fixture = Fixture::new("repair");
    let mut cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    cursor.generation = fixture
        .db
        .commit_pipeline_unit(&cursor, &unit(7, "page-2:item-7", 'a'))
        .expect("translate commit")
        .generation;
    let mut repair_unit = unit(7, "page-2:item-7", 'b');
    repair_unit.producer_generation = Some(18);
    let repaired = fixture
        .db
        .commit_pipeline_unit(&cursor, &repair_unit)
        .expect("repair commit");
    let repaired_hash = "b".repeat(64);
    assert_eq!(
        repaired.last_page_hash.as_deref(),
        Some(repaired_hash.as_str())
    );
    let units = fixture
        .db
        .list_pipeline_units("job-1", cursor.attempt, "translate")
        .expect("units");
    assert_eq!(units.len(), 1);
    assert_eq!(units[0].page_hash, "b".repeat(64));
}

#[test]
fn repair_can_refresh_an_earlier_page_without_moving_stage_cursor_backwards() {
    let fixture = Fixture::new("repair-earlier-page");
    let mut cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    cursor.generation = fixture
        .db
        .commit_pipeline_unit(&cursor, &unit(1, "p001-b1", 'a'))
        .expect("first page")
        .generation;
    let mut second = unit(2, "p002-b1", 'b');
    second.producer_generation = Some(13);
    cursor.generation = fixture
        .db
        .commit_pipeline_unit(&cursor, &second)
        .expect("second page")
        .generation;

    let mut repaired_first = unit(1, "p001-b1", 'c');
    repaired_first.producer_generation = Some(14);
    let repaired = fixture
        .db
        .commit_pipeline_unit(&cursor, &repaired_first)
        .expect("repair earlier page");

    assert_eq!(repaired.last_committed_unit_key.as_deref(), Some("p002-b1"));
    assert_eq!(repaired.last_committed_unit_order, Some(2));
    assert_eq!(
        repaired.last_page_hash.as_deref(),
        Some("b".repeat(64).as_str())
    );
    let first_page = fixture
        .db
        .latest_pipeline_unit_for_page("job-1", "translate", 1)
        .expect("query page")
        .expect("page unit");
    assert_eq!(first_page.page_hash, "c".repeat(64));
    assert_eq!(first_page.generation, repaired.generation);
}

#[test]
fn new_page_can_commit_out_of_document_order_without_moving_stage_cursor_backwards() {
    let fixture = Fixture::new("out-of-order-page");
    let mut cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    let mut later_page = unit(10, "page:10", 'a');
    later_page.page_index = Some(10);
    later_page.producer_generation = Some(21);
    cursor.generation = fixture
        .db
        .commit_pipeline_unit(&cursor, &later_page)
        .expect("later page finishes first")
        .generation;

    let mut earlier_page = unit(1, "page:1", 'b');
    earlier_page.page_index = Some(1);
    earlier_page.producer_generation = Some(22);
    let committed = fixture
        .db
        .commit_pipeline_unit(&cursor, &earlier_page)
        .expect("earlier page finishes later");

    assert_eq!(
        committed.last_committed_unit_key.as_deref(),
        Some("page:10")
    );
    assert_eq!(committed.last_committed_unit_order, Some(10));
    assert_eq!(
        committed.last_page_hash.as_deref(),
        Some("a".repeat(64).as_str())
    );
    let page = fixture
        .db
        .latest_pipeline_unit_for_page("job-1", "translate", 1)
        .expect("query page")
        .expect("earlier page commit");
    assert_eq!(page.unit_key, "page:1");
    assert_eq!(page.generation, committed.generation);
}

#[test]
fn restart_fences_the_previous_worker() {
    let fixture = Fixture::new("restart");
    let old = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-old", "translate", 1)
        .expect("old worker");
    let new = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-new", "translate", 1)
        .expect("new worker");
    assert!(fixture
        .db
        .commit_pipeline_unit(&old, &unit(1, "stale", 'a'))
        .expect_err("old worker fenced")
        .to_string()
        .contains("stale pipeline cursor"));
    assert!(fixture
        .db
        .commit_pipeline_unit(&new, &unit(1, "fresh", 'b'))
        .is_ok());
}

#[test]
fn concurrent_workers_have_one_authoritative_generation() {
    let fixture = Fixture::new("concurrent");
    let db = Arc::new(fixture.db.clone());
    let barrier = Arc::new(Barrier::new(3));
    let mut handles = Vec::new();
    for worker in ["worker-a", "worker-b"] {
        let db = db.clone();
        let barrier = barrier.clone();
        handles.push(thread::spawn(move || {
            barrier.wait();
            db.acquire_pipeline_attempt("job-1", worker, "translate", 1)
                .expect("claim")
        }));
    }
    barrier.wait();
    let cursors: Vec<_> = handles
        .into_iter()
        .map(|handle| handle.join().expect("join"))
        .collect();
    let winner = cursors
        .iter()
        .max_by_key(|cursor| cursor.generation)
        .expect("winner");
    let loser = cursors
        .iter()
        .min_by_key(|cursor| cursor.generation)
        .expect("loser");
    assert!(db
        .commit_pipeline_unit(winner, &unit(1, "winner", 'c'))
        .is_ok());
    assert!(db
        .commit_pipeline_unit(loser, &unit(1, "loser", 'd'))
        .is_err());
}

#[test]
fn events_are_inserted_only_after_authoritative_commit() {
    let fixture = Fixture::new("events");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    fixture
        .db
        .commit_pipeline_unit(&cursor, &unit(1, "unit-1", 'e'))
        .expect("commit");
    let events = fixture.db.list_job_events("job-1", 100, 0).expect("events");
    assert!(events
        .iter()
        .any(|event| event.event == "pipeline_unit_committed"));
    assert!(!events
        .iter()
        .any(|event| event.message.contains("raw stdout")));
}

#[test]
fn multi_page_checkpoint_commits_atomically_in_one_generation() {
    let fixture = Fixture::new("multi-page-checkpoint");
    let mut cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    let mut first = unit(1, "p001-b2", 'a');
    first.page_index = Some(0);
    first.producer_generation = Some(21);
    first.payload = json!({"changed_item_ids": ["p001-b1", "p001-b2"]});
    let mut second = unit(4, "p002-b1", 'b');
    second.page_index = Some(1);
    second.producer_generation = Some(21);
    second.payload = json!({"changed_item_ids": ["p002-b1"]});

    let checkpoint = fixture
        .db
        .commit_pipeline_units(&cursor, &[first.clone(), second.clone()])
        .expect("commit batch");
    assert_eq!(checkpoint.generation, cursor.generation + 1);
    assert_eq!(
        checkpoint.last_committed_unit_key.as_deref(),
        Some("p002-b1")
    );
    let units = fixture
        .db
        .list_pipeline_units("job-1", cursor.attempt, "translate")
        .expect("units");
    assert_eq!(units.len(), 2);
    assert_eq!(units[0].generation, units[1].generation);
    assert_eq!(units[0].producer_generation, Some(21));

    let events = fixture
        .db
        .list_translation_commit_events_after("job-1", 0, 10)
        .expect("commit events");
    assert_eq!(events.len(), 2);
    assert_eq!(
        events[0].payload["changed_item_ids"],
        json!(["p001-b1", "p001-b2"])
    );

    cursor.generation = checkpoint.generation;
    let duplicate = fixture
        .db
        .commit_pipeline_units(&cursor, &[first, second])
        .expect("idempotent retransmission");
    assert_eq!(duplicate.generation, checkpoint.generation);
    assert_eq!(
        fixture
            .db
            .list_translation_commit_events_after("job-1", 0, 10)
            .expect("commit events")
            .len(),
        2
    );
}

#[test]
fn invalid_multi_page_checkpoint_does_not_partially_commit() {
    let fixture = Fixture::new("invalid-multi-page-checkpoint");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    let first = unit(1, "p001-b1", 'a');
    let mut invalid = unit(2, "p002-b1", 'b');
    invalid.page_hash = "not-a-hash".to_string();

    fixture
        .db
        .commit_pipeline_units(&cursor, &[first, invalid])
        .expect_err("invalid batch");
    assert!(fixture
        .db
        .list_pipeline_units("job-1", cursor.attempt, "translate")
        .expect("units")
        .is_empty());
    assert_eq!(
        fixture
            .db
            .pipeline_checkpoint("job-1", cursor.attempt, "translate")
            .expect("checkpoint")
            .expect("stage")
            .generation,
        cursor.generation
    );
}

#[test]
fn stage_observation_updates_state_and_event_in_one_fenced_transition() {
    let fixture = Fixture::new("stage-observation");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    let next = fixture
        .db
        .observe_pipeline_stage(
            &cursor,
            "translate",
            1,
            true,
            &observation(4, "translating", 3),
        )
        .expect("observe");
    assert_eq!(next.generation, cursor.generation + 1);
    let state = fixture
        .db
        .pipeline_stage_state("job-1", cursor.attempt, "translate")
        .expect("stage state")
        .expect("stage");
    assert_eq!(state.raw_stage.as_deref(), Some("translating"));
    assert_eq!(state.progress_current, Some(3));
    assert_eq!(state.producer_seq, Some(4));
    let events = fixture.db.list_job_events("job-1", 100, 0).expect("events");
    let progress = events
        .iter()
        .find(|event| event.event == "stage_progress")
        .expect("derived progress event");
    assert_eq!(progress.stage.as_deref(), Some("translating"));
    assert_eq!(progress.progress_current, Some(3));
    assert_eq!(
        progress
            .payload
            .as_ref()
            .and_then(|payload| payload.pointer("/authority/generation"))
            .and_then(Value::as_u64),
        Some(next.generation)
    );

    let later = fixture
        .db
        .observe_pipeline_stage(
            &next,
            "translate",
            1,
            true,
            &observation(5, "translating", 1),
        )
        .expect("observe restarted lower progress");
    assert_eq!(later.generation, next.generation + 1);
    assert_eq!(
        fixture
            .db
            .pipeline_stage_state("job-1", cursor.attempt, "translate")
            .expect("stage state")
            .expect("stage")
            .progress_current,
        Some(3)
    );
}

#[test]
fn background_stage_does_not_replace_main_stage() {
    let fixture = Fixture::new("background-stage");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    let mut prewarm = observation(5, "render_preprocess", 2);
    prewarm.substage = Some("render_prewarm".to_string());
    let next = fixture
        .db
        .observe_pipeline_stage(&cursor, "render", 2, false, &prewarm)
        .expect("observe background");
    assert_eq!(next.stage_key, "translate");
    assert_eq!(
        fixture
            .db
            .pipeline_stage_state("job-1", cursor.attempt, "translate")
            .expect("main state")
            .expect("main stage")
            .status,
        "running"
    );
    assert_eq!(
        fixture
            .db
            .pipeline_stage_state("job-1", cursor.attempt, "render")
            .expect("background state")
            .expect("background stage")
            .substage
            .as_deref(),
        Some("render_prewarm")
    );
}

#[test]
fn main_stage_transition_completes_previous_stage_and_fences_old_cursor() {
    let fixture = Fixture::new("main-stage-transition");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    let next = fixture
        .db
        .observe_pipeline_stage(&cursor, "render", 2, true, &observation(6, "rendering", 1))
        .expect("enter render");
    assert_eq!(next.stage_key, "render");
    assert_eq!(
        fixture
            .db
            .pipeline_stage_state("job-1", cursor.attempt, "translate")
            .expect("translation state")
            .expect("translation stage")
            .status,
        "completed"
    );
    assert!(fixture
        .db
        .observe_pipeline_stage(
            &cursor,
            "translate",
            1,
            true,
            &observation(7, "translating", 7),
        )
        .expect_err("old cursor fenced")
        .to_string()
        .contains("stale pipeline cursor"));
}

#[test]
fn restart_claim_preserves_last_authoritative_stage() {
    let fixture = Fixture::new("resume-stage-cursor");
    let translate = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire translate");
    let render = fixture
        .db
        .observe_pipeline_stage(
            &translate,
            "render",
            2,
            true,
            &observation(9, "rendering", 4),
        )
        .expect("enter render");
    assert_eq!(render.stage_key, "render");

    // The compatibility JobSnapshot may still say translation during
    // startup. The durable attempt cursor must win over that hint.
    let resumed = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-b", "translate", 1)
        .expect("resume");
    assert_eq!(resumed.attempt, translate.attempt);
    assert_eq!(resumed.stage_key, "render");
    assert!(resumed.generation > render.generation);
}

#[test]
fn main_stage_order_cannot_regress() {
    let fixture = Fixture::new("stage-order-regression");
    let translate = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire translate");
    let render = fixture
        .db
        .observe_pipeline_stage(
            &translate,
            "render",
            2,
            true,
            &observation(10, "rendering", 4),
        )
        .expect("enter render");
    assert!(fixture
        .db
        .observe_pipeline_stage(
            &render,
            "translate",
            1,
            true,
            &observation(11, "translating", 5),
        )
        .expect_err("stage regression rejected")
        .to_string()
        .contains("stage order regressed"));
}

#[test]
fn request_sent_without_receipt_becomes_ambiguous_after_restart() {
    let fixture = Fixture::new("dispatch-intent-crash");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "ocr", 0)
        .expect("acquire");
    let send_cursor = match fixture
        .db
        .begin_pipeline_dispatch(&cursor, &dispatch_intent())
        .expect("begin dispatch")
    {
        PipelineDispatchBegin::Send { cursor } => cursor,
        other => panic!("expected send, got {other:?}"),
    };
    assert!(send_cursor.generation > cursor.generation);

    // Simulate the provider accepting the request while the runtime dies
    // before persisting its returned handle.
    let restarted = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-b", "ocr", 0)
        .expect("restart claim");
    let ambiguous = fixture
        .db
        .begin_pipeline_dispatch(&restarted, &dispatch_intent())
        .expect("recover dispatch");
    assert!(matches!(ambiguous, PipelineDispatchBegin::Ambiguous { .. }));
    let record = fixture
        .db
        .pipeline_dispatch("job-1", cursor.attempt, "ocr-submit")
        .expect("dispatch")
        .expect("record");
    assert_eq!(record.status, "ambiguous");
    assert!(record.receipt.is_none());
}

#[test]
fn durable_provider_receipt_resumes_polling_without_resubmit() {
    let fixture = Fixture::new("dispatch-receipt-resume");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "ocr", 0)
        .expect("acquire");
    let send_cursor = match fixture
        .db
        .begin_pipeline_dispatch(&cursor, &dispatch_intent())
        .expect("begin dispatch")
    {
        PipelineDispatchBegin::Send { cursor } => cursor,
        other => panic!("expected send, got {other:?}"),
    };
    let receipt = json!({"task_id": "task-123", "trace_id": "trace-1"});
    let receipted = fixture
        .db
        .receipt_pipeline_dispatch(&send_cursor, "ocr-submit", &receipt)
        .expect("receipt");

    let restarted = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-b", "ocr", 0)
        .expect("restart claim");
    let resumed = fixture
        .db
        .begin_pipeline_dispatch(&restarted, &dispatch_intent())
        .expect("resume dispatch");
    match resumed {
        PipelineDispatchBegin::Resume {
            cursor,
            receipt: loaded,
        } => {
            assert_eq!(cursor.generation, restarted.generation);
            assert_eq!(loaded, receipt);
        }
        other => panic!("expected receipt resume, got {other:?}"),
    }
    assert!(receipted.generation < restarted.generation);
}

#[test]
fn stale_worker_cannot_publish_provider_receipt() {
    let fixture = Fixture::new("dispatch-stale-receipt");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "ocr", 0)
        .expect("acquire");
    let send_cursor = match fixture
        .db
        .begin_pipeline_dispatch(&cursor, &dispatch_intent())
        .expect("begin dispatch")
    {
        PipelineDispatchBegin::Send { cursor } => cursor,
        other => panic!("expected send, got {other:?}"),
    };
    fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-b", "ocr", 0)
        .expect("superseding claim");
    assert!(fixture
        .db
        .receipt_pipeline_dispatch(&send_cursor, "ocr-submit", &json!({"task_id": "late-task"}),)
        .expect_err("stale receipt fenced")
        .to_string()
        .contains("stale pipeline cursor"));
}

#[test]
fn atomic_ocr_resolution_survives_restart_and_resumes_bound_receipt() {
    let fixture = Fixture::new("ocr-resolution-restart");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-before-crash", "ocr", 0)
        .expect("source attempt");
    let intent = dispatch_intent();
    fixture
        .db
        .begin_pipeline_dispatch(&cursor, &intent)
        .expect("source intent");
    let restarted = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-after-crash", "ocr", 0)
        .expect("restart claim");
    assert!(matches!(
        fixture
            .db
            .begin_pipeline_dispatch(&restarted, &intent)
            .expect("mark ambiguous"),
        PipelineDispatchBegin::Ambiguous { .. }
    ));
    fixture
        .db
        .finish_latest_pipeline_attempt("job-1", "failed")
        .expect("close source");
    let mut source_job = fixture.db.get_job("job-1").expect("source job");
    source_job.status = crate::models::domain::JobStatusKind::Failed;
    fixture.db.save_job(&source_job).expect("fail source job");
    let source_dispatch = fixture
        .db
        .latest_pipeline_dispatch("job-1", "ocr-submit")
        .expect("source dispatch")
        .expect("source record");
    let mut recovery = JobSnapshot::new(
        "job-recovery".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    recovery.status = crate::models::domain::JobStatusKind::Queued;
    let receipt = json!({
        "kind": "mineru_task",
        "task_id": "task-existing",
        "trace_id": "secret-value"
    });
    assert!(fixture
        .db
        .create_ocr_recovery_job_state(
            &source_dispatch,
            &recovery,
            "bind_existing_receipt",
            Some(&receipt),
        )
        .expect("atomic recovery"));

    assert_eq!(
        fixture
            .db
            .list_resumable_pipeline_job_ids()
            .expect("restart candidates"),
        vec!["job-recovery".to_string()]
    );
    let claimed = fixture
        .db
        .acquire_pipeline_attempt("job-recovery", "worker-after-service-restart", "ocr", 0)
        .expect("claim recovery");
    match fixture
        .db
        .begin_pipeline_dispatch(&claimed, &intent)
        .expect("resume receipt")
    {
        PipelineDispatchBegin::Resume { receipt, .. } => {
            assert_eq!(receipt["task_id"], "task-existing");
        }
        other => panic!("expected receipt resume, got {other:?}"),
    }
    let events = fixture
        .db
        .list_job_events("job-recovery", 100, 0)
        .expect("recovery events");
    assert!(!serde_json::to_string(&events)
        .expect("event json")
        .contains("secret-value"));
}

#[test]
fn concurrent_ocr_resolution_creates_exactly_one_recovery_job() {
    let fixture = Fixture::new("ocr-resolution-concurrent");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "ocr", 0)
        .expect("source attempt");
    let intent = dispatch_intent();
    fixture
        .db
        .begin_pipeline_dispatch(&cursor, &intent)
        .expect("source intent");
    let restarted = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-b", "ocr", 0)
        .expect("restart claim");
    fixture
        .db
        .begin_pipeline_dispatch(&restarted, &intent)
        .expect("mark ambiguous");
    fixture
        .db
        .finish_latest_pipeline_attempt("job-1", "failed")
        .expect("close source");
    let mut source_job = fixture.db.get_job("job-1").expect("source job");
    source_job.status = crate::models::domain::JobStatusKind::Failed;
    fixture.db.save_job(&source_job).expect("fail source job");
    let source_dispatch = fixture
        .db
        .latest_pipeline_dispatch("job-1", "ocr-submit")
        .expect("source dispatch")
        .expect("source record");
    let db = Arc::new(fixture.db.clone());
    let barrier = Arc::new(Barrier::new(2));
    let handles = (1..=2)
        .map(|index| {
            let db = db.clone();
            let barrier = barrier.clone();
            let source_dispatch = source_dispatch.clone();
            thread::spawn(move || {
                let recovery = JobSnapshot::new(
                    format!("job-recovery-{index}"),
                    CreateJobInput::default(),
                    vec!["python".to_string()],
                );
                barrier.wait();
                (
                    recovery.job_id.clone(),
                    db.create_ocr_recovery_job_state(
                        &source_dispatch,
                        &recovery,
                        "accept_duplicate_risk",
                        None,
                    )
                    .expect("resolution attempt"),
                )
            })
        })
        .collect::<Vec<_>>();
    let results = handles
        .into_iter()
        .map(|handle| handle.join().expect("resolution thread"))
        .collect::<Vec<_>>();
    assert_eq!(results.iter().filter(|(_, created)| *created).count(), 1);
    for (job_id, created) in results {
        assert_eq!(fixture.db.get_job(&job_id).is_ok(), created);
    }
    assert_eq!(
        fixture
            .db
            .latest_pipeline_dispatch("job-1", "ocr-submit")
            .expect("resolved dispatch")
            .expect("resolved record")
            .status,
        "resolved"
    );
}

#[test]
fn recovered_source_job_fences_stale_ocr_resolution() {
    let fixture = Fixture::new("ocr-resolution-source-recovered");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "ocr", 0)
        .expect("source attempt");
    let intent = dispatch_intent();
    fixture
        .db
        .begin_pipeline_dispatch(&cursor, &intent)
        .expect("source intent");
    let restarted = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-b", "ocr", 0)
        .expect("restart claim");
    fixture
        .db
        .begin_pipeline_dispatch(&restarted, &intent)
        .expect("mark ambiguous");
    let source_dispatch = fixture
        .db
        .latest_pipeline_dispatch("job-1", "ocr-submit")
        .expect("source dispatch")
        .expect("source record");
    let mut source_job = fixture.db.get_job("job-1").expect("source job");
    source_job.status = crate::models::domain::JobStatusKind::Succeeded;
    fixture
        .db
        .save_job(&source_job)
        .expect("recover source job");
    let recovery = JobSnapshot::new(
        "job-stale-recovery".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );

    assert!(!fixture
        .db
        .create_ocr_recovery_job_state(&source_dispatch, &recovery, "accept_duplicate_risk", None,)
        .expect("stale resolution must be fenced"));
    assert!(fixture.db.get_job("job-stale-recovery").is_err());
    assert_eq!(
        fixture
            .db
            .latest_pipeline_dispatch("job-1", "ocr-submit")
            .expect("dispatch after stale resolution")
            .expect("dispatch record")
            .status,
        "ambiguous"
    );
}

#[test]
fn terminal_job_closes_attempt_and_removes_it_from_resume_queue() {
    let fixture = Fixture::new("terminal");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("acquire");
    fixture
        .db
        .commit_pipeline_unit(&cursor, &unit(1, "unit-1", 'f'))
        .expect("commit");
    assert!(fixture
        .db
        .finish_latest_pipeline_attempt("job-1", "succeeded")
        .expect("finish attempt"));
    assert!(!fixture
        .db
        .has_running_pipeline_attempt("job-1")
        .expect("active attempt"));
    assert!(fixture
        .db
        .list_resumable_pipeline_job_ids()
        .expect("resume queue")
        .is_empty());
}

#[test]
fn stuck_queued_lists_jobs_without_running_attempts() {
    let fixture = Fixture::new("stuck-queued");
    // job-1: plain queued, never started -> stuck.
    fixture
        .db
        .save_job(&JobSnapshot::new(
            "job-stuck".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        ))
        .expect("seed stuck job");
    // job with a running attempt -> resumable path, not stuck.
    fixture
        .db
        .save_job(&JobSnapshot::new(
            "job-resumable".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        ))
        .expect("seed resumable job");
    fixture
        .db
        .acquire_pipeline_attempt("job-resumable", "worker-a", "ocr", 0)
        .expect("acquire attempt");
    // failed job -> neither list.
    let mut failed = JobSnapshot::new(
        "job-failed".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    failed.status = crate::models::domain::JobStatusKind::Failed;
    fixture.db.save_job(&failed).expect("seed failed job");

    let mut stuck = fixture
        .db
        .list_stuck_queued_job_ids()
        .expect("stuck queue");
    stuck.sort();
    assert_eq!(stuck, vec!["job-1".to_string(), "job-stuck".to_string()]);

    let resumable = fixture
        .db
        .list_resumable_pipeline_job_ids()
        .expect("resume queue");
    assert_eq!(resumable, vec!["job-resumable".to_string()]);
}
