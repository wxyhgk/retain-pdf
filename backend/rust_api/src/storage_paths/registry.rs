use std::path::{Path, PathBuf};

use anyhow::Result;

use crate::models::{now_iso, JobArtifactRecord, JobSnapshot};

use super::constants::{
    ARTIFACT_GROUP_DEBUG, ARTIFACT_GROUP_JSON, ARTIFACT_GROUP_MARKDOWN, ARTIFACT_GROUP_PROVIDER,
    ARTIFACT_GROUP_RENDERED, ARTIFACT_GROUP_SOURCE, ARTIFACT_GROUP_TYPST,
    ARTIFACT_KEY_EVENTS_JSONL, ARTIFACT_KEY_JOB_ROOT, ARTIFACT_KEY_LAYOUT_JSON,
    ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP, ARTIFACT_KEY_MARKDOWN_IMAGES_DIR, ARTIFACT_KEY_MARKDOWN_RAW,
    ARTIFACT_KEY_NORMALIZATION_REPORT_JSON, ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON,
    ARTIFACT_KEY_PIPELINE_SUMMARY, ARTIFACT_KEY_PROVIDER_BUNDLE_ZIP, ARTIFACT_KEY_PROVIDER_RAW_DIR,
    ARTIFACT_KEY_PROVIDER_RESULT_JSON, ARTIFACT_KEY_RENDER_CONFIG_JSON, ARTIFACT_KEY_SOURCE_PDF,
    ARTIFACT_KEY_TRANSLATED_PDF, ARTIFACT_KEY_TRANSLATIONS_DIR,
    ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON, ARTIFACT_KEY_TYPST_PDF, ARTIFACT_KEY_TYPST_SOURCE,
    ARTIFACT_KIND_DIR, ARTIFACT_KIND_FILE,
};
use super::path_ops::{resolve_data_path, to_relative_data_path};
use super::resolvers::{
    resolve_events_jsonl, resolve_markdown_bundle_zip, resolve_markdown_images_dir,
    resolve_markdown_path, resolve_translation_manifest, resolve_typst_pdf, resolve_typst_source,
};

