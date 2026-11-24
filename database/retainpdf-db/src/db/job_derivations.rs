//! 续跑、重试阶段派生出的新任务记在 `job_derivations`（v38）：新任务 → 源任务。
//!
//! 用处只有一个：同一个源任务同时只许有一个排队中 / 运行中的派生任务（防双击、网络重试建出两个要花钱的任务）。
//! 「查有没有」和「落库」在同一个 `BEGIN IMMEDIATE` 事务里（[`Db::save_derived_job_as_new_run`]），
//! 两个请求同时来也只有一个写得进去。表的说明见迁移 `v38_duplicate_submissions.sql`。

use anyhow::Result;
use rusqlite::{params, OptionalExtension, TransactionBehavior};

use crate::models::domain::{now_iso, JobSnapshot};

use super::job_writes::{bump_run_generation, persist_prepared_job, prepare_job_write};
use super::Db;

/// [`Db::save_derived_job_as_new_run`] 的结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DerivedRunWrite {
    /// 写进去了，新的运行代次。
    Started(u64),
    /// 源任务已经有一个排队中 / 运行中的派生任务（编号），什么都没写。
    SourceBusy { active_job_id: String },
}

/// 源任务排队中 / 运行中的派生任务（最新的一个），不算 `except_job_id` 自己。
const ACTIVE_DERIVED_JOB_SQL: &str = r#"
    SELECT d.job_id FROM job_derivations d
    JOIN jobs j ON j.job_id = d.job_id
    WHERE d.source_job_id = ?1 AND d.job_id <> ?2 AND j.status IN ('queued', 'running')
    ORDER BY j.created_at DESC, d.job_id DESC
    LIMIT 1
"#;

/// 在事务里记一行派生关系（同一个新任务再写就改成新的源任务）。
pub(super) fn record_job_derivation(
    tx: &rusqlite::Transaction<'_>,
    job_id: &str,
    source_job_id: &str,
) -> Result<()> {
    tx.execute(
        r#"
        INSERT INTO job_derivations (job_id, source_job_id, created_at) VALUES (?1, ?2, ?3)
        ON CONFLICT(job_id) DO UPDATE SET source_job_id = excluded.source_job_id
        "#,
        params![job_id, source_job_id, now_iso()],
    )?;
    Ok(())
}

