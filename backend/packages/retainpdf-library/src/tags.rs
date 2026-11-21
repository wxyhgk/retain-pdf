//! 标签（2026-11-21，数据库 v37）：建、列、改、删，给书设标签。任何条目都能打标签，接口里现在只有书。
//! 存法见数据库层 `tags.rs`：同名标签（不分大小写）只有一个，编号由名字算出来。

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::{DocumentRecord, TagRecord};
use retainpdf_data::db::OwnedKind;

use crate::documents::with_document_media_urls;
use crate::views::{CreateTagInput, PatchTagInput, SetDocumentTagsInput, TagDeleteResultView, TagListView};
use crate::LibraryDeps;

/// 标签名最长几个字。
const MAX_TAG_NAME_CHARS: usize = 64;

fn checked_name(name: &str) -> Result<&str, AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::bad_request("name must not be empty"));
    }
    if name.chars().count() > MAX_TAG_NAME_CHARS {
        return Err(AppError::bad_request(format!("name must be at most {MAX_TAG_NAME_CHARS} characters")));
    }
    Ok(name)
}

/// 空 = 不设颜色；否则必须是 `#RRGGBB`（和库里的 CHECK 一样）。
fn checked_color(color: &str) -> Result<&str, AppError> {
    let color = color.trim();
    let valid = color.is_empty()
        || (color.len() == 7 && color.starts_with('#') && color[1..].chars().all(|c| c.is_ascii_hexdigit()));
    if !valid {
        return Err(AppError::bad_request("color must be empty or #RRGGBB"));
    }
    Ok(color)
}

fn tag_or_404(deps: &LibraryDeps<'_>, tag_id: &str) -> Result<TagRecord, AppError> {
    deps.db
        .get_tag(tag_id)?
        .ok_or_else(|| AppError::not_found(format!("tag not found: {tag_id}")))
}

pub fn list_tags_view(deps: &LibraryDeps<'_>, owner: Option<&str>) -> Result<TagListView, AppError> {
    Ok(TagListView { tags: deps.db.list_tags(owner)? })
}

pub fn create_tag_view(deps: &LibraryDeps<'_>, payload: &CreateTagInput, owner: &str) -> Result<TagRecord, AppError> {
    let name = checked_name(&payload.name)?;
    let color = checked_color(payload.color.as_deref().unwrap_or(""))?;
    let (record, _created) = deps.db.create_tag(name, color, owner)?;
    Ok(record)
}

pub fn patch_tag_view(deps: &LibraryDeps<'_>, tag_id: &str, payload: &PatchTagInput) -> Result<TagRecord, AppError> {
    tag_or_404(deps, tag_id)?;
    let name = payload.name.as_deref().map(checked_name).transpose()?;
    let color = payload.color.as_deref().map(checked_color).transpose()?;
    if let Some(name) = name {
        let owner = deps.db.resource_owner(OwnedKind::Tag, tag_id)?;
        if let Some(other) = deps.db.find_tag_by_name(name, owner.as_deref())? {
            if other.tag_id != tag_id {
                return Err(AppError::conflict(format!("another tag is already named {name}: {}", other.tag_id)));
            }
        }
    }
    deps.db
        .update_tag(tag_id, name, color)
        .map_err(|error| AppError::from_lookup(error, format!("tag not found: {tag_id}")))
}

pub fn delete_tag_view(deps: &LibraryDeps<'_>, tag_id: &str) -> Result<TagDeleteResultView, AppError> {
    if !deps.db.delete_tag(tag_id)? {
        return Err(AppError::not_found(format!("tag not found: {tag_id}")));
    }
    Ok(TagDeleteResultView { tag_id: tag_id.to_string(), deleted: true })
}

/// 书的标签设成正好这几个；返回改完的书。书或任何一个标签不在 404。
pub fn set_document_tags_view(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    payload: SetDocumentTagsInput,
    base_url: &str,
) -> Result<DocumentRecord, AppError> {
    deps.db
        .get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    let mut tag_ids: Vec<String> = Vec::new();
    for tag_id in payload.tag_ids.iter().map(|id| id.trim()).filter(|id| !id.is_empty()) {
        if !tag_ids.iter().any(|seen| seen == tag_id) {
            tag_or_404(deps, tag_id)?;
            tag_ids.push(tag_id.to_string());
        }
    }
    deps.db
        .set_document_tags(document_id, &tag_ids)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    let document = deps
        .db
        .get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    Ok(with_document_media_urls(document, base_url))
}
