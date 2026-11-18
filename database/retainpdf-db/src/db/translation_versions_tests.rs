use std::fs;
use std::path::PathBuf;

use rusqlite::params;

use crate::db::Db;
use crate::models::domain::{now_iso, JobStatusKind, UploadRecord, WorkflowKind};

struct TestDb {
    root: PathBuf,
    db: Db,
}

impl TestDb {
    /// 同一个库文件新开一个 `Db`：结构升级每个实例只跑一次。
    fn reopen(&self) -> Db {
        Db::new(self.root.join("db").join("jobs.db"), self.root.join("data"))
    }
}

impl TestDb {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!("rust-api-db-tv-{name}-{}", fastrand::u64(..)));
        let data_root = root.join("data");
        let db_path = root.join("db").join("jobs.db");
        fs::create_dir_all(&data_root).unwrap();
        fs::create_dir_all(db_path.parent().unwrap()).unwrap();
        let db = Db::new(db_path, data_root);
        db.init().unwrap();
        Self { root, db }
    }
}

impl Drop for TestDb {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn seed_document(db: &Db, document_id: &str) {
    let upload = UploadRecord {
        upload_id: format!("up-{document_id}"),
        filename: "book.pdf".into(),
        stored_path: "uploads/x/book.pdf".into(),
        bytes: 10,
        page_count: 3,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: document_id.into(),
    };
    db.save_upload(&upload).unwrap();
    db.upsert_document_from_upload(&upload).unwrap();
}

fn insert_job(db: &Db, document_id: &str, job_id: &str, workflow: WorkflowKind, created_at: &str, artifact_job_id: &str) {
    let request = serde_json::json!({"source": {"artifact_job_id": artifact_job_id}});
    db.connect()
        .unwrap()
        .execute(
            "INSERT INTO jobs (job_id, workflow, status_json, created_at, updated_at, finished_at,
                               command_json, request_json, log_tail_json, document_id)
             VALUES (?1, ?2, ?3, ?4, ?4, ?4, '[]', ?5, '[]', ?6)",
            params![
                job_id,
                serde_json::to_string(&workflow).unwrap(),
                serde_json::to_string(&JobStatusKind::Succeeded).unwrap(),
                created_at,
                request.to_string(),
                document_id,
            ],
        )
        .unwrap();
}

#[test]
fn versions_group_jobs_and_the_document_remembers_its_choice() {
    let t = TestDb::new("crud");
    seed_document(&t.db, "doc-a");
    insert_job(&t.db, "doc-a", "job-1", WorkflowKind::Book, "2026-11-01T00:00:00Z", "");
    insert_job(&t.db, "doc-a", "job-2", WorkflowKind::Book, "2026-11-01T00:00:01Z", "");

    let version = t.db.create_translation_version("doc-a", None, "translate").unwrap();
    assert!(t.db.add_job_to_translation_version(&version, "job-1").unwrap());
    assert!(t.db.add_job_to_translation_version(&version, "job-2").unwrap());
    assert!(!t.db.add_job_to_translation_version("other", "job-1").unwrap(), "a job belongs to one version");
    assert_eq!(t.db.translation_version_of_job("job-2").unwrap().as_deref(), Some(version.as_str()));
    let record = t.db.get_translation_version(&version).unwrap().unwrap();
    assert_eq!(record.job_ids, ["job-1", "job-2"]);

    assert_eq!(t.db.document_current_translation_version("doc-a").unwrap(), None, "auto by default");
    t.db.set_document_current_translation_version("doc-a", Some(&version)).unwrap();
    assert_eq!(t.db.document_current_translation_version("doc-a").unwrap().as_deref(), Some(version.as_str()));

    // 隐藏当前版本：书退回自动；列表默认不含它，自动模式也不用它的任务
    t.db.set_translation_version_hidden(&version, true).unwrap();
    assert_eq!(t.db.document_current_translation_version("doc-a").unwrap(), None);
    assert!(t.db.list_translation_versions("doc-a", false).unwrap().is_empty());
    assert_eq!(t.db.list_translation_versions("doc-a", true).unwrap().len(), 1);
    assert_eq!(t.db.hidden_translation_version_jobs("doc-a").unwrap().len(), 2);
    t.db.set_translation_version_hidden(&version, false).unwrap();
    assert!(t.db.set_translation_version_label(&version, "第一版").unwrap());
    assert_eq!(t.db.list_translation_versions("doc-a", false).unwrap()[0].label, "第一版");

    // 任务删了，版本里就没有它；一个任务都不剩的版本不列
    t.db.delete_jobs(&["job-1".to_string(), "job-2".to_string()]).unwrap();
    assert!(t.db.list_translation_versions("doc-a", true).unwrap().is_empty());
}

#[test]
fn the_migration_backfills_one_version_per_translation_job() {
    let t = TestDb::new("backfill");
    seed_document(&t.db, "doc-b");
    // 退回 v29、去掉 v30 建的东西，插入老任务，再升级一次
    {
        let conn = t.db.connect().unwrap();
        conn.execute_batch(
            "DROP TABLE translation_version_choices; DROP TABLE translation_version_jobs; DROP TABLE translation_versions;
             PRAGMA user_version = 29;",
        )
        .unwrap();
    }
    insert_job(&t.db, "doc-b", "ocr-1", WorkflowKind::Ocr, "2026-11-01T00:00:00Z", "");
    insert_job(&t.db, "doc-b", "whole", WorkflowKind::Book, "2026-11-02T00:00:00Z", "ocr-1");
    insert_job(&t.db, "doc-b", "relayout", WorkflowKind::Render, "2026-11-03T00:00:00Z", "whole");
    insert_job(&t.db, "doc-b", "redo", WorkflowKind::Book, "2026-11-04T00:00:00Z", "whole");
    let db = t.reopen();
    db.init().unwrap();

    let versions = db.list_translation_versions("doc-b", false).unwrap();
    let summary: Vec<_> = versions.iter().map(|v| (v.version_id.as_str(), v.job_ids.clone(), v.base_version_id.as_deref())).collect();
    assert_eq!(
        summary,
        vec![
            ("tv-whole", vec!["whole".to_string(), "relayout".to_string()], None),
            ("tv-redo", vec!["redo".to_string()], Some("tv-whole")),
        ],
        "OCR jobs are not versions, re-layouts join their source, a re-translation falls back to its source"
    );
    assert_eq!(versions[0].origin, "backfill");
    assert_eq!(db.document_current_translation_version("doc-b").unwrap(), None);
}
