use serde::{Deserialize, Serialize};

use crate::models::{JobStatusKind, OcrProviderDiagnostics};

#[derive(Debug, Clone, Copy)]
pub struct OcrCheckpointArtifacts<'a> {
    pub source_pdf: Option<&'a str>,
    pub layout_json: Option<&'a str>,
    pub normalized_document_json: Option<&'a str>,
    pub normalization_report_json: Option<&'a str>,
    pub provider_raw_dir: Option<&'a str>,
    pub provider_zip: Option<&'a str>,
    pub provider_summary_json: Option<&'a str>,
    pub schema_version: Option<&'a str>,
}

#[derive(Debug, Clone, Copy)]
pub struct TranslationArtifacts<'a> {
    pub source_pdf: Option<&'a str>,
    pub layout_json: Option<&'a str>,
    pub normalized_document_json: Option<&'a str>,
    pub translations_dir: Option<&'a str>,
    pub summary: Option<&'a str>,
    pub events_jsonl: Option<&'a str>,
}

#[derive(Debug, Clone, Copy)]
pub struct RenderArtifacts<'a> {
    pub output_pdf: Option<&'a str>,
    pub summary: Option<&'a str>,
    pub events_jsonl: Option<&'a str>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct JobArtifacts {
    pub ocr_job_id: Option<String>,
    pub ocr_status: Option<JobStatusKind>,
    pub ocr_trace_id: Option<String>,
    pub ocr_provider_trace_id: Option<String>,
    pub job_root: Option<String>,
    pub source_pdf: Option<String>,
    pub layout_json: Option<String>,
    pub normalized_document_json: Option<String>,
    pub normalization_report_json: Option<String>,
    pub provider_raw_dir: Option<String>,
    pub provider_zip: Option<String>,
    pub provider_summary_json: Option<String>,
    pub schema_version: Option<String>,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub translations_dir: Option<String>,
    pub output_pdf: Option<String>,
    pub summary: Option<String>,
    pub events_jsonl: Option<String>,
    pub pages_processed: Option<i64>,
    pub translated_items: Option<i64>,
    pub translate_render_time_seconds: Option<f64>,
    pub save_time_seconds: Option<f64>,
    pub total_time_seconds: Option<f64>,
    pub ocr_provider_diagnostics: Option<OcrProviderDiagnostics>,
}

impl JobArtifacts {
    pub fn ocr_checkpoint(&self) -> OcrCheckpointArtifacts<'_> {
        OcrCheckpointArtifacts {
            source_pdf: self.source_pdf.as_deref(),
            layout_json: self.layout_json.as_deref(),
            normalized_document_json: self.normalized_document_json.as_deref(),
            normalization_report_json: self.normalization_report_json.as_deref(),
            provider_raw_dir: self.provider_raw_dir.as_deref(),
            provider_zip: self.provider_zip.as_deref(),
            provider_summary_json: self.provider_summary_json.as_deref(),
            schema_version: self.schema_version.as_deref(),
        }
    }

    pub fn translation_outputs(&self) -> TranslationArtifacts<'_> {
        TranslationArtifacts {
            source_pdf: self.source_pdf.as_deref(),
            layout_json: self.layout_json.as_deref(),
            normalized_document_json: self.normalized_document_json.as_deref(),
            translations_dir: self.translations_dir.as_deref(),
            summary: self.summary.as_deref(),
            events_jsonl: self.events_jsonl.as_deref(),
        }
    }

    pub fn render_outputs(&self) -> RenderArtifacts<'_> {
        RenderArtifacts {
            output_pdf: self.output_pdf.as_deref(),
            summary: self.summary.as_deref(),
            events_jsonl: self.events_jsonl.as_deref(),
        }
    }

    pub fn copy_translation_inputs_from(&mut self, source: &JobArtifacts) {
        let checkpoint = source.ocr_checkpoint();
        self.source_pdf = checkpoint.source_pdf.map(str::to_string);
        self.layout_json = checkpoint.layout_json.map(str::to_string);
        self.normalized_document_json = checkpoint.normalized_document_json.map(str::to_string);
        self.normalization_report_json = checkpoint.normalization_report_json.map(str::to_string);
        self.schema_version = checkpoint.schema_version.map(str::to_string);
    }

    pub fn copy_ocr_checkpoint_from(&mut self, source_job_id: &str, source: &JobArtifacts) {
        let checkpoint = source.ocr_checkpoint();
        self.ocr_job_id = source
            .ocr_job_id
            .clone()
            .or_else(|| Some(source_job_id.to_string()));
        self.ocr_status = source.ocr_status.clone();
        self.ocr_trace_id = source.ocr_trace_id.clone().or(source.trace_id.clone());
        self.ocr_provider_trace_id = source
            .ocr_provider_trace_id
            .clone()
            .or(source.provider_trace_id.clone());
        if self.job_root.is_none() {
            self.job_root = source.job_root.clone();
        }
        self.source_pdf = checkpoint.source_pdf.map(str::to_string);
        self.layout_json = checkpoint.layout_json.map(str::to_string);
        self.normalized_document_json = checkpoint.normalized_document_json.map(str::to_string);
        self.normalization_report_json = checkpoint.normalization_report_json.map(str::to_string);
        self.provider_raw_dir = checkpoint.provider_raw_dir.map(str::to_string);
        self.provider_zip = checkpoint.provider_zip.map(str::to_string);
        self.provider_summary_json = checkpoint.provider_summary_json.map(str::to_string);
        self.schema_version = checkpoint.schema_version.map(str::to_string);
        self.trace_id = self.trace_id.clone().or(source.trace_id.clone());
        self.provider_trace_id = source.provider_trace_id.clone();
        self.ocr_provider_diagnostics = source.ocr_provider_diagnostics.clone();
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct JobArtifactRecord {
    pub job_id: String,
    pub artifact_key: String,
    pub artifact_group: String,
    pub artifact_kind: String,
    pub relative_path: String,
    pub file_name: Option<String>,
    pub content_type: String,
    pub ready: bool,
    pub size_bytes: Option<u64>,
    pub checksum: Option<String>,
    pub source_stage: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_ocr_checkpoint_preserves_parent_trace_and_copies_ocr_outputs() {
        let mut target = JobArtifacts {
            trace_id: Some("parent-trace".to_string()),
            ..JobArtifacts::default()
        };
        let source = JobArtifacts {
            source_pdf: Some("/tmp/source.pdf".to_string()),
            normalized_document_json: Some("/tmp/document.v1.json".to_string()),
            provider_zip: Some("/tmp/provider.zip".to_string()),
            trace_id: Some("child-trace".to_string()),
            provider_trace_id: Some("provider-trace".to_string()),
            ..JobArtifacts::default()
        };

        target.copy_ocr_checkpoint_from("job-ocr", &source);

        assert_eq!(target.ocr_job_id.as_deref(), Some("job-ocr"));
        assert_eq!(target.ocr_trace_id.as_deref(), Some("child-trace"));
        assert_eq!(
            target.ocr_provider_trace_id.as_deref(),
            Some("provider-trace")
        );
        assert_eq!(target.trace_id.as_deref(), Some("parent-trace"));
        assert_eq!(target.source_pdf.as_deref(), Some("/tmp/source.pdf"));
        assert_eq!(
            target.normalized_document_json.as_deref(),
            Some("/tmp/document.v1.json")
        );
        assert_eq!(target.provider_zip.as_deref(), Some("/tmp/provider.zip"));
    }
}
