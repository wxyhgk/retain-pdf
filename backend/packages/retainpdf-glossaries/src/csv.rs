use retainpdf_api_base::error::AppError;
use super::views::GlossaryCsvParseInput;
use retainpdf_core::models::request::GlossaryEntryInput;

use super::entries::{
    finish_glossary_entries, normalize_glossary_entry, normalize_glossary_level,
    normalize_glossary_match_mode, sanitize_csv_cell,
};

/// 导出时为防公式注入在单元格前加的 `'`，以及会触发它的开头字符（Excel、WPS 把这些开头当公式）。
pub(super) const CSV_FORMULA_GUARD: char = '\'';
pub(super) const CSV_FORMULA_TRIGGERS: &[char] = &['=', '+', '-', '@', '\t', '\r'];

pub(crate) struct ParsedGlossaryCsv {
    pub(crate) entries: Vec<GlossaryEntryInput>,
    pub(crate) duplicate_count: usize,
}

pub(crate) fn parse_glossary_csv(input: &GlossaryCsvParseInput) -> Result<ParsedGlossaryCsv, AppError> {
    parse_glossary_csv_counted(&input.csv_text)
}

#[cfg(test)]
pub(crate) fn parse_glossary_csv_text(csv_text: &str) -> Result<Vec<GlossaryEntryInput>, AppError> {
    parse_glossary_csv_counted(csv_text).map(|parsed| parsed.entries)
}

/// 先按 CSV 引号规则解析候选分隔符，再比较表头和列数一致性，避免把单元格内的逗号误判为分隔符。
fn detect_delimiter(csv_text: &str) -> u8 {
    let mut best = (b',', 0);
    for delimiter in [b',', b'\t', b';'] {
        let mut reader = csv::ReaderBuilder::new()
            .has_headers(false)
            .flexible(true)
            .delimiter(delimiter)
            .from_reader(csv_text.as_bytes());
        let rows: Vec<_> = reader.records().take(20).filter_map(Result::ok)
            .filter(|row| row.iter().any(|cell| !cell.trim().is_empty())).collect();
        if let Some(first) = rows.first() {
            let width = first.len();
            let consistent = rows.iter().filter(|row| row.len() == width).count();
            let score = usize::from(detect_csv_header(first).is_some()) * 10000
                + usize::from(width > 1) * 100
                + consistent * 10 / rows.len()
                + width.min(50);
            if score > best.1 { best = (delimiter, score); }
        }
    }
    best.0
}

fn parse_glossary_csv_counted(csv_text: &str) -> Result<ParsedGlossaryCsv, AppError> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .delimiter(detect_delimiter(csv_text))
        .from_reader(csv_text.as_bytes());
    let mut rows = Vec::new();
    for record in reader.records() {
        let record =
            record.map_err(|err| AppError::bad_request(format!("invalid glossary csv: {err}")))?;
        rows.push(record);
    }
    if rows.is_empty() {
        return Ok(ParsedGlossaryCsv { entries: Vec::new(), duplicate_count: 0 });
    }

    let header_map = detect_csv_header(&rows[0]);
    let data_rows: &[csv::StringRecord] = if header_map.is_some() {
        &rows[1..]
    } else {
        &rows
    };
    let mut entries = Vec::new();
    for (index, row) in data_rows.iter().enumerate() {
        // 行号是文本里的行（从 1 数，含表头），带引号的多行单元格按开头那一行算。
        let line = row
            .position()
            .map(|position| position.line())
            .unwrap_or((index + 1 + usize::from(header_map.is_some())) as u64);
        let entry = parse_csv_row(row, header_map.as_ref());
        let level = entry.level.clone();
        let match_mode = entry.match_mode.clone();
        match normalize_glossary_entry(&entry, level, match_mode) {
            Ok(Some(entry)) => entries.push(entry),
            Ok(None) => {}
            Err(message) => return Err(AppError::bad_request(format!("row {line}: {message}"))),
        }
    }
    let (entries, duplicate_count) = finish_glossary_entries(entries)?;
    Ok(ParsedGlossaryCsv { entries, duplicate_count })
}

/// 一个单元格：去掉空白、BOM，再去掉导出时防公式注入加的 `'`（只在它后面跟着会触发公式的字符时）。
fn read_csv_cell(value: &str) -> String {
    let cell = sanitize_csv_cell(value);
    let mut chars = cell.chars();
    if chars.next() == Some(CSV_FORMULA_GUARD)
        && chars.next().is_some_and(|ch| CSV_FORMULA_TRIGGERS.contains(&ch))
    {
        return cell[CSV_FORMULA_GUARD.len_utf8()..].to_string();
    }
    cell
}

fn parse_csv_row(
    row: &csv::StringRecord,
    header_map: Option<&GlossaryCsvHeader>,
) -> GlossaryEntryInput {
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
        // 没有表头时的默认列序：原词,译文,备注（2026-10-22 定不改，前端改占位符）。
        .unwrap_or((0, 1, Some(2), None, None, None));
    let source = read_csv_cell(row.get(source_idx).unwrap_or_default());
    let target = read_csv_cell(row.get(target_idx).unwrap_or_default());
    let note = note_idx
        .and_then(|index| row.get(index))
        .map(read_csv_cell)
        .unwrap_or_default();
    let level = level_idx
        .and_then(|index| row.get(index))
        .map(|value| normalize_glossary_level(&read_csv_cell(value)))
        .unwrap_or_else(|| "preferred".to_string());
    let match_mode = match_mode_idx
        .and_then(|index| row.get(index))
        .map(|value| normalize_glossary_match_mode(&read_csv_cell(value)))
        .unwrap_or_else(|| "exact".to_string());
    let context = context_idx
        .and_then(|index| row.get(index))
        .map(read_csv_cell)
        .unwrap_or_default();
    GlossaryEntryInput {
        source,
        target,
        note,
        level,
        match_mode,
        context,
    }
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
