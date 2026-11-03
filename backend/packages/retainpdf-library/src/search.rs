//! Block full-text search.

use std::collections::HashMap;

use retainpdf_core::config::limits::MAX_SEARCH_LIMIT;
use retainpdf_api_base::error::AppError;
use retainpdf_api_base::paging::checked_limit;
use crate::views::{SearchHitView, SearchQuery, SearchResultView};

use super::LibraryDeps;

pub fn search_blocks(
    deps: &LibraryDeps<'_>,
    query: &SearchQuery,
    owner: Option<&str>,
) -> Result<SearchResultView, AppError> {
    let limit = checked_limit(query.limit, MAX_SEARCH_LIMIT)?;
    let document_id = query.document_id.trim();
    // 多取一条：有第 limit+1 条就说明命中不止这些。
    let mut hits = deps.db.search_blocks_for_owner(
        &query.q,
        limit + 1,
        if document_id.is_empty() {
            None
        } else {
            Some(document_id)
        },
        owner,
    )?;
    let has_more = hits.len() > limit as usize;
    hits.truncate(limit as usize);
    // 每个任务的 OCR 页号表只读一次（命中常集中在一两个任务）。
    let mut ocr_pages: HashMap<String, Option<Vec<u32>>> = HashMap::new();
    let hits = hits
        .into_iter()
        .map(|hit| {
            let pages = ocr_pages.entry(hit.job_id.clone()).or_insert_with(|| {
                deps.db
                    .get_job(&hit.job_id)
                    .ok()
                    .and_then(|job| job.artifacts.map(|artifacts| artifacts.ocr_page_numbers))
            });
            let document_page = pages.as_deref().and_then(|pages| document_page(pages, hit.page_idx));
            SearchHitView { hit, document_page }
        })
        .collect();
    Ok(SearchResultView {
        query: query.q.clone(),
        hits,
        limit,
        has_more,
    })
}

/// 索引行的本地页号（OCR 文档里的第几页，0 起）换成整本书的页号（1 起）。和建索引时一样：老任务没记
/// `ocr_page_numbers`，那时 OCR 都是整本，文档页 = 本地页 + 1。
fn document_page(ocr_pages: &[u32], local_page_idx: i64) -> Option<i64> {
    let local = usize::try_from(local_page_idx).ok()?;
    if ocr_pages.is_empty() {
        return Some(local_page_idx + 1);
    }
    ocr_pages.get(local).map(|page| i64::from(*page))
}

#[cfg(test)]
mod tests {
    use super::document_page;

    #[test]
    fn local_index_pages_map_to_whole_book_pages() {
        // 只 OCR 了第 11-13 页的任务：本地第 0 页是书的第 11 页
        assert_eq!(document_page(&[11, 12, 13], 0), Some(11));
        assert_eq!(document_page(&[11, 12, 13], 2), Some(13));
        assert_eq!(document_page(&[11, 12, 13], 3), None);
        // 老任务：整本 OCR
        assert_eq!(document_page(&[], 4), Some(5));
        assert_eq!(document_page(&[11], -1), None);
    }
}
