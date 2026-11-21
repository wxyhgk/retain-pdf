//! 标签（v37，见迁移 `v37_library_tags.sql`）：`tags` 一个标签一行，`item_tags` 是条目和标签的多对多。
//!
//! 标签编号由名字算出来（[`tag_id_for_name`]）：两台设备各自建了同名标签，同步后是同一个。名字查重不分大小写、
//! 去掉首尾空白；库里不加唯一约束（同步写入时撞了会卡住），查重在建标签、改名时做。接口里现在只给书打标签，
//! 书按文件的内容指纹找到它所属的条目。

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};

use crate::models::api::TagRecord;
use crate::models::domain::now_iso;

use super::documents::sha256_hex;
use super::Db;

const TAG_COLUMNS: &str = "t.tag_id, t.name, t.color, t.created_at, t.updated_at,
     (SELECT COUNT(*) FROM item_tags it JOIN item_files f ON f.item_id = it.item_id WHERE it.tag_id = t.tag_id)";

fn row_to_tag(row: &rusqlite::Row<'_>) -> rusqlite::Result<TagRecord> {
    Ok(TagRecord {
        tag_id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        document_count: row.get(5)?,
    })
}

/// 查重用的名字：去掉首尾空白、不分大小写。
fn name_key(name: &str) -> String {
    name.trim().to_lowercase()
}

/// 同名标签在每台设备上算出同一个编号。
pub fn tag_id_for_name(name: &str) -> String {
    format!("tag-{}", &sha256_hex(name_key(name).as_bytes())[..16])
}

fn find_by_name(conn: &Connection, name: &str, owner: Option<&str>) -> Result<Option<TagRecord>> {
    Ok(conn
        .query_row(
            &format!(
                "SELECT {TAG_COLUMNS} FROM tags t
                 WHERE lower(trim(t.name)) = ?1 AND (?2 IS NULL OR t.owner_user_id = ?2)
                 ORDER BY t.created_at, t.tag_id LIMIT 1"
            ),
            params![name_key(name), owner],
            row_to_tag,
        )
        .optional()?)
}

impl Db {
    /// 全部标签，按名字排。`owner` 给了只列这个账号的（多用户模式）。
    pub fn list_tags(&self, owner: Option<&str>) -> Result<Vec<TagRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {TAG_COLUMNS} FROM tags t WHERE (?1 IS NULL OR t.owner_user_id = ?1)
             ORDER BY lower(t.name), t.tag_id"
        ))?;
        let rows = stmt.query_map(params![owner], row_to_tag)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn get_tag(&self, tag_id: &str) -> Result<Option<TagRecord>> {
        let conn = self.connect()?;
        Ok(conn
            .query_row(&format!("SELECT {TAG_COLUMNS} FROM tags t WHERE t.tag_id = ?1"), params![tag_id], row_to_tag)
            .optional()?)
    }

    /// 同名（不分大小写）的标签；`owner` 给了只在这个账号的标签里找。
    pub fn find_tag_by_name(&self, name: &str, owner: Option<&str>) -> Result<Option<TagRecord>> {
        let conn = self.connect()?;
        find_by_name(&conn, name, owner)
    }

    /// 建标签；已经有同名的（不分大小写）就返回那个，不再建。返回（标签，是不是新建的）。
    pub fn create_tag(&self, name: &str, color: &str, owner: &str) -> Result<(TagRecord, bool)> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        if let Some(existing) = find_by_name(&tx, name, Some(owner))? {
            tx.commit()?;
            return Ok((existing, false));
        }
        // 名字算出来的编号被占了（那个标签后来改了名）：用随机编号。
        let mut tag_id = tag_id_for_name(name);
        let taken = tx
            .query_row("SELECT 1 FROM tags WHERE tag_id = ?1", params![tag_id], |_| Ok(()))
            .optional()?
            .is_some();
        if taken {
            tag_id = format!("tag-{:016x}", fastrand::u64(..));
        }
        let now = now_iso();
        tx.execute(
            "INSERT INTO tags (tag_id, name, color, created_at, updated_at, owner_user_id) VALUES (?1, ?2, ?3, ?4, ?4, ?5)",
            params![tag_id, name.trim(), color, now, owner],
        )?;
        let record = tx
            .query_row(&format!("SELECT {TAG_COLUMNS} FROM tags t WHERE t.tag_id = ?1"), params![tag_id], row_to_tag)
            .context("load inserted tag")?;
        tx.commit()?;
        Ok((record, true))
    }

    /// 改名、改颜色，都可以不给。没有这个标签报 QueryReturnedNoRows（调用方判 404）。查重由调用方做。
    pub fn update_tag(&self, tag_id: &str, name: Option<&str>, color: Option<&str>) -> Result<TagRecord> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let now = now_iso();
        if let Some(name) = name {
            tx.execute("UPDATE tags SET name = ?1, updated_at = ?2 WHERE tag_id = ?3", params![name.trim(), now, tag_id])?;
        }
        if let Some(color) = color {
            tx.execute("UPDATE tags SET color = ?1, updated_at = ?2 WHERE tag_id = ?3", params![color, now, tag_id])?;
        }
        let record = tx
            .query_row(&format!("SELECT {TAG_COLUMNS} FROM tags t WHERE t.tag_id = ?1"), params![tag_id], row_to_tag)
            .optional()?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
            .with_context(|| format!("tag not found: {tag_id}"))?;
        tx.commit()?;
        Ok(record)
    }

    /// 删标签；打在条目上的随外键级联去掉。
    pub fn delete_tag(&self, tag_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        Ok(conn.execute("DELETE FROM tags WHERE tag_id = ?1", params![tag_id])? > 0)
    }

    /// 把书的标签设成正好这几个（书按文件的内容指纹找到它所属的条目）。标签要已经在（调用方查过）。
    /// 没有这本书报 QueryReturnedNoRows。
    pub fn set_document_tags(&self, document_id: &str, tag_ids: &[String]) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let item_id: String = tx
            .query_row("SELECT item_id FROM item_files WHERE file_id = ?1", params![document_id], |row| row.get(0))
            .optional()?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)
            .with_context(|| format!("document not found: {document_id}"))?;
        let current: Vec<String> = {
            let mut stmt = tx.prepare("SELECT tag_id FROM item_tags WHERE item_id = ?1")?;
            let rows = stmt.query_map(params![item_id], |row| row.get(0))?;
            rows.collect::<rusqlite::Result<_>>()?
        };
        for tag_id in current.iter().filter(|tag_id| !tag_ids.contains(tag_id)) {
            tx.execute("DELETE FROM item_tags WHERE item_id = ?1 AND tag_id = ?2", params![item_id, tag_id])?;
        }
        let now = now_iso();
        for tag_id in tag_ids.iter().filter(|tag_id| !current.contains(tag_id)) {
            tx.execute(
                "INSERT INTO item_tags (item_id, tag_id, added_at) VALUES (?1, ?2, ?3)",
                params![item_id, tag_id, now],
            )?;
        }
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
#[path = "tags_tests.rs"]
mod tests;
