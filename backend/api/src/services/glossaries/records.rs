use crate::db::Db;
use crate::error::AppError;
use crate::models::api::ListGlossariesQuery;
use crate::models::domain::{build_glossary_id, now_iso, GlossaryRecord};
use crate::models::request::GlossaryUpsertInput;

use super::entries::normalize_glossary_entries;

const MAX_GLOSSARY_NAME_LEN: usize = 120;

pub(crate) fn create_glossary(
    db: &Db,
    input: &GlossaryUpsertInput,
) -> Result<GlossaryRecord, AppError> {
    let name = normalize_glossary_name(&input.name)?;
    let entries = normalize_glossary_entries(&input.entries)?;
    let description = normalize_glossary_description(&input.description)?;
    let source_lang = normalize_glossary_lang(&input.source_lang)?;
    let target_lang = normalize_glossary_lang(&input.target_lang)?;
    let now = now_iso();
    let record = GlossaryRecord {
        glossary_id: build_glossary_id(),
        name,
        description,
        source_lang,
        target_lang,
        enabled: input.enabled,
        entries,
        created_at: now.clone(),
        updated_at: now,
    };
    db.save_glossary(&record)?;
    Ok(record)
}

pub(crate) fn update_glossary(
    db: &Db,
    glossary_id: &str,
    input: &GlossaryUpsertInput,
) -> Result<GlossaryRecord, AppError> {
    let previous = load_glossary_or_404(db, glossary_id)?;
    let record = GlossaryRecord {
        glossary_id: previous.glossary_id,
        name: normalize_glossary_name(&input.name)?,
        description: normalize_glossary_description(&input.description)?,
        source_lang: normalize_glossary_lang(&input.source_lang)?,
        target_lang: normalize_glossary_lang(&input.target_lang)?,
        enabled: input.enabled,
        entries: normalize_glossary_entries(&input.entries)?,
        created_at: previous.created_at,
        updated_at: now_iso(),
    };
    db.save_glossary(&record)?;
    Ok(record)
}

pub(crate) fn list_glossaries(db: &Db) -> Result<Vec<GlossaryRecord>, AppError> {
    let mut items = db.list_glossaries()?;
    items.sort_by(|a, b| {
        b.updated_at
            .cmp(&a.updated_at)
            .then_with(|| a.glossary_id.cmp(&b.glossary_id))
    });
    Ok(items)
}

pub(crate) fn filter_glossaries(
    items: Vec<GlossaryRecord>,
    query: &ListGlossariesQuery,
) -> Vec<GlossaryRecord> {
    items
        .into_iter()
        .filter(|item| {
            query
                .enabled
                .map(|enabled| item.enabled == enabled)
                .unwrap_or(true)
        })
        .filter(|item| {
            query
                .source_lang
                .as_ref()
                .map(|lang| item.source_lang.eq_ignore_ascii_case(lang.trim()))
                .unwrap_or(true)
        })
        .filter(|item| {
            query
                .target_lang
                .as_ref()
                .map(|lang| item.target_lang.eq_ignore_ascii_case(lang.trim()))
                .unwrap_or(true)
        })
        .filter(|item| {
            query
                .q
                .as_ref()
                .map(|needle| {
                    let needle = needle.trim().to_lowercase();
                    !needle.is_empty()
                        && (item.name.to_lowercase().contains(&needle)
                            || item.description.to_lowercase().contains(&needle)
                            || item.glossary_id.to_lowercase().contains(&needle))
                })
                .unwrap_or(true)
        })
        .collect()
}

pub(crate) fn load_glossary_or_404(db: &Db, glossary_id: &str) -> Result<GlossaryRecord, AppError> {
    db.get_glossary(glossary_id)
        .map_err(|_| AppError::not_found(format!("glossary not found: {glossary_id}")))
}

pub(crate) fn delete_glossary(db: &Db, glossary_id: &str) -> Result<(), AppError> {
    load_glossary_or_404(db, glossary_id)?;
    db.delete_glossary(glossary_id)?;
    Ok(())
}

fn normalize_glossary_name(name: &str) -> Result<String, AppError> {
    let normalized = name.trim();
    if normalized.is_empty() {
        return Err(AppError::bad_request("glossary name is required"));
    }
    if normalized.chars().count() > MAX_GLOSSARY_NAME_LEN {
        return Err(AppError::bad_request(format!(
            "glossary name exceeds {MAX_GLOSSARY_NAME_LEN} characters"
        )));
    }
    Ok(normalized.to_string())
}

fn normalize_glossary_description(description: &str) -> Result<String, AppError> {
    let normalized = description.trim();
    if normalized.chars().count() > 500 {
        return Err(AppError::bad_request(
            "glossary description exceeds 500 characters",
        ));
    }
    Ok(normalized.to_string())
}

fn normalize_glossary_lang(value: &str) -> Result<String, AppError> {
    let normalized = value.trim();
    if normalized.chars().count() > 64 {
        return Err(AppError::bad_request(
            "glossary language exceeds 64 characters",
        ));
    }
    Ok(normalized.to_string())
}
