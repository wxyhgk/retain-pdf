#[path = "documents/backfill.rs"]
mod backfill;
#[path = "documents/change_stamps.rs"]
mod change_stamps;
#[path = "documents/crud.rs"]
mod crud;
#[path = "documents/rows.rs"]
pub(super) mod rows;
#[path = "documents/search.rs"]
mod search;

pub use change_stamps::DocumentChangeStamp;
pub use crud::DocumentListFilter;
pub use rows::sha256_hex;
pub use search::{
    build_document_fts, build_document_fts_selected, build_fts_rows, build_fts_rows_from_job_dir, fts_page_owners,
    FtsCandidate, FtsSelection,
};

use anyhow::Result;

use crate::db::Db;

impl Db {
    /// 存量回填:老库升级为图书馆模型。幂等且只在有缺口时做事,
    /// 稳态启动只付几条 COUNT 的代价。
    pub(in crate::db) fn backfill_library_records(&self) -> Result<()> {
        backfill::run(self)
    }
}

#[cfg(test)]
#[path = "documents/tests.rs"]
mod tests;
