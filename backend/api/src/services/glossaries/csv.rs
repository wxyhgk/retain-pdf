use crate::error::AppError;
use crate::models::request::{GlossaryCsvParseInput, GlossaryEntryInput};

use super::entries::{
    normalize_glossary_entries, normalize_glossary_level, normalize_glossary_match_mode,
    sanitize_csv_cell,
};

pub(crate) fn parse_glossary_csv(
    input: &GlossaryCsvParseInput,
) -> Result<Vec<GlossaryEntryInput>, AppError> {
    parse_glossary_csv_text(&input.csv_text)
}

pub(crate) fn parse_glossary_csv_text(csv_text: &str) -> Result<Vec<GlossaryEntryInput>, AppError> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(csv_text.as_bytes());
    let mut rows = Vec::new();
    for record in reader.records() {
        let record =
            record.map_err(|err| AppError::bad_request(format!("invalid glossary csv: {err}")))?;
        rows.push(record);
    }
    if rows.is_empty() {
        return Ok(Vec::new());
    }

    let header_map = detect_csv_header(&rows[0]);
    let data_rows: &[csv::StringRecord] = if header_map.is_some() {
        &rows[1..]
    } else {
        &rows
    };
    let mut entries = Vec::new();
    for row in data_rows {
        let entry = parse_csv_row(row, header_map.as_ref())?;
        if let Some(entry) = entry {
            entries.push(entry);
        }
    }
    normalize_glossary_entries(&entries)
}

fn parse_csv_row(
    row: &csv::StringRecord,
    header_map: Option<&GlossaryCsvHeader>,
) -> Result<Option<GlossaryEntryInput>, AppError> {
    let (source_idx, target_idx, note_idx, level_idx, match_mode_idx, context_idx) = header_map
        .map(|header| {
            (
                header.source_idx,
                header.target_idx,
                header.note_idx,
                header.level_idx,
                header.match_mode_idx,
                header.context_idx,
            )
        })
        .unwrap_or((0, 1, Some(2), None, None, None));
    let source = sanitize_csv_cell(row.get(source_idx).unwrap_or_default());
    let target = sanitize_csv_cell(row.get(target_idx).unwrap_or_default());
    let note = note_idx
        .and_then(|index| row.get(index))
        .map(sanitize_csv_cell)
        .unwrap_or_default();
    let level = level_idx
        .and_then(|index| row.get(index))
        .map(normalize_glossary_level)
        .unwrap_or_else(|| "preferred".to_string());
    let match_mode = match_mode_idx
        .and_then(|index| row.get(index))
        .map(normalize_glossary_match_mode)
        .unwrap_or_else(|| "exact".to_string());
    let context = context_idx
        .and_then(|index| row.get(index))
        .map(sanitize_csv_cell)
        .unwrap_or_default();
    if source.is_empty() && target.is_empty() && note.is_empty() {
        return Ok(None);
    }
    Ok(Some(GlossaryEntryInput {
        source,
        target,
        note,
        level,
        match_mode,
        context,
    }))
}

#[derive(Debug, Clone, Copy)]
struct GlossaryCsvHeader {
    source_idx: usize,
    target_idx: usize,
    note_idx: Option<usize>,
    level_idx: Option<usize>,
    match_mode_idx: Option<usize>,
    context_idx: Option<usize>,
}

fn detect_csv_header(row: &csv::StringRecord) -> Option<GlossaryCsvHeader> {
    let mut source_idx = None;
    let mut target_idx = None;
    let mut note_idx = None;
    let mut level_idx = None;
    let mut match_mode_idx = None;
    let mut context_idx = None;
    for (index, value) in row.iter().enumerate() {
        let normalized = sanitize_csv_cell(value).to_ascii_lowercase();
        match normalized.as_str() {
            "source" | "src" | "term" | "original" | "原词" | "原文" | "术语" => {
                source_idx = Some(index)
            }
            "target" | "dst" | "translation" | "translated" | "译文" | "翻译" | "目标译文" => {
                target_idx = Some(index)
            }
            "note" | "notes" | "comment" | "comments" | "备注" | "说明" => {
                note_idx = Some(index)
            }
            "level" | "glossary_level" | "mode" | "action" | "类型" | "模式" | "动作" => {
                level_idx = Some(index)
            }
            "match" | "match_mode" | "match-mode" | "匹配" | "匹配模式" => {
                match_mode_idx = Some(index)
            }
            "context" | "上下文" | "语境" => context_idx = Some(index),
            _ => {}
        }
    }
    match (source_idx, target_idx) {
        (Some(source_idx), Some(target_idx)) => Some(GlossaryCsvHeader {
            source_idx,
            target_idx,
            note_idx,
            level_idx,
            match_mode_idx,
            context_idx,
        }),
        _ => None,
    }
}
