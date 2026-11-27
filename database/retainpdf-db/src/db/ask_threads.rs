//! 阅读页提问的问答记录（v39，见迁移 `v39_ask_threads.sql`）：`ask_threads` 一次提问一行，`ask_messages` 一条问答一行。
//!
//! 这里只管行：建、列、读、改（整份换掉问答）、删。锚点、长度、数量怎么校验，标题怎么取，在书库包的 `ask_threads.rs`。

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;

use crate::models::domain::{build_job_id, now_iso};

use super::Db;

/// 页内位置（占整页的比例，0–1）。
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct AskPoint {
    pub x: f64,
    pub y: f64,
}

/// 问的是哪儿（和阅读器的 `ReaderAskAnchor` 一一对应，字段名改成下划线）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AskAnchorRecord {
    /// `source` 原文 / `translated` 译文。
    pub pane: String,
    /// 第几页（从 1 起）。
    pub page: u32,
    /// 鼠标下面那一块；认不出是 None。
    pub item_id: Option<String>,
    /// 选中的字；没选是空串。
    pub selection: String,
    pub source_text: String,
    pub translated_text: String,
    pub section: String,
    pub point: Option<AskPoint>,
}

/// 一条问或答。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AskMessageRecord {
    /// `user` / `assistant`。
    pub role: String,
    pub text: String,
    /// 思考摘要；没有是 None。
    pub thought: Option<String>,
    /// 用量（JSON 对象，原样存）；没有是 None。
    pub usage: Option<serde_json::Value>,
}

/// 一次提问（不带问答正文）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AskThreadRecord {
    pub thread_id: String,
    pub document_id: String,
    pub agent_id: String,
    pub session_id: Option<String>,
    pub title: String,
    pub anchor: AskAnchorRecord,
    pub message_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// 建一次提问要的东西（调用方校验过）。
pub struct NewAskThread<'a> {
    pub document_id: &'a str,
    pub agent_id: &'a str,
    pub session_id: Option<&'a str>,
    pub title: &'a str,
    pub anchor: &'a AskAnchorRecord,
    pub messages: &'a [AskMessageRecord],
}

/// 改一次提问：给了的才改。`session_id: Some(None)` 是清掉；`messages` 整份换掉，连同按它算的标题。
#[derive(Default)]
pub struct AskThreadChanges<'a> {
    pub agent_id: Option<&'a str>,
    pub session_id: Option<Option<&'a str>>,
    pub messages: Option<(&'a [AskMessageRecord], &'a str)>,
}

/// 建的结果：书上的提问已经到上限时不建。
pub enum AskThreadCreated {
    Created(AskThreadRecord),
    LimitReached,
}

const THREAD_COLUMNS: &str = "t.thread_id, t.document_id, t.agent_id, t.session_id, t.title, t.pane, t.page, t.item_id,
     t.selection, t.source_text, t.translated_text, t.section, t.point_x, t.point_y, t.created_at, t.updated_at,
     (SELECT COUNT(*) FROM ask_messages m WHERE m.thread_id = t.thread_id)";

fn row_to_thread(row: &rusqlite::Row<'_>) -> rusqlite::Result<AskThreadRecord> {
    let point_x: Option<f64> = row.get(12)?;
    let point_y: Option<f64> = row.get(13)?;
    Ok(AskThreadRecord {
        thread_id: row.get(0)?,
        document_id: row.get(1)?,
        agent_id: row.get(2)?,
        session_id: row.get(3)?,
        title: row.get(4)?,
        anchor: AskAnchorRecord {
            pane: row.get(5)?,
            page: row.get(6)?,
            item_id: row.get(7)?,
            selection: row.get(8)?,
            source_text: row.get(9)?,
            translated_text: row.get(10)?,
            section: row.get(11)?,
            point: point_x.zip(point_y).map(|(x, y)| AskPoint { x, y }),
        },
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        message_count: row.get(16)?,
    })
}

fn load_thread(conn: &Connection, document_id: &str, thread_id: &str) -> Result<Option<AskThreadRecord>> {
    Ok(conn
        .query_row(
            &format!("SELECT {THREAD_COLUMNS} FROM ask_threads t WHERE t.thread_id = ?1 AND t.document_id = ?2"),
            params![thread_id, document_id],
            row_to_thread,
        )
        .optional()?)
}

