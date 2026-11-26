//! 主对话太长时的压缩摘要（v42 `ask_compactions`，2026-11-26 第二期）。
//!
//! 一份摘要替代一个对话 `seq <= covers_to_seq` 的消息；`covers_to_seq` 最大的那份生效，旧的留着可查。原始消息不删。
//! 摘要由后端生成（书库包 `ask_compactions.rs` 起 `python -m retainpdf_ask_agent summarize`），这里只管存取。
use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::Serialize;

use crate::models::domain::{build_job_id, now_iso};

use super::ask_conversations::load_conversation;
use super::Db;

/// 一份压缩摘要。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct AskCompactionRecord {
    pub compaction_id: String,
    pub conversation_id: String,
    /// 替代了 `seq <= covers_to_seq` 的消息。
    pub covers_to_seq: i64,
    pub summary: String,
    /// 涉及的书和页（`[{document_id, pages}]`）；没有是 None。
    pub sources: Option<serde_json::Value>,
    pub model: String,
    pub created_at: String,
}

/// 要存的一份摘要（调用方校验过长度）。
#[derive(Debug, Clone, Default)]
pub struct NewAskCompaction {
    pub covers_to_seq: i64,
    pub summary: String,
    pub sources: Option<serde_json::Value>,
    pub model: String,
}

pub enum AskCompactionInserted {
    Inserted(AskCompactionRecord),
    NotFound,
    /// `covers_to_seq` 超过了对话最后一条，或者不比现在生效的那份大（别的请求先压过了）。
    Stale,
}

const COLUMNS: &str = "compaction_id, conversation_id, covers_to_seq, summary, sources_json, model, created_at";

