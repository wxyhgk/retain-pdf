//! 事件流测试用的临时库和任务目录。任务包自己的测试用它；书库的测试经 `test-fixtures` 特性用它，
//! 生产构建里没有。

use std::{fs, path::PathBuf};

use chrono::{Duration, Utc};
use rusqlite::{params, Connection};
use serde_json::{json, Value};

use super::{files, live_snapshot, live_snapshots, sync};
use retainpdf_core::models::domain::{CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind, WorkflowKind};
use retainpdf_data::db::Db;

pub struct EventFeedFixture {
    pub root: PathBuf,
    pub db: Db,
}

impl EventFeedFixture {
    pub fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!("{name}-{}", fastrand::u64(..)));
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().unwrap();
        Self { root, db }
    }

    pub fn job(&self, id: &str, child: Option<&str>) {
        self.job_with(id, child, WorkflowKind::Book);
    }

    /// OCR 子任务（流程是 ocr）：事件流只并这种子任务的事件。
    pub fn ocr_child(&self, id: &str) {
        self.job_with(id, None, WorkflowKind::Ocr);
    }

    pub fn job_with(&self, id: &str, child: Option<&str>, workflow: WorkflowKind) {
        let mut job = JobSnapshot::new(id.into(), CreateJobInput::default(), vec![]);
        job.workflow = workflow;
        job.status = JobStatusKind::Running;
        job.stage = Some("translating".into());
        let root = self.root.join("jobs").join(id);
        fs::create_dir_all(root.join("logs")).unwrap();
        job.artifacts = Some(JobArtifacts {
            job_root: Some(root.to_string_lossy().into_owned()),
            ocr_job_id: child.map(str::to_string),
            ..Default::default()
        });
        self.db.save_job(&job).unwrap();
    }

    pub fn path(&self, id: &str) -> PathBuf {
        self.root
            .join("jobs")
            .join(id)
            .join("logs/pipeline_events.jsonl")
    }

    pub fn db_progress(&self, id: &str, seq: i64) {
        Connection::open(&self.root.join("jobs.db")).unwrap().execute(
            "INSERT INTO events(job_id,seq,ts,level,stage,event,message,progress_current,progress_total)
             VALUES(?1,?2,?3,'info','translating','stage_progress','progress',?2,100)",
            params![id, seq, (Utc::now() + Duration::seconds(seq)).to_rfc3339()],
        ).unwrap();
    }

    pub fn fast(&self, id: &str) -> bool {
        let inputs = self.db.load_event_projection_inputs(&[id]).unwrap();
        sync::cached_stage_basis(&self.root, id, &inputs)
            .unwrap()
            .is_some()
    }

    pub fn project(&self, id: &str) -> Value {
        let job = self.db.get_job(id).unwrap();
        let batch = live_snapshots(&self.db, &self.root, std::slice::from_ref(&job));
        let result = serde_json::to_value(batch.get(id)).unwrap();
        let single = live_snapshot(&self.db, &self.root, &job);
        assert_eq!(
            result,
            serde_json::to_value(single).unwrap(),
            "batch/single projection parity"
        );
        result
    }
}

impl Drop for EventFeedFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

pub fn event_line(id: &str, seq: i64) -> String {
    json!({"job_id":id,"ts":(Utc::now()+Duration::seconds(seq)).to_rfc3339(),
        "level":"info","stage":"translating","event_type":"stage_progress",
        "message":format!("JSONL-{seq}"),"progress_current":seq,"progress_total":100})
    .to_string()
        + "\n"
}

/// 进程里累计读了多少字节 JSONL 事件历史（用来断言某条路径没碰历史）。
pub fn jsonl_bytes_read() -> u64 {
    files::read_bytes()
}