fn write_messages(conn: &Connection, thread_id: &str, messages: &[AskMessageRecord]) -> Result<()> {
    conn.execute("DELETE FROM ask_messages WHERE thread_id = ?1", params![thread_id])?;
    let mut stmt = conn.prepare(
        "INSERT INTO ask_messages (thread_id, position, role, text, thought, usage_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )?;
    for (position, message) in messages.iter().enumerate() {
        let usage = message.usage.as_ref().map(serde_json::to_string).transpose()?;
        stmt.execute(params![thread_id, position as i64, message.role, message.text, message.thought, usage])?;
    }
    Ok(())
}

impl Db {
    /// 这本书上有几次提问。
    pub fn count_ask_threads(&self, document_id: &str) -> Result<i64> {
        let conn = self.connect()?;
        Ok(conn.query_row("SELECT COUNT(*) FROM ask_threads WHERE document_id = ?1", params![document_id], |row| row.get(0))?)
    }

    /// 建一次提问（连同开头的几条问答）。书上已经有 `max_threads` 次就不建；没有这本书报 QueryReturnedNoRows。
    pub fn create_ask_thread(&self, new: &NewAskThread<'_>, max_threads: i64) -> Result<AskThreadCreated> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.query_row("SELECT 1 FROM item_files WHERE file_id = ?1", params![new.document_id], |_| Ok(()))
            .optional()?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
            .with_context(|| format!("document not found: {}", new.document_id))?;
        let count: i64 =
            tx.query_row("SELECT COUNT(*) FROM ask_threads WHERE document_id = ?1", params![new.document_id], |row| row.get(0))?;
        if count >= max_threads {
            return Ok(AskThreadCreated::LimitReached);
        }
        let thread_id = format!("ask-{}", build_job_id());
        let now = now_iso();
        let anchor = new.anchor;
        tx.execute(
            "INSERT INTO ask_threads (thread_id, document_id, agent_id, session_id, title, pane, page, item_id, selection,
                 source_text, translated_text, section, point_x, point_y, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)",
            params![
                thread_id,
                new.document_id,
                new.agent_id,
                new.session_id,
                new.title,
                anchor.pane,
                anchor.page,
                anchor.item_id,
                anchor.selection,
                anchor.source_text,
                anchor.translated_text,
                anchor.section,
                anchor.point.map(|point| point.x),
                anchor.point.map(|point| point.y),
                now,
            ],
        )?;
        write_messages(&tx, &thread_id, new.messages)?;
        let record = load_thread(&tx, new.document_id, &thread_id)?.context("load inserted ask thread")?;
        tx.commit()?;
        Ok(AskThreadCreated::Created(record))
    }

    /// 这本书上的提问，最近改过的在前。
    pub fn list_ask_threads(&self, document_id: &str) -> Result<Vec<AskThreadRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {THREAD_COLUMNS} FROM ask_threads t WHERE t.document_id = ?1
             ORDER BY t.updated_at DESC, t.created_at DESC, t.thread_id DESC"
        ))?;
        let rows = stmt.query_map(params![document_id], row_to_thread)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// 一次提问；不在这本书上返回 None。
    pub fn get_ask_thread(&self, document_id: &str, thread_id: &str) -> Result<Option<AskThreadRecord>> {
        let conn = self.connect()?;
        load_thread(&conn, document_id, thread_id)
    }

    /// 一次提问的问答，按顺序。
    pub fn ask_thread_messages(&self, thread_id: &str) -> Result<Vec<AskMessageRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT role, text, thought, usage_json FROM ask_messages WHERE thread_id = ?1 ORDER BY position",
        )?;
        let rows = stmt.query_map(params![thread_id], |row| {
            let usage: Option<String> = row.get(3)?;
            Ok(AskMessageRecord {
                role: row.get(0)?,
                text: row.get(1)?,
                thought: row.get(2)?,
                usage: usage.and_then(|text| serde_json::from_str(&text).ok()),
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// 改一次提问（见 [`AskThreadChanges`]），`updated_at` 换成现在。不在这本书上返回 None。
    pub fn update_ask_thread(
        &self,
        document_id: &str,
        thread_id: &str,
        changes: &AskThreadChanges<'_>,
    ) -> Result<Option<AskThreadRecord>> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        if load_thread(&tx, document_id, thread_id)?.is_none() {
            return Ok(None);
        }
        if let Some(agent_id) = changes.agent_id {
            tx.execute("UPDATE ask_threads SET agent_id = ?1 WHERE thread_id = ?2", params![agent_id, thread_id])?;
        }
        if let Some(session_id) = changes.session_id {
            tx.execute("UPDATE ask_threads SET session_id = ?1 WHERE thread_id = ?2", params![session_id, thread_id])?;
        }
        if let Some((messages, title)) = changes.messages {
            write_messages(&tx, thread_id, messages)?;
            tx.execute("UPDATE ask_threads SET title = ?1 WHERE thread_id = ?2", params![title, thread_id])?;
        }
        tx.execute("UPDATE ask_threads SET updated_at = ?1 WHERE thread_id = ?2", params![now_iso(), thread_id])?;
        let record = load_thread(&tx, document_id, thread_id)?;
        tx.commit()?;
        Ok(record)
    }

    /// 这本书上的提问记着的 agent 会话编号（去重；没记的不算）。删书前取，删完按它清 pi 的会话文件。
    pub fn ask_thread_session_ids(&self, document_id: &str) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT DISTINCT session_id FROM ask_threads
             WHERE document_id = ?1 AND session_id IS NOT NULL AND session_id != '' ORDER BY session_id",
        )?;
        let ids = stmt.query_map(params![document_id], |row| row.get::<_, String>(0))?.collect::<rusqlite::Result<_>>()?;
        Ok(ids)
    }

    /// 还有没有提问（任何一本书上）或对话消息（v44）记着这个会话。
    pub fn ask_session_in_use(&self, session_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        Ok(conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM ask_threads WHERE session_id = ?1)
                 OR EXISTS(SELECT 1 FROM ask_conversation_messages WHERE session_id = ?1)",
            params![session_id],
            |row| row.get::<_, bool>(0),
        )?)
    }

    /// 删一次提问（问答跟着外键删）；不在这本书上返回 false。
    pub fn delete_ask_thread(&self, document_id: &str, thread_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        Ok(conn.execute(
            "DELETE FROM ask_threads WHERE thread_id = ?1 AND document_id = ?2",
            params![thread_id, document_id],
        )? > 0)
    }
}

#[cfg(test)]
#[path = "ask_threads_tests.rs"]
mod tests;
