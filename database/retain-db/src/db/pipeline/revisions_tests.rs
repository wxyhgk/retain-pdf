//! 修订登记:在读模型生效的那一行上原地推进,不新开 attempt、不碰 running attempt。

use std::fs;

use serde_json::json;

use super::{RevisedPageStatus, RevisedTranslationPage};
use crate::db::pipeline::{PipelineAttemptCursor, PipelineUnitCommit};
use crate::db::Db;
use crate::models::domain::JobSnapshot;
use crate::models::request::CreateJobInput;

struct Fixture {
    root: std::path::PathBuf,
    db: Db,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "retain-pipeline-revision-{name}-{}-{}",
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

    fn attempt_column(&self, attempt: u32, column: &str) -> String {
        let conn = self.db.connect().expect("connect");
        conn.query_row(
            &format!(
                "SELECT CAST({column} AS TEXT) FROM pipeline_attempts WHERE job_id='job-1' AND attempt=?1"
            ),
            [attempt],
            |row| row.get(0),
        )
        .expect("attempt column")
    }

    fn attempt_generation(&self, attempt: u32) -> u64 {
        self.attempt_column(attempt, "generation")
            .parse()
            .expect("generation")
    }

    fn commit_events(&self) -> Vec<serde_json::Value> {
        self.db
            .list_translation_commit_events_after("job-1", 0, 100)
            .expect("events")
            .into_iter()
            .map(|record| record.payload)
            .collect()
    }

