use serde_json::Value;

use crate::models::domain::JobSnapshot;

use super::artifact_fields::{artifact_field_from_key, ArtifactField, ARTIFACT_LABEL_RULES};
use super::{job_artifacts_mut, ocr_provider_diagnostics_mut, parse_labeled_value};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PublishedArtifactLine {
    pub artifact_key: String,
    pub path: String,
}

pub(super) fn apply_artifact_line(job: &mut JobSnapshot, line: &str) {
    if apply_structured_artifact_event(job, line) {
        return;
    }
    for (label, field) in ARTIFACT_LABEL_RULES {
        if let Some(value) = parse_labeled_value(line, label) {
            apply_artifact_field(job, *field, value);
        }
    }
}

fn apply_structured_artifact_event(job: &mut JobSnapshot, line: &str) -> bool {
    let Some(artifact) = parse_artifact_published_line(line) else {
        return false;
    };
    let Some(field) = artifact_field_from_key(&artifact.artifact_key) else {
        return false;
    };
    apply_artifact_field(job, field, &artifact.path);
    true
}

pub(crate) fn parse_artifact_published_line(line: &str) -> Option<PublishedArtifactLine> {
    let Ok(value) = serde_json::from_str::<Value>(line) else {
        return None;
    };
    if value
        .get("event_type")
        .and_then(Value::as_str)
        .map(str::trim)
        != Some("artifact_published")
    {
        return None;
    }
    let Some(payload) = value.get("payload").and_then(Value::as_object) else {
        return None;
    };
    let Some(artifact_key) = payload
        .get("artifact_key")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
    else {
        return None;
    };
    let Some(path) = payload
        .get("path")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|item| !item.is_empty())
    else {
        return None;
    };
    Some(PublishedArtifactLine {
        artifact_key: artifact_key.to_string(),
        path: path.to_string(),
    })
}

fn apply_artifact_field(job: &mut JobSnapshot, field: ArtifactField, value: &str) {
    match field {
        ArtifactField::JobRoot => job_artifacts_mut(job).job_root = Some(value.to_string()),
        ArtifactField::SourcePdf => job_artifacts_mut(job).source_pdf = Some(value.to_string()),
        ArtifactField::LayoutJson => {
            let value = value.to_string();
            job_artifacts_mut(job).layout_json = Some(value.clone());
            ocr_provider_diagnostics_mut(job).artifacts.layout_json = Some(value);
        }
        ArtifactField::NormalizedDocumentJson => {
            let value = value.to_string();
            job_artifacts_mut(job).normalized_document_json = Some(value.clone());
            ocr_provider_diagnostics_mut(job)
                .artifacts
                .normalized_document_json = Some(value);
        }
        ArtifactField::NormalizationReportJson => {
            let value = value.to_string();
            job_artifacts_mut(job).normalization_report_json = Some(value.clone());
            ocr_provider_diagnostics_mut(job)
                .artifacts
                .normalization_report_json = Some(value);
        }
        ArtifactField::ProviderRawDir => {
            job_artifacts_mut(job).provider_raw_dir = Some(value.to_string())
        }
        ArtifactField::ProviderZip => {
            let value = value.to_string();
            job_artifacts_mut(job).provider_zip = Some(value.clone());
            ocr_provider_diagnostics_mut(job)
                .artifacts
                .provider_bundle_zip = Some(value);
        }
        ArtifactField::ProviderSummaryJson => {
            job_artifacts_mut(job).provider_summary_json = Some(value.to_string())
        }
        ArtifactField::SchemaVersion => {
            job_artifacts_mut(job).schema_version = Some(value.to_string())
        }
        ArtifactField::TranslationsDir => {
            job_artifacts_mut(job).translations_dir = Some(value.to_string())
        }
        ArtifactField::OutputPdf => job_artifacts_mut(job).output_pdf = Some(value.to_string()),
        ArtifactField::Summary => job_artifacts_mut(job).summary = Some(value.to_string()),
        ArtifactField::EventsJsonl => job_artifacts_mut(job).events_jsonl = Some(value.to_string()),
        ArtifactField::BatchId => {
            ocr_provider_diagnostics_mut(job).handle.batch_id = Some(value.to_string())
        }
        ArtifactField::TaskId => {
            ocr_provider_diagnostics_mut(job).handle.task_id = Some(value.to_string())
        }
        ArtifactField::FullZipUrl => {
            ocr_provider_diagnostics_mut(job).artifacts.full_zip_url = Some(value.to_string())
        }
    }
}
