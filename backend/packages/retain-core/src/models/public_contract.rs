use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

use super::common::WorkflowKind;
use super::input::{
    GlossaryEntryInput, RenderInput, ResolvedJobSpec, ResolvedSourceSpec, RuntimeInput,
};

#[derive(Debug, Serialize, Clone)]
pub struct PublicResolvedJobSpec {
    pub workflow: WorkflowKind,
    pub job_id: String,
    pub source: ResolvedSourceSpec,
    pub ocr: PublicOcrInput,
    pub translation: PublicTranslationInput,
    pub render: RenderInput,
    pub runtime: RuntimeInput,
}

#[derive(Debug, Serialize, Clone)]
pub struct PublicOcrInput {
    pub provider: String,
    pub credential_ref: String,
    pub mineru_token: String,
    pub mineru_token_configured: bool,
    pub model_version: String,
    pub paddle_token: String,
    pub paddle_token_configured: bool,
    pub paddle_api_url: String,
    pub paddle_model: String,
    pub is_ocr: bool,
    pub disable_formula: bool,
    pub disable_table: bool,
    pub language: String,
    pub page_ranges: String,
    pub data_id: String,
    pub no_cache: bool,
    pub cache_tolerance: i64,
    pub extra_formats: String,
    pub poll_interval: i64,
    pub poll_timeout: i64,
    pub options: BTreeMap<String, Value>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PublicTranslationInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_connection: Option<crate::model_connection::ModelConnection>,
    pub mode: String,
    pub math_mode: String,
    pub skip_title_translation: bool,
    pub classify_batch_size: i64,
    pub rule_profile_name: String,
    pub custom_rules_text: String,
    pub glossary_id: String,
    pub glossary_name: String,
    pub glossary_resource_entry_count: i64,
    pub glossary_inline_entry_count: i64,
    pub glossary_overridden_entry_count: i64,
    pub glossary_entries: Vec<GlossaryEntryInput>,
    pub context_mode: String,
    pub glossary_mode: String,
    pub memory_mode: String,
    pub api_key: String,
    pub api_key_configured: bool,
    pub credential_ref: String,
    pub model: String,
    pub base_url: String,
    pub start_page: i64,
    pub end_page: i64,
    pub page_ranges: Vec<u32>,
    pub batch_size: i64,
    pub workers: i64,
    pub accepted_ambiguous_request_risk: bool,
}

pub fn public_request_payload(spec: &ResolvedJobSpec) -> PublicResolvedJobSpec {
    let ocr_credential_ref_configured = !spec.ocr.credential_ref.trim().is_empty();
    let ocr_provider = spec.ocr.provider.trim();
    PublicResolvedJobSpec {
        workflow: spec.workflow.clone(),
        job_id: spec.job_id.clone(),
        source: spec.source.clone(),
        ocr: PublicOcrInput {
            provider: spec.ocr.provider.clone(),
            credential_ref: spec.ocr.credential_ref.clone(),
            mineru_token: String::new(),
            mineru_token_configured: !spec.ocr.mineru_token.trim().is_empty()
                || (ocr_credential_ref_configured && ocr_provider.eq_ignore_ascii_case("mineru")),
            model_version: spec.ocr.model_version.clone(),
            paddle_token: String::new(),
            paddle_token_configured: !spec.ocr.paddle_token.trim().is_empty()
                || (ocr_credential_ref_configured && ocr_provider.eq_ignore_ascii_case("paddle")),
            paddle_api_url: spec.ocr.paddle_api_url.clone(),
            paddle_model: spec.ocr.paddle_model.clone(),
            is_ocr: spec.ocr.is_ocr,
            disable_formula: spec.ocr.disable_formula,
            disable_table: spec.ocr.disable_table,
            language: spec.ocr.language.clone(),
            page_ranges: spec.ocr.page_ranges.clone(),
            data_id: spec.ocr.data_id.clone(),
            no_cache: spec.ocr.no_cache,
            cache_tolerance: spec.ocr.cache_tolerance,
            extra_formats: spec.ocr.extra_formats.clone(),
            poll_interval: spec.ocr.poll_interval,
            poll_timeout: spec.ocr.poll_timeout,
            options: public_ocr_options(&spec.ocr.options),
        },
        translation: PublicTranslationInput {
            execution_connection: spec.translation.execution_connection.clone(),
            mode: spec.translation.mode.clone(),
            math_mode: spec.translation.math_mode.clone(),
            skip_title_translation: spec.translation.skip_title_translation,
            classify_batch_size: spec.translation.classify_batch_size,
            rule_profile_name: spec.translation.rule_profile_name.clone(),
            custom_rules_text: spec.translation.custom_rules_text.clone(),
            glossary_id: spec.translation.glossary_id.clone(),
            glossary_name: spec.translation.glossary_name.clone(),
            glossary_resource_entry_count: spec.translation.glossary_resource_entry_count,
            glossary_inline_entry_count: spec.translation.glossary_inline_entry_count,
            glossary_overridden_entry_count: spec.translation.glossary_overridden_entry_count,
            glossary_entries: spec.translation.glossary_entries.clone(),
            context_mode: spec.translation.context_mode.clone(),
            glossary_mode: spec.translation.glossary_mode.clone(),
            memory_mode: spec.translation.memory_mode.clone(),
            api_key: String::new(),
            api_key_configured: !spec.translation.api_key.trim().is_empty()
                || !spec.translation.credential_ref.trim().is_empty(),
            credential_ref: spec.translation.credential_ref.clone(),
            model: spec.translation.model.clone(),
            base_url: spec.translation.base_url.clone(),
            start_page: spec.translation.start_page,
            end_page: spec.translation.end_page,
            page_ranges: spec.translation.page_ranges.clone(),
            batch_size: spec.translation.batch_size,
            workers: spec.translation.workers,
            accepted_ambiguous_request_risk: spec.translation.accepted_ambiguous_request_risk,
        },
        render: spec.render.clone(),
        runtime: spec.runtime.clone(),
    }
}

fn public_ocr_options(options: &BTreeMap<String, Value>) -> BTreeMap<String, Value> {
    options
        .iter()
        .filter(|(key, _)| !matches!(key.as_str(), "credential" | "token" | "api_key"))
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect()
}
