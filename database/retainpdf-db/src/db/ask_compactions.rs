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
    /// 作废的时间（v43：改了它盖过的一条问，从那里重问）；没作废是 None。
    pub superseded_at: Option<String>,
}

/// 要存的一份摘要（调用方校验过长度）。
#[derive(Debug, Clone, Default)]
pub struct NewAskCompaction {
    pub covers_to_seq: i64,
    pub summary: String,
    pub sources: Option<serde_json::Value>,
    pub model: String,
    /// 生成摘要前看到的、`covers_to_seq` 以内作废的消息有几条；存的时候变了（中途有人改了问）就回 `Stale`。
    pub superseded_before: i64,
}

pub enum AskCompactionInserted {
    Inserted(AskCompactionRecord),
    NotFound,
    /// `covers_to_seq` 超过了对话最后一条，或者不比现在生效的那份大（别的请求先压过了），或者生成摘要的时候有问被改了。
    Stale,
}

const COLUMNS: &str = "compaction_id, conversation_id, covers_to_seq, summary, sources_json, model, created_at, superseded_at";

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
        superseded_at: row.get(7)?,
    })
}

fn latest(conn: &Connection, conversation_id: &str) -> Result<Option<AskCompactionRecord>> {
    Ok(conn
        .query_row(
            &format!(
                "SELECT {COLUMNS} FROM ask_compactions WHERE conversation_id = ?1 AND superseded_at IS NULL
                 ORDER BY covers_to_seq DESC, created_at DESC LIMIT 1"
            ),
            params![conversation_id],
            row_to_compaction,
        )
        .optional()?)
}

fn superseded_up_to(conn: &Connection, conversation_id: &str, up_to_seq: i64) -> Result<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM ask_conversation_messages WHERE conversation_id = ?1 AND seq <= ?2 AND superseded_at IS NOT NULL",
        params![conversation_id, up_to_seq],
        |row| row.get(0),
    )?)
}

impl Db {
    /// 这个对话现在生效的那份摘要（没作废的里 `covers_to_seq` 最大的）；没压过是 None。
    pub fn latest_ask_compaction(&self, conversation_id: &str) -> Result<Option<AskCompactionRecord>> {
        let conn = self.connect()?;
        latest(&conn, conversation_id)
    }

