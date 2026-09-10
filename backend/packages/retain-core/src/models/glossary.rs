use serde::{Deserialize, Serialize};

use super::common::build_job_id;
use super::input::GlossaryEntryInput;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct GlossaryRecord {
    pub glossary_id: String,
    pub name: String,
    pub description: String,
    pub source_lang: String,
    pub target_lang: String,
    pub enabled: bool,
    pub entries: Vec<GlossaryEntryInput>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct GlossaryUpsertInput {
    #[serde(default)]
    pub glossary_id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub source_lang: String,
    #[serde(default)]
    pub target_lang: String,
    #[serde(default = "default_glossary_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub entries: Vec<GlossaryEntryInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct GlossaryCsvParseInput {
    pub csv_text: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GlossarySummaryView {
    pub glossary_id: String,
    pub name: String,
    pub description: String,
    pub source_lang: String,
    pub target_lang: String,
    pub enabled: bool,
    pub entry_count: usize,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GlossaryDetailView {
    pub glossary_id: String,
    pub name: String,
    pub description: String,
    pub source_lang: String,
    pub target_lang: String,
    pub enabled: bool,
    pub entry_count: usize,
    pub entries: Vec<GlossaryEntryInput>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GlossaryListView {
    pub items: Vec<GlossarySummaryView>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GlossaryCsvParseView {
    pub entry_count: usize,
    pub entries: Vec<GlossaryEntryInput>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GlossaryCsvExportView {
    pub glossary_id: String,
    pub name: String,
    pub csv_text: String,
    pub file_name: String,
}

pub fn build_glossary_id() -> String {
    format!("glossary-{}", build_job_id())
}

pub fn glossary_to_summary(record: &GlossaryRecord) -> GlossarySummaryView {
    GlossarySummaryView {
        glossary_id: record.glossary_id.clone(),
        name: record.name.clone(),
        description: record.description.clone(),
        source_lang: record.source_lang.clone(),
        target_lang: record.target_lang.clone(),
        enabled: record.enabled,
        entry_count: record.entries.len(),
        created_at: record.created_at.clone(),
        updated_at: record.updated_at.clone(),
    }
}

pub fn glossary_to_detail(record: &GlossaryRecord) -> GlossaryDetailView {
    GlossaryDetailView {
        glossary_id: record.glossary_id.clone(),
        name: record.name.clone(),
        description: record.description.clone(),
        source_lang: record.source_lang.clone(),
        target_lang: record.target_lang.clone(),
        enabled: record.enabled,
        entry_count: record.entries.len(),
        entries: record.entries.clone(),
        created_at: record.created_at.clone(),
        updated_at: record.updated_at.clone(),
    }
}

pub fn glossary_to_csv_export(record: &GlossaryRecord) -> GlossaryCsvExportView {
    let mut csv_text = String::from("source,target,note,level,match_mode,context\n");
    for entry in &record.entries {
        csv_text.push_str(&escape_csv_cell(&entry.source));
        csv_text.push(',');
        csv_text.push_str(&escape_csv_cell(&entry.target));
        csv_text.push(',');
        csv_text.push_str(&escape_csv_cell(&entry.note));
        csv_text.push(',');
        csv_text.push_str(&escape_csv_cell(&entry.level));
        csv_text.push(',');
        csv_text.push_str(&escape_csv_cell(&entry.match_mode));
        csv_text.push(',');
        csv_text.push_str(&escape_csv_cell(&entry.context));
        csv_text.push('\n');
    }
    GlossaryCsvExportView {
        glossary_id: record.glossary_id.clone(),
        name: record.name.clone(),
        csv_text,
        file_name: format!("{}.csv", record.name.replace('/', "_")),
    }
}

fn escape_csv_cell(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        let escaped = value.replace('"', "\"\"");
        format!("\"{escaped}\"")
    } else {
        value.to_string()
    }
}

fn default_glossary_enabled() -> bool {
    true
}
