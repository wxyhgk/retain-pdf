use std::{fs, io::Write};

use chrono::{Duration, Utc};
use rusqlite::Connection;
use serde_json::{json, Value};

use super::fixture::{event_line as line, jsonl_bytes_read, EventFeedFixture as Fixture};
use super::*;
use retainpdf_core::models::JobStatusKind;

#[test]
fn eventless_list_does_not_initialize_empty_feeds() {
    let fs = Fixture::new("batch-stage-empty");
    for n in 0..50 {
        fs.job(&format!("empty-{n}"), None);
    }
    let jobs = fs.db.list_jobs(100, 0, None, None).unwrap();
    assert!(live_snapshots(&fs.db, &fs.root, &jobs).is_empty());
    for job in jobs {
        assert!(fs.fast(&job.job_id));
        assert!(fs.db.load_event_feed(&job.job_id).unwrap().is_none());
    }
}

#[test]
fn batch_stage_reuses_unchanged_feeds_and_observes_db_appends_mutations_and_deletes() {
    let fs = Fixture::new("batch-stage-db-deltas");
    fs.job("owner", None);
    fs.db_progress("owner", 1);
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 1);
    assert!(fs.fast("owner"));
    let revision = fs.db.load_event_feed("owner").unwrap().unwrap().revision;
    assert_eq!(fs.project("owner")["progress_current"], 1);
    assert_eq!(
        fs.db.load_event_feed("owner").unwrap().unwrap().revision,
        revision
    );
    fs.db_progress("owner", 2);
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 2);
    let conn = Connection::open(&fs.root.join("jobs.db")).unwrap();
    conn.execute(
        "UPDATE events SET progress_current=42 WHERE job_id='owner' AND seq=2",
        [],
    )
    .unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 42);
    conn.execute("DELETE FROM events WHERE job_id='owner' AND seq=2", [])
        .unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 1);
}

#[test]
fn batch_stage_observes_partial_jsonl_append_rewrite_replacement_and_removal() {
    let fs = Fixture::new("batch-stage-file-deltas");
    fs.job("owner", None);
    fs.db_progress("owner", 1);
    let path = fs.path("owner");
    fs::write(&path, line("owner", 3)).unwrap();
    assert_eq!(fs.project("owner")["progress_current"], 3);
    assert!(fs.fast("owner"));
    let reads = jsonl_bytes_read();
    assert_eq!(fs.project("owner")["progress_current"], 3);
    assert_eq!(
        jsonl_bytes_read(),
        reads,
        "unchanged files are not parsed again"
    );
    let partial = line("owner", 4);
    let mut file = fs::OpenOptions::new().append(true).open(&path).unwrap();
    file.write_all(partial[..partial.len() - 1].as_bytes())
        .unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 3);
    assert!(
        fs.fast("owner"),
        "unchanged partial tail is already accounted for"
    );
    file.write_all(b"\n").unwrap();
    drop(file);
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 4);
    fs::write(&path, line("owner", 5)).unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 5);
    let replacement = path.with_extension("replacement");
    fs::write(&replacement, line("owner", 6)).unwrap();
    fs::rename(&replacement, &path).unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 6);
    fs::remove_file(path).unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 1);
}

#[test]
fn batch_stage_observes_child_creation_updates_and_detachment() {
    let fs = Fixture::new("batch-stage-child-deltas");
    fs.job("owner", Some("child"));
    assert!(fs.fast("owner"));
    fs.job("child", None);
    fs.db_progress("child", 2);
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 2);
    assert!(fs.fast("owner"));
    fs.db_progress("child", 9);
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner")["progress_current"], 9);
    let mut owner = fs.db.get_job("owner").unwrap();
    owner.artifacts.as_mut().unwrap().ocr_job_id = None;
    fs.db.save_job(&owner).unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner"), Value::Null);
}

