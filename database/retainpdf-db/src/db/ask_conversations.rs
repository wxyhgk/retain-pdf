//! 阅读页提问的主对话、副对话（v40，见迁移 `v40_ask_conversations.sql`）：`ask_conversations` 一个对话一行，
//! `ask_conversation_messages` 一条消息一行（只追加）。
//!
//! 这里只管行：取或建主对话、开副对话、列、读、改、删、结束副对话、追加消息、分页读消息、按书列问过的地方。
//! 出处、长度、数量怎么校验在书库包的 `ask_conversations.rs`。记忆在 `ask_memories.rs`。

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;

use crate::models::domain::{build_job_id, now_iso};

use super::Db;

/// 一个对话（不带消息）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AskConversationRecord {
    pub conversation_id: String,
    /// `main` / `side`。
    pub kind: String,
    pub parent_id: Option<String>,
    pub forked_from_message_id: Option<String>,
    /// 主对话 `open` / `archived`；副对话 `open` / `closed` / `archived`。
    pub status: String,
    pub title: String,
    pub summary: Option<String>,
    pub document_id: Option<String>,
    pub message_count: i64,
    /// 最后一条消息的 `seq`；没有消息是 0。
    pub last_seq: i64,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
}

/// 一条消息。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AskConversationMessageRecord {
    pub message_id: String,
    pub conversation_id: String,
    pub seq: i64,
    /// `user` / `assistant` / `side_summary`。
    pub role: String,
    pub text: String,
    pub thought: Option<String>,
    pub usage: Option<serde_json::Value>,
    pub agent_id: Option<String>,
    pub side_conversation_id: Option<String>,
    pub document_id: Option<String>,
    pub job_id: Option<String>,
    pub version_id: Option<String>,
    pub pane: Option<String>,
    pub page: Option<u32>,
    /// 结构化出处（原样存的 JSON 对象）；没有是 None。
    pub selection: Option<serde_json::Value>,
    pub client_message_id: Option<String>,
    pub created_at: String,
}

/// 要追加的一条消息（调用方校验过）。`memory_ids`：这条回答里记下的记忆，出处还空着的补上这条消息。
#[derive(Debug, Clone, Default)]
pub struct NewAskConversationMessage {
    pub role: String,
    pub text: String,
    pub thought: Option<String>,
    pub usage: Option<serde_json::Value>,
    pub agent_id: Option<String>,
    pub side_conversation_id: Option<String>,
    pub document_id: Option<String>,
    pub job_id: Option<String>,
    pub version_id: Option<String>,
    pub pane: Option<String>,
    pub page: Option<u32>,
    pub selection: Option<serde_json::Value>,
    pub client_message_id: Option<String>,
    pub memory_ids: Vec<String>,
}

/// 开副对话要的东西（调用方校验过）。
pub struct NewAskSideConversation<'a> {
    pub parent_id: &'a str,
    pub forked_from_message_id: Option<&'a str>,
    pub title: &'a str,
    pub document_id: Option<&'a str>,
}

/// 开副对话的结果。
pub enum AskSideCreated {
    Created(AskConversationRecord),
    ParentMissing,
    /// 父对话不是主对话（副对话里不能再开副对话）。
    ParentNotMain,
    /// 分叉的那条消息不在父对话里。
    ForkNotInParent,
    DocumentMissing,
}

/// 改一个对话：给了的才改。
#[derive(Default)]
pub struct AskConversationChanges<'a> {
    pub title: Option<&'a str>,
    pub status: Option<&'a str>,
}

pub enum AskConversationUpdated {
    Updated(AskConversationRecord),
    NotFound,
    /// 这种对话不能是这个状态（主对话没有 `closed`）。
    BadStatus,
    /// 重新打开一个主对话时已经有一个开着的了。
    AnotherOpenMain,
}

pub enum AskConversationDeleted {
    Deleted,
    NotFound,
    /// 开着的主对话：先归档再删。
    MainStillOpen,
}

pub enum AskSideClosed {
    /// 结束了；给了摘要时另有回到主对话的卡片。
    Closed(AskConversationRecord, Option<AskConversationMessageRecord>),
    NotFound,
    NotSide,
}

