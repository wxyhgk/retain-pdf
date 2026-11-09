use std::collections::HashMap;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::request::{CreateJobInput, GlossaryEntryInput};

pub(crate) const MAX_GLOSSARY_ENTRIES: usize = 1000;
const MAX_GLOSSARY_TERM_LEN: usize = 200;
const MAX_GLOSSARY_NOTE_LEN: usize = 500;
const MAX_GLOSSARY_CONTEXT_LEN: usize = 500;

/// 建任务时解析任务用的术语：按 `translation.glossary_id` 读现在的表，把 `glossary_entries`（用户内联的条目）
/// 覆盖在上面，结果写回 `glossary_entries`（快照），内联条目另存进 `glossary_inline_entries`。
/// 重跑、阶段重试先把 `glossary_entries` 换回内联条目再进这里（`JobRecord::glossary_inline_entries_for_rerun`）。
pub fn resolve_task_glossary_request(
    db: &Db,
    input: &CreateJobInput,
) -> Result<CreateJobInput, AppError> {
    let mut resolved = input.clone();
    let inline_entries = normalize_glossary_entries(&input.translation.glossary_entries)
        .map_err(|err| prefix_bad_request(err, "translation.glossary_entries"))?;
    resolved.translation.glossary_inline_entry_count = inline_entries.len() as i64;
    resolved.translation.glossary_inline_entries = inline_entries.clone();
    let glossary_id = input.translation.glossary_id.trim();
    if glossary_id.is_empty() {
        resolved.translation.glossary_entries = inline_entries;
        resolved.translation.glossary_name.clear();
        resolved.translation.glossary_resource_entry_count = 0;
        resolved.translation.glossary_overridden_entry_count = 0;
        return Ok(resolved);
    }

    // 请求里引用了不存在的表是请求写错了（400），不是要的资源不在（404）。
    let glossary = db.get_glossary(glossary_id).map_err(|error| {
        if AppError::is_record_missing(&error) {
            AppError::bad_request(format!("translation.glossary_id not found: {glossary_id}"))
        } else {
            AppError::from(error)
        }
    })?;
    if !glossary.enabled {
        return Err(AppError::bad_request(format!(
            "translation.glossary_id is disabled: {glossary_id}"
        )));
    }
    // 表里的词条保存时已经校验过；按当时的规矩存下的（例如 2026-10-22 以前没查的坏正则、超长上下文）
    // 不在建任务时再拦，只按现在的键去重。要改得去编辑那张表。
    let base_entries = dedupe_glossary_entries(glossary.entries.clone());
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

/// 重跑、阶段重试出新任务前：源任务用的那张表还得在、还得启用。
/// 删了是 409 `glossary_missing`，停用了是 409 `glossary_disabled`（请求本身没错，是表的状态不允许）；读错 500。
pub fn require_glossary_for_rerun(db: &Db, glossary_id: &str) -> Result<(), AppError> {
    match db.get_glossary(glossary_id) {
        Ok(glossary) if glossary.enabled => Ok(()),
        Ok(_) => Err(AppError::conflict_because(
            "glossary_disabled",
            format!(
                "glossary {glossary_id} used by the source job is disabled; enable it, or rerun with overrides.translation.glossary_id set to another glossary (or empty)"
            ),
        )),
        Err(error) if AppError::is_record_missing(&error) => Err(AppError::conflict_because(
            "glossary_missing",
            format!(
                "glossary {glossary_id} used by the source job has been deleted; rerun with overrides.translation.glossary_id set to another glossary (or empty)"
            ),
        )),
        Err(error) => Err(AppError::from(error)),
    }
}

/// JSON 接口的词条：规范化、校验、去重。`level`、`match_mode` 认别名，不认识的值 400。
pub(crate) fn normalize_glossary_entries(
    entries: &[GlossaryEntryInput],
) -> Result<Vec<GlossaryEntryInput>, AppError> {
    normalize_glossary_entries_counted(entries).map(|(entries, _)| entries)
}

/// 同 [`normalize_glossary_entries`]，另外返回去重时丢掉了几条。
pub(crate) fn normalize_glossary_entries_counted(
    entries: &[GlossaryEntryInput],
) -> Result<(Vec<GlossaryEntryInput>, usize), AppError> {
    let mut normalized = Vec::new();
    for entry in entries {
        let level = strict_glossary_level(&entry.level, &entry.source)?;
        let match_mode = strict_glossary_match_mode(&entry.match_mode, &entry.source)?;
        if let Some(entry) = normalize_glossary_entry(entry, level, match_mode)
            .map_err(AppError::bad_request)?
        {
            normalized.push(entry);
        }
    }
    finish_glossary_entries(normalized)
}

/// 一条词条：四项（原词、译文、备注、上下文）都空跳过（`None`）；其余按规则校验。错误是给人看的一句话。
/// `level`、`match_mode` 已经由调用方认好（JSON 严格、CSV 宽松）。
pub(super) fn normalize_glossary_entry(
    entry: &GlossaryEntryInput,
    level: String,
    match_mode: String,
) -> Result<Option<GlossaryEntryInput>, String> {
    let source = sanitize_csv_cell(&entry.source);
    let mut target = sanitize_csv_cell(&entry.target);
    let note = sanitize_csv_cell(&entry.note);
    let context = sanitize_csv_cell(&entry.context);
    if source.is_empty() && target.is_empty() && note.is_empty() && context.is_empty() {
        return Ok(None);
    }
    if level == "preserve" && !source.is_empty() && target.is_empty() {
        target = source.clone();
    }
    if source.is_empty() || target.is_empty() {
        return Err("glossary entry requires both source and target".to_string());
    }
    if source.chars().count() > MAX_GLOSSARY_TERM_LEN {
        return Err(format!(
            "glossary source exceeds {MAX_GLOSSARY_TERM_LEN} characters"
        ));
    }
    if target.chars().count() > MAX_GLOSSARY_TERM_LEN {
        return Err(format!(
            "glossary entry {source:?}: target exceeds {MAX_GLOSSARY_TERM_LEN} characters"
        ));
    }
    if note.chars().count() > MAX_GLOSSARY_NOTE_LEN {
        return Err(format!(
            "glossary entry {source:?}: note exceeds {MAX_GLOSSARY_NOTE_LEN} characters"
        ));
    }
    if context.chars().count() > MAX_GLOSSARY_CONTEXT_LEN {
        return Err(format!(
            "glossary entry {source:?}: context exceeds {MAX_GLOSSARY_CONTEXT_LEN} characters"
        ));
    }
    if match_mode == "regex" {
        validate_glossary_regex(&source)?;
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

/// 去重、卡条数上限。
pub(super) fn finish_glossary_entries(
    normalized: Vec<GlossaryEntryInput>,
) -> Result<(Vec<GlossaryEntryInput>, usize), AppError> {
    let total = normalized.len();
    let deduped = dedupe_glossary_entries(normalized);
    if deduped.len() > MAX_GLOSSARY_ENTRIES {
        return Err(AppError::bad_request(format!(
            "glossary entry count exceeds {MAX_GLOSSARY_ENTRIES}"
        )));
    }
    let duplicate_count = total - deduped.len();
    Ok((deduped, duplicate_count))
}

/// 正则词条至少要能编译。翻译用的是 Python 的 `re`，语法比 Rust 的宽：环视、反向引用 Rust 不支持，
/// 这两种放过，只拒绝明显写错的（括号不配对、量词放错地方……）。
fn validate_glossary_regex(pattern: &str) -> Result<(), String> {
    use regex_syntax::ast::ErrorKind;
    match regex_syntax::ast::parse::Parser::new().parse(pattern) {
        Ok(_) => Ok(()),
        Err(error)
            if matches!(
                error.kind(),
                ErrorKind::UnsupportedLookAround | ErrorKind::UnsupportedBackreference
            ) =>
        {
            Ok(())
        }
        Err(error) => Err(format!(
            "glossary entry {pattern:?}: invalid regex: {}",
            error.kind()
        )),
    }
}

pub(crate) fn merge_glossary_entries(
    base_entries: &[GlossaryEntryInput],
    overlay_entries: &[GlossaryEntryInput],
) -> Vec<GlossaryEntryInput> {
    let mut merged = Vec::with_capacity(base_entries.len() + overlay_entries.len());
    let mut index_by_key: HashMap<GlossaryEntryKey, usize> = HashMap::new();
    for entry in base_entries.iter().chain(overlay_entries.iter()) {
        let key = glossary_entry_key(entry);
        if let Some(index) = index_by_key.get(&key).copied() {
            merged[index] = entry.clone();
        } else {
            index_by_key.insert(key, merged.len());
            merged.push(entry.clone());
        }
    }
    merged
}

/// CSV 那边：认别名，不认识的值落到默认（`preferred`）。
pub(super) fn normalize_glossary_level(value: &str) -> String {
    glossary_level_alias(value).unwrap_or("preferred").to_string()
}

/// CSV 那边：认别名，不认识的值落到默认（`exact`）。
pub(super) fn normalize_glossary_match_mode(value: &str) -> String {
    glossary_match_mode_alias(value).unwrap_or("exact").to_string()
}

/// JSON 那边：空串是默认（`preferred`），别名照认，不认识的 400。
fn strict_glossary_level(value: &str, source: &str) -> Result<String, AppError> {
    if sanitize_csv_cell(value).is_empty() {
        return Ok("preferred".to_string());
    }
    glossary_level_alias(value).map(str::to_string).ok_or_else(|| {
        AppError::bad_request(format!(
            "glossary entry {:?}: unknown level {:?} (preserve, canonical, preferred)",
            sanitize_csv_cell(source),
            sanitize_csv_cell(value)
        ))
    })
}

/// JSON 那边：空串是默认（`exact`），别名照认，不认识的 400。
fn strict_glossary_match_mode(value: &str, source: &str) -> Result<String, AppError> {
    if sanitize_csv_cell(value).is_empty() {
        return Ok("exact".to_string());
    }
    glossary_match_mode_alias(value).map(str::to_string).ok_or_else(|| {
        AppError::bad_request(format!(
            "glossary entry {:?}: unknown match_mode {:?} (exact, case_insensitive, regex)",
            sanitize_csv_cell(source),
            sanitize_csv_cell(value)
        ))
    })
}

fn glossary_level_alias(value: &str) -> Option<&'static str> {
    match sanitize_csv_cell(value).to_ascii_lowercase().as_str() {
        "preserve" | "keep" | "keep_origin" | "keep-original" | "do_not_translate"
        | "do-not-translate" | "not_translate" | "not-translate" | "no_translate"
        | "no-translate" | "不翻译" | "保留" | "原文保留" => Some("preserve"),
        "canonical" | "fixed" | "fixed_translation" | "fixed-translation" | "required"
        | "强制翻译" | "固定翻译" | "专业译法" | "标准译法" => Some("canonical"),
        "preferred" | "prefer" | "推荐" | "推荐译法" | "建议译法" => Some("preferred"),
        _ => None,
    }
}

fn glossary_match_mode_alias(value: &str) -> Option<&'static str> {
    match sanitize_csv_cell(value).to_ascii_lowercase().as_str() {
        "regex" | "正则" => Some("regex"),
        "case_insensitive" | "case-insensitive" | "ci" | "ignore_case" | "ignore-case"
        | "大小写不敏感" | "忽略大小写" => Some("case_insensitive"),
        "exact" | "精确" | "精确匹配" | "区分大小写" => Some("exact"),
        _ => None,
    }
}

fn dedupe_glossary_entries(entries: Vec<GlossaryEntryInput>) -> Vec<GlossaryEntryInput> {
    let mut deduped = Vec::with_capacity(entries.len());
    let mut index_by_key: HashMap<GlossaryEntryKey, usize> = HashMap::new();
    for entry in entries {
        let key = glossary_entry_key(&entry);
        if let Some(index) = index_by_key.get(&key).copied() {
            deduped[index] = entry;
        } else {
            index_by_key.insert(key, deduped.len());
            deduped.push(entry);
        }
    }
    deduped
}

/// 「同一条」的键：（原词，上下文）。忽略大小写匹配的词原词按小写比，精确匹配、正则区分大小写
/// （和翻译时 Python 的匹配一致：只有 `case_insensitive` 带 IGNORECASE）；上下文忽略大小写
/// （Python 按 casefold 找上下文）。于是 `US`/`us` 两个精确词、配了不同上下文的同一个词各留一条。
/// 去重和内联覆盖表用同一个键，后面的那条为准。
type GlossaryEntryKey = (String, String);

fn glossary_entry_key(entry: &GlossaryEntryInput) -> GlossaryEntryKey {
    let source = entry.source.trim();
    let source = if entry.match_mode == "case_insensitive" {
        source.to_lowercase()
    } else {
        source.to_string()
    };
    (source, entry.context.trim().to_lowercase())
}

fn count_overridden_entries(
    base_entries: &[GlossaryEntryInput],
    overlay_entries: &[GlossaryEntryInput],
) -> usize {
    let base_keys: HashMap<GlossaryEntryKey, ()> = base_entries
        .iter()
        .map(|entry| (glossary_entry_key(entry), ()))
        .collect();
    overlay_entries
        .iter()
        .filter(|entry| base_keys.contains_key(&glossary_entry_key(entry)))
        .count()
}

fn prefix_bad_request(error: AppError, field: &str) -> AppError {
    match error {
        AppError::BadRequest(message) => AppError::bad_request(format!("{field}: {message}")),
        other => other,
    }
}

pub(super) fn sanitize_csv_cell(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('\u{feff}')
        .trim()
        .to_string()
}