#[test]
fn batch_stage_invalidates_authority_status_and_retention_without_resurrection() {
    let fs = Fixture::new("batch-stage-context-retention");
    fs.job("owner", None);
    fs.db_progress("owner", 1);
    let conn = Connection::open(&fs.root.join("jobs.db")).unwrap();
    let old = (Utc::now() - Duration::days(60)).to_rfc3339();
    conn.execute("UPDATE events SET ts=?1 WHERE job_id='owner'", [&old])
        .unwrap();
    let old_line = json!({"job_id":"owner","ts":old,"stage":"translating","event_type":"stage_progress","message":"old file","progress_current":2,"progress_total":100});
    fs::write(fs.path("owner"), old_line.to_string() + "\n").unwrap();
    fs.project("owner");
    assert!(fs.fast("owner"));
    conn.execute("INSERT INTO pipeline_attempts(job_id,attempt,generation,status,worker_id,created_at,updated_at) VALUES('owner',1,1,'completed','test',?1,?1)", [&old]).unwrap();
    assert!(!fs.fast("owner"));
    fs.project("owner");
    let mut owner = fs.db.get_job("owner").unwrap();
    owner.status = JobStatusKind::Failed;
    fs.db.save_job(&owner).unwrap();
    assert!(!fs.fast("owner"));
    fs.project("owner");
    fs.db.cleanup_expired_events(30).unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner"), Value::Null);
    owner.status = JobStatusKind::Running;
    fs.db.save_job(&owner).unwrap();
    assert!(!fs.fast("owner"));
    assert_eq!(fs.project("owner"), Value::Null);
    fs.db_progress("owner", 2);
    assert_eq!(fs.project("owner")["progress_current"], 2);
}

/// OCR 子任务的 `finished` 阶段排名最高（与 rendering 同级）。它被导入父任务
/// 事件流时，父任务一旦在翻译阶段失败，终态任务的「当前阶段」按排名选，就会
/// 选成子任务的「任务完成」（书库卡片/详情读的 stage、stage_detail）。
#[test]
fn failed_parent_stage_is_not_taken_from_the_ocr_childs_finished_stage() {
    let fs = Fixture::new("ocr-child-finished-rank");
    fs.job("parent", Some("parent-ocr"));
    fs.job("parent-ocr", None);
    let mut parent = fs.db.get_job("parent").unwrap();
    parent.status = JobStatusKind::Failed;
    fs.db.save_job(&parent).unwrap();

    let append = |job_id: &str, level: &str, stage: &str, event: &str, message: &str| {
        fs.db
            .append_event(
                job_id,
                level,
                Some(stage.to_string()),
                Some(message.to_string()),
                None,
                None,
                event,
                Some(event.to_string()),
                message,
                None,
                None,
                None,
                None,
                None,
            )
            .unwrap();
    };
    append("parent-ocr", "info", "ocr_processing", "stage_progress", "Paddle 正在解析文件，第 45/48 页");
    append("parent-ocr", "info", "finished", "stage_transition", "任务完成");
    append("parent", "info", "translating", "stage_transition", "OCR 完成，开始翻译");
    append("parent", "error", "failed", "job_error", "translation boom");
    append("parent", "error", "failed", "job_terminal", "任务进入终态 failed");

    let snapshot = fs.project("parent");
    assert_ne!(snapshot["stage"], "finished", "{snapshot}");
    assert_ne!(snapshot["stage_detail"], "任务完成", "{snapshot}");
    assert_eq!(snapshot["stage"], "translating", "{snapshot}");
}

#[test]
fn an_initial_build_larger_than_one_batch_publishes_every_event_in_order() {
    // 建事件流时一批 16384 条（sync::INITIAL_CHUNK）：多出一批的历史要全部导进来、按时间排好，阶段进度取最后一条
    let fs = Fixture::new("batch-initial-chunks");
    fs.job("owner", None);
    let total = sync::INITIAL_CHUNK as i64 + 5;
    let mut conn = Connection::open(&fs.root.join("jobs.db")).unwrap();
    let tx = conn.transaction().unwrap();
    {
        let mut insert = tx
            .prepare(
                "INSERT INTO events(job_id,seq,ts,level,stage,event,message,progress_current,progress_total)
                 VALUES('owner',?1,?2,'info','translating','stage_progress','progress',?1,?3)",
            )
            .unwrap();
        let base = Utc::now() - Duration::hours(1);
        for seq in 1..=total {
            insert
                .execute(rusqlite::params![seq, (base + Duration::milliseconds(seq)).to_rfc3339(), total])
                .unwrap();
        }
    }
    tx.commit().unwrap();
    assert_eq!(fs.project("owner")["progress_current"], total);
    let feed = fs.db.load_event_feed("owner").unwrap().unwrap();
    assert_eq!(feed.high_seq, total);
    assert!(fs.fast("owner"));
}
