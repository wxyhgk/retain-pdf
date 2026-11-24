//! 每本书的「变了没有」戳记：书库后台对账（书库包 `library_refresh`）定时比它，变了才重建全文索引、重写书文件夹。
//!
//! 只查库、不读文件，几百本书一次查询几毫秒。分两半：
//!
//! - `content`：会改变正文的东西——成功任务（编号、完成时间）、它们登记过的译文修订（`pipeline_units` 里
//!   翻译阶段每个任务的最新修改时间和行数；改译文的 PATCH 写回后会登记进这里）、译文版本（来源版本、隐藏、
//!   包含的任务）、书选的当前版本。变了要重建全文索引、重写这本书的文件夹。
//! - `card`：书目里的东西——书名、作者、页数、标签、合集。变了只重写书文件夹的 `meta.json` 和 `library.md`。
//!
//! 在跑、失败的任务不算：它们不提供内容，算进来的话翻译进行中每分钟都会变。

use anyhow::Result;

use super::rows::sha256_hex;
use crate::db::Db;

/// 一本书的戳记（两半各是一个 sha256）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentChangeStamp {
    pub document_id: String,
    pub content: String,
    pub card: String,
}

const STAMPS_SQL: &str = r#"
SELECT d.document_id,
  d.title,
  COALESCE(d.authors_json, '[]'),
  d.page_count,
  COALESCE(d.tags_json, '[]'),
  COALESCE((SELECT group_concat(x, char(31)) FROM (
      SELECT c.collection_id || '=' || c.name AS x
      FROM collection_items ci JOIN collections c ON c.collection_id = ci.collection_id
      WHERE ci.item_id = d.item_id ORDER BY c.collection_id)), ''),
  COALESCE(d.chosen_version_id, ''),
  COALESCE((SELECT group_concat(x, char(31)) FROM (
      SELECT j.job_id || '@' || COALESCE(j.finished_at, j.updated_at) AS x
      FROM jobs j WHERE j.document_id = d.document_id AND j.status = 'succeeded' ORDER BY j.job_id)), ''),
  COALESCE((SELECT group_concat(x, char(31)) FROM (
      SELECT u.job_id || '@' || MAX(u.updated_at) || '#' || COUNT(*) AS x
      FROM pipeline_units u JOIN jobs j ON j.job_id = u.job_id
      WHERE j.document_id = d.document_id AND j.status = 'succeeded' AND u.stage_key = 'translate'
      GROUP BY u.job_id ORDER BY u.job_id)), ''),
  COALESCE((SELECT group_concat(x, char(31)) FROM (
      SELECT v.version_id || '<' || COALESCE(v.base_version_id, '') || '!' || COALESCE(v.hidden_at, '') || '=' ||
             COALESCE((SELECT group_concat(job_id, ',') FROM (
                 SELECT job_id FROM translation_version_jobs WHERE version_id = v.version_id ORDER BY job_id)), '') AS x
      FROM translation_versions v WHERE v.document_id = d.document_id ORDER BY v.version_id)), '')
FROM library_documents d
ORDER BY d.document_id
"#;

impl Db {
    /// 全部书的戳记，按书编号排。规则见模块说明。
    pub fn document_change_stamps(&self) -> Result<Vec<DocumentChangeStamp>> {
        let conn = self.connect()?;
        let mut statement = conn.prepare(STAMPS_SQL)?;
        let rows = statement.query_map([], |row| {
            let field = |index: usize| -> rusqlite::Result<String> {
                Ok(match row.get_ref(index)? {
                    rusqlite::types::ValueRef::Null => String::new(),
                    rusqlite::types::ValueRef::Integer(value) => value.to_string(),
                    rusqlite::types::ValueRef::Real(value) => value.to_string(),
                    rusqlite::types::ValueRef::Text(text) | rusqlite::types::ValueRef::Blob(text) => {
                        String::from_utf8_lossy(text).into_owned()
                    }
                })
            };
            let card = [field(1)?, field(2)?, field(3)?, field(4)?, field(5)?].join("\u{1e}");
            let content = [field(6)?, field(7)?, field(8)?, field(9)?].join("\u{1e}");
            Ok(DocumentChangeStamp {
                document_id: field(0)?,
                content: sha256_hex(content.as_bytes()),
                card: sha256_hex(card.as_bytes()),
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}
