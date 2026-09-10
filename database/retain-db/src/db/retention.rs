use anyhow::Result;
use chrono::{Duration as ChronoDuration, SecondsFormat, Utc};
use rusqlite::params;

use crate::models::domain::{JobStatusKind, UploadRecord};
use crate::storage_paths::resolve_data_path;

use super::Db;

impl Db {
    /// Deletes rows from `events` older than `retention_days` whose owning
    /// job has already reached a terminal state (succeeded / failed /
    /// canceled). Events belonging to jobs that are still `queued` or
    /// `running` are never touched, no matter how old, since deleting
    /// history for an in-flight job would break diagnostics for it.
    ///
    /// `retention_days == 0` disables cleanup entirely and is a no-op.
    ///
    /// Returns the number of deleted rows.
    pub fn cleanup_expired_events(&self, retention_days: u64) -> Result<usize> {
        if retention_days == 0 {
            return Ok(0);
        }
        let cutoff = cutoff_iso(ChronoDuration::days(retention_days as i64));
        let succeeded = serde_json::to_string(&JobStatusKind::Succeeded)?;
        let failed = serde_json::to_string(&JobStatusKind::Failed)?;
        let canceled = serde_json::to_string(&JobStatusKind::Canceled)?;
        let conn = self.connect()?;
        let deleted = conn.execute(
            r#"
            DELETE FROM events
            WHERE ts < ?1
              AND job_id IN (
                  SELECT job_id FROM jobs WHERE status_json IN (?2, ?3, ?4)
              )
            "#,
            params![cutoff, succeeded, failed, canceled],
        )?;
        Ok(deleted)
    }

    /// Deletes rows from `uploads` older than `retention_hours` that no row
    /// in `jobs` references AND that back no `documents` row. Returns the
    /// deleted records with `stored_path` resolved to an absolute path, so the
    /// caller can also remove the on-disk `uploads_dir/<upload_id>/` directory.
    ///
    /// The `documents` guard is essential: an "ingest-only" library document
    /// (uploaded but never translated) is referenced by a document via
    /// `content_hash` yet by no job. Without this guard, retention would GC its
    /// source PDF after `retention_hours`, orphaning the document row into a
    /// broken "zombie" library card.
    ///
    /// `retention_hours == 0` disables cleanup entirely and is a no-op.
    pub fn cleanup_orphaned_uploads(&self, retention_hours: u64) -> Result<Vec<UploadRecord>> {
        if retention_hours == 0 {
            return Ok(Vec::new());
        }
        let cutoff = cutoff_iso(ChronoDuration::hours(retention_hours as i64));
        let conn = self.connect()?;
        let orphans: Vec<UploadRecord> = {
            let mut stmt = conn.prepare(
                r#"
                SELECT upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode, content_hash
                FROM uploads
                WHERE uploaded_at < ?1
                  AND upload_id NOT IN (
                      SELECT upload_id FROM jobs WHERE upload_id IS NOT NULL
                  )
                  AND (content_hash = '' OR content_hash NOT IN (
                      SELECT document_id FROM documents
                  ))
                "#,
            )?;
            let rows = stmt.query_map(params![cutoff], |row| {
                Ok(UploadRecord {
                    upload_id: row.get(0)?,
                    filename: row.get(1)?,
                    stored_path: row.get(2)?,
                    bytes: row.get::<_, i64>(3)? as u64,
                    page_count: row.get::<_, i64>(4)? as u32,
                    uploaded_at: row.get(5)?,
                    developer_mode: row.get::<_, i64>(6)? != 0,
                    content_hash: row.get(7)?,
                })
            })?;
            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            items
        };
        for upload in &orphans {
            conn.execute(
                "DELETE FROM uploads WHERE upload_id = ?1",
                params![upload.upload_id],
            )?;
        }
        let resolved = orphans
            .into_iter()
            .map(|upload| {
                let stored_path = resolve_data_path(&self.data_root, &upload.stored_path)
                    .map(|path| path.to_string_lossy().to_string())
                    .unwrap_or(upload.stored_path);
                UploadRecord {
                    stored_path,
                    ..upload
                }
            })
            .collect();
        Ok(resolved)
    }
}

