use std::fs;
use std::path::{Path, PathBuf};

use axum::http::StatusCode;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::db::Db;
use crate::error::AppError;
use crate::models::api::{
    LiveTranslationCommitEventView, LiveTranslationItemView, LiveTranslationLayoutBlockView,
    LiveTranslationLayoutPageView, LiveTranslationLayoutView, LiveTranslationPageView,
};
use crate::models::domain::JobSnapshot;
use crate::storage_paths::{resolve_data_path, resolve_job_root, resolve_normalized_document};

const TRANSLATION_STAGE: &str = "translate";
const CHECKPOINTS_DIR: &str = ".translation-checkpoints";

#[path = "live_translation/typography.rs"]
mod typography;

use typography::{load_typography_index, TypographyIndex};

pub(super) fn load_live_translation_layout(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<LiveTranslationLayoutView, AppError> {
    let path = resolve_normalized_document(job, data_root)
        .filter(|path| path.is_file())
        .ok_or_else(|| {
            live_error(
                StatusCode::CONFLICT,
                "LIVE_TRANSLATION_LAYOUT_NOT_READY",
                "页面文字块布局尚未就绪",
            )
        })?;
    let bytes = fs::read(path).map_err(|_| {
        live_error(
            StatusCode::CONFLICT,
            "LIVE_TRANSLATION_LAYOUT_NOT_READY",
            "页面文字块布局暂时不可用",
        )
    })?;
    let document: Value = serde_json::from_slice(&bytes).map_err(|_| {
        live_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "LIVE_TRANSLATION_LAYOUT_INVALID",
            "页面文字块布局格式无效",
        )
    })?;
    let pages = document
        .get("pages")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            live_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "LIVE_TRANSLATION_LAYOUT_INVALID",
                "页面文字块布局格式无效",
            )
        })?;

    let typography = load_typography_index(data_root, job);
    let pages = pages
        .iter()
        .filter_map(|page| layout_page_from_value(page, &typography))
        .collect::<Vec<_>>();
    if pages.is_empty() {
        return Err(live_error(
            StatusCode::CONFLICT,
            "LIVE_TRANSLATION_LAYOUT_NOT_READY",
            "页面文字块布局尚未就绪",
        ));
    }
    Ok(LiveTranslationLayoutView { pages })
}

pub(super) fn load_live_translation_page(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    page_idx: u32,
) -> Result<LiveTranslationPageView, AppError> {
    let unit = db
        .latest_pipeline_unit_for_page(&job.job_id, TRANSLATION_STAGE, page_idx)?
        .ok_or_else(|| {
            live_error(
                StatusCode::NOT_FOUND,
                "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
                "该页尚无已提交的翻译",
            )
        })?;
    let translations_dir = translation_dir(data_root, job)?;
    let bytes = find_committed_page_snapshot(
        &translations_dir,
        page_idx,
        &unit.page_hash,
        unit.producer_generation,
    )?
    .ok_or_else(|| {
        live_error(
            StatusCode::CONFLICT,
            "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE",
            "已提交的翻译快照暂时不可用",
        )
    })?;
    let payload: Value = serde_json::from_slice(&bytes).map_err(|_| {
        live_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "LIVE_TRANSLATION_SNAPSHOT_INVALID",
            "已提交的翻译快照格式无效",
        )
    })?;
    let raw_items = payload
        .as_array()
        .or_else(|| payload.get("items").and_then(Value::as_array))
        .ok_or_else(|| {
            live_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "LIVE_TRANSLATION_SNAPSHOT_INVALID",
                "已提交的翻译快照格式无效",
            )
        })?;
    let items = raw_items.iter().filter_map(live_item_from_value).collect();

    Ok(LiveTranslationPageView {
        attempt: unit.attempt,
        generation: unit.generation,
        page_idx,
        page_hash: unit.page_hash,
        items,
    })
}

pub(super) fn load_live_translation_events_after(
    db: &Db,
    job_id: &str,
    after_seq: i64,
    limit: u32,
) -> Result<Vec<LiveTranslationCommitEventView>, AppError> {
    let records = db.list_translation_commit_events_after(job_id, after_seq, limit.min(256))?;
    records
        .into_iter()
        .map(|record| {
            let payload = record.payload;
            let attempt = json_u64(&payload, "attempt").ok_or_else(invalid_commit_event)? as u32;
            let generation = json_u64(&payload, "generation").ok_or_else(invalid_commit_event)?;
            let page_idx =
                json_u64(&payload, "page_index").ok_or_else(invalid_commit_event)? as u32;
            let page_hash = nonempty_string(payload.get("page_hash"))
                .filter(|value| is_sha256(value))
                .ok_or_else(invalid_commit_event)?;
            let changed_item_ids = payload
                .get("changed_item_ids")
                .and_then(Value::as_array)
                .map(|values| {
                    values
                        .iter()
                        .filter_map(|value| nonempty_string(Some(value)))
                        .map(|value| canonical_item_id(&value))
                        .collect::<Vec<_>>()
                })
                .filter(|values| !values.is_empty())
                .or_else(|| {
                    nonempty_string(payload.get("unit_key"))
                        .map(|value| vec![canonical_item_id(&value)])
                })
                .unwrap_or_default();
            Ok(LiveTranslationCommitEventView {
                event: "translation_units_committed",
                seq: record.seq,
                attempt,
                generation,
                page_idx,
                page_hash,
                changed_item_ids,
            })
        })
        .collect()
}

