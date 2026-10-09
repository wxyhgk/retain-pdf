use std::path::PathBuf;
use std::sync::{Arc, Barrier};

use rusqlite::params;
use serde_json::json;

use super::*;
use crate::models::domain::{now_iso, JobSnapshot, JobStatusKind};
use crate::models::request::CreateJobInput;

struct Fixture {
    root: PathBuf,
    db: Db,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("retain-event-feed-{}", fastrand::u64(..)));
        let db = Db::new(root.join("db.sqlite"), root.join("data"));
        db.init().unwrap();
        Self { root, db }
    }

    fn job(&self, id: &str, status: JobStatusKind) {
        let mut job = JobSnapshot::new(id.to_owned(), CreateJobInput::default(), vec![]);
        job.status = status;
        job.sync_runtime_state();
        self.db.save_job(&job).unwrap();
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn insert(conn: &Connection, job: &str, seq: i64, ts: &str) {
    conn.execute(
        "INSERT INTO events(job_id, seq, ts, level, event, message)
         VALUES(?1, ?2, ?3, 'info', 'test', 'test')",
        params![job, seq, ts],
    )
    .unwrap();
}

fn item(key: &str, ts: &str) -> NewFeedItem {
    NewFeedItem {
        source_key: key.to_owned(),
        event_id: format!("event-{key}"),
        ts: ts.to_owned(),
        payload: json!({"message": key}),
    }
}

#[test]
fn event_uid_is_backfilled_for_legacy_schema_and_migrations_are_idempotent() {
    let fs = Fixture::new();
    fs.job("legacy", JobStatusKind::Running);
    let conn = fs.db.connect().unwrap();
    insert(&conn, "legacy", 1, &now_iso());
    // v17 的同步记账:触发器挂在业务表上,不会随同步表一起删掉,逐个撤。
    let sync_triggers: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_dirty_%'")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert!(!sync_triggers.is_empty());
    for trigger in sync_triggers {
        conn.execute_batch(&format!("DROP TRIGGER {trigger};")).unwrap();
    }
    conn.execute_batch(
        "DROP TABLE sync_state;
         DROP TABLE sync_dirty;
         DROP TABLE sync_apply_guard;
         DROP TABLE sync_entities;
         DROP TABLE sync_entity_files;
         DROP TABLE sync_cursors;
         DROP TABLE sync_pending;
         DROP TABLE sync_file_cache;
         DROP TABLE sync_blobs;
         DROP TABLE sync_own_records;
         DROP TABLE sync_retired_packs;",
    )
    .unwrap();
    conn.execute_batch(
        "DROP TRIGGER events_assign_uid;
         DROP TRIGGER events_immutable_uid;
         DROP TRIGGER events_source_insert;
         DROP TRIGGER events_source_update;
         DROP TRIGGER events_source_delete;
         DROP INDEX idx_events_uid;
         DROP INDEX idx_jobs_document_updated;
         DROP INDEX idx_events_translation_commit;
         DROP TABLE event_feed_items;
         DROP TABLE event_feeds;
         DROP TABLE event_feed_retention;
         DROP TABLE event_source_versions;
         ALTER TABLE events DROP COLUMN event_uid;
         ALTER TABLE jobs DROP COLUMN document_id;
         -- 这里回退到 v13，所以 v14 之后的每一条迁移都会重跑一遍。SQLite 没有
         -- ADD COLUMN IF NOT EXISTS，凡是被重跑的加列迁移，都要在这里先撤掉，
         -- 否则第二次执行会以「列已存在」失败。新增迁移时记得跟上这一段。
         ALTER TABLE ai_messages DROP COLUMN finish_reason;
         PRAGMA user_version = 13;",
    )
    .unwrap();
    drop(conn);
    let reopened = Db::new(fs.db.path.clone(), fs.db.data_root.clone());
    reopened.init().unwrap();
    let source = reopened
        .list_event_source_after("legacy", 0, 1, 10)
        .unwrap();
    assert_eq!(source.len(), 1);
    assert_eq!(source[0].event_uid.len(), 32);
    let again = Db::new(fs.db.path.clone(), fs.db.data_root.clone());
    again.init().unwrap();
    assert_eq!(
        again.list_event_source_after("legacy", 0, 1, 10).unwrap()[0].event_uid,
        source[0].event_uid
    );
    assert_eq!(again.event_source_version("legacy").unwrap().high_seq, 1);
    let version: i64 = again
        .connect()
        .unwrap()
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap();
    assert_eq!(version, super::super::schema::versioned_migration_count());
}

#[test]
fn direct_writers_get_immutable_uids_and_mutations_advance_source_revision() {
    let fs = Fixture::new();
    fs.job("source", JobStatusKind::Running);
    let conn = fs.db.connect().unwrap();
    insert(&conn, "source", 1, &now_iso());
    let original = fs
        .db
        .list_event_source_after("source", 0, 1, 10)
        .unwrap()
        .remove(0);
    assert_eq!(original.event_uid.len(), 32);
    assert_eq!(
        fs.db.event_source_version("source").unwrap().revision,
        0,
        "the UID assignment trigger is not a source-content mutation"
    );
    assert!(conn
        .execute("UPDATE events SET event_uid = 'replacement'", [])
        .is_err());
    conn.execute("UPDATE events SET message = 'updated'", [])
        .unwrap();
    assert_eq!(fs.db.event_source_version("source").unwrap().revision, 1);
    conn.execute("DELETE FROM events WHERE job_id = 'source'", [])
        .unwrap();
    assert_eq!(fs.db.event_source_version("source").unwrap().revision, 2);
    insert(&conn, "source", 1, &now_iso());
    let reused = fs
        .db
        .list_event_source_after("source", 0, 1, 10)
        .unwrap()
        .remove(0);
    assert_ne!(reused.event_uid, original.event_uid);
    assert_eq!(fs.db.event_source_version("source").unwrap().revision, 3);
}

#[test]
fn source_pages_cross_ten_thousand_rows_and_keep_a_fixed_upper_bound() {
    let fs = Fixture::new();
    fs.job("source", JobStatusKind::Running);
    let mut conn = fs.db.connect().unwrap();
    let tx = conn.transaction().unwrap();
    let ts = now_iso();
    for seq in 1..=10_021 {
        insert(&tx, "source", seq, &ts);
    }
    tx.commit().unwrap();
    let captured = fs.db.event_source_version("source").unwrap();
    insert(&conn, "source", 10_022, &ts);
    let mut after = 0;
    let mut total = 0;
    loop {
        let page = fs
            .db
            .list_event_source_after("source", after, captured.high_seq, 700)
            .unwrap();
        if page.is_empty() {
            break;
        }
        after = page.last().unwrap().event.seq;
        total += page.len();
    }
    assert_eq!(total, 10_021);
    assert_eq!(after, captured.high_seq);
    assert_eq!(
        fs.db.event_source_version("source").unwrap().revision,
        captured.revision
    );
}

#[test]
fn commit_compare_and_swap_deduplicates_and_keeps_owner_checkpoints_isolated() {
    let fs = Fixture::new();
    fs.job("parent", JobStatusKind::Running);
    fs.job("child", JobStatusKind::Running);
    let ts = now_iso();
    let events = vec![item("one", &ts), item("one", &ts), item("two", &ts)];
    assert!(fs
        .db
        .commit_event_feed(
            "parent",
            None,
            "epoch-1",
            "context",
            &json!({"offset": 3}),
            &events,
            false,
            &[]
        )
        .unwrap());
    let feed = fs.db.load_event_feed("parent").unwrap().unwrap();
    assert_eq!(feed.high_seq, 2);
    assert!(!fs
        .db
        .commit_event_feed("parent", None, "stale", "wrong", &json!({}), &[], true, &[])
        .unwrap());
    assert_eq!(
        fs.db
            .load_event_feed("parent")
            .unwrap()
            .unwrap()
            .checkpoints,
        json!({"offset": 3})
    );
    assert!(fs
        .db
        .commit_event_feed(
            "child",
            None,
            "child-1",
            "context",
            &json!({"offset": 1}),
            &events[..1],
            false,
            &[]
        )
        .unwrap());
    assert_eq!(fs.db.load_event_feed("child").unwrap().unwrap().high_seq, 1);
    let page = fs
        .db
        .read_event_feed_page("parent", "epoch-1", 0, feed.high_seq, 10)
        .unwrap();
    assert_eq!(
        page.iter().map(|item| item.seq).collect::<Vec<_>>(),
        vec![1, 2]
    );
    assert_eq!(page[0].event_id, "event-one");
    let reopened = Db::new(fs.db.path.clone(), fs.db.data_root.clone());
    assert_eq!(
        reopened
            .load_event_feed("parent")
            .unwrap()
            .unwrap()
            .checkpoints,
        feed.checkpoints
    );
    assert_eq!(
        reopened
            .read_event_feed_page("parent", "epoch-1", 0, 2, 10)
            .unwrap()[0]
            .event_id,
        page[0].event_id
    );
}

#[test]
fn source_mutation_aborts_feed_publication_but_new_appends_do_not() {
    let fs = Fixture::new();
    fs.job("source", JobStatusKind::Running);
    let conn = fs.db.connect().unwrap();
    let ts = now_iso();
    insert(&conn, "source", 1, &ts);
    let captured = fs.db.event_source_version("source").unwrap();
    insert(&conn, "source", 2, &ts);
    assert!(fs
        .db
        .commit_event_feed(
            "source",
            None,
            "epoch",
            "ctx",
            &json!({"after": 1}),
            &[item("one", &ts)],
            false,
            std::slice::from_ref(&captured)
        )
        .unwrap());
    conn.execute("UPDATE events SET message = 'changed' WHERE seq = 1", [])
        .unwrap();
    assert!(!fs
        .db
        .commit_event_feed(
            "source",
            Some(1),
            "epoch",
            "ctx",
            &json!({"after": 2}),
            &[item("two", &ts)],
            false,
            &[captured]
        )
        .unwrap());
    let feed = fs.db.load_event_feed("source").unwrap().unwrap();
    assert_eq!(feed.high_seq, 1);
    assert_eq!(feed.checkpoints, json!({"after": 1}));
}

#[test]
fn concurrent_publishers_have_exactly_one_winner() {
    let fs = Fixture::new();
    fs.job("owner", JobStatusKind::Running);
    let barrier = Arc::new(Barrier::new(2));
    let handles: Vec<_> = (0..2)
        .map(|_| {
            let db = fs.db.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                db.commit_event_feed(
                    "owner",
                    None,
                    "epoch",
                    "ctx",
                    &json!({}),
                    &[item("one", &now_iso())],
                    false,
                    &[],
                )
                .unwrap()
            })
        })
        .collect();
    let successes = handles
        .into_iter()
        .map(|handle| usize::from(handle.join().unwrap()))
        .sum::<usize>();
    assert_eq!(successes, 1);
    assert_eq!(fs.db.load_event_feed("owner").unwrap().unwrap().high_seq, 1);
}