pub fn collect_job_artifact_entries(
    job: &JobSnapshot,
    data_root: &Path,
) -> Result<Vec<JobArtifactRecord>> {
    let mut items = Vec::new();
    let now = now_iso();
    let Some(artifacts) = job.artifacts.as_ref() else {
        return Ok(items);
    };

    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.job_root.as_deref(),
        ARTIFACT_KEY_JOB_ROOT,
        ARTIFACT_GROUP_DEBUG,
        ARTIFACT_KIND_DIR,
        "application/x-directory",
        Some("runtime".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.source_pdf.as_deref(),
        ARTIFACT_KEY_SOURCE_PDF,
        ARTIFACT_GROUP_SOURCE,
        ARTIFACT_KIND_FILE,
        "application/pdf",
        Some("upload".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.output_pdf.as_deref(),
        ARTIFACT_KEY_TRANSLATED_PDF,
        ARTIFACT_GROUP_RENDERED,
        ARTIFACT_KIND_FILE,
        "application/pdf",
        Some("rendering".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        resolve_typst_source(job, data_root).as_deref(),
        ARTIFACT_KEY_TYPST_SOURCE,
        ARTIFACT_GROUP_TYPST,
        ARTIFACT_KIND_FILE,
        "text/plain; charset=utf-8",
        Some("rendering".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        resolve_typst_pdf(job, data_root).as_deref(),
        ARTIFACT_KEY_TYPST_PDF,
        ARTIFACT_GROUP_TYPST,
        ARTIFACT_KIND_FILE,
        "application/pdf",
        Some("rendering".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        resolve_markdown_path(job, data_root).as_deref(),
        ARTIFACT_KEY_MARKDOWN_RAW,
        ARTIFACT_GROUP_MARKDOWN,
        ARTIFACT_KIND_FILE,
        "text/markdown; charset=utf-8",
        Some("ocr".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        resolve_markdown_images_dir(job, data_root).as_deref(),
        ARTIFACT_KEY_MARKDOWN_IMAGES_DIR,
        ARTIFACT_GROUP_MARKDOWN,
        ARTIFACT_KIND_DIR,
        "application/x-directory",
        Some("ocr".to_string()),
        &now,
    )?;
    push_virtual_artifact(
        &mut items,
        data_root,
        &job.job_id,
        resolve_markdown_bundle_zip(job, data_root).as_deref(),
        ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP,
        ARTIFACT_GROUP_MARKDOWN,
        ARTIFACT_KIND_FILE,
        "application/zip",
        resolve_markdown_path(job, data_root).is_some(),
        Some("ocr".to_string()),
        Some(format!("{}-markdown.zip", job.job_id)),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.normalized_document_json.as_deref(),
        ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON,
        ARTIFACT_GROUP_JSON,
        ARTIFACT_KIND_FILE,
        "application/json",
        Some("normalizing".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        resolve_translation_manifest(job, data_root).as_deref(),
        ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON,
        ARTIFACT_GROUP_JSON,
        ARTIFACT_KIND_FILE,
        "application/json",
        Some("translation".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.normalization_report_json.as_deref(),
        ARTIFACT_KEY_NORMALIZATION_REPORT_JSON,
        ARTIFACT_GROUP_JSON,
        ARTIFACT_KIND_FILE,
        "application/json",
        Some("normalizing".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.layout_json.as_deref(),
        ARTIFACT_KEY_LAYOUT_JSON,
        ARTIFACT_GROUP_JSON,
        ARTIFACT_KIND_FILE,
        "application/json",
        Some("ocr".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.provider_zip.as_deref(),
        ARTIFACT_KEY_PROVIDER_BUNDLE_ZIP,
        ARTIFACT_GROUP_PROVIDER,
        ARTIFACT_KIND_FILE,
        "application/zip",
        Some("ocr".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.provider_summary_json.as_deref(),
        ARTIFACT_KEY_PROVIDER_RESULT_JSON,
        ARTIFACT_GROUP_PROVIDER,
        ARTIFACT_KIND_FILE,
        "application/json",
        Some("ocr".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.provider_raw_dir.as_deref(),
        ARTIFACT_KEY_PROVIDER_RAW_DIR,
        ARTIFACT_GROUP_PROVIDER,
        ARTIFACT_KIND_DIR,
        "application/x-directory",
        Some("ocr".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.summary.as_deref(),
        ARTIFACT_KEY_PIPELINE_SUMMARY,
        ARTIFACT_GROUP_DEBUG,
        ARTIFACT_KIND_FILE,
        "application/json",
        Some("rendering".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.render_config_json.as_deref(),
        ARTIFACT_KEY_RENDER_CONFIG_JSON,
        ARTIFACT_GROUP_DEBUG,
        ARTIFACT_KIND_FILE,
        "application/json",
        Some("runtime".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        resolve_events_jsonl(job, data_root).as_deref(),
        ARTIFACT_KEY_EVENTS_JSONL,
        ARTIFACT_GROUP_DEBUG,
        ARTIFACT_KIND_FILE,
        "application/x-ndjson",
        Some("runtime".to_string()),
        &now,
    )?;
    push_optional_artifact(
        &mut items,
        data_root,
        &job.job_id,
        artifacts.translations_dir.as_deref(),
        ARTIFACT_KEY_TRANSLATIONS_DIR,
        ARTIFACT_GROUP_DEBUG,
        ARTIFACT_KIND_DIR,
        "application/x-directory",
        Some("translation".to_string()),
        &now,
    )?;

    Ok(items)
}

fn push_optional_artifact(
    items: &mut Vec<JobArtifactRecord>,
    data_root: &Path,
    job_id: &str,
    raw_path: impl ArtifactRawPath,
    artifact_key: &str,
    artifact_group: &str,
    artifact_kind: &str,
    content_type: &str,
    source_stage: Option<String>,
    now: &str,
) -> Result<()> {
    let Some(raw_path) = raw_path.into_path_buf() else {
        return Ok(());
    };
    let relative_path = to_relative_data_path(data_root, &raw_path)?;
    let resolved_path = resolve_data_path(data_root, &relative_path)?;
    let metadata = std::fs::metadata(&resolved_path).ok();
    let ready = metadata.is_some();
    let size_bytes = metadata
        .as_ref()
        .filter(|item| item.is_file())
        .map(|item| item.len());
    let file_name = resolved_path
        .file_name()
        .map(|item| item.to_string_lossy().to_string())
        .or_else(|| Some(artifact_key.to_string()));
    items.push(JobArtifactRecord {
        job_id: job_id.to_string(),
        artifact_key: artifact_key.to_string(),
        artifact_group: artifact_group.to_string(),
        artifact_kind: artifact_kind.to_string(),
        relative_path,
        file_name,
        content_type: content_type.to_string(),
        ready,
        size_bytes,
        checksum: None,
        source_stage,
        created_at: now.to_string(),
        updated_at: now.to_string(),
    });
    Ok(())
}

fn push_virtual_artifact(
    items: &mut Vec<JobArtifactRecord>,
    data_root: &Path,
    job_id: &str,
    raw_path: impl ArtifactRawPath,
    artifact_key: &str,
    artifact_group: &str,
    artifact_kind: &str,
    content_type: &str,
    ready: bool,
    source_stage: Option<String>,
    file_name_override: Option<String>,
    now: &str,
) -> Result<()> {
    let Some(raw_path) = raw_path.into_path_buf() else {
        return Ok(());
    };
    let relative_path = to_relative_data_path(data_root, &raw_path)?;
    let resolved_path = resolve_data_path(data_root, &relative_path)?;
    let metadata = std::fs::metadata(&resolved_path).ok();
    let size_bytes = metadata
        .as_ref()
        .filter(|item| item.is_file())
        .map(|item| item.len());
    let file_name = file_name_override.or_else(|| {
        resolved_path
            .file_name()
            .map(|item| item.to_string_lossy().to_string())
    });
    items.push(JobArtifactRecord {
        job_id: job_id.to_string(),
        artifact_key: artifact_key.to_string(),
        artifact_group: artifact_group.to_string(),
        artifact_kind: artifact_kind.to_string(),
        relative_path,
        file_name,
        content_type: content_type.to_string(),
        ready,
        size_bytes,
        checksum: None,
        source_stage,
        created_at: now.to_string(),
        updated_at: now.to_string(),
    });
    Ok(())
}

trait ArtifactRawPath {
    fn into_path_buf(self) -> Option<PathBuf>;
}

impl ArtifactRawPath for Option<&str> {
    fn into_path_buf(self) -> Option<PathBuf> {
        self.and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(PathBuf::from(trimmed))
            }
        })
    }
}

impl ArtifactRawPath for Option<&Path> {
    fn into_path_buf(self) -> Option<PathBuf> {
        self.map(Path::to_path_buf)
    }
}