fn layout_page_from_value(
    page: &Value,
    typography: &TypographyIndex,
) -> Option<LiveTranslationLayoutPageView> {
    let page_idx = json_u64(page, "page_index")
        .or_else(|| json_u64(page, "page").map(|page| page.saturating_sub(1)))?
        as u32;
    let width = positive_number(page.get("width"))?;
    let height = positive_number(page.get("height"))?;
    let blocks = page
        .get("blocks")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|block| layout_block_from_value(block, page_idx, typography))
        .collect();
    Some(LiveTranslationLayoutPageView {
        page_idx,
        width,
        height,
        blocks,
    })
}

fn layout_block_from_value(
    block: &Value,
    page_idx: u32,
    typography: &TypographyIndex,
) -> Option<LiveTranslationLayoutBlockView> {
    let item_id = nonempty_string(block.get("block_id").or_else(|| block.get("item_id")))?;
    let source_text = source_text_from_item(block)?;
    let normalized_bbox = bbox_from_value(
        block
            .get("bbox")
            .or_else(|| block.get("geometry").and_then(|value| value.get("bbox"))),
    )?;
    let kind = first_string(
        block,
        &[
            "effective_role",
            "semantic_role",
            "sub_type",
            "block_type",
            "type",
        ],
    )
    .unwrap_or_else(|| "paragraph".to_string());
    let item_id = canonical_item_id(&item_id);
    let plan = typography.get(&(page_idx, item_id.clone()));
    Some(LiveTranslationLayoutBlockView {
        // Padding is measured between the renderer's background/content rects,
        // so the public bbox must use that same PDF-point coordinate system.
        bbox: plan
            .map(|plan| plan.bbox.clone())
            .unwrap_or(normalized_bbox),
        typography: plan.map(|plan| plan.view.clone()),
        item_id,
        source_text,
        kind,
    })
}

fn live_item_from_value(item: &Value) -> Option<LiveTranslationItemView> {
    let item_id = first_string(item, &["item_id", "block_id", "id"])?;
    let translated_text = translated_text_from_item(item)?;
    let status = first_string(item, &["final_status", "translation_status", "status"])
        .unwrap_or_else(|| "translated".to_string());
    Some(LiveTranslationItemView {
        item_id: canonical_item_id(&item_id),
        translated_text,
        status,
    })
}

fn translation_dir(data_root: &Path, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    let registered = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.translations_dir.as_deref());
    // `translations_dir` is normally published with terminal artifacts. Live
    // translation must also work while the worker is running, so derive the
    // standard workspace directory from the already registered job root until
    // that terminal artifact field is populated.
    let path = match registered {
        Some(raw) => resolve_data_path(data_root, raw).map_err(|_| {
            live_error(
                StatusCode::CONFLICT,
                "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE",
                "翻译快照目录不可用",
            )
        })?,
        None => resolve_job_root(job, data_root)
            .map(|root| root.join("translated"))
            .ok_or_else(|| {
                live_error(
                    StatusCode::CONFLICT,
                    "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE",
                    "翻译快照目录尚未就绪",
                )
            })?,
    };
    if !path.is_dir() {
        return Err(live_error(
            StatusCode::CONFLICT,
            "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE",
            "翻译快照目录尚未就绪",
        ));
    }
    Ok(path)
}

fn find_committed_page_snapshot(
    translations_dir: &Path,
    page_idx: u32,
    expected_hash: &str,
    preferred_generation: Option<u64>,
) -> Result<Option<Vec<u8>>, AppError> {
    let checkpoints_dir = translations_dir.join(CHECKPOINTS_DIR);
    let mut generations = fs::read_dir(&checkpoints_dir)
        .map_err(|_| {
            live_error(
                StatusCode::CONFLICT,
                "LIVE_TRANSLATION_SNAPSHOT_UNAVAILABLE",
                "翻译 checkpoint 尚未就绪",
            )
        })?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            if !file_type.is_dir() {
                return None;
            }
            let name = entry.file_name();
            let generation = name.to_str()?.strip_prefix("generation-")?.parse().ok()?;
            Some((generation, entry.path()))
        })
        .collect::<Vec<(u64, PathBuf)>>();
    generations.sort_by_key(|(generation, _)| std::cmp::Reverse(*generation));
    if let Some(preferred) = preferred_generation {
        generations.sort_by_key(|(generation, _)| *generation != preferred);
    }
    let prefix = format!("page-{:03}-", page_idx + 1);
    for (_, generation_dir) in generations {
        let Ok(entries) = fs::read_dir(generation_dir) else {
            continue;
        };
        for entry in entries.filter_map(Result::ok) {
            let Some(name) = entry.file_name().to_str().map(str::to_string) else {
                continue;
            };
            if !name.starts_with(&prefix) || !name.ends_with(".json") {
                continue;
            }
            let Ok(bytes) = fs::read(entry.path()) else {
                continue;
            };
            if sha256_hex(&bytes) == expected_hash {
                return Ok(Some(bytes));
            }
        }
    }
    Ok(None)
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn json_u64(value: &Value, key: &str) -> Option<u64> {
    value.get(key).and_then(Value::as_u64)
}