#[test]
fn bootstrap_is_sorted_once_at_atomic_publication_and_late_rows_append() {
    let fs = Fixture::new();
    fs.job("owner", JobStatusKind::Running);
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            None,
            "epoch",
            "ctx",
            &json!({"initializing": true}),
            &[item("newer", "2026-09-02")],
            false,
            &[]
        )
        .unwrap());
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            Some(1),
            "epoch",
            "ctx",
            &json!({"initializing": true}),
            &[item("older", "2026-09-01")],
            false,
            &[]
        )
        .unwrap());
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            Some(2),
            "epoch",
            "ctx",
            &json!({"initializing": false}),
            &[],
            false,
            &[]
        )
        .unwrap());
    let page = fs
        .db
        .read_event_feed_page("owner", "epoch", 0, 2, 10)
        .unwrap();
    assert_eq!(
        page.iter()
            .map(|item| item.event_id.as_str())
            .collect::<Vec<_>>(),
        vec!["event-older", "event-newer"]
    );
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            Some(3),
            "epoch",
            "ctx",
            &json!({"initializing": false}),
            &[item("late", "2026-08-31")],
            false,
            &[]
        )
        .unwrap());
    let page = fs
        .db
        .read_event_feed_page("owner", "epoch", 2, 3, 10)
        .unwrap();
    assert_eq!(page[0].event_id, "event-late");
    assert_eq!(page[0].seq, 3);
}

