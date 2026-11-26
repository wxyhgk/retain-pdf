//! 阅读页提问的记忆（v40，见迁移 `v40_ask_conversations.sql`）：`ask_memories` 一条一行，`ask_memories_fts` 是全文索引（触发器维护）。
//!
//! 这里只管行：记一条（同层同书一模一样的字不重记；`replaces` 的旧条标 superseded）、列和查、读、改字、删（标 deleted，
//! 被它替代的旧条恢复成 active）。长度、数量、类别怎么校验在书库包的 `ask_memories.rs`。

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;

use crate::models::domain::{build_job_id, now_iso};

use super::Db;

/// 阅读页提问的设置（`ask_settings` 一行；没有这一行是默认）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AskSettingsRecord {
    /// 「让 AI 使用记忆」总开关，默认开。
    pub memory_enabled: bool,
    /// 最后一次改的时间；没改过是 None。
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AskMemoryRecord {
    pub memory_id: String,
    /// `user` / `book`。
    pub scope: String,
    pub document_id: Option<String>,
    pub category: String,
    pub text: String,
    /// `active` / `superseded` / `deleted`。
    pub status: String,
    pub superseded_by: Option<String>,
    /// `agent` / `user`。
    pub origin: String,
    pub agent_id: Option<String>,
    pub source_conversation_id: Option<String>,
    pub source_message_id: Option<String>,
    pub source_job_id: Option<String>,
    pub source_page: Option<u32>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

/// 记一条要的东西（调用方校验过）。
#[derive(Debug, Clone, Default)]
pub struct NewAskMemory {
    pub scope: String,
    pub document_id: Option<String>,
    pub category: String,
    pub text: String,
    pub origin: String,
    pub agent_id: Option<String>,
    pub source_conversation_id: Option<String>,
    pub source_message_id: Option<String>,
    pub source_job_id: Option<String>,
    pub source_page: Option<u32>,
    /// 要替代的旧条（标 superseded）。
    pub replaces: Option<String>,
}

pub enum AskMemoryCreated {
    Created(AskMemoryRecord),
    /// 同层同书已经有一条一模一样的（active），回那条，不重记。
    Duplicate(AskMemoryRecord),
    DocumentMissing,
    /// `replaces` 的那条没有或已经删了。
    ReplacesMissing,
    /// 这一层（书层按书算）active 的已经到上限。
    LimitReached,
}

/// 列、查的条件（给了的才筛）。`statuses` 空 = 只要 active。
#[derive(Default)]
pub struct AskMemoryFilter<'a> {
    pub scope: Option<&'a str>,
    pub document_id: Option<&'a str>,
    pub statuses: Vec<&'a str>,
    pub query: Option<&'a str>,
    pub source_conversation_id: Option<&'a str>,
    pub created_after: Option<&'a str>,
    pub limit: u32,
}

const MEMORY_COLUMNS: &str = "m.memory_id, m.scope, m.document_id, m.category, m.text, m.status, m.superseded_by, m.origin, m.agent_id,
     m.source_conversation_id, m.source_message_id, m.source_job_id, m.source_page, m.created_at, m.updated_at, m.deleted_at";

fn row_to_memory(row: &rusqlite::Row<'_>) -> rusqlite::Result<AskMemoryRecord> {
    Ok(AskMemoryRecord {
        memory_id: row.get(0)?,
        scope: row.get(1)?,
        document_id: row.get(2)?,
        category: row.get(3)?,
        text: row.get(4)?,
        status: row.get(5)?,
        superseded_by: row.get(6)?,
        origin: row.get(7)?,
        agent_id: row.get(8)?,
        source_conversation_id: row.get(9)?,
        source_message_id: row.get(10)?,
        source_job_id: row.get(11)?,
        source_page: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
        deleted_at: row.get(15)?,
    })
}

fn load_memory(conn: &Connection, memory_id: &str) -> Result<Option<AskMemoryRecord>> {
    Ok(conn
        .query_row(&format!("SELECT {MEMORY_COLUMNS} FROM ask_memories m WHERE m.memory_id = ?1"), params![memory_id], row_to_memory)
        .optional()?)
}

/// 比较「一模一样」用：空白全去掉。
fn squeezed(text: &str) -> String {
    text.chars().filter(|c| !c.is_whitespace()).collect()
}

impl Db {
    /// 阅读页提问的设置；没存过是默认（记忆开着）。
    pub fn ask_settings(&self) -> Result<AskSettingsRecord> {
        let conn = self.connect()?;
        let row: Option<(i64, String)> = conn
            .query_row("SELECT memory_enabled, updated_at FROM ask_settings WHERE id = 1", [], |row| Ok((row.get(0)?, row.get(1)?)))
            .optional()?;
        Ok(match row {
            Some((enabled, updated_at)) => AskSettingsRecord { memory_enabled: enabled != 0, updated_at: Some(updated_at) },
            None => AskSettingsRecord { memory_enabled: true, updated_at: None },
        })
    }