impl Db {
    /// 源任务现在有没有排队中 / 运行中的派生任务；有就返回它的编号（最新的一个）。
    ///
    /// 只是提前看一眼（建任务目录、导入凭据之前就拒，不留副作用）；真正挡住并发的是
    /// [`Db::save_derived_job_as_new_run`] 里同一事务的那次查。
    pub fn active_derived_job(&self, source_job_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(ACTIVE_DERIVED_JOB_SQL, params![source_job_id, ""], |row| {
                row.get(0)
            })
            .optional()?)
    }

    /// 落库一个从 `source_job_id` 派生的新任务（同 [`Db::save_job_as_new_run`]，代次加一），并记下派生关系。
    ///
    /// 和「源任务还有没有排队中 / 运行中的派生任务」在同一个 `BEGIN IMMEDIATE` 事务里：有就什么都不写，
    /// 返回 [`DerivedRunWrite::SourceBusy`]。
    pub fn save_derived_job_as_new_run(
        &self,
        job: &JobSnapshot,
        source_job_id: &str,
    ) -> Result<DerivedRunWrite> {
        let prepared = prepare_job_write(self, job)?;
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let active: Option<String> = tx
            .query_row(
                ACTIVE_DERIVED_JOB_SQL,
                params![source_job_id, job.job_id],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(active_job_id) = active {
            return Ok(DerivedRunWrite::SourceBusy { active_job_id });
        }
        persist_prepared_job(&tx, prepared)?;
        let generation = bump_run_generation(&tx, &job.job_id)?;
        record_job_derivation(&tx, &job.job_id, source_job_id)?;
        tx.commit()?;
        Ok(DerivedRunWrite::Started(generation))
    }

    /// 这个任务是从哪个任务派生的（续跑、重试阶段建的新任务）；不是派生的返回 None。
    pub fn derivation_source_of(&self, job_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(
                "SELECT source_job_id FROM job_derivations WHERE job_id = ?1",
                params![job_id],
                |row| row.get(0),
            )
            .optional()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::{CreateJobInput, JobStatusKind};

    fn temp_db(name: &str) -> (Db, std::path::PathBuf) {
        let root =
            std::env::temp_dir().join(format!("retain-derivations-{name}-{}", fastrand::u64(..)));
        std::fs::create_dir_all(root.join("db")).unwrap();
        let db = Db::new(root.join("db").join("jobs.db"), root.clone());
        db.init().unwrap();
        (db, root)
    }

    fn job(job_id: &str, status: JobStatusKind) -> JobSnapshot {
        let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), Vec::new());
        job.status = status;
        job
    }

    #[test]
    fn only_one_active_derived_job_per_source() {
        let (db, root) = temp_db("one-active");
        db.save_job(&job("source", JobStatusKind::Failed)).unwrap();

        assert_eq!(
            db.save_derived_job_as_new_run(&job("first", JobStatusKind::Queued), "source")
                .unwrap(),
            DerivedRunWrite::Started(1)
        );
        assert_eq!(
            db.active_derived_job("source").unwrap().as_deref(),
            Some("first")
        );
        assert_eq!(
            db.derivation_source_of("first").unwrap().as_deref(),
            Some("source")
        );

        // 第一个还在排队：第二个不写。
        assert_eq!(
            db.save_derived_job_as_new_run(&job("second", JobStatusKind::Queued), "source")
                .unwrap(),
            DerivedRunWrite::SourceBusy {
                active_job_id: "first".to_string()
            }
        );
        assert!(
            db.get_job("second").is_err(),
            "refused job must not be written"
        );

        // 第一个结束了（成功 / 失败 / 取消都一样）：可以再派生。
        for (index, status) in [
            JobStatusKind::Failed,
            JobStatusKind::Succeeded,
            JobStatusKind::Canceled,
        ]
        .into_iter()
        .enumerate()
        {
            let previous = if index == 0 {
                "first".to_string()
            } else {
                format!("again-{}", index - 1)
            };
            let mut finished = db.get_job(&previous).unwrap();
            finished.status = status;
            db.save_job(&finished).unwrap();
            assert_eq!(db.active_derived_job("source").unwrap(), None);
            let next = format!("again-{index}");
            assert!(matches!(
                db.save_derived_job_as_new_run(&job(&next, JobStatusKind::Queued), "source")
                    .unwrap(),
                DerivedRunWrite::Started(_)
            ));
        }

        // 别的源任务不受影响。
        assert_eq!(db.active_derived_job("other").unwrap(), None);
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn deleting_the_derived_job_drops_its_row() {
        let (db, root) = temp_db("cascade");
        db.save_job(&job("source", JobStatusKind::Failed)).unwrap();
        db.save_derived_job_as_new_run(&job("derived", JobStatusKind::Running), "source")
            .unwrap();
        db.delete_job("derived").unwrap();
        assert_eq!(db.derivation_source_of("derived").unwrap(), None);
        assert_eq!(db.active_derived_job("source").unwrap(), None);
        std::fs::remove_dir_all(root).ok();
    }

    #[test]
    fn concurrent_derivations_from_one_source_write_only_one_job() {
        let (db, root) = temp_db("concurrent");
        db.save_job(&job("source", JobStatusKind::Failed)).unwrap();
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));
        let handles: Vec<_> = (0..8)
            .map(|index| {
                let db = db.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    db.save_derived_job_as_new_run(
                        &job(&format!("racer-{index}"), JobStatusKind::Queued),
                        "source",
                    )
                    .unwrap()
                })
            })
            .collect();
        let results: Vec<_> = handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect();
        let started = results
            .iter()
            .filter(|result| matches!(result, DerivedRunWrite::Started(_)))
            .count();
        assert_eq!(started, 1, "{results:?}");
        let written = (0..8)
            .filter(|index| db.get_job(&format!("racer-{index}")).is_ok())
            .count();
        assert_eq!(written, 1);
        std::fs::remove_dir_all(root).ok();
    }
}