#[test]
fn retention_expires_cursors_keeps_watermarks_and_cannot_restore_expired_history() {
    let fs = Fixture::new();
    fs.job("done", JobStatusKind::Succeeded);
    fs.job("lazy", JobStatusKind::Succeeded);
    fs.job("running", JobStatusKind::Running);
    let recent = now_iso();
    let old = "2000-01-01T00:00:00Z";
    let conn = fs.db.connect().unwrap();
    insert(&conn, "done", 1, old);
    insert(&conn, "done", 2, &recent);
    let events = vec![
        item("old", old),
        item("recent", &recent),
        item("late-old", old),
    ];
    for owner in ["done", "running"] {
        assert!(fs
            .db
            .commit_event_feed(
                owner,
                None,
                "epoch",
                "ctx",
                &json!({"after": 3}),
                &events,
                false,
                &[]
            )
            .unwrap());
    }
    assert_eq!(fs.db.cleanup_expired_events(0).unwrap(), 0);
    assert_eq!(
        fs.db.load_event_feed("done").unwrap().unwrap().epoch,
        "epoch"
    );
    assert_eq!(fs.db.cleanup_expired_events(30).unwrap(), 1);
    let feed = fs.db.load_event_feed("done").unwrap().unwrap();
    assert_ne!(feed.epoch, "epoch");
    assert_eq!(feed.high_seq, 3);
    assert_eq!(feed.checkpoints, json!({"after": 3}));
    assert!(feed.retention_cutoff.is_some());
    assert!(fs
        .db
        .read_event_feed_page("done", "epoch", 0, 3, 10)
        .is_err());
    let tail = fs
        .db
        .read_event_feed_tail("done", &feed.epoch, feed.high_seq, 1)
        .unwrap();
    assert_eq!(tail[0].seq, 2);
    assert_eq!(
        fs.db.load_event_feed("running").unwrap().unwrap().epoch,
        "epoch"
    );
    assert!(fs
        .db
        .commit_event_feed(
            "done",
            Some(feed.revision),
            "rebuilt",
            "ctx",
            &json!({}),
            &events,
            true,
            &[]
        )
        .unwrap());
    assert_eq!(fs.db.load_event_feed("done").unwrap().unwrap().high_seq, 1);
    assert!(fs
        .db
        .commit_event_feed(
            "lazy",
            None,
            "lazy-epoch",
            "ctx",
            &json!({}),
            &events,
            false,
            &[]
        )
        .unwrap());
    assert_eq!(fs.db.load_event_feed("lazy").unwrap().unwrap().high_seq, 1);
    conn.execute("DELETE FROM jobs WHERE job_id = 'done'", [])
        .unwrap();
    assert!(fs.db.load_event_feed("done").unwrap().is_none());
    let remaining: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM event_feed_items WHERE owner_job_id = 'done'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 0);
}

