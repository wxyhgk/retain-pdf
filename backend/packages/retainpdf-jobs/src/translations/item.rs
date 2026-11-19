use std::path::Path;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::{redact_json_value, sensitive_values};
use crate::views::TranslationDebugItemView;
use retainpdf_core::models::domain::JobSnapshot;

use crate::data::reader_item_id;
use crate::translations::artifacts::{load_manifest_pages, translation_manifest_path};
use crate::translations::common::value_string;

/// 按编号取一条译文。阅读页的四位块号（`p012-b0005`）也认（2026-11-19）：译文条目存的可能是
/// `p012-b005` 或 `p012-b5`，按 `reader_item_id` 同一规则比对；一字不差的优先。返回的 `item_id`
/// 是条目里实际存的写法，改译文、修订历史、重放都拿它往下走。
pub(crate) fn load_translation_debug_item_view(
    data_root: &Path,
    job: &JobSnapshot,
    item_id: &str,
) -> Result<TranslationDebugItemView, AppError> {
    let manifest_path = translation_manifest_path(data_root, job)?;
    let secrets = sensitive_values(&job.request_payload);
    let wanted = reader_item_id(item_id);
    let mut same_block = None;
    for (page_idx, page_path, items) in load_manifest_pages(&manifest_path)? {
        for item in items {
            let stored = value_string(item.get("item_id"));
            let exact = stored == item_id;
            if exact || (same_block.is_none() && reader_item_id(&stored) == wanted) {
                let view = TranslationDebugItemView {
                    job_id: job.job_id.clone(),
                    item_id: stored,
                    page_idx,
                    page_number: page_idx + 1,
                    page_path: page_path.clone(),
                    item: redact_json_value(&item, &secrets),
                };
                if exact {
                    return Ok(view);
                }
                same_block = Some(view);
            }
        }
    }
    same_block.ok_or_else(|| {
        AppError::not_found(format!(
            "translation item not found: {}/{}",
            job.job_id, item_id
        ))
    })
}

/// 请求里的编号换成条目里实际存的写法；找不到（清单还没生成、条目不存在）就原样返回，
/// 交给后面照旧报 404 / not_ready。
pub(crate) fn stored_item_id(data_root: &Path, job: &JobSnapshot, item_id: &str) -> String {
    load_translation_debug_item_view(data_root, job, item_id)
        .map(|view| view.item_id)
        .unwrap_or_else(|_| item_id.to_string())
}
