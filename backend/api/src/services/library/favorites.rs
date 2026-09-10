//! Favorite anchors CRUD.

use crate::error::AppError;
use crate::models::api::{
    CreateFavoriteInput, FavoriteListView, FavoriteMutationResult, FavoriteRecord,
    ListFavoritesQuery, PatchFavoriteInput,
};
use crate::models::domain::{build_job_id, now_iso};

use super::LibraryDeps;

pub fn create_favorite(
    deps: &LibraryDeps<'_>,
    payload: CreateFavoriteInput,
) -> Result<FavoriteRecord, AppError> {
    let requested_job_id = payload
        .job_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(str::to_string);
    let document = if !payload.document_id.trim().is_empty() {
        deps.db
            .get_document(payload.document_id.trim())
            .map_err(|_| {
                AppError::not_found(format!("document not found: {}", payload.document_id))
            })?
    } else if let Some(job_id) = requested_job_id.as_deref() {
        // 只给 job_id 也能收藏:历史 run 同样解析到所属文档
        deps.db
            .get_document_by_job_id(job_id)?
            .ok_or_else(|| AppError::not_found(format!("no document owns job: {job_id}")))?
    } else {
        return Err(AppError::bad_request(
            "either document_id or job_id is required",
        ));
    };
    let job_id = requested_job_id
        .or(document.active_job_id.clone())
        .ok_or_else(|| {
            AppError::bad_request("document has no active job; pass job_id explicitly")
        })?;
    if payload.quote_text.trim().is_empty() {
        return Err(AppError::bad_request("quote_text must not be empty"));
    }
    let asset_id = payload
        .asset_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(str::to_string)
        .unwrap_or_default();
    if !asset_id.is_empty() && deps.db.get_asset(&asset_id)?.is_none() {
        return Err(AppError::bad_request(format!(
            "asset not found: {asset_id}; upload it via POST /api/v1/assets first"
        )));
    }
    let now = now_iso();
    let favorite = FavoriteRecord {
        favorite_id: format!("fav-{}", build_job_id()),
        document_id: document.document_id,
        job_id,
        page_idx: payload.page_idx,
        block_id: payload.block_id,
        char_start: payload.char_start,
        char_end: payload.char_end,
        kind: payload.kind.unwrap_or_else(|| "sentence".to_string()),
        quote_text: payload.quote_text,
        translated_quote_text: payload.translated_quote_text.unwrap_or_default(),
        note: payload.note.unwrap_or_default(),
        asset_id,
        rect_json: payload.rect_json.unwrap_or_default(),
        created_at: now.clone(),
        updated_at: now,
    };
    deps.db.save_favorite(&favorite)?;
    Ok(favorite)
}

pub fn list_favorites(
    deps: &LibraryDeps<'_>,
    query: &ListFavoritesQuery,
) -> Result<FavoriteListView, AppError> {
    let favorites = deps.db.list_favorites(query.document_id.as_deref())?;
    Ok(FavoriteListView { favorites })
}

pub fn patch_favorite(
    deps: &LibraryDeps<'_>,
    favorite_id: &str,
    payload: &PatchFavoriteInput,
) -> Result<FavoriteMutationResult, AppError> {
    let Some(note) = payload.note.as_ref() else {
        return Err(AppError::bad_request("note is required"));
    };
    let updated = deps.db.update_favorite_note(favorite_id, note)?;
    if !updated {
        return Err(AppError::not_found(format!(
            "favorite not found: {favorite_id}"
        )));
    }
    Ok(FavoriteMutationResult {
        updated: Some(true),
        deleted: None,
    })
}

pub fn delete_favorite(
    deps: &LibraryDeps<'_>,
    favorite_id: &str,
) -> Result<FavoriteMutationResult, AppError> {
    let deleted = deps.db.delete_favorite(favorite_id)?;
    if !deleted {
        return Err(AppError::not_found(format!(
            "favorite not found: {favorite_id}"
        )));
    }
    Ok(FavoriteMutationResult {
        updated: None,
        deleted: Some(true),
    })
}