    /// 改「让 AI 使用记忆」开关，回改完的设置。
    pub fn set_ask_memory_enabled(&self, enabled: bool) -> Result<AskSettingsRecord> {
        {
            let conn = self.connect()?;
            conn.execute(
                "INSERT INTO ask_settings (id, memory_enabled, updated_at) VALUES (1, ?1, ?2)
                 ON CONFLICT(id) DO UPDATE SET memory_enabled = excluded.memory_enabled, updated_at = excluded.updated_at",
                params![i64::from(enabled), now_iso()],
            )?;
        }
        self.ask_settings()
    }

    /// 记一条（见 [`AskMemoryCreated`]）。`max_active`：这一层（书层按书）最多几条 active。
    /// 出处的对话、消息不在库里（删了）就当没给。
    pub fn create_ask_memory(&self, new: &NewAskMemory, max_active: i64) -> Result<AskMemoryCreated> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        if let Some(document_id) = new.document_id.as_deref() {
            let exists = tx
                .query_row("SELECT 1 FROM item_files WHERE file_id = ?1", params![document_id], |_| Ok(()))
                .optional()?
                .is_some();
            if !exists {
                return Ok(AskMemoryCreated::DocumentMissing);
            }
        }
        let wanted = squeezed(&new.text);
        {
            let mut stmt = tx.prepare(&format!(
                "SELECT {MEMORY_COLUMNS} FROM ask_memories m WHERE m.scope = ?1 AND m.document_id IS ?2 AND m.status = 'active'"
            ))?;
            let rows = stmt.query_map(params![new.scope, new.document_id], row_to_memory)?;
            for row in rows {
                let row = row?;
                if squeezed(&row.text) == wanted && new.replaces.as_deref().is_none_or(|replaces| replaces != row.memory_id) {
                    return Ok(AskMemoryCreated::Duplicate(row));
                }
            }
        }
        let replaced = match new.replaces.as_deref() {
            Some(replaces) => match load_memory(&tx, replaces)? {
                Some(old) if old.status != "deleted" => Some(old),
                _ => return Ok(AskMemoryCreated::ReplacesMissing),
            },
            None => None,
        };
        let active: i64 = tx.query_row(
            "SELECT COUNT(*) FROM ask_memories WHERE scope = ?1 AND document_id IS ?2 AND status = 'active'",
            params![new.scope, new.document_id],
            |row| row.get(0),
        )?;
        let freed = replaced.as_ref().is_some_and(|old| old.status == "active" && old.scope == new.scope && old.document_id == new.document_id);
        if active - i64::from(freed) >= max_active {
            return Ok(AskMemoryCreated::LimitReached);
        }
        let memory_id = format!("mem-{}", build_job_id());
        let now = now_iso();
        tx.execute(
            "INSERT INTO ask_memories (memory_id, scope, document_id, category, text, status, origin, agent_id, source_conversation_id,
                 source_message_id, source_job_id, source_page, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'active', ?6, ?7,
                 (SELECT conversation_id FROM ask_conversations WHERE conversation_id = ?8),
                 (SELECT message_id FROM ask_conversation_messages WHERE message_id = ?9), ?10, ?11, ?12, ?12)",
            params![
                memory_id,
                new.scope,
                new.document_id,
                new.category,
                new.text,
                new.origin,
                new.agent_id,
                new.source_conversation_id,
                new.source_message_id,
                new.source_job_id,
                new.source_page,
                now,
            ],
        )?;
        if let Some(old) = replaced {
            tx.execute(
                "UPDATE ask_memories SET status = 'superseded', superseded_by = ?1, updated_at = ?2 WHERE memory_id = ?3",
                params![memory_id, now, old.memory_id],
            )?;
        }
        let record = load_memory(&tx, &memory_id)?.context("load inserted ask memory")?;
        tx.commit()?;
        Ok(AskMemoryCreated::Created(record))
    }

    /// 列、查记忆，最近改过的在前（有 `query` 时 trigram 全文检索按相关度；词不到 3 个字退回 LIKE）。
    pub fn list_ask_memories(&self, filter: &AskMemoryFilter<'_>) -> Result<Vec<AskMemoryRecord>> {
        let conn = self.connect()?;
        let mut conditions: Vec<String> = Vec::new();
        let mut values: Vec<rusqlite::types::Value> = Vec::new();
        let mut push = |condition: &str, value: rusqlite::types::Value, values: &mut Vec<rusqlite::types::Value>| {
            values.push(value);
            conditions.push(condition.replace('?', &format!("?{}", values.len())));
        };
        if let Some(scope) = filter.scope {
            push("m.scope = ?", scope.to_string().into(), &mut values);
        }
        if let Some(document_id) = filter.document_id {
            push("m.document_id = ?", document_id.to_string().into(), &mut values);
        }
        if let Some(conversation_id) = filter.source_conversation_id {
            push("m.source_conversation_id = ?", conversation_id.to_string().into(), &mut values);
        }
        if let Some(after) = filter.created_after {
            push("m.created_at > ?", after.to_string().into(), &mut values);
        }
        let statuses: Vec<&str> = if filter.statuses.is_empty() { vec!["active"] } else { filter.statuses.clone() };
        let placeholders: Vec<String> = statuses
            .iter()
            .map(|status| {
                values.push(status.to_string().into());
                format!("?{}", values.len())
            })
            .collect();
        conditions.push(format!("m.status IN ({})", placeholders.join(", ")));
        let terms: Vec<String> = filter
            .query
            .map(|query| query.split_whitespace().map(|term| term.replace('"', "")).filter(|term| !term.is_empty()).collect())
            .unwrap_or_default();
        let mut order = "m.updated_at DESC, m.memory_id DESC".to_string();
        let mut from = "ask_memories m".to_string();
        if !terms.is_empty() {
            if terms.iter().all(|term| term.chars().count() >= 3) {
                let expression = terms.iter().map(|term| format!("\"{term}\"")).collect::<Vec<_>>().join(" AND ");
                values.push(expression.into());
                from = "ask_memories m JOIN ask_memories_fts f ON f.memory_id = m.memory_id".into();
                conditions.push(format!("ask_memories_fts MATCH ?{}", values.len()));
                order = format!("bm25(ask_memories_fts), {order}");
            } else {
                for term in &terms {
                    let needle = format!("%{}%", term.replace('%', "").replace('_', ""));
                    values.push(needle.into());
                    conditions.push(format!("m.text LIKE ?{}", values.len()));
                }
            }
        }
        values.push(i64::from(filter.limit.max(1)).into());
        let sql = format!(
            "SELECT {MEMORY_COLUMNS} FROM {from} WHERE {} ORDER BY {order} LIMIT ?{}",
            conditions.join(" AND "),
            values.len()
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(values), row_to_memory)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn get_ask_memory(&self, memory_id: &str) -> Result<Option<AskMemoryRecord>> {
        let conn = self.connect()?;
        load_memory(&conn, memory_id)
    }

    /// 改字、类别（给了的才改；删了的不能改，回 None）。
    pub fn update_ask_memory(&self, memory_id: &str, text: Option<&str>, category: Option<&str>) -> Result<Option<AskMemoryRecord>> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        match load_memory(&tx, memory_id)? {
            Some(memory) if memory.status != "deleted" => {}
            _ => return Ok(None),
        }
        if let Some(text) = text {
            tx.execute("UPDATE ask_memories SET text = ?1 WHERE memory_id = ?2", params![text, memory_id])?;
        }
        if let Some(category) = category {
            tx.execute("UPDATE ask_memories SET category = ?1 WHERE memory_id = ?2", params![category, memory_id])?;
        }
        tx.execute("UPDATE ask_memories SET updated_at = ?1 WHERE memory_id = ?2", params![now_iso(), memory_id])?;
        let record = load_memory(&tx, memory_id)?;
        tx.commit()?;
        Ok(record)
    }

    /// 删一条（标 deleted，行留着）；它替代过的旧条恢复成 active（撤销一次「记住」就回到记之前）。
    /// 没有返回 None；已经删了的原样返回。
    pub fn delete_ask_memory(&self, memory_id: &str) -> Result<Option<AskMemoryRecord>> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let Some(memory) = load_memory(&tx, memory_id)? else {
            return Ok(None);
        };
        if memory.status != "deleted" {
            let now = now_iso();
            tx.execute(
                "UPDATE ask_memories SET status = 'deleted', deleted_at = ?1, updated_at = ?1 WHERE memory_id = ?2",
                params![now, memory_id],
            )?;
            tx.execute(
                "UPDATE ask_memories SET status = 'active', superseded_by = NULL, updated_at = ?1
                 WHERE superseded_by = ?2 AND status = 'superseded'",
                params![now, memory_id],
            )?;
        }
        let record = load_memory(&tx, memory_id)?;
        tx.commit()?;
        Ok(record)
    }

    /// 全部记忆的编号（比对工具用）。
    pub(crate) fn ask_memory_ids(&self) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare("SELECT memory_id FROM ask_memories ORDER BY memory_id")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

#[cfg(test)]
#[path = "ask_memories_tests.rs"]
mod tests;
