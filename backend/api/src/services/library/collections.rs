//! Collection folders and document membership.

use crate::error::AppError;
use crate::models::api::{
    AddCollectionDocumentsInput, CollectionListView, CollectionMutationResult, CollectionRecord,
    CreateCollectionInput, PatchCollectionInput,
};
use crate::models::domain::build_job_id;

use super::LibraryDeps;

fn new_collection_id() -> String {
    format!("col-{}", build_job_id())
}

pub fn create_collection(
    deps: &LibraryDeps<'_>,
    payload: &CreateCollectionInput,
) -> Result<CollectionRecord, AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::bad_request("name must not be empty"));
    }
    let parent_id = payload
        .parent_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty());
    if let Some(parent_id) = parent_id {
        if deps.db.get_collection(parent_id)?.is_none() {
            return Err(AppError::not_found(format!(
                "parent collection not found: {parent_id}"
            )));
        }
    }
    Ok(deps
        .db
        .create_collection(&new_collection_id(), name, parent_id)?)
}

pub fn list_collections(deps: &LibraryDeps<'_>) -> Result<CollectionListView, AppError> {
    let collections = deps.db.list_collections()?;
    Ok(CollectionListView { collections })
}

pub fn patch_collection(
    deps: &LibraryDeps<'_>,
    collection_id: &str,
    payload: &PatchCollectionInput,
) -> Result<CollectionRecord, AppError> {
    let name = payload
        .name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if payload.name.is_some() && name.is_none() {
        return Err(AppError::bad_request("name must not be empty"));
    }
    deps.db
        .update_collection(collection_id, name, payload.sort_order)
        .map_err(|_| AppError::not_found(format!("collection not found: {collection_id}")))
}

pub fn delete_collection(
    deps: &LibraryDeps<'_>,
    collection_id: &str,
) -> Result<CollectionMutationResult, AppError> {
    let deleted = deps.db.delete_collection(collection_id)?;
    if !deleted {
        return Err(AppError::not_found(format!(
            "collection not found: {collection_id}"
        )));
    }
    Ok(CollectionMutationResult {
        deleted: Some(true),
        removed: None,
    })
}

pub fn add_collection_documents(
    deps: &LibraryDeps<'_>,
    collection_id: &str,
    payload: AddCollectionDocumentsInput,
) -> Result<CollectionRecord, AppError> {
    if deps.db.get_collection(collection_id)?.is_none() {
        return Err(AppError::not_found(format!(
            "collection not found: {collection_id}"
        )));
    }
    let document_ids: Vec<String> = payload
        .document_ids
        .into_iter()
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect();
    for document_id in &document_ids {
        if deps.db.get_document(document_id).is_err() {
            return Err(AppError::not_found(format!(
                "document not found: {document_id}"
            )));
        }
    }
    deps.db
        .add_documents_to_collection(collection_id, &document_ids)?;
    deps.db
        .get_collection(collection_id)?
        .ok_or_else(|| AppError::not_found(format!("collection not found: {collection_id}")))
}

pub fn remove_collection_document(
    deps: &LibraryDeps<'_>,
    collection_id: &str,
    document_id: &str,
) -> Result<CollectionMutationResult, AppError> {
    let removed = deps
        .db
        .remove_document_from_collection(collection_id, document_id)?;
    if !removed {
        return Err(AppError::not_found(format!(
            "document {document_id} is not in collection {collection_id}"
        )));
    }
    Ok(CollectionMutationResult {
        deleted: None,
        removed: Some(true),
    })
}
