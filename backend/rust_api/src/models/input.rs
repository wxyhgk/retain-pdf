use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::common::{build_job_id, WorkflowKind};
use super::defaults::*;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(deny_unknown_fields)]
pub struct CreateJobInput {
    #[serde(default)]
    pub workflow: WorkflowKind,
    #[serde(default)]
    pub source: JobSourceInput,
    #[serde(default)]
    pub ocr: OcrInput,
    #[serde(default)]
    pub translation: TranslationInput,
    #[serde(default)]
    pub render: RenderInput,
    #[serde(default)]
    pub runtime: RuntimeInput,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(deny_unknown_fields)]
pub struct JobSourceInput {
    #[serde(default)]
    pub upload_id: String,
    #[serde(default)]
    pub source_url: String,
    #[serde(default)]
    pub artifact_job_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct OcrInput {
    #[serde(default = "default_ocr_provider")]
    pub provider: String,
    #[serde(default)]
    pub mineru_token: String,
    #[serde(default = "default_model_version")]
    pub model_version: String,
    #[serde(default)]
    pub paddle_token: String,
    #[serde(default)]
    pub paddle_api_url: String,
    #[serde(default = "default_paddle_model")]
    pub paddle_model: String,
    #[serde(default)]
    pub is_ocr: bool,
    #[serde(default)]
    pub disable_formula: bool,
    #[serde(default)]
    pub disable_table: bool,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub page_ranges: String,
    #[serde(default)]
    pub data_id: String,
    #[serde(default)]
    pub no_cache: bool,
    #[serde(default = "default_cache_tolerance")]
    pub cache_tolerance: i64,
    #[serde(default)]
    pub extra_formats: String,
    #[serde(default = "default_poll_interval")]
    pub poll_interval: i64,
    #[serde(default = "default_poll_timeout")]
    pub poll_timeout: i64,
}

impl Default for OcrInput {
    fn default() -> Self {
        Self {
            provider: default_ocr_provider(),
            mineru_token: String::new(),
            model_version: default_model_version(),
            paddle_token: String::new(),
            paddle_api_url: String::new(),
            paddle_model: default_paddle_model(),
            is_ocr: false,
            disable_formula: false,
            disable_table: false,
            language: default_language(),
            page_ranges: String::new(),
            data_id: String::new(),
            no_cache: false,
            cache_tolerance: default_cache_tolerance(),
            extra_formats: String::new(),
            poll_interval: default_poll_interval(),
            poll_timeout: default_poll_timeout(),
        }
    }
}

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
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub start_page: i64,
    #[serde(default = "default_end_page")]
    pub end_page: i64,
    #[serde(default = "default_batch_size")]
    pub batch_size: i64,
    #[serde(default)]
    pub workers: i64,
}