fn positive_number(value: Option<&Value>) -> Option<f64> {
    let number = value?.as_f64()?;
    (number.is_finite() && number > 0.0).then_some(number)
}

fn bbox_from_value(value: Option<&Value>) -> Option<Vec<f64>> {
    let values = value?.as_array()?;
    if values.len() < 4 {
        return None;
    }
    let bbox = values
        .iter()
        .take(4)
        .map(Value::as_f64)
        .collect::<Option<Vec<_>>>()?;
    (bbox.iter().all(|number| number.is_finite()) && bbox[2] > bbox[0] && bbox[3] > bbox[1])
        .then_some(bbox)
}

fn source_text_from_item(item: &Value) -> Option<String> {
    first_string(
        item,
        &[
            "translation_unit_protected_source_text",
            "group_protected_source_text",
            "protected_source_text",
            "source_text",
            "text",
        ],
    )
}

fn translated_text_from_item(item: &Value) -> Option<String> {
    // `translated_text` is the durable, restored text for this concrete block.
    // Protected fields may still contain model placeholders, while group/unit
    // fields may contain a whole continuation group and must not be repeated
    // over every member block.
    nonempty_raw_string(item.get("translated_text")).or_else(|| {
        (!is_multi_member_translation_unit(item))
            .then(|| {
                first_raw_string(
                    item,
                    &["translation_unit_translated_text", "group_translated_text"],
                )
            })
            .flatten()
    })
}

fn is_multi_member_translation_unit(item: &Value) -> bool {
    item.get("translation_unit_member_ids")
        .and_then(Value::as_array)
        .is_some_and(|members| members.len() > 1)
}

fn first_string(item: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| nonempty_string(item.get(*key)))
}

fn first_raw_string(item: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| nonempty_raw_string(item.get(*key)))
}

fn nonempty_raw_string(value: Option<&Value>) -> Option<String> {
    let value = value?.as_str()?;
    (!value.trim().is_empty()).then(|| value.to_string())
}

fn nonempty_string(value: Option<&Value>) -> Option<String> {
    let value = value?.as_str()?.trim();
    (!value.is_empty()).then(|| value.to_string())
}

fn canonical_item_id(value: &str) -> String {
    let Some((page, block)) = value.split_once("-b") else {
        return value.to_string();
    };
    block
        .parse::<u32>()
        .map(|number| format!("{page}-b{number:04}"))
        .unwrap_or_else(|_| value.to_string())
}

fn invalid_commit_event() -> AppError {
    live_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "LIVE_TRANSLATION_EVENT_INVALID",
        "已提交翻译事件格式无效",
    )
}

fn live_error(status: StatusCode, code: &'static str, message: &'static str) -> AppError {
    AppError::live_translation(status, code, message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonicalizes_translation_item_ids() {
        assert_eq!(canonical_item_id("p001-b3"), "p001-b0003");
        assert_eq!(canonical_item_id("p001-b0003"), "p001-b0003");
    }

    #[test]
    fn only_exposes_items_with_committed_translation_text() {
        let pending = serde_json::json!({"item_id": "p001-b1", "status": "pending"});
        assert!(live_item_from_value(&pending).is_none());
        let translated = serde_json::json!({
            "item_id": "p001-b1",
            "translated_text": "译文"
        });
        assert_eq!(
            live_item_from_value(&translated)
                .expect("translated item")
                .item_id,
            "p001-b0001"
        );
    }

    #[test]
    fn live_text_prefers_member_restored_latex_over_protected_placeholder() {
        let item = serde_json::json!({
            "item_id": "p001-b1",
            "translated_text": "结果是 $E=mc^2$。",
            "protected_translated_text": "结果是 <f1-abc/>。",
            "translation_unit_translated_text": "错误的单元级回退",
            "translation_unit_protected_translated_text": "错误的 <f1-abc/>"
        });
        assert_eq!(
            translated_text_from_item(&item).as_deref(),
            Some("结果是 $E=mc^2$。")
        );
    }

    #[test]
    fn live_text_does_not_repeat_whole_group_over_member_without_member_text() {
        let item = serde_json::json!({
            "item_id": "p001-b1",
            "translation_unit_member_ids": ["p001-b1", "p001-b2"],
            "translation_unit_translated_text": "整组译文",
            "group_translated_text": "整组译文"
        });
        assert!(translated_text_from_item(&item).is_none());
    }
}