fn row_to_compaction(row: &rusqlite::Row<'_>) -> rusqlite::Result<AskCompactionRecord> {
    let sources: Option<String> = row.get(4)?;
    Ok(AskCompactionRecord {
        compaction_id: row.get(0)?,
        conversation_id: row.get(1)?,
        covers_to_seq: row.get(2)?,
        summary: row.get(3)?,
        sources: sources.and_then(|text| serde_json::from_str(&text).ok()),
        model: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn latest(conn: &Connection, conversation_id: &str) -> Result<Option<AskCompactionRecord>> {
    Ok(conn
        .query_row(
            &format!(
                "SELECT {COLUMNS} FROM ask_compactions WHERE conversation_id = ?1
                 ORDER BY covers_to_seq DESC, created_at DESC LIMIT 1"
            ),
            params![conversation_id],
            row_to_compaction,
        )
        .optional()?)
}

impl Db {
    /// 这个对话现在生效的那份摘要（`covers_to_seq` 最大的）；没压过是 None。
    pub fn latest_ask_compaction(&self, conversation_id: &str) -> Result<Option<AskCompactionRecord>> {
        let conn = self.connect()?;
        latest(&conn, conversation_id)
    }

    /// 这个对话所有的摘要，按 `covers_to_seq` 从小到大（消息分页画压缩点、查旧摘要用）。
    pub fn list_ask_compactions(&self, conversation_id: &str) -> Result<Vec<AskCompactionRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM ask_compactions WHERE conversation_id = ?1 ORDER BY covers_to_seq, created_at"
        ))?;
        let rows = stmt.query_map(params![conversation_id], row_to_compaction)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// `seq > after_seq` 的消息一共多少字（判断该不该压）。
    pub fn ask_message_chars_after(&self, conversation_id: &str, after_seq: i64) -> Result<i64> {
        let conn = self.connect()?;
        Ok(conn.query_row(
            "SELECT COALESCE(SUM(length(text)), 0) FROM ask_conversation_messages WHERE conversation_id = ?1 AND seq > ?2",
            params![conversation_id, after_seq],
            |row| row.get(0),
        )?)
    }

    /// 存一份新摘要。一个事务里核对：对话还在，`covers_to_seq` 不超过最后一条、比现在生效的那份大；不然回 `Stale`
    /// （两个请求同时压同一段时，后到的那份不会把先到的盖成更旧的）。
    pub fn insert_ask_compaction(&self, conversation_id: &str, new: &NewAskCompaction) -> Result<AskCompactionInserted> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let Some(conversation) = load_conversation(&tx, conversation_id)? else {
            return Ok(AskCompactionInserted::NotFound);
        };
        let current = latest(&tx, conversation_id)?.map(|record| record.covers_to_seq).unwrap_or(0);
        if new.covers_to_seq < 1 || new.covers_to_seq > conversation.last_seq || new.covers_to_seq <= current {
            return Ok(AskCompactionInserted::Stale);
        }
        let compaction_id = format!("cmp-{}", build_job_id());
        let sources = new.sources.as_ref().map(serde_json::Value::to_string);
        tx.execute(
            &format!("INSERT INTO ask_compactions ({COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"),
            params![compaction_id, conversation_id, new.covers_to_seq, new.summary, sources, new.model, now_iso()],
        )?;
        let record = latest(&tx, conversation_id)?.expect("just inserted");
        tx.commit()?;
        Ok(AskCompactionInserted::Inserted(record))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::NewAskConversationMessage;

    fn db() -> Db {
        let root = std::env::temp_dir().join(format!("retainpdf-ask-compactions-{:016x}", fastrand::u64(..)));
        let db = Db::new(root.join("db.sqlite"), root.join("data"));
        db.init().unwrap();
        db
    }

    fn message(role: &str, text: &str) -> NewAskConversationMessage {
        NewAskConversationMessage { role: role.into(), text: text.into(), ..Default::default() }
    }

    #[test]
    fn the_newest_compaction_wins_and_stale_ones_are_refused() {
        let db = db();
        let main = db.ensure_main_ask_conversation().unwrap();
        let id = main.conversation_id.as_str();
        let messages: Vec<_> = (0..6).map(|i| message(if i % 2 == 0 { "user" } else { "assistant" }, "一二三四五")).collect();
        db.append_ask_conversation_messages(id, &messages, 100).unwrap();
        assert_eq!(db.ask_message_chars_after(id, 0).unwrap(), 30);
        assert_eq!(db.ask_message_chars_after(id, 4).unwrap(), 10);
        assert!(db.latest_ask_compaction(id).unwrap().is_none());

        let first = NewAskCompaction { covers_to_seq: 4, summary: "前四条".into(), model: "m".into(), ..Default::default() };
        let AskCompactionInserted::Inserted(record) = db.insert_ask_compaction(id, &first).unwrap() else { panic!("insert") };
        assert_eq!((record.covers_to_seq, record.summary.as_str()), (4, "前四条"));
        // 不比生效的大、超过最后一条、对话不存在
        assert!(matches!(db.insert_ask_compaction(id, &first).unwrap(), AskCompactionInserted::Stale));
        let too_far = NewAskCompaction { covers_to_seq: 7, ..first.clone() };
        assert!(matches!(db.insert_ask_compaction(id, &too_far).unwrap(), AskCompactionInserted::Stale));
        assert!(matches!(db.insert_ask_compaction("conv-missing", &first).unwrap(), AskCompactionInserted::NotFound));

        let second = NewAskCompaction {
            covers_to_seq: 6,
            summary: "前六条".into(),
            sources: Some(serde_json::json!([{"document_id": "doc", "pages": [3]}])),
            model: "m".into(),
        };
        assert!(matches!(db.insert_ask_compaction(id, &second).unwrap(), AskCompactionInserted::Inserted(_)));
        let latest = db.latest_ask_compaction(id).unwrap().unwrap();
        assert_eq!((latest.covers_to_seq, latest.sources.unwrap()[0]["pages"][0].as_i64()), (6, Some(3)));
        // 旧的留着可查，原始消息一条不少
        assert_eq!(db.list_ask_compactions(id).unwrap().len(), 2);
        assert_eq!(db.list_ask_conversation_messages(id, None, 100).unwrap().len(), 6);
    }

    #[test]
    fn deleting_the_conversation_deletes_its_compactions() {
        let db = db();
        let main = db.ensure_main_ask_conversation().unwrap();
        let id = main.conversation_id.clone();
        db.append_ask_conversation_messages(&id, &[message("user", "问"), message("assistant", "答")], 100).unwrap();
        let new = NewAskCompaction { covers_to_seq: 2, summary: "s".into(), ..Default::default() };
        assert!(matches!(db.insert_ask_compaction(&id, &new).unwrap(), AskCompactionInserted::Inserted(_)));
        db.update_ask_conversation(&id, &crate::db::AskConversationChanges { status: Some("archived"), ..Default::default() }).unwrap();
        db.delete_ask_conversation(&id).unwrap();
        assert!(db.list_ask_compactions(&id).unwrap().is_empty());
    }
}
