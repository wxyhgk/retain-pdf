//! 译文版本（v30）：一本书的几份译文，前端能切换。规则见迁移 `v30_translation_versions.sql` 开头。
//!
//! 这里只管行：建版本、把任务挂进版本、列出、改名、隐藏、书的当前版本。哪些任务算一个版本、读的时候怎么合成，
//! 在任务包（建任务时）和书库包（阅读入口）。

use anyhow::Result;
use rusqlite::{params, OptionalExtension};

use crate::models::domain::build_job_id;
use crate::models::domain::now_iso;

use crate::db::Db;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslationVersionRecord {
    pub version_id: String,
    pub document_id: String,
    /// 只重翻一部分页时，其余页沿用的版本。
    pub base_version_id: Option<String>,
    /// translate（整本翻译）/ retranslate（重新翻译）/ backfill（迁移时从已有任务回填）。
    pub origin: String,
    /// 用户起的名字；空 = 由调用方按翻译设置生成。
    pub label: String,
    pub hidden_at: Option<String>,
    pub created_at: String,
    /// 这个版本的任务，按提交时间排。
    pub job_ids: Vec<String>,
}

const VERSION_COLUMNS: &str = "version_id, document_id, base_version_id, origin, label, hidden_at, created_at";

fn version_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TranslationVersionRecord> {
    Ok(TranslationVersionRecord {
        version_id: row.get(0)?,
        document_id: row.get(1)?,
        base_version_id: row.get(2)?,
        origin: row.get(3)?,
        label: row.get(4)?,
        hidden_at: row.get(5)?,
        created_at: row.get(6)?,
        job_ids: Vec::new(),
    })
}

impl Db {
    /// 新建一个版本（还没有任务）。返回版本编号。
    pub fn create_translation_version(&self, document_id: &str, base_version_id: Option<&str>, origin: &str) -> Result<String> {
        let version_id = format!("tv-{}", build_job_id());
        let conn = self.connect()?;
        conn.execute(
            "INSERT INTO translation_versions (version_id, document_id, base_version_id, origin, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![version_id, document_id, base_version_id, origin, now_iso()],
        )?;
        Ok(version_id)
    }

    /// 把任务挂进版本。一个任务只属于一个版本：已经挂过的不动（返回 false）。
    pub fn add_job_to_translation_version(&self, version_id: &str, job_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "INSERT OR IGNORE INTO translation_version_jobs (job_id, version_id) VALUES (?1, ?2)",
            params![job_id, version_id],
        )?;
        Ok(changed > 0)
    }

    pub fn translation_version_of_job(&self, job_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row("SELECT version_id FROM translation_version_jobs WHERE job_id = ?1", params![job_id], |row| row.get(0))
            .optional()?)
    }

    pub fn get_translation_version(&self, version_id: &str) -> Result<Option<TranslationVersionRecord>> {
        let conn = self.connect()?;
        let record = conn
            .query_row(
                &format!("SELECT {VERSION_COLUMNS} FROM translation_versions WHERE version_id = ?1"),
                params![version_id],
                version_from_row,
            )
            .optional()?;
        let Some(mut record) = record else { return Ok(None) };
        record.job_ids = version_job_ids(&conn, &record.version_id)?;
        Ok(Some(record))
    }

    /// 一本书的版本，从旧到新：按版本里最早那个任务的提交时间排（同一秒建的版本也按任务先后），再按创建时间、编号兜底。
    /// `include_hidden=false` 时不含隐藏的。没有任务的版本（任务都删了）不列。
    pub fn list_translation_versions(&self, document_id: &str, include_hidden: bool) -> Result<Vec<TranslationVersionRecord>> {
        let conn = self.connect()?;
        let mut statement = conn.prepare(&format!(
            "SELECT {VERSION_COLUMNS} FROM translation_versions tv
             WHERE document_id = ?1 AND (?2 OR hidden_at IS NULL)
             ORDER BY (SELECT MIN(j.created_at) FROM translation_version_jobs tvj JOIN jobs j ON j.job_id = tvj.job_id
                       WHERE tvj.version_id = tv.version_id),
                      created_at, version_id"
        ))?;
        let records = statement
            .query_map(params![document_id, include_hidden], version_from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut out = Vec::with_capacity(records.len());
        for mut record in records {
            record.job_ids = version_job_ids(&conn, &record.version_id)?;
            if !record.job_ids.is_empty() {
                out.push(record);
            }
        }
        Ok(out)
    }

    /// 隐藏的版本里的任务：自动模式（逐页取最新）不用它们。
    pub fn hidden_translation_version_jobs(&self, document_id: &str) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut statement = conn.prepare(
            "SELECT tvj.job_id FROM translation_version_jobs tvj
             JOIN translation_versions tv ON tv.version_id = tvj.version_id
             WHERE tv.document_id = ?1 AND tv.hidden_at IS NOT NULL",
        )?;
        let jobs = statement.query_map(params![document_id], |row| row.get(0))?.collect::<rusqlite::Result<Vec<String>>>()?;
        Ok(jobs)
    }

    pub fn set_translation_version_label(&self, version_id: &str, label: &str) -> Result<bool> {
        let conn = self.connect()?;
        Ok(conn.execute("UPDATE translation_versions SET label = ?1 WHERE version_id = ?2", params![label, version_id])? > 0)
    }

    /// 隐藏或恢复。隐藏的正好是书的当前版本时，书退回自动模式。
    pub fn set_translation_version_hidden(&self, version_id: &str, hidden: bool) -> Result<bool> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let hidden_at = hidden.then(now_iso);
        let changed = tx.execute("UPDATE translation_versions SET hidden_at = ?1 WHERE version_id = ?2", params![hidden_at, version_id])?;
        if hidden {
            tx.execute("DELETE FROM translation_version_choices WHERE version_id = ?1", params![version_id])?;
        }
        tx.commit()?;
        Ok(changed > 0)
    }

    /// 书的当前版本：None = 自动（逐页取最新）。
    pub fn document_current_translation_version(&self, document_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row("SELECT version_id FROM translation_version_choices WHERE document_id = ?1", params![document_id], |row| row.get(0))
            .optional()?)
    }

    /// 选当前版本；`None` 回到自动。
    pub fn set_document_current_translation_version(&self, document_id: &str, version_id: Option<&str>) -> Result<()> {
        let conn = self.connect()?;
        match version_id {
            Some(version_id) => conn.execute(
                "INSERT INTO translation_version_choices (document_id, version_id, chosen_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(document_id) DO UPDATE SET version_id = excluded.version_id, chosen_at = excluded.chosen_at",
                params![document_id, version_id, now_iso()],
            )?,
            None => conn.execute("DELETE FROM translation_version_choices WHERE document_id = ?1", params![document_id])?,
        };
        Ok(())
    }
}

fn version_job_ids(conn: &rusqlite::Connection, version_id: &str) -> Result<Vec<String>> {
    let mut statement = conn.prepare(
        "SELECT tvj.job_id FROM translation_version_jobs tvj
         JOIN jobs j ON j.job_id = tvj.job_id
         WHERE tvj.version_id = ?1
         ORDER BY j.created_at, j.job_id",
    )?;
    let ids = statement.query_map(params![version_id], |row| row.get(0))?.collect::<rusqlite::Result<Vec<String>>>()?;
    Ok(ids)
}

#[cfg(test)]
#[path = "translation_versions_tests.rs"]
mod tests;
