use anyhow::Result;
use rusqlite::{params, OptionalExtension};

use crate::models::api::AssetRecord;

use super::Db;

impl Db {
    pub fn save_asset(&self, asset: &AssetRecord) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            INSERT INTO assets (asset_id, mime, bytes, width, height, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(asset_id) DO NOTHING
            "#,
            params![
                asset.asset_id,
                asset.mime,
                asset.bytes as i64,
                asset.width,
                asset.height,
                asset.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_asset(&self, asset_id: &str) -> Result<Option<AssetRecord>> {
        let conn = self.connect()?;
        let record = conn
            .query_row(
                "SELECT asset_id, mime, bytes, width, height, created_at FROM assets WHERE asset_id = ?1",
                params![asset_id],
                |row| {
                    Ok(AssetRecord {
                        asset_id: row.get(0)?,
                        mime: row.get(1)?,
                        bytes: row.get::<_, i64>(2)? as u64,
                        width: row.get(3)?,
                        height: row.get(4)?,
                        created_at: row.get(5)?,
                    })
                },
            )
            .optional()?;
        Ok(record)
    }
}