    fn page(&self, page_index: u32) -> crate::db::pipeline::PipelineUnitRecord {
        self.db
            .latest_pipeline_unit_for_page("job-1", "translate", page_index)
            .expect("query")
            .expect("row")
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn unit(order: u64, hash_digit: char) -> PipelineUnitCommit {
    PipelineUnitCommit {
        unit_key: format!("page:{order}"),
        unit_order: order,
        page_index: Some(order as u32),
        page_hash: hash_digit.to_string().repeat(64),
        producer_generation: Some(order + 10),
        payload: json!({"phase": "translating"}),
    }
}

fn revised(page_index: u32, hash_digit: char, producer_generation: u64) -> RevisedTranslationPage {
    RevisedTranslationPage {
        page_index,
        page_hash: hash_digit.to_string().repeat(64),
        producer_generation,
        unit_key: format!("page:{page_index}"),
        unit_order: page_index as u64,
        changed_item_ids: vec![format!("p{:03}-b001", page_index + 1)],
        revision_ids: vec!["rev-1".to_string()],
    }
}

/// 两页已翻译(producer_generation 10、11)、attempt 以 `status` 收尾的任务。
fn finished_translation(fixture: &Fixture, status: &str) -> u64 {
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("claim");
    let checkpoint = fixture
        .db
        .commit_pipeline_units(&cursor, &[unit(0, 'a')])
        .expect("commit page 0");
    let cursor = PipelineAttemptCursor {
        generation: checkpoint.generation,
        ..cursor
    };
    fixture
        .db
        .commit_pipeline_units(&cursor, &[unit(1, 'b')])
        .expect("commit page 1");
    assert!(fixture
        .db
        .finish_latest_pipeline_attempt("job-1", status)
        .expect("finish"));
    fixture.attempt_generation(1)
}

#[test]
fn revision_advances_the_reader_visible_row_of_a_terminal_attempt() {
    let fixture = Fixture::new("publish");
    let before = finished_translation(&fixture, "failed");
    let events_before = fixture.commit_events().len();

    let published = fixture
        .db
        .publish_translation_revision("job-1", &[revised(1, 'c', 20)])
        .expect("publish");

    assert_eq!(published[0].status, RevisedPageStatus::Published);
    assert_eq!(published[0].attempt, Some(1));
    assert_eq!(published[0].generation, Some(before + 1));
    let row = fixture.page(1);
    assert_eq!(row.page_hash, "c".repeat(64));
    assert_eq!(row.producer_generation, Some(20));
    assert_eq!(row.generation, before + 1);
    assert_eq!(row.unit_key, "page:1");
    assert_eq!(row.payload["source"], "translation_revision");
    assert_eq!(row.payload["previous_page_hash"], "b".repeat(64));
    // 没被修订的页不动;attempt 的终态不动,只推进 generation。
    assert_eq!(fixture.page(0).page_hash, "a".repeat(64));
    assert_eq!(fixture.attempt_column(1, "status"), "failed");
    assert_eq!(fixture.attempt_generation(1), before + 1);
    assert!(!fixture
        .db
        .has_running_pipeline_attempt("job-1")
        .expect("running"));

    let events = fixture.commit_events();
    assert_eq!(events.len(), events_before + 1);
    let event = events.last().expect("event");
    assert_eq!(event["page_index"], 1);
    assert_eq!(event["page_hash"], "c".repeat(64));
    assert_eq!(event["attempt"], 1);
    assert_eq!(event["generation"], before + 1);
    assert_eq!(event["unit_order"], 1);
    assert_eq!(event["changed_item_ids"], json!(["p002-b001"]));
    assert_eq!(event["source"], "translation_revision");
    assert_eq!(event["revision_ids"], json!(["rev-1"]));
}

#[test]
fn republishing_is_idempotent_and_older_state_never_overwrites_newer() {
    let fixture = Fixture::new("idempotent");
    finished_translation(&fixture, "succeeded");
    fixture
        .db
        .publish_translation_revision("job-1", &[revised(0, 'c', 20)])
        .expect("first");
    let events = fixture.commit_events().len();

    let again = fixture
        .db
        .publish_translation_revision("job-1", &[revised(0, 'c', 20)])
        .expect("again");
    assert_eq!(again[0].status, RevisedPageStatus::Current);
    assert_eq!(fixture.commit_events().len(), events);

    // 两次修订的登记交错:21 先登记,迟到的 20 不能把它盖回去。
    fixture
        .db
        .publish_translation_revision("job-1", &[revised(0, 'd', 21)])
        .expect("newer");
    let generation = fixture.attempt_generation(1);
    let stale = fixture
        .db
        .publish_translation_revision("job-1", &[revised(0, 'c', 20)])
        .expect("stale");
    assert_eq!(stale[0].status, RevisedPageStatus::Superseded);
    assert_eq!(fixture.page(0).page_hash, "d".repeat(64));
    assert_eq!(fixture.attempt_generation(1), generation);
    assert_eq!(fixture.commit_events().len(), events + 1);
}

#[test]
fn pages_of_one_revision_share_one_generation() {
    let fixture = Fixture::new("multi-page");
    let before = finished_translation(&fixture, "succeeded");

    let published = fixture
        .db
        .publish_translation_revision("job-1", &[revised(0, 'c', 20), revised(1, 'd', 20)])
        .expect("publish");

    assert!(published
        .iter()
        .all(|page| page.status == RevisedPageStatus::Published
            && page.generation == Some(before + 1)));
    assert_eq!(fixture.attempt_generation(1), before + 1);
}

#[test]
fn rows_owned_by_a_running_attempt_are_left_to_its_worker() {
    let fixture = Fixture::new("running");
    let cursor = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
        .expect("claim");
    let checkpoint = fixture
        .db
        .commit_pipeline_units(&cursor, &[unit(0, 'a')])
        .expect("commit");

    let published = fixture
        .db
        .publish_translation_revision("job-1", &[revised(0, 'c', 20), revised(3, 'd', 20)])
        .expect("publish");

    assert_eq!(published[0].status, RevisedPageStatus::RunningAttempt);
    assert_eq!(published[1].status, RevisedPageStatus::RunningAttempt);
    // worker 的 fencing token 没被动过,它还能继续提交。
    assert_eq!(fixture.attempt_generation(1), checkpoint.generation);
    fixture
        .db
        .commit_pipeline_units(
            &PipelineAttemptCursor {
                generation: checkpoint.generation,
                ..cursor
            },
            &[unit(1, 'b')],
        )
        .expect("worker still owns the attempt");
}

#[test]
fn a_later_render_attempt_neither_hides_nor_is_fenced_by_the_revision() {
    let fixture = Fixture::new("rerender");
    finished_translation(&fixture, "succeeded");
    // 原地重渲染开了 attempt 2:只有 render 阶段,正在跑。
    let render = fixture
        .db
        .acquire_pipeline_attempt("job-1", "worker-r", "render", 3)
        .expect("render attempt");
    assert_eq!(render.attempt, 2);

    let published = fixture
        .db
        .publish_translation_revision("job-1", &[revised(1, 'c', 20)])
        .expect("publish");

    assert_eq!(published[0].status, RevisedPageStatus::Published);
    assert_eq!(published[0].attempt, Some(1));
    assert_eq!(fixture.attempt_generation(2), render.generation);
    assert_eq!(fixture.page(1).page_hash, "c".repeat(64));
}

#[test]
fn unregistered_page_is_attached_to_the_latest_translate_attempt() {
    let fixture = Fixture::new("insert");
    finished_translation(&fixture, "canceled");

    let published = fixture
        .db
        .publish_translation_revision("job-1", &[revised(5, 'e', 20)])
        .expect("publish");

    assert_eq!(published[0].status, RevisedPageStatus::Published);
    let row = fixture.page(5);
    assert_eq!(row.unit_key, "page:5");
    assert_eq!(row.unit_order, 5);
    assert_eq!(row.page_hash, "e".repeat(64));
}

#[test]
fn taken_unit_identity_falls_back_to_a_revision_key_after_the_last_unit() {
    let fixture = Fixture::new("identity");
    finished_translation(&fixture, "succeeded");
    // 第 7 页从没登记过,但 checkpoint 给的身份 page:1 已经属于第 2 页。
    let mut page = revised(6, 'e', 20);
    page.unit_key = "page:1".to_string();
    page.unit_order = 1;

    let published = fixture
        .db
        .publish_translation_revision("job-1", &[page])
        .expect("publish");

    assert_eq!(published[0].status, RevisedPageStatus::Published);
    let row = fixture.page(6);
    assert_eq!(row.unit_key, "revision-page:6");
    assert_eq!(row.unit_order, 2);
    assert_eq!(fixture.page(1).page_hash, "b".repeat(64));
}

#[test]
fn job_without_durable_translation_is_reported_not_invented() {
    let fixture = Fixture::new("legacy");
    let published = fixture
        .db
        .publish_translation_revision("job-1", &[revised(0, 'c', 20)])
        .expect("publish");
    assert_eq!(published[0].status, RevisedPageStatus::NoDurableAttempt);
    assert!(!fixture.db.has_pipeline_attempt("job-1").expect("attempts"));
}

#[test]
fn invalid_batch_is_rejected_before_touching_state() {
    let fixture = Fixture::new("invalid");
    let generation = finished_translation(&fixture, "succeeded");
    let mut bad = revised(0, 'c', 20);
    bad.page_hash = "not-a-hash".to_string();
    assert!(fixture
        .db
        .publish_translation_revision("job-1", &[revised(1, 'd', 20), bad])
        .is_err());
    assert!(fixture
        .db
        .publish_translation_revision("job-1", &[revised(1, 'd', 20), revised(1, 'e', 20)])
        .is_err());
    assert_eq!(fixture.attempt_generation(1), generation);
    assert_eq!(fixture.page(1).page_hash, "b".repeat(64));
}