fn cutoff_iso(age: ChronoDuration) -> String {
    (Utc::now() - age).to_rfc3339_opts(SecondsFormat::Secs, true)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use rusqlite::{params, Connection};

    use super::*;
    use crate::models::domain::{now_iso, JobSnapshot};
    use crate::models::request::CreateJobInput;

    struct TestDbFs {
        root: PathBuf,
        data_root: PathBuf,
        db_path: PathBuf,
    }

    impl TestDbFs {
        fn new(test_name: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "rust-api-db-retention-{test_name}-{}",
                fastrand::u64(..)
            ));
            let data_root = root.join("data");
            let db_path = root.join("db").join("jobs.db");
            fs::create_dir_all(&data_root).expect("create data root");
            fs::create_dir_all(db_path.parent().expect("db parent")).expect("create db dir");
            Self {
                root,
                data_root,
                db_path,
            }
        }

        fn db(&self) -> Db {
            Db::new(self.db_path.clone(), self.data_root.clone())
        }
    }

    impl Drop for TestDbFs {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn job_with_status(job_id: &str, status: JobStatusKind) -> JobSnapshot {
        let mut job = JobSnapshot::new(
            job_id.to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = status;
        job.sync_runtime_state();
        job
    }

    fn insert_event_with_ts(conn: &Connection, job_id: &str, seq: i64, ts: &str) {
        conn.execute(
            r#"
            INSERT INTO events (job_id, seq, ts, level, event, message)
            VALUES (?1, ?2, ?3, 'info', 'job_created', 'created')
            "#,
            params![job_id, seq, ts],
        )
        .expect("insert event with custom ts");
    }

    #[test]
    fn cleanup_expired_events_only_deletes_terminal_jobs_past_retention() {
        let fs = TestDbFs::new("events-terminal");
        let db = fs.db();
        db.init().expect("init db");

        db.save_job(&job_with_status("job-done", JobStatusKind::Succeeded))
            .expect("save finished job");
        db.save_job(&job_with_status("job-running", JobStatusKind::Running))
            .expect("save running job");

        let old_ts = cutoff_iso(ChronoDuration::days(40));
        let recent_ts = now_iso();

        let conn = Connection::open(&fs.db_path).expect("open sqlite");
        insert_event_with_ts(&conn, "job-done", 1, &old_ts);
        insert_event_with_ts(&conn, "job-done", 2, &recent_ts);
        insert_event_with_ts(&conn, "job-running", 1, &old_ts);
        drop(conn);

        let deleted = db
            .cleanup_expired_events(30)
            .expect("cleanup expired events");
        assert_eq!(deleted, 1);

        let remaining = db
            .list_job_events("job-done", 100, 0)
            .expect("list events for finished job");
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].seq, 2);

        let running_remaining = db
            .list_job_events("job-running", 100, 0)
            .expect("list events for running job");
        assert_eq!(
            running_remaining.len(),
            1,
            "events for a still-running job must never be cleaned regardless of age"
        );
    }

    #[test]
    fn cleanup_expired_events_disabled_when_zero() {
        let fs = TestDbFs::new("events-disabled");
        let db = fs.db();
        db.init().expect("init db");
        db.save_job(&job_with_status("job-done", JobStatusKind::Succeeded))
            .expect("save finished job");
        let old_ts = cutoff_iso(ChronoDuration::days(400));
        let conn = Connection::open(&fs.db_path).expect("open sqlite");
        insert_event_with_ts(&conn, "job-done", 1, &old_ts);
        drop(conn);

        let deleted = db.cleanup_expired_events(0).expect("cleanup disabled");
        assert_eq!(deleted, 0);
        assert_eq!(
            db.list_job_events("job-done", 100, 0)
                .expect("list events")
                .len(),
            1
        );
    }

    #[test]
    fn cleanup_orphaned_uploads_only_deletes_unreferenced_old_uploads() {
        let fs = TestDbFs::new("uploads-orphan");
        let db = fs.db();
        db.init().expect("init db");

        let old_ts = cutoff_iso(ChronoDuration::hours(72));
        let recent_ts = now_iso();

        for id in ["upload-orphan", "upload-referenced", "upload-recent"] {
            fs::create_dir_all(fs.data_root.join("uploads").join(id)).expect("upload dir");
            fs::write(fs.data_root.join("uploads").join(id).join("a.pdf"), b"pdf")
                .expect("write upload file");
        }

        let make_record = |upload_id: &str, uploaded_at: &str| UploadRecord {
            upload_id: upload_id.to_string(),
            filename: "a.pdf".to_string(),
            stored_path: fs
                .data_root
                .join("uploads")
                .join(upload_id)
                .join("a.pdf")
                .to_string_lossy()
                .to_string(),
            bytes: 3,
            page_count: 1,
            uploaded_at: uploaded_at.to_string(),
            developer_mode: false,
            content_hash: String::new(),
        };

        db.save_upload(&make_record("upload-orphan", &old_ts))
            .expect("save orphan upload");
        db.save_upload(&make_record("upload-referenced", &old_ts))
            .expect("save referenced upload");
        db.save_upload(&make_record("upload-recent", &recent_ts))
            .expect("save recent upload");

        let mut referencing_job =
            job_with_status("job-referencing-upload", JobStatusKind::Succeeded);
        referencing_job.upload_id = Some("upload-referenced".to_string());
        db.save_job(&referencing_job)
            .expect("save job referencing upload");

        let orphans = db
            .cleanup_orphaned_uploads(48)
            .expect("cleanup orphaned uploads");
        assert_eq!(orphans.len(), 1);
        assert_eq!(orphans[0].upload_id, "upload-orphan");
        assert!(
            PathBuf::from(&orphans[0].stored_path).is_absolute(),
            "returned stored_path should be resolved to an absolute path"
        );

        assert!(
            db.get_upload("upload-orphan").is_err(),
            "orphan upload row should be deleted"
        );
        assert!(
            db.get_upload("upload-referenced").is_ok(),
            "upload referenced by a job must survive even if old"
        );
        assert!(
            db.get_upload("upload-recent").is_ok(),
            "recent upload must survive despite having no referencing job yet"
        );
    }

    #[test]
    fn cleanup_orphaned_uploads_disabled_when_zero() {
        let fs = TestDbFs::new("uploads-disabled");
        let db = fs.db();
        db.init().expect("init db");

        let old_ts = cutoff_iso(ChronoDuration::hours(400));
        db.save_upload(&UploadRecord {
            upload_id: "upload-orphan".to_string(),
            filename: "a.pdf".to_string(),
            stored_path: "uploads/upload-orphan/a.pdf".to_string(),
            bytes: 3,
            page_count: 1,
            uploaded_at: old_ts,
            developer_mode: false,
            content_hash: String::new(),
        })
        .expect("save orphan upload");

        let orphans = db.cleanup_orphaned_uploads(0).expect("cleanup disabled");
        assert!(orphans.is_empty());
        assert!(db.get_upload("upload-orphan").is_ok());
    }
}
