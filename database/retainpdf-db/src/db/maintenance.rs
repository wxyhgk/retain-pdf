//! 库的维护：截短老任务存下的程序输出、把空出来的页还给磁盘、整库压缩（2026-11-20 数据库瘦身）。
//!
//! SQLite 删了行文件不会变小，空出来的页只留着给以后用。新库从一开始就是增量收缩模式（`auto_vacuum = INCREMENTAL`，
//! 见 `db.rs` 建表前），每次 30 天清理之后 [`Db::release_free_pages`] 把空页还给磁盘；老库要经一次 [`Db::compact`]
//! （整库 `VACUUM`）才切到这个模式。`compact` 要独占整个库，只在后端停着时由命令行 `retainpdf compact` 调。

use anyhow::Result;
use rusqlite::params;
use serde_json::Value;

use crate::models::domain::{stored_output_tail, STORED_OUTPUT_TAIL_BYTES};

use super::Db;

/// 整库压缩前后的大小。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CompactReport {
    pub bytes_before: u64,
    pub bytes_after: u64,
}

impl Db {
    /// 老任务 `result_json` 里超长的 stdout、stderr 截成末尾（和新任务进库时一样，见 `stored_output_tail`）。
    /// 返回改了几个任务。完整输出本来就在任务目录的 `logs/` 下。
    pub fn trim_stored_process_output(&self) -> Result<usize> {
        let conn = self.connect()?;
        let limit = STORED_OUTPUT_TAIL_BYTES as i64;
        let rows: Vec<(String, String)> = {
            let mut stmt = conn.prepare(
                "SELECT job_id, result_json FROM jobs
                 WHERE result_json IS NOT NULL AND LENGTH(result_json) > ?1",
            )?;
            let mapped = stmt.query_map(params![limit], |row| Ok((row.get(0)?, row.get(1)?)))?;
            mapped.collect::<rusqlite::Result<_>>()?
        };
        let mut changed = 0;
        for (job_id, raw) in rows {
            let Ok(mut result) = serde_json::from_str::<Value>(&raw) else {
                continue;
            };
            let mut touched = false;
            for field in ["stdout", "stderr"] {
                if let Some(text) = result.get(field).and_then(Value::as_str) {
                    let kept = stored_output_tail(text);
                    if kept.len() < text.len() {
                        result[field] = Value::String(kept);
                        touched = true;
                    }
                }
            }
            if touched {
                conn.execute(
                    "UPDATE jobs SET result_json = ?1 WHERE job_id = ?2",
                    params![serde_json::to_string(&result)?, job_id],
                )?;
                changed += 1;
            }
        }
        Ok(changed)
    }

    /// 增量收缩模式下把空页还给磁盘（不是这个模式时什么都不做）。30 天清理之后调。返回还了几页。
    pub fn release_free_pages(&self) -> Result<usize> {
        incremental_vacuum(&self.connect()?)
    }

    /// 空页数（还没还给磁盘的）。
    pub fn free_pages(&self) -> Result<u64> {
        Ok(self.connect()?.query_row("PRAGMA freelist_count", [], |row| row.get::<_, i64>(0))?.max(0) as u64)
    }

    /// 整库压缩，并切到增量收缩模式。要独占整个库：后端开着（别的连接在用）会失败。
    /// 压缩时临时要再占一份库那么大的磁盘。
    pub fn compact(&self) -> Result<CompactReport> {
        let bytes_before = self.file_bytes();
        let conn = self.connect()?;
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA auto_vacuum = INCREMENTAL; VACUUM; PRAGMA wal_checkpoint(TRUNCATE);")?;
        drop(conn);
        Ok(CompactReport { bytes_before, bytes_after: self.file_bytes() })
    }

    /// 库文件现在多大（不含 WAL）。
    pub fn file_bytes(&self) -> u64 {
        std::fs::metadata(self.path()).map(|meta| meta.len()).unwrap_or(0)
    }

    /// 库现在是不是增量收缩模式（`PRAGMA auto_vacuum` 为 2）。
    pub fn incremental_vacuum_enabled(&self) -> Result<bool> {
        let conn = self.connect()?;
        let mode: i64 = conn.query_row("PRAGMA auto_vacuum", [], |row| row.get(0))?;
        Ok(mode == 2)
    }
}

/// `PRAGMA incremental_vacuum` 每还一页返回一行（空行），要一直走到头才全部还完。`execute_batch` 只走一步，
/// 只还一页——2026-11-20 起 30 天清理之后的收缩一直只还了一页，2026-11-21 发现。返回还了几页。
pub(super) fn incremental_vacuum(conn: &rusqlite::Connection) -> Result<usize> {
    let mut stmt = conn.prepare("PRAGMA incremental_vacuum")?;
    let mut rows = stmt.query([])?;
    let mut released = 0;
    while rows.next()?.is_some() {
        released += 1;
    }
    Ok(released)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::{CreateJobInput, JobSnapshot, ProcessResult};

    fn temp_db(name: &str) -> (Db, std::path::PathBuf) {
        let root = std::env::temp_dir().join(format!("retain-maintenance-{name}-{}", fastrand::u64(..)));
        std::fs::create_dir_all(root.join("db")).unwrap();
        let db = Db::new(root.join("db").join("jobs.db"), root.clone());
        db.init().unwrap();
        (db, root)
    }

    #[test]
    fn new_databases_start_in_incremental_vacuum_mode() {
        let (db, root) = temp_db("mode");
        assert!(db.incremental_vacuum_enabled().unwrap());
        db.release_free_pages().unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }

    /// 空页要全部还回去（以前 `execute_batch` 只走一步、只还一页）。
    #[test]
    fn releasing_free_pages_returns_all_of_them() {
        let (db, root) = temp_db("release");
        let conn = db.connect().unwrap();
        conn.execute_batch(
            "CREATE TABLE filler(x TEXT);
             WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 2000)
             INSERT INTO filler SELECT printf('%.2000c', 'x') FROM n;
             DROP TABLE filler;",
        )
        .unwrap();
        let free = db.free_pages().unwrap();
        assert!(free > 500, "{free}");
        assert_eq!(db.release_free_pages().unwrap() as u64, free);
        assert_eq!(db.free_pages().unwrap(), 0);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn long_stored_output_is_trimmed_to_its_tail_and_compact_shrinks_the_file() {
        let (db, root) = temp_db("trim");
        let mut job = JobSnapshot::new("job-chatty".into(), CreateJobInput::default(), vec!["python".into()]);
        job.result = Some(ProcessResult {
            stdout: format!("{}最后一行", "x".repeat(4 * 1024 * 1024)),
            stderr: "warn".into(),
            ..Default::default()
        });
        db.save_job(&job).unwrap();
        assert_eq!(db.trim_stored_process_output().unwrap(), 1);
        assert_eq!(db.trim_stored_process_output().unwrap(), 0, "再跑一次没有要改的");
        let stored = db.get_job("job-chatty").unwrap().result.clone().unwrap();
        assert!(stored.stdout.ends_with("最后一行") && stored.stdout.len() < STORED_OUTPUT_TAIL_BYTES + 200);
        assert_eq!(stored.stderr, "warn");
        let report = db.compact().unwrap();
        assert!(report.bytes_after < report.bytes_before, "{report:?}");
        assert!(db.incremental_vacuum_enabled().unwrap());
        std::fs::remove_dir_all(root).unwrap();
    }
}
