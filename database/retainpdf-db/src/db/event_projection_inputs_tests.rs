use super::*;
use crate::models::domain::{JobArtifacts, JobStatusKind};
use crate::models::request::CreateJobInput;
use rusqlite::params;
use serde_json::json;

struct Fixture {
    root: std::path::PathBuf,
    db: Db,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("projection-inputs-{}", fastrand::u64(..)));
        let db = Db::new(root.join("jobs.db"), root.join("data"));
        db.init().unwrap();
        Self { root, db }
    }

    fn job(&self, id: &str, child: Option<&str>, status: JobStatusKind) {
        let mut job = JobSnapshot::new(id.into(), CreateJobInput::default(), vec![]);
        job.status = status;
        job.artifacts = Some(JobArtifacts {
            ocr_job_id: child.map(str::to_string),
            ..Default::default()
        });
        self.db.save_job(&job).unwrap();
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[test]
fn batch_inputs_use_two_queries_for_a_large_page_and_only_direct_children() {
    let fs = Fixture::new();
    fs.job("template", None, JobStatusKind::Running);
    fs.job("parent'quoted", Some("child"), JobStatusKind::Running);
    fs.job("child", Some("grandchild"), JobStatusKind::Running);
    fs.job("grandchild", None, JobStatusKind::Running);
    let mut conn = fs.db.connect().unwrap();
    let tx = conn.transaction().unwrap();
    let mut ids = vec!["parent'quoted".to_owned()];
    for n in 0..1100 {
        let id = format!("job-{n}");
        tx.execute("INSERT INTO jobs(job_id, workflow, status, created_at, updated_at, command_json, request_json, log_tail_json)
            SELECT ?1, workflow, status, created_at, updated_at, command_json, request_json, log_tail_json FROM jobs WHERE job_id='template'", [&id]).unwrap();
        ids.push(id);
    }
    tx.commit().unwrap();
    ids.extend(["parent'quoted".into(), "missing".into()]);
    let before = QUERIES.with(std::cell::Cell::get);
    let inputs = fs
        .db
        .load_event_projection_inputs(&ids.iter().map(String::as_str).collect::<Vec<_>>())
        .unwrap();
    assert_eq!(QUERIES.with(std::cell::Cell::get) - before, 2);
    assert_eq!(inputs.len(), 1102);
    assert!(inputs.contains_key("child"));
    assert!(!inputs.contains_key("grandchild"));
    assert!(!inputs.contains_key("missing"));
    let before = QUERIES.with(std::cell::Cell::get);
    assert!(fs.db.load_event_projection_inputs(&[]).unwrap().is_empty());
    assert_eq!(QUERIES.with(std::cell::Cell::get), before);
}

#[test]
fn batch_inputs_match_source_versions_authority_feeds_and_effective_retention() {
    let fs = Fixture::new();
    fs.job("owner", Some("child"), JobStatusKind::Running);
    fs.job("child", None, JobStatusKind::Succeeded);
    fs.job("terminal", None, JobStatusKind::Failed);
    let conn = fs.db.connect().unwrap();
    conn.execute("INSERT INTO events(job_id,seq,ts,level,event,message) VALUES('owner',5,'2026-01-01','info','test','test')", []).unwrap();
    conn.execute(
        "UPDATE events SET message='revised' WHERE job_id='owner'",
        [],
    )
    .unwrap();
    conn.execute(
        "UPDATE event_source_versions SET retention_cutoff='2026-01-01' WHERE job_id='owner'",
        [],
    )
    .unwrap();
    conn.execute("INSERT INTO pipeline_attempts(job_id,attempt,generation,status,worker_id,created_at,updated_at) VALUES('child',1,1,'completed','test','2026-01-01','2026-01-01')", []).unwrap();
    conn.execute(
        "INSERT INTO event_feed_retention(singleton,cutoff) VALUES(1,'2026-03-01')",
        [],
    )
    .unwrap();
    conn.execute("INSERT INTO event_feeds(owner_job_id,epoch,revision,context,checkpoints_json,high_seq,retention_cutoff)
        VALUES('owner','epoch',4,'context',?1,8,'2026-02-01')", [json!({"stage_basis":[]}).to_string()]).unwrap();
    let inputs = fs
        .db
        .load_event_projection_inputs(&["owner", "terminal"])
        .unwrap();
    for (id, input) in &inputs {
        assert_eq!(input.version, fs.db.event_source_version(id).unwrap());
        assert_eq!(
            input.has_pipeline_attempt,
            fs.db.has_pipeline_attempt(id).unwrap()
        );
        assert_eq!(
            input.retention_cutoff,
            fs.db.event_source_retention_cutoff(id).unwrap()
        );
        assert_eq!(
            input.feed.as_ref().map(|f| &f.epoch),
            fs.db
                .load_event_feed(id)
                .unwrap()
                .as_ref()
                .map(|f| &f.epoch)
        );
    }
    assert_eq!(
        inputs["owner"].retention_cutoff.as_deref(),
        Some("2026-02-01")
    );
    assert_eq!(
        inputs["terminal"].retention_cutoff.as_deref(),
        Some("2026-03-01")
    );
    assert!(inputs["child"].has_pipeline_attempt);
    assert_eq!(inputs["owner"].feed.as_ref().unwrap().high_seq, 8);
    assert_eq!(inputs["owner"].feed.as_ref().unwrap().revision, 4);
}

#[test]
fn malformed_jobs_are_absent_but_corrupt_feed_metadata_aborts_the_fast_path() {
    let fs = Fixture::new();
    fs.job("owner", Some("child"), JobStatusKind::Running);
    fs.job("child", None, JobStatusKind::Running);
    let conn = fs.db.connect().unwrap();
    conn.execute(
        // 状态有 CHECK 钉着写不进坏值（v32），用对不上类型的请求造一条读不出来的任务。
        "UPDATE jobs SET request_json=?1 WHERE job_id='child'",
        params!["{\"invalid\":true}"],
    )
    .unwrap();
    let inputs = fs.db.load_event_projection_inputs(&["owner"]).unwrap();
    assert!(inputs.contains_key("owner"));
    assert!(!inputs.contains_key("child"));
    conn.execute("INSERT INTO event_feeds(owner_job_id,epoch,revision,context,checkpoints_json) VALUES('owner','epoch',1,'context','bad-json')", []).unwrap();
    assert!(fs.db.load_event_projection_inputs(&["owner"]).is_err());
}
