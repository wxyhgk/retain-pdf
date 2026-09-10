use anyhow::Result;
use rusqlite::params;

use crate::models::api::FavoriteRecord;
use crate::models::domain::now_iso;

use super::rows::row_to_favorite;
use crate::db::Db;

impl Db {
    pub fn update_favorite_note(&self, favorite_id: &str, note: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "UPDATE favorites SET note = ?1, updated_at = ?2 WHERE favorite_id = ?3",
            params![note, now_iso(), favorite_id],
        )?;
        Ok(changed > 0)
    }

    pub fn favorites_count_for_document(&self, document_id: &str) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE document_id = ?1",
            params![document_id],
            |row| row.get(0),
        )?;
        Ok(count as u64)
    }

    pub fn save_favorite(&self, favorite: &FavoriteRecord) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            INSERT INTO favorites (
                favorite_id, document_id, job_id, page_idx, block_id,
                char_start, char_end, kind, quote_text, translated_quote_text,
                note, asset_id, rect_json, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            ON CONFLICT(favorite_id) DO UPDATE SET
                kind=excluded.kind,
                quote_text=excluded.quote_text,
                translated_quote_text=excluded.translated_quote_text,
                note=excluded.note,
                asset_id=excluded.asset_id,
                rect_json=excluded.rect_json,
                updated_at=excluded.updated_at
            "#,
            params![
                favorite.favorite_id,
                favorite.document_id,
                favorite.job_id,
                favorite.page_idx,
                favorite.block_id,
                favorite.char_start,
                favorite.char_end,
                favorite.kind,
                favorite.quote_text,
                favorite.translated_quote_text,
                favorite.note,
                favorite.asset_id,
                favorite.rect_json,
                favorite.created_at,
                favorite.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_favorites(&self, document_id: Option<&str>) -> Result<Vec<FavoriteRecord>> {
        let conn = self.connect()?;
        let (sql, args): (&str, Vec<Box<dyn rusqlite::types::ToSql>>) = match document_id {
            Some(id) => (
                "SELECT favorite_id, document_id, job_id, page_idx, block_id, char_start, char_end, kind, quote_text, translated_quote_text, note, asset_id, rect_json, created_at, updated_at FROM favorites WHERE document_id = ?1 ORDER BY page_idx, created_at",
                vec![Box::new(id.to_string())],
            ),
            None => (
                "SELECT favorite_id, document_id, job_id, page_idx, block_id, char_start, char_end, kind, quote_text, translated_quote_text, note, asset_id, rect_json, created_at, updated_at FROM favorites ORDER BY created_at DESC",
                Vec::new(),
            ),
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(
            rusqlite::params_from_iter(args.iter().map(|value| value.as_ref())),
            row_to_favorite,
        )?;
        let mut favorites = Vec::new();
        for row in rows {
            favorites.push(row?);
        }
        Ok(favorites)
    }

    pub fn delete_favorite(&self, favorite_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "DELETE FROM favorites WHERE favorite_id = ?1",
            params![favorite_id],
        )?;
        Ok(changed > 0)
    }

    /// 被收藏锚点引用的 job 不允许单独删除(锚点块空间保护)。
    pub fn favorites_referencing_job(&self, job_id: &str) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE job_id = ?1",
            params![job_id],
            |row| row.get(0),
        )?;
        Ok(count as u64)
    }
}
