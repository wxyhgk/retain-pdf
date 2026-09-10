use serde::{Deserialize, Serialize};

use crate::models::defaults::*;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct GlossaryEntryInput {
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub target: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub level: String,
    #[serde(default)]
    pub match_mode: String,
    #[serde(default)]
    pub context: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct TranslationInput {
    /// Full immutable snapshot, not a pointer to mutable frontend settings.
    /// Omitted for legacy jobs; it never contains an inline model API key.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_connection: Option<crate::model_connection::ModelConnection>,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default = "default_math_mode")]
    pub math_mode: String,
    #[serde(default)]
    pub skip_title_translation: bool,
    #[serde(default = "default_classify_batch_size")]
    pub classify_batch_size: i64,
    #[serde(default = "default_rule_profile_name")]
    pub rule_profile_name: String,
    #[serde(default)]
    pub custom_rules_text: String,
    #[serde(default)]
    pub glossary_id: String,
    #[serde(default)]
    pub glossary_name: String,
    #[serde(default)]
    pub glossary_resource_entry_count: i64,
    #[serde(default)]
    pub glossary_inline_entry_count: i64,
    #[serde(default)]
    pub glossary_overridden_entry_count: i64,
    #[serde(default)]
    pub glossary_entries: Vec<GlossaryEntryInput>,
    #[serde(default = "default_translation_context_mode")]
    pub context_mode: String,
    #[serde(default = "default_translation_glossary_mode")]
    pub glossary_mode: String,
    #[serde(default = "default_translation_memory_mode")]
    pub memory_mode: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub credential_ref: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub start_page: i64,
    #[serde(default = "default_end_page")]
    pub end_page: i64,
    /// Optional explicit, one-based document page numbers. An empty list keeps
    /// the legacy start_page/end_page selection semantics.
    #[serde(default)]
    pub page_ranges: Vec<u32>,
    #[serde(default = "default_batch_size")]
    pub batch_size: i64,
    #[serde(default)]
    pub workers: i64,
    #[serde(default)]
    pub accepted_ambiguous_request_risk: bool,
}

impl Default for TranslationInput {
    fn default() -> Self {
        Self {
            execution_connection: None,
            mode: default_mode(),
            math_mode: default_math_mode(),
            skip_title_translation: false,
            classify_batch_size: default_classify_batch_size(),
            rule_profile_name: default_rule_profile_name(),
            custom_rules_text: String::new(),
            glossary_id: String::new(),
            glossary_name: String::new(),
            glossary_resource_entry_count: 0,
            glossary_inline_entry_count: 0,
            glossary_overridden_entry_count: 0,
            glossary_entries: Vec::new(),
            context_mode: default_translation_context_mode(),
            glossary_mode: default_translation_glossary_mode(),
            memory_mode: default_translation_memory_mode(),
            api_key: String::new(),
            credential_ref: String::new(),
            model: String::new(),
            base_url: String::new(),
            start_page: 0,
            end_page: default_end_page(),
            page_ranges: Vec::new(),
            batch_size: default_batch_size(),
            workers: 0,
            accepted_ambiguous_request_risk: false,
        }
    }
}

pub fn default_translation_context_mode() -> String {
    "needed".to_string()
}

pub fn default_translation_glossary_mode() -> String {
    "matched".to_string()
}

pub fn default_translation_memory_mode() -> String {
    "matched".to_string()
}
