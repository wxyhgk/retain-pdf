use serde::{Deserialize, Serialize};

use super::common::build_job_id;
use super::input::GlossaryEntryInput;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct GlossaryRecord {
    pub glossary_id: String,
    pub name: String,
    pub entries: Vec<GlossaryEntryInput>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct GlossaryUpsertInput {
    pub name: String,
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
    pub entry_count: usize,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct GlossaryDetailView {
    pub glossary_id: String,
    pub name: String,
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

pub fn build_glossary_id() -> String {
    format!("glossary-{}", build_job_id())
}

pub fn glossary_to_summary(record: &GlossaryRecord) -> GlossarySummaryView {
    GlossarySummaryView {
        glossary_id: record.glossary_id.clone(),
        name: record.name.clone(),
        entry_count: record.entries.len(),
        created_at: record.created_at.clone(),
        updated_at: record.updated_at.clone(),
    }
}

pub fn glossary_to_detail(record: &GlossaryRecord) -> GlossaryDetailView {
    GlossaryDetailView {
        glossary_id: record.glossary_id.clone(),
        name: record.name.clone(),
        entry_count: record.entries.len(),
        entries: record.entries.clone(),
        created_at: record.created_at.clone(),
        updated_at: record.updated_at.clone(),
    }
}