#[test]
fn new_indexes_match_document_history_and_translation_commit_reads() {
    let fs = Fixture::new();
    let conn = fs.db.connect().unwrap();
    let document_plan: String = conn
        .query_row(
            "EXPLAIN QUERY PLAN SELECT job_id FROM jobs WHERE document_id = 'doc'
         ORDER BY updated_at DESC, job_id DESC LIMIT 50",
            [],
            |row| row.get(3),
        )
        .unwrap();
    assert!(
        document_plan.contains("idx_jobs_document_updated"),
        "{document_plan}"
    );
    let event_plan: String = conn
        .query_row(
            "EXPLAIN QUERY PLAN SELECT seq, payload_json FROM events
         WHERE job_id = 'job' AND seq > 10 AND event = 'pipeline_unit_committed'
         AND stage = 'translate' ORDER BY seq ASC LIMIT 50",
            [],
            |row| row.get(3),
        )
        .unwrap();
    assert!(
        event_plan.contains("idx_events_translation_commit"),
        "{event_plan}"
    );
}

#[test]
fn bootstrap_source_order_breaks_timestamp_ties_and_tail_respects_captured_upper_bound() {
    let fs = Fixture::new();
    fs.job("owner", JobStatusKind::Running);
    let ts = now_iso();
    let mut first = item("z-first", &ts);
    first.payload["raw"] = json!({"source_seq": 1});
    let mut second = item("a-second", &ts);
    second.payload["raw"] = json!({"source_seq": 2});
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            None,
            "epoch",
            "ctx",
            &json!({"initializing": true}),
            &[second, first],
            false,
            &[]
        )
        .unwrap());
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            Some(1),
            "epoch",
            "ctx",
            &json!({"initializing": false}),
            &[],
            false,
            &[]
        )
        .unwrap());
    let initial = fs
        .db
        .read_event_feed_page("owner", "epoch", 0, 2, 10)
        .unwrap();
    assert_eq!(initial[0].event_id, "event-z-first");
    assert_eq!(initial[1].event_id, "event-a-second");
    let captured = fs.db.load_event_feed("owner").unwrap().unwrap();
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            Some(2),
            "epoch",
            "ctx",
            &json!({"initializing": false}),
            &[item("third", &ts)],
            false,
            &[]
        )
        .unwrap());
    let tail = fs
        .db
        .read_event_feed_tail("owner", "epoch", captured.high_seq, 1)
        .unwrap();
    assert_eq!(tail[0].event_id, "event-a-second");
}