    /// 这个对话所有的摘要（作废的也在），按 `covers_to_seq` 从小到大（消息分页画压缩点、查旧摘要用）。
    pub fn list_ask_compactions(&self, conversation_id: &str) -> Result<Vec<AskCompactionRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {COLUMNS} FROM ask_compactions WHERE conversation_id = ?1 ORDER BY covers_to_seq, created_at"
        ))?;
        let rows = stmt.query_map(params![conversation_id], row_to_compaction)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// `seq > after_seq` 的没作废的消息一共多少字（判断该不该压）。
    pub fn ask_message_chars_after(&self, conversation_id: &str, after_seq: i64) -> Result<i64> {
        let conn = self.connect()?;
        Ok(conn.query_row(
            "SELECT COALESCE(SUM(length(text)), 0) FROM ask_conversation_messages
             WHERE conversation_id = ?1 AND seq > ?2 AND superseded_at IS NULL",
            params![conversation_id, after_seq],
            |row| row.get(0),
        )?)
    }

    /// `seq <= up_to_seq` 的作废消息有几条（存摘要时核对生成期间没人改问）。
    pub fn superseded_ask_messages_up_to(&self, conversation_id: &str, up_to_seq: i64) -> Result<i64> {
        let conn = self.connect()?;
        superseded_up_to(&conn, conversation_id, up_to_seq)
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
        if new.covers_to_seq < 1
            || new.covers_to_seq > conversation.last_seq
            || new.covers_to_seq <= current
            || superseded_up_to(&tx, conversation_id, new.covers_to_seq)? != new.superseded_before
        {
            return Ok(AskCompactionInserted::Stale);
        }
        let compaction_id = format!("cmp-{}", build_job_id());
        let sources = new.sources.as_ref().map(serde_json::Value::to_string);
        tx.execute(
            "INSERT INTO ask_compactions (compaction_id, conversation_id, covers_to_seq, summary, sources_json, model, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
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
    use crate::db::{AskMessagesAppended, AskMessagesSuperseded, NewAskConversationMessage};

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
            superseded_before: 0,
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

    #[test]
    fn superseding_from_a_question_drops_it_and_later_messages_and_the_summaries_over_them() {
        let db = db();
        let main = db.ensure_main_ask_conversation().unwrap();
        let id = main.conversation_id.as_str();
        let messages: Vec<_> = (0..8).map(|i| message(if i % 2 == 0 { "user" } else { "assistant" }, "一二三四五")).collect();
        let AskMessagesAppended::Appended(stored) = db.append_ask_conversation_messages(id, &messages, 100).unwrap() else { panic!() };
        let early = NewAskCompaction { covers_to_seq: 2, summary: "前两条".into(), ..Default::default() };
        let AskCompactionInserted::Inserted(early) = db.insert_ask_compaction(id, &early).unwrap() else { panic!() };
        let late = NewAskCompaction { covers_to_seq: 6, summary: "前六条".into(), ..Default::default() };
        let AskCompactionInserted::Inserted(late) = db.insert_ask_compaction(id, &late).unwrap() else { panic!() };

        // 只能从这个对话里、没作废的一条问起
        assert!(matches!(db.supersede_ask_messages_from(id, &stored[3].message_id).unwrap(), AskMessagesSuperseded::NotUser));
        assert!(matches!(db.supersede_ask_messages_from(id, "msg-nope").unwrap(), AskMessagesSuperseded::MessageNotInConversation));
        assert!(matches!(db.supersede_ask_messages_from("conv-nope", &stored[2].message_id).unwrap(), AskMessagesSuperseded::NotFound));

        // 改第 5 条（seq 5）：5–8 作废，盖到 6 的那份摘要作废，盖到 2 的还生效
        let AskMessagesSuperseded::Superseded { message_ids, compaction_ids, .. } =
            db.supersede_ask_messages_from(id, &stored[4].message_id).unwrap()
        else {
            panic!()
        };
        assert_eq!(message_ids, stored[4..].iter().map(|message| message.message_id.clone()).collect::<Vec<_>>());
        assert_eq!(compaction_ids, vec![late.compaction_id.clone()]);
        assert_eq!(db.latest_ask_compaction(id).unwrap().unwrap().compaction_id, early.compaction_id);
        assert!(matches!(db.supersede_ask_messages_from(id, &stored[4].message_id).unwrap(), AskMessagesSuperseded::AlreadySuperseded));
        assert_eq!(db.ask_message_chars_after(id, 0).unwrap(), 20);
        assert_eq!(db.count_live_ask_messages_after(id, 2).unwrap(), 2);
        let live = db.list_live_ask_conversation_messages(id, None, 100).unwrap();
        assert_eq!(live.iter().map(|message| message.seq).collect::<Vec<_>>(), vec![1, 2, 3, 4]);
        let all = db.list_ask_conversation_messages(id, None, 100).unwrap();
        assert_eq!(all.len(), 8);
        assert!(all[4].superseded_at.is_some() && all[3].superseded_at.is_none());
        let listed = db.list_ask_compactions(id).unwrap();
        assert!(listed[1].superseded_at.is_some() && listed[0].superseded_at.is_none());

        // 改后的问追加在最后、指回被改的那条；指向没作废的、别的角色的不行
        let mut edited = message("user", "改过的问");
        edited.edited_from = Some(stored[2].message_id.clone());
        assert!(matches!(db.append_ask_conversation_messages(id, &[edited.clone()], 100).unwrap(), AskMessagesAppended::BadEditedFrom));
        edited.edited_from = Some(stored[5].message_id.clone());
        assert!(matches!(db.append_ask_conversation_messages(id, &[edited.clone()], 100).unwrap(), AskMessagesAppended::BadEditedFrom));
        edited.edited_from = Some(stored[4].message_id.clone());
        let AskMessagesAppended::Appended(added) = db.append_ask_conversation_messages(id, &[edited], 100).unwrap() else { panic!() };
        assert_eq!((added[0].seq, added[0].edited_from.as_deref()), (9, Some(stored[4].message_id.as_str())));

        // 生成摘要期间有人改了问：存的时候核对作废的条数，不一样回 Stale
        let racing = NewAskCompaction { covers_to_seq: 9, summary: "x".into(), superseded_before: 0, ..Default::default() };
        assert!(matches!(db.insert_ask_compaction(id, &racing).unwrap(), AskCompactionInserted::Stale));
        let fine = NewAskCompaction { covers_to_seq: 9, summary: "x".into(), superseded_before: 4, ..Default::default() };
        assert!(matches!(db.insert_ask_compaction(id, &fine).unwrap(), AskCompactionInserted::Inserted(_)));
    }

}