pub enum AskMessagesAppended {
    Appended(Vec<AskConversationMessageRecord>),
    NotFound,
    /// 对话不是 open（结束了、归档了）。
    NotOpen,
    TooMany,
}

const CONVERSATION_COLUMNS: &str = "c.conversation_id, c.kind, c.parent_id, c.forked_from_message_id, c.status, c.title, c.summary,
     c.document_id, c.created_at, c.updated_at, c.closed_at,
     (SELECT COUNT(*) FROM ask_conversation_messages m WHERE m.conversation_id = c.conversation_id),
     (SELECT COALESCE(MAX(seq), 0) FROM ask_conversation_messages m WHERE m.conversation_id = c.conversation_id)";

const MESSAGE_COLUMNS: &str = "message_id, conversation_id, seq, role, text, thought, usage_json, agent_id, side_conversation_id,
     document_id, job_id, version_id, pane, page, selection_json, client_message_id, created_at";

fn row_to_conversation(row: &rusqlite::Row<'_>) -> rusqlite::Result<AskConversationRecord> {
    Ok(AskConversationRecord {
        conversation_id: row.get(0)?,
        kind: row.get(1)?,
        parent_id: row.get(2)?,
        forked_from_message_id: row.get(3)?,
        status: row.get(4)?,
        title: row.get(5)?,
        summary: row.get(6)?,
        document_id: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        closed_at: row.get(10)?,
        message_count: row.get(11)?,
        last_seq: row.get(12)?,
    })
}

fn json_column(text: Option<String>) -> Option<serde_json::Value> {
    text.and_then(|text| serde_json::from_str(&text).ok())
}

fn row_to_message(row: &rusqlite::Row<'_>) -> rusqlite::Result<AskConversationMessageRecord> {
    Ok(AskConversationMessageRecord {
        message_id: row.get(0)?,
        conversation_id: row.get(1)?,
        seq: row.get(2)?,
        role: row.get(3)?,
        text: row.get(4)?,
        thought: row.get(5)?,
        usage: json_column(row.get(6)?),
        agent_id: row.get(7)?,
        side_conversation_id: row.get(8)?,
        document_id: row.get(9)?,
        job_id: row.get(10)?,
        version_id: row.get(11)?,
        pane: row.get(12)?,
        page: row.get(13)?,
        selection: json_column(row.get(14)?),
        client_message_id: row.get(15)?,
        created_at: row.get(16)?,
    })
}

pub(crate) fn load_conversation(conn: &Connection, conversation_id: &str) -> Result<Option<AskConversationRecord>> {
    Ok(conn
        .query_row(
            &format!("SELECT {CONVERSATION_COLUMNS} FROM ask_conversations c WHERE c.conversation_id = ?1"),
            params![conversation_id],
            row_to_conversation,
        )
        .optional()?)
}

fn load_message(conn: &Connection, message_id: &str) -> Result<Option<AskConversationMessageRecord>> {
    Ok(conn
        .query_row(
            &format!("SELECT {MESSAGE_COLUMNS} FROM ask_conversation_messages WHERE message_id = ?1"),
            params![message_id],
            row_to_message,
        )
        .optional()?)
}

fn document_exists(conn: &Connection, document_id: &str) -> Result<bool> {
    Ok(conn
        .query_row("SELECT 1 FROM item_files WHERE file_id = ?1", params![document_id], |_| Ok(()))
        .optional()?
        .is_some())
}

fn is_unique_violation(error: &rusqlite::Error) -> bool {
    matches!(error, rusqlite::Error::SqliteFailure(code, _) if code.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE)
}

