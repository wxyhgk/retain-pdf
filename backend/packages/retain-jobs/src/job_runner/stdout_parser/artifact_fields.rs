use super::{
    STDOUT_LABEL_EVENTS_JSONL, STDOUT_LABEL_JOB_ROOT, STDOUT_LABEL_LAYOUT_JSON,
    STDOUT_LABEL_NORMALIZATION_REPORT_JSON, STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON,
    STDOUT_LABEL_OUTPUT_PDF, STDOUT_LABEL_PROVIDER_RAW_DIR, STDOUT_LABEL_PROVIDER_SUMMARY_JSON,
    STDOUT_LABEL_PROVIDER_ZIP, STDOUT_LABEL_SCHEMA_VERSION, STDOUT_LABEL_SOURCE_PDF,
    STDOUT_LABEL_SUMMARY, STDOUT_LABEL_TRANSLATIONS_DIR,
};

#[derive(Clone, Copy)]
pub(super) enum ArtifactField {
    JobRoot,
    SourcePdf,
    LayoutJson,
    NormalizedDocumentJson,
    NormalizationReportJson,
    ProviderRawDir,
    ProviderZip,
    ProviderSummaryJson,
    SchemaVersion,
    TranslationsDir,
    OutputPdf,
    Summary,
    EventsJsonl,
    BatchId,
    TaskId,
    FullZipUrl,
}

pub(super) const ARTIFACT_LABEL_RULES: &[(&str, ArtifactField)] = &[
    (STDOUT_LABEL_JOB_ROOT, ArtifactField::JobRoot),
    (STDOUT_LABEL_SOURCE_PDF, ArtifactField::SourcePdf),
    (STDOUT_LABEL_LAYOUT_JSON, ArtifactField::LayoutJson),
    (
        STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON,
        ArtifactField::NormalizedDocumentJson,
    ),
    (
        STDOUT_LABEL_NORMALIZATION_REPORT_JSON,
        ArtifactField::NormalizationReportJson,
    ),
    (STDOUT_LABEL_PROVIDER_RAW_DIR, ArtifactField::ProviderRawDir),
    (STDOUT_LABEL_PROVIDER_ZIP, ArtifactField::ProviderZip),
    (
        STDOUT_LABEL_PROVIDER_SUMMARY_JSON,
        ArtifactField::ProviderSummaryJson,
    ),
    (STDOUT_LABEL_SCHEMA_VERSION, ArtifactField::SchemaVersion),
    (
        STDOUT_LABEL_TRANSLATIONS_DIR,
        ArtifactField::TranslationsDir,
    ),
    (STDOUT_LABEL_OUTPUT_PDF, ArtifactField::OutputPdf),
    (STDOUT_LABEL_SUMMARY, ArtifactField::Summary),
    (STDOUT_LABEL_EVENTS_JSONL, ArtifactField::EventsJsonl),
    ("batch_id", ArtifactField::BatchId),
    ("task_id", ArtifactField::TaskId),
    ("full_zip_url", ArtifactField::FullZipUrl),
];

pub(super) fn artifact_field_from_key(artifact_key: &str) -> Option<ArtifactField> {
    match artifact_key.trim() {
        "job_root" => Some(ArtifactField::JobRoot),
        "source_pdf" => Some(ArtifactField::SourcePdf),
        "layout_json" => Some(ArtifactField::LayoutJson),
        "normalized_document_json" | "source_json_used" => {
            Some(ArtifactField::NormalizedDocumentJson)
        }
        "normalization_report_json" => Some(ArtifactField::NormalizationReportJson),
        "provider_raw_dir" => Some(ArtifactField::ProviderRawDir),
        "provider_zip" | "provider_bundle_zip" => Some(ArtifactField::ProviderZip),
        "provider_summary_json" | "provider_result_json" => {
            Some(ArtifactField::ProviderSummaryJson)
        }
        "translations_dir" => Some(ArtifactField::TranslationsDir),
        "output_pdf" | "translated_pdf" => Some(ArtifactField::OutputPdf),
        "summary" | "pipeline_summary" | "pipeline_summary_json" => Some(ArtifactField::Summary),
        "events_jsonl" | "pipeline_events_jsonl" => Some(ArtifactField::EventsJsonl),
        _ => None,
    }
}
