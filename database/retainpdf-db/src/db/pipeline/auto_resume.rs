//! 自动续跑计数（崩溃循环熔断），列见迁移 v27_pipeline_auto_resume。
//!
//! 只有运行时自己的自动续跑（启动恢复、运行期巡检把「running 却没有 driver」的任务放回
//! queued）读写这两列。计数挂在 attempt 上：手动重试 / 续跑认领的是新 attempt，从 0 开始。

use anyhow::Result;
use rusqlite::{params, OptionalExtension};

use crate::db::Db;

/// 再自动续跑一次之后，这个 attempt 的计数。
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub struct AutoResumeTally {
    pub attempt: u32,
    /// 连续没有新进度的自动续跑次数（含这一次）。
    pub count: u32,
    /// 现在的进度：已提交的单元数 + 已完成的阶段数。
    pub progress: i64,
}

impl Db {
    /// 算出「再自动续跑一次」之后的计数，不落库（判定通过、任务真的放回 queued 之后再
    /// [`Db::record_auto_resume`]）。上一次自动续跑以来有了新进度就从 1 重新数。
    /// 没有 running attempt 时返回 `None`。
    pub fn next_auto_resume_tally(&self, job_id: &str) -> Result<Option<AutoResumeTally>> {
        let conn = self.connect()?;
        let latest = conn
            .query_row(
                r#"
                SELECT attempt, auto_resume_count, auto_resume_progress
                FROM pipeline_attempts
                WHERE job_id = ?1 AND status = 'running'
                ORDER BY attempt DESC LIMIT 1
                "#,
                params![job_id],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?)),
            )
            .optional()?;
        let Some((attempt, count, last_progress)) = latest else {
            return Ok(None);
        };
        let progress: i64 = conn.query_row(
            r#"
            SELECT
              (SELECT COUNT(*) FROM pipeline_units WHERE job_id = ?1 AND attempt = ?2)
              + (SELECT COUNT(*) FROM pipeline_stages
                 WHERE job_id = ?1 AND attempt = ?2 AND status = 'completed')
            "#,
            params![job_id, attempt],
            |row| row.get(0),
        )?;
        let count = if progress > last_progress { 1 } else { count.max(0) + 1 };
        Ok(Some(AutoResumeTally {
            attempt: attempt as u32,
            count: count as u32,
            progress,
        }))
    }

    /// 任务已经放回 queued 等自动续跑：把这次的计数记到它的 attempt 上。
    pub fn record_auto_resume(&self, job_id: &str, tally: &AutoResumeTally) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            UPDATE pipeline_attempts
            SET auto_resume_count = ?1, auto_resume_progress = ?2
            WHERE job_id = ?3 AND attempt = ?4 AND status = 'running'
            "#,
            params![tally.count, tally.progress, job_id, tally.attempt],
        )?;
        Ok(())
    }
}