/// 追加一条（在调用方的事务里）：`client_message_id` 已经有了就回原来那条，不再插。书没了（删书和追加撞上）当没有书。
fn insert_message(conn: &Connection, conversation_id: &str, message: &NewAskConversationMessage) -> Result<AskConversationMessageRecord> {
    if let Some(client_id) = message.client_message_id.as_deref() {
        let existing: Option<String> = conn
            .query_row(
                "SELECT message_id FROM ask_conversation_messages WHERE conversation_id = ?1 AND client_message_id = ?2",
                params![conversation_id, client_id],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(message_id) = existing {
            return load_message(conn, &message_id)?.context("load existing ask message");
        }
    }
    let seq: i64 = conn.query_row(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM ask_conversation_messages WHERE conversation_id = ?1",
        params![conversation_id],
        |row| row.get(0),
    )?;
    let document_id = match message.document_id.as_deref() {
        Some(document_id) if document_exists(conn, document_id)? => Some(document_id),
        _ => None,
    };
    let side = match message.side_conversation_id.as_deref() {
        Some(side) if load_conversation(conn, side)?.is_some() => Some(side),
        _ => None,
    };
    let message_id = format!("msg-{}", build_job_id());
    let usage = message.usage.as_ref().map(serde_json::to_string).transpose()?;
    let selection = message.selection.as_ref().map(serde_json::to_string).transpose()?;
    conn.execute(
        "INSERT INTO ask_conversation_messages (message_id, conversation_id, seq, role, text, thought, usage_json, agent_id,
             side_conversation_id, document_id, job_id, version_id, pane, page, selection_json, client_message_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            message_id,
            conversation_id,
            seq,
            message.role,
            message.text,
            message.thought,
            usage,
            message.agent_id,
            side,
            document_id,
            message.job_id,
            message.version_id,
            message.pane,
            message.page,
            selection,
            message.client_message_id,
            now_iso(),
        ],
    )?;
    for memory_id in &message.memory_ids {
        conn.execute(
            "UPDATE ask_memories SET source_message_id = ?1, source_conversation_id = COALESCE(source_conversation_id, ?2)
             WHERE memory_id = ?3 AND source_message_id IS NULL",
            params![message_id, conversation_id, memory_id],
        )?;
    }
    load_message(conn, &message_id)?.context("load inserted ask message")
}

fn touch(conn: &Connection, conversation_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE ask_conversations SET updated_at = ?1 WHERE conversation_id = ?2",
        params![now_iso(), conversation_id],
    )?;
    Ok(())
}

/// 列对话的条件（给了的才筛）。
#[derive(Default)]
pub struct AskConversationFilter<'a> {
    pub kind: Option<&'a str>,
    pub status: Option<&'a str>,
    pub parent_id: Option<&'a str>,
}

