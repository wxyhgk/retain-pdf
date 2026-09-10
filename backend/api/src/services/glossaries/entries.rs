use std::collections::HashMap;

use crate::db::Db;
use crate::error::AppError;
use crate::models::request::{CreateJobInput, GlossaryEntryInput};

use super::records::load_glossary_or_404;

pub(crate) const MAX_GLOSSARY_ENTRIES: usize = 200;
const MAX_GLOSSARY_TERM_LEN: usize = 200;
const MAX_GLOSSARY_NOTE_LEN: usize = 500;

pub(crate) fn resolve_task_glossary_request(
    db: &Db,
    input: &CreateJobInput,
) -> Result<CreateJobInput, AppError> {
    let mut resolved = input.clone();
    let inline_entries = normalize_glossary_entries(&input.translation.glossary_entries)?;
    resolved.translation.glossary_inline_entry_count = inline_entries.len() as i64;
    let glossary_id = input.translation.glossary_id.trim();
    if glossary_id.is_empty() {
        resolved.translation.glossary_entries = inline_entries;
        resolved.translation.glossary_name.clear();
        resolved.translation.glossary_resource_entry_count = 0;
        resolved.translation.glossary_overridden_entry_count = 0;
        return Ok(resolved);
    }

    let glossary = load_glossary_or_404(db, glossary_id)?;
    let base_entries = normalize_glossary_entries(&glossary.entries)?;
    let overridden_entry_count = count_overridden_entries(&base_entries, &inline_entries);
    let merged_entries = merge_glossary_entries(&base_entries, &inline_entries);
    if merged_entries.len() > MAX_GLOSSARY_ENTRIES {
        return Err(AppError::bad_request(format!(
            "merged glossary entry count exceeds {MAX_GLOSSARY_ENTRIES}"
        )));
    }
    resolved.translation.glossary_id = glossary.glossary_id;
    resolved.translation.glossary_name = glossary.name;
    resolved.translation.glossary_resource_entry_count = base_entries.len() as i64;
    resolved.translation.glossary_overridden_entry_count = overridden_entry_count as i64;
    resolved.translation.glossary_entries = merged_entries;
    Ok(resolved)
}

pub(crate) fn normalize_glossary_entries(
    entries: &[GlossaryEntryInput],
) -> Result<Vec<GlossaryEntryInput>, AppError> {
    let mut normalized = Vec::new();
    for entry in entries {
        let source = sanitize_csv_cell(&entry.source);
        let mut target = sanitize_csv_cell(&entry.target);
        let note = sanitize_csv_cell(&entry.note);
        let level = normalize_glossary_level(&entry.level);
        let match_mode = normalize_glossary_match_mode(&entry.match_mode);
        let context = sanitize_csv_cell(&entry.context);
        if source.is_empty() && target.is_empty() && note.is_empty() && context.is_empty() {
            continue;
        }
        if level == "preserve" && !source.is_empty() && target.is_empty() {
            target = source.clone();
        }
        if source.is_empty() || target.is_empty() {
            return Err(AppError::bad_request(
                "glossary entry requires both source and target",
            ));
        }
        if source.chars().count() > MAX_GLOSSARY_TERM_LEN {
            return Err(AppError::bad_request(format!(
                "glossary source exceeds {MAX_GLOSSARY_TERM_LEN} characters"
            )));
        }
        if target.chars().count() > MAX_GLOSSARY_TERM_LEN {
            return Err(AppError::bad_request(format!(
                "glossary target exceeds {MAX_GLOSSARY_TERM_LEN} characters"
            )));
        }
        if note.chars().count() > MAX_GLOSSARY_NOTE_LEN {
            return Err(AppError::bad_request(format!(
                "glossary note exceeds {MAX_GLOSSARY_NOTE_LEN} characters"
            )));
        }
        normalized.push(GlossaryEntryInput {
            source,
            target,
            note,
            level,
            match_mode,
            context,
        });
    }
    let deduped = dedupe_glossary_entries(normalized);
    if deduped.len() > MAX_GLOSSARY_ENTRIES {
        return Err(AppError::bad_request(format!(
            "glossary entry count exceeds {MAX_GLOSSARY_ENTRIES}"
        )));
    }
    Ok(deduped)
}

pub(crate) fn merge_glossary_entries(
    base_entries: &[GlossaryEntryInput],
    overlay_entries: &[GlossaryEntryInput],
) -> Vec<GlossaryEntryInput> {
    let mut merged = Vec::with_capacity(base_entries.len() + overlay_entries.len());
    let mut index_by_key: HashMap<String, usize> = HashMap::new();
    for entry in base_entries.iter().chain(overlay_entries.iter()) {
        let key = glossary_entry_key(&entry.source);
        if let Some(index) = index_by_key.get(&key).copied() {
            merged[index] = entry.clone();
        } else {
            index_by_key.insert(key, merged.len());
            merged.push(entry.clone());
        }
    }
    merged
}

pub(super) fn normalize_glossary_level(value: &str) -> String {
    match sanitize_csv_cell(value).to_ascii_lowercase().as_str() {
        "preserve" | "keep" | "keep_origin" | "keep-original" | "do_not_translate"
        | "do-not-translate" | "not_translate" | "not-translate" | "no_translate"
        | "no-translate" | "不翻译" | "保留" | "原文保留" => "preserve".to_string(),
        "canonical" | "fixed" | "fixed_translation" | "fixed-translation" | "required"
        | "强制翻译" | "固定翻译" | "专业译法" | "标准译法" => {
            "canonical".to_string()
        }
        _ => "preferred".to_string(),
    }
}

pub(super) fn normalize_glossary_match_mode(value: &str) -> String {
    match sanitize_csv_cell(value).to_ascii_lowercase().as_str() {
        "regex" => "regex".to_string(),
        "case_insensitive" | "case-insensitive" | "ci" | "ignore_case" | "ignore-case"
        | "大小写不敏感" | "忽略大小写" => "case_insensitive".to_string(),
        _ => "exact".to_string(),
    }
}

fn dedupe_glossary_entries(entries: Vec<GlossaryEntryInput>) -> Vec<GlossaryEntryInput> {
    let mut deduped = Vec::with_capacity(entries.len());
    let mut index_by_key: HashMap<String, usize> = HashMap::new();
    for entry in entries {
        let key = glossary_entry_key(&entry.source);
        if let Some(index) = index_by_key.get(&key).copied() {
            deduped[index] = entry;
        } else {
            index_by_key.insert(key, deduped.len());
            deduped.push(entry);
        }
    }
    deduped
}

fn glossary_entry_key(source: &str) -> String {
    source.trim().to_ascii_lowercase()
}

fn count_overridden_entries(
    base_entries: &[GlossaryEntryInput],
    overlay_entries: &[GlossaryEntryInput],
) -> usize {
    let base_keys: HashMap<String, ()> = base_entries
        .iter()
        .map(|entry| (glossary_entry_key(&entry.source), ()))
        .collect();
    overlay_entries
        .iter()
        .filter(|entry| base_keys.contains_key(&glossary_entry_key(&entry.source)))
        .count()
}

pub(super) fn sanitize_csv_cell(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('\u{feff}')
        .trim()
        .to_string()
}