#[test]
fn failed_reset_publication_rolls_back_items_epoch_and_checkpoints() {
    let fs = Fixture::new();
    fs.job("owner", JobStatusKind::Running);
    let ts = now_iso();
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            None,
            "original",
            "ctx",
            &json!({"after": 1}),
            &[item("original", &ts)],
            false,
            &[]
        )
        .unwrap());
    let conn = fs.db.connect().unwrap();
    conn.execute_batch(
        "CREATE TRIGGER inject_feed_failure BEFORE INSERT ON event_feed_items
         WHEN NEW.source_key = 'fail'
         BEGIN SELECT RAISE(ABORT, 'injected publication failure'); END;",
    )
    .unwrap();
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            Some(1),
            "reset",
            "new-context",
            &json!({"after": 3}),
            &[item("new", &ts), item("fail", &ts)],
            true,
            &[]
        )
        .is_err());
    let feed = fs.db.load_event_feed("owner").unwrap().unwrap();
    assert_eq!(feed.epoch, "original");
    assert_eq!(feed.revision, 1);
    assert_eq!(feed.context, "ctx");
    assert_eq!(feed.checkpoints, json!({"after": 1}));
    assert_eq!(feed.high_seq, 1);
    let page = fs
        .db
        .read_event_feed_page("owner", "original", 0, 1, 10)
        .unwrap();
    assert_eq!(page[0].event_id, "event-original");
}