impl Default for TranslationInput {
    fn default() -> Self {
        Self {
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
            api_key: String::new(),
            model: String::new(),
            base_url: String::new(),
            start_page: 0,
            end_page: default_end_page(),
            batch_size: default_batch_size(),
            workers: 0,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RenderInput {
    #[serde(default = "default_render_mode")]
    pub render_mode: String,
    #[serde(default)]
    pub compile_workers: i64,
    #[serde(default = "default_typst_font_family")]
    pub typst_font_family: String,
    #[serde(default = "default_pdf_compress_dpi")]
    pub pdf_compress_dpi: i64,
    #[serde(default)]
    pub translated_pdf_name: String,
    #[serde(default = "default_body_font_size_factor")]
    pub body_font_size_factor: f64,
    #[serde(default = "default_body_leading_factor")]
    pub body_leading_factor: f64,
    #[serde(default = "default_inner_bbox_shrink_x")]
    pub inner_bbox_shrink_x: f64,
    #[serde(default = "default_inner_bbox_shrink_y")]
    pub inner_bbox_shrink_y: f64,
    #[serde(default = "default_inner_bbox_dense_shrink_x")]
    pub inner_bbox_dense_shrink_x: f64,
    #[serde(default = "default_inner_bbox_dense_shrink_y")]
    pub inner_bbox_dense_shrink_y: f64,
}

impl Default for RenderInput {
    fn default() -> Self {
        Self {
            render_mode: default_render_mode(),
            compile_workers: 0,
            typst_font_family: default_typst_font_family(),
            pdf_compress_dpi: default_pdf_compress_dpi(),
            translated_pdf_name: String::new(),
            body_font_size_factor: default_body_font_size_factor(),
            body_leading_factor: default_body_leading_factor(),
            inner_bbox_shrink_x: default_inner_bbox_shrink_x(),
            inner_bbox_shrink_y: default_inner_bbox_shrink_y(),
            inner_bbox_dense_shrink_x: default_inner_bbox_dense_shrink_x(),
            inner_bbox_dense_shrink_y: default_inner_bbox_dense_shrink_y(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RuntimeInput {
    #[serde(default)]
    pub job_id: String,
    #[serde(default = "default_timeout_seconds")]
    pub timeout_seconds: i64,
}

impl Default for RuntimeInput {
    fn default() -> Self {
        Self {
            job_id: String::new(),
            timeout_seconds: default_timeout_seconds(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResolvedJobSpec {
    pub workflow: WorkflowKind,
    pub job_id: String,
    pub source: ResolvedSourceSpec,
    pub ocr: OcrInput,
    pub translation: TranslationInput,
    pub render: RenderInput,
    pub runtime: RuntimeInput,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ResolvedSourceSpec {
    pub upload_id: String,
    pub source_url: String,
    pub artifact_job_id: String,
}

impl ResolvedJobSpec {
    pub fn from_input(input: CreateJobInput) -> Self {
        let job_id = if input.runtime.job_id.trim().is_empty() {
            build_job_id()
        } else {
            input.runtime.job_id.trim().to_string()
        };
        Self {
            workflow: input.workflow,
            job_id,
            source: ResolvedSourceSpec {
                upload_id: input.source.upload_id.trim().to_string(),
                source_url: input.source.source_url.trim().to_string(),
                artifact_job_id: input.source.artifact_job_id.trim().to_string(),
            },
            ocr: input.ocr,
            translation: input.translation,
            render: input.render,
            runtime: input.runtime,
        }
    }

    pub fn resolved_workers(&self) -> i64 {
        if self.translation.workers > 0 {
            return self.translation.workers;
        }
        let model = self.translation.model.to_lowercase();
        let base = self.translation.base_url.to_lowercase();
        if model.contains("deepseek") || base.contains("deepseek.com") {
            100
        } else {
            4
        }
    }
}

impl From<CreateJobInput> for ResolvedJobSpec {
    fn from(value: CreateJobInput) -> Self {
        ResolvedJobSpec::from_input(value)
    }
}

impl CreateJobInput {
    pub fn from_api_value(value: Value) -> serde_json::Result<Self> {
        serde_json::from_value(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn create_job_input_from_api_value_supports_grouped_payload() {
        let input = CreateJobInput::from_api_value(json!({
            "workflow": "mineru",
            "source": { "upload_id": "upload-1" },
            "ocr": { "mineru_token": "mineru-token" },
            "translation": {
                "model": "deepseek-chat",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            },
            "render": { "render_mode": "auto" },
            "runtime": { "job_id": "job-1", "timeout_seconds": 1200 }
        }))
        .expect("parse grouped payload");

        assert_eq!(input.workflow, WorkflowKind::Mineru);
        assert_eq!(input.source.upload_id, "upload-1");
        assert_eq!(input.ocr.mineru_token, "mineru-token");
        assert_eq!(input.translation.model, "deepseek-chat");
        assert_eq!(input.translation.base_url, "https://api.deepseek.com/v1");
        assert_eq!(input.translation.api_key, "sk-test");
        assert_eq!(input.render.render_mode, "auto");
        assert_eq!(input.runtime.job_id, "job-1");
        assert_eq!(input.runtime.timeout_seconds, 1200);
    }

    #[test]
    fn create_job_input_from_api_value_rejects_legacy_flat_payload() {
        let err = CreateJobInput::from_api_value(json!({
            "workflow": "mineru",
            "upload_id": "upload-legacy",
            "model": "deepseek-chat",
            "base_url": "https://api.deepseek.com/v1",
            "api_key": "sk-legacy",
            "mineru_token": "mineru-legacy",
            "render_mode": "auto",
            "job_id": "job-legacy"
        }))
        .expect_err("legacy payload should be rejected");

        let message = err.to_string();
        assert!(message.contains("unknown field") || message.contains("upload_id"));
    }

    #[test]
    fn create_job_input_accepts_artifact_job_id() {
        let input = CreateJobInput::from_api_value(json!({
            "workflow": "render",
            "source": { "artifact_job_id": "job-prev" },
            "render": { "render_mode": "auto" }
        }))
        .expect("parse render payload");

        assert_eq!(input.workflow, WorkflowKind::Render);
        assert_eq!(input.source.artifact_job_id, "job-prev");
    }

    #[test]
    fn create_job_input_accepts_translate_workflow() {
        let input = CreateJobInput::from_api_value(json!({
            "workflow": "translate",
            "source": { "upload_id": "upload-translate" },
            "translation": {
                "model": "deepseek-chat",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            }
        }))
        .expect("parse translate payload");

        assert_eq!(input.workflow, WorkflowKind::Translate);
        assert_eq!(input.source.upload_id, "upload-translate");
        assert_eq!(input.translation.model, "deepseek-chat");
    }

    #[test]
    fn create_job_input_accepts_all_canonical_workflows() {
        let mineru = CreateJobInput::from_api_value(json!({
            "workflow": "mineru",
            "source": { "upload_id": "upload-mineru" },
            "ocr": { "mineru_token": "mineru-token" },
            "translation": {
                "model": "deepseek-chat",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            }
        }))
        .expect("parse mineru payload");
        assert_eq!(mineru.workflow, WorkflowKind::Mineru);

        let ocr = CreateJobInput::from_api_value(json!({
            "workflow": "ocr",
            "source": { "source_url": "https://example.com/paper.pdf" },
            "ocr": { "provider": "mineru", "mineru_token": "mineru-token" }
        }))
        .expect("parse ocr payload");
        assert_eq!(ocr.workflow, WorkflowKind::Ocr);

        let translate = CreateJobInput::from_api_value(json!({
            "workflow": "translate",
            "source": { "upload_id": "upload-translate" },
            "translation": {
                "model": "deepseek-chat",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            }
        }))
        .expect("parse translate payload");
        assert_eq!(translate.workflow, WorkflowKind::Translate);

        let render = CreateJobInput::from_api_value(json!({
            "workflow": "render",
            "source": { "artifact_job_id": "job-prev" },
            "render": { "render_mode": "auto" }
        }))
        .expect("parse render payload");
        assert_eq!(render.workflow, WorkflowKind::Render);
    }

    #[test]
    fn resolved_job_spec_from_input_derives_job_id_and_workers() {
        let mut input = CreateJobInput::default();
        input.source.upload_id = "upload-1".to_string();
        input.translation.model = "deepseek-chat".to_string();
        input.translation.base_url = "https://api.deepseek.com/v1".to_string();
        input.translation.api_key = "sk-test".to_string();
        input.ocr.mineru_token = "mineru-token".to_string();

        let spec = ResolvedJobSpec::from_input(input);

        assert!(!spec.job_id.trim().is_empty());
        assert_eq!(spec.source.upload_id, "upload-1");
        assert_eq!(spec.resolved_workers(), 100);
    }
}