impl Db {
    /// 当前开着的主对话；没有就建一条空的（幂等：同一时间只有一个开着的主对话）。
    pub fn ensure_main_ask_conversation(&self) -> Result<AskConversationRecord> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let existing: Option<String> = tx
            .query_row(
                "SELECT conversation_id FROM ask_conversations WHERE kind = 'main' AND status = 'open'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        let conversation_id = match existing {
            Some(id) => id,
            None => {
                let id = format!("conv-{}", build_job_id());
                let now = now_iso();
                tx.execute(
                    "INSERT INTO ask_conversations (conversation_id, kind, status, created_at, updated_at)
                     VALUES (?1, 'main', 'open', ?2, ?2)",
                    params![id, now],
                )?;
                id
            }
        };
        let record = load_conversation(&tx, &conversation_id)?.context("load main ask conversation")?;
        tx.commit()?;
        Ok(record)
    }

    /// 开一个副对话（父对话必须是主对话）。
    pub fn create_side_ask_conversation(&self, new: &NewAskSideConversation<'_>) -> Result<AskSideCreated> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let Some(parent) = load_conversation(&tx, new.parent_id)? else {
            return Ok(AskSideCreated::ParentMissing);
        };
        if parent.kind != "main" {
            return Ok(AskSideCreated::ParentNotMain);
        }
        if let Some(message_id) = new.forked_from_message_id {
            let in_parent = load_message(&tx, message_id)?.is_some_and(|message| message.conversation_id == parent.conversation_id);
            if !in_parent {
                return Ok(AskSideCreated::ForkNotInParent);
            }
        }
        if let Some(document_id) = new.document_id {
            if !document_exists(&tx, document_id)? {
                return Ok(AskSideCreated::DocumentMissing);
            }
        }
        let id = format!("conv-{}", build_job_id());
        let now = now_iso();
        tx.execute(
            "INSERT INTO ask_conversations (conversation_id, kind, parent_id, forked_from_message_id, status, title, document_id,
                 created_at, updated_at)
             VALUES (?1, 'side', ?2, ?3, 'open', ?4, ?5, ?6, ?6)",
            params![id, new.parent_id, new.forked_from_message_id, new.title, new.document_id, now],
        )?;
        let record = load_conversation(&tx, &id)?.context("load inserted side conversation")?;
        tx.commit()?;
        Ok(AskSideCreated::Created(record))
    }

    /// 列对话：主对话在前，同类按最近改过的在前。
    pub fn list_ask_conversations(&self, filter: &AskConversationFilter<'_>) -> Result<Vec<AskConversationRecord>> {
        let conn = self.connect()?;
        let mut conditions: Vec<String> = Vec::new();
        let mut values: Vec<rusqlite::types::Value> = Vec::new();
        for (column, value) in [("c.kind", filter.kind), ("c.status", filter.status), ("c.parent_id", filter.parent_id)] {
            if let Some(value) = value {
                values.push(value.to_string().into());
                conditions.push(format!("{column} = ?{}", values.len()));
            }
        }
        let where_clause = if conditions.is_empty() { String::new() } else { format!("WHERE {}", conditions.join(" AND ")) };
        let mut stmt = conn.prepare(&format!(
            "SELECT {CONVERSATION_COLUMNS} FROM ask_conversations c {where_clause}
             ORDER BY (c.kind = 'main') DESC, c.updated_at DESC, c.created_at DESC, c.conversation_id DESC"
        ))?;
        let rows = stmt.query_map(rusqlite::params_from_iter(values), row_to_conversation)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn get_ask_conversation(&self, conversation_id: &str) -> Result<Option<AskConversationRecord>> {
        let conn = self.connect()?;
        load_conversation(&conn, conversation_id)
    }

    /// 改标题、状态（主对话 `open` / `archived`；副对话另有 `closed`，结束时记 `closed_at`）。
    pub fn update_ask_conversation(
        &self,
        conversation_id: &str,
        changes: &AskConversationChanges<'_>,
    ) -> Result<AskConversationUpdated> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let Some(current) = load_conversation(&tx, conversation_id)? else {
            return Ok(AskConversationUpdated::NotFound);
        };
        if let Some(title) = changes.title {
            tx.execute("UPDATE ask_conversations SET title = ?1 WHERE conversation_id = ?2", params![title, conversation_id])?;
        }
        if let Some(status) = changes.status {
            let allowed = match current.kind.as_str() {
                "main" => matches!(status, "open" | "archived"),
                _ => matches!(status, "open" | "closed" | "archived"),
            };
            if !allowed {
                return Ok(AskConversationUpdated::BadStatus);
            }
            if status != current.status {
                let closed_at = if status == "closed" { Some(now_iso()) } else { current.closed_at.clone().filter(|_| status != "open") };
                match tx.execute(
                    "UPDATE ask_conversations SET status = ?1, closed_at = ?2 WHERE conversation_id = ?3",
                    params![status, closed_at, conversation_id],
                ) {
                    Err(error) if is_unique_violation(&error) => return Ok(AskConversationUpdated::AnotherOpenMain),
                    other => {
                        other?;
                    }
                }
            }
        }
        touch(&tx, conversation_id)?;
        let record = load_conversation(&tx, conversation_id)?.context("load updated ask conversation")?;
        tx.commit()?;
        Ok(AskConversationUpdated::Updated(record))
    }

    /// 删一个对话（消息、它的副对话跟着删；记忆留着，出处置空）。开着的主对话不删（2026-11-26 用户定：主对话只能先归档再删）。
    pub fn delete_ask_conversation(&self, conversation_id: &str) -> Result<AskConversationDeleted> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let Some(current) = load_conversation(&tx, conversation_id)? else {
            return Ok(AskConversationDeleted::NotFound);
        };
        if current.kind == "main" && current.status == "open" {
            return Ok(AskConversationDeleted::MainStillOpen);
        }
        tx.execute("DELETE FROM ask_conversations WHERE conversation_id = ?1", params![conversation_id])?;
        tx.commit()?;
        Ok(AskConversationDeleted::Deleted)
    }

    /// 结束一个副对话：状态 `closed`。给了摘要就记下，并在主对话末尾追加一条 `side_summary` 卡片（主对话不是 open 时不追加）。
    /// 已经结束的再结束：有摘要就换成新的、再追加一张卡片；没有摘要什么都不变。
    pub fn close_side_ask_conversation(&self, conversation_id: &str, summary: Option<&str>) -> Result<AskSideClosed> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let Some(current) = load_conversation(&tx, conversation_id)? else {
            return Ok(AskSideClosed::NotFound);
        };
        if current.kind != "side" {
            return Ok(AskSideClosed::NotSide);
        }
        let now = now_iso();
        if current.status != "closed" {
            tx.execute(
                "UPDATE ask_conversations SET status = 'closed', closed_at = ?1, updated_at = ?1 WHERE conversation_id = ?2",
                params![now, conversation_id],
            )?;
        }
        let mut card = None;
        if let Some(summary) = summary {
            tx.execute(
                "UPDATE ask_conversations SET summary = ?1, updated_at = ?2 WHERE conversation_id = ?3",
                params![summary, now, conversation_id],
            )?;
            let parent_id = current.parent_id.as_deref().context("side conversation has a parent")?;
            let parent_open = load_conversation(&tx, parent_id)?.is_some_and(|parent| parent.status == "open");
            if parent_open {
                let message = NewAskConversationMessage {
                    role: "side_summary".into(),
                    text: summary.to_string(),
                    side_conversation_id: Some(conversation_id.to_string()),
                    document_id: current.document_id.clone(),
                    ..Default::default()
                };
                card = Some(insert_message(&tx, parent_id, &message)?);
                touch(&tx, parent_id)?;
            }
        }
        let record = load_conversation(&tx, conversation_id)?.context("load closed side conversation")?;
        tx.commit()?;
        Ok(AskSideClosed::Closed(record, card))
    }

    /// 往一个 open 的对话后面追加几条（一个事务；`client_message_id` 重复的回原来那条）。消息总数超过 `max_messages` 不追加。
    pub fn append_ask_conversation_messages(
        &self,
        conversation_id: &str,
        messages: &[NewAskConversationMessage],
        max_messages: i64,
    ) -> Result<AskMessagesAppended> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let Some(current) = load_conversation(&tx, conversation_id)? else {
            return Ok(AskMessagesAppended::NotFound);
        };
        if current.status != "open" {
            return Ok(AskMessagesAppended::NotOpen);
        }
        if current.message_count + messages.len() as i64 > max_messages {
            return Ok(AskMessagesAppended::TooMany);
        }
        let mut out = Vec::with_capacity(messages.len());
        for message in messages {
            out.push(insert_message(&tx, conversation_id, message)?);
        }
        touch(&tx, conversation_id)?;
        tx.commit()?;
        Ok(AskMessagesAppended::Appended(out))
    }

    /// 一页消息：`seq < before_seq`（不给是到最后）的最后 `limit` 条，按 `seq` 从小到大。
    pub fn list_ask_conversation_messages(
        &self,
        conversation_id: &str,
        before_seq: Option<i64>,
        limit: u32,
    ) -> Result<Vec<AskConversationMessageRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {MESSAGE_COLUMNS} FROM ask_conversation_messages WHERE conversation_id = ?1 AND seq < ?2
             ORDER BY seq DESC LIMIT ?3"
        ))?;
        let rows = stmt.query_map(params![conversation_id, before_seq.unwrap_or(i64::MAX), limit as i64], row_to_message)?;
        let mut messages = rows.collect::<rusqlite::Result<Vec<_>>>()?;
        messages.reverse();
        Ok(messages)
    }

    pub fn get_ask_conversation_message(&self, message_id: &str) -> Result<Option<AskConversationMessageRecord>> {
        let conn = self.connect()?;
        load_message(&conn, message_id)
    }

    /// 这本书上问过的地方：所有对话里属于这本书、有页码的问（`user`），按页、再按时间。
    pub fn list_document_ask_messages(&self, document_id: &str, limit: u32) -> Result<Vec<AskConversationMessageRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {MESSAGE_COLUMNS} FROM ask_conversation_messages
             WHERE document_id = ?1 AND role = 'user' AND page IS NOT NULL
             ORDER BY page, created_at, message_id LIMIT ?2"
        ))?;
        let rows = stmt.query_map(params![document_id, limit as i64], row_to_message)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// 全部对话的编号（比对工具用）。
    pub(crate) fn ask_conversation_ids(&self) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare("SELECT conversation_id FROM ask_conversations ORDER BY conversation_id")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

#[cfg(test)]
#[path = "ask_conversations_tests.rs"]
mod tests;