#[test]
fn source_cutoff_is_available_before_first_feed_and_survives_child_rerender() {
    let fs = Fixture::new();
    fs.job("parent", JobStatusKind::Running);
    fs.job("child", JobStatusKind::Succeeded);
    fs.job("newly-terminal", JobStatusKind::Running);
    assert!(fs
        .db
        .event_source_retention_cutoff("child")
        .unwrap()
        .is_none());
    fs.db.cleanup_expired_events(30).unwrap();

    let cutoff = fs
        .db
        .event_source_retention_cutoff("child")
        .unwrap()
        .unwrap();
    assert!(
        fs.db.load_event_feed("child").unwrap().is_none(),
        "cutoff must not require a child feed"
    );
    assert!(
        fs.db
            .event_source_retention_cutoff("parent")
            .unwrap()
            .is_none(),
        "active parents keep their own history"
    );
    assert!(
        fs.db.event_source_version("child").unwrap().revision > 0,
        "cleanup invalidates an in-flight child source import"
    );
    fs.job("child", JobStatusKind::Running);
    assert_eq!(
        fs.db.event_source_retention_cutoff("child").unwrap(),
        Some(cutoff.clone()),
        "a rerender without a child feed still preserves prior cleanup"
    );

    fs.job("newly-terminal", JobStatusKind::Succeeded);
    assert_eq!(
        fs.db
            .event_source_retention_cutoff("newly-terminal")
            .unwrap(),
        Some(cutoff.clone()),
        "new terminal sources inherit policy before first import"
    );
    assert!(fs
        .db
        .commit_event_feed(
            "newly-terminal",
            None,
            "epoch",
            "ctx",
            &json!({}),
            &[item("expired", "2000-01-01T00:00:00Z")],
            false,
            &[]
        )
        .unwrap());
    assert_eq!(
        fs.db
            .load_event_feed("newly-terminal")
            .unwrap()
            .unwrap()
            .high_seq,
        0
    );
    fs.job("newly-terminal", JobStatusKind::Running);
    assert_eq!(
        fs.db
            .event_source_retention_cutoff("newly-terminal")
            .unwrap(),
        Some(cutoff),
        "existing feed cleanup survives a later running state"
    );
    assert!(fs
        .db
        .event_source_retention_cutoff("missing")
        .unwrap()
        .is_none());
}

#[test]
fn initial_order_visitor_matches_publication_and_requires_unpublished_epoch() {
    let fs = Fixture::new();
    fs.job("owner", JobStatusKind::Running);
    let ts = now_iso();
    let mut first = item("z-first", &ts);
    first.payload["raw"] = json!({"source_seq": 1});
    let mut second = item("a-second", &ts);
    second.payload["raw"] = json!({"source_seq": 2});
    let mut third = item("b-third", &ts);
    third.payload["raw"] = json!({"source_seq": 2});
    let older = item("older", "2000-01-01T00:00:00Z");
    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            None,
            "epoch",
            "ctx",
            &json!({"initializing": true}),
            &[third, second, first, older],
            false,
            &[]
        )
        .unwrap());

    let mut visited = Vec::new();
    fs.db
        .visit_event_feed_initial_order("owner", "epoch", |item| {
            visited.push((item.seq, item.event_id, item.payload));
            Ok(())
        })
        .unwrap();
    assert_eq!(
        visited
            .iter()
            .map(|(_, id, _)| id.as_str())
            .collect::<Vec<_>>(),
        vec![
            "event-older",
            "event-z-first",
            "event-a-second",
            "event-b-third"
        ]
    );
    let mut failed_calls = 0;
    let error = fs
        .db
        .visit_event_feed_initial_order("owner", "epoch", |_| {
            failed_calls += 1;
            anyhow::bail!("stop visitor")
        })
        .unwrap_err();
    assert!(error.to_string().contains("stop visitor"));
    assert_eq!(failed_calls, 1, "a visitor failure stops further delivery");
    assert!(fs
        .db
        .visit_event_feed_initial_order("owner", "wrong-epoch", |_| panic!(
            "stale epoch must not invoke visitor"
        ))
        .is_err());

    assert!(fs
        .db
        .commit_event_feed(
            "owner",
            Some(1),
            "epoch",
            "ctx",
            &json!({"initializing": false}),
            &[],
            false,
            &[]
        )
        .unwrap());
    let published = fs
        .db
        .read_event_feed_page("owner", "epoch", 0, 4, 10)
        .unwrap();
    assert_eq!(
        visited,
        published
            .into_iter()
            .map(|item| (item.seq, item.event_id, item.payload))
            .collect::<Vec<_>>()
    );
    assert!(fs
        .db
        .visit_event_feed_initial_order("owner", "epoch", |_| panic!(
            "published feed must not invoke visitor"
        ))
        .is_err());
}
