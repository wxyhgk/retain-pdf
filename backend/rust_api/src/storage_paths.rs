use std::path::{Component, Path, PathBuf};

use anyhow::{bail, Context, Result};

use crate::models::{now_iso, JobArtifactRecord, JobArtifacts, JobSnapshot};

const OUTPUT_SOURCE_DIR_NAME: &str = "source";
const OUTPUT_OCR_DIR_NAME: &str = "ocr";
const OUTPUT_MARKDOWN_DIR_NAME: &str = "md";
const OUTPUT_TRANSLATED_DIR_NAME: &str = "translated";
const OUTPUT_RENDERED_DIR_NAME: &str = "rendered";
const OUTPUT_ARTIFACTS_DIR_NAME: &str = "artifacts";
const OUTPUT_LOGS_DIR_NAME: &str = "logs";
const OUTPUT_SPECS_DIR_NAME: &str = "specs";
const OUTPUT_TYPST_DIR_NAME: &str = "typst";
const OUTPUT_TYPST_BOOK_OVERLAYS_DIR_NAME: &str = "book-overlays";
const LEGACY_LAYOUT_DIR_NAMES: [&str; 4] = ["originPDF", "jsonPDF", "transPDF", "typstPDF"];

pub const LEGACY_JOB_UNSUPPORTED_MESSAGE: &str =
    "job uses legacy output layout/path storage and is no longer supported; rerun required";
pub const ARTIFACT_KIND_FILE: &str = "file";
pub const ARTIFACT_KIND_DIR: &str = "dir";
pub const ARTIFACT_GROUP_SOURCE: &str = "source";
pub const ARTIFACT_GROUP_RENDERED: &str = "rendered";
pub const ARTIFACT_GROUP_TYPST: &str = "typst";
pub const ARTIFACT_GROUP_MARKDOWN: &str = "markdown";
pub const ARTIFACT_GROUP_JSON: &str = "json";
pub const ARTIFACT_GROUP_PROVIDER: &str = "provider";
pub const ARTIFACT_GROUP_DEBUG: &str = "debug";
pub const ARTIFACT_KEY_JOB_ROOT: &str = "job_root";
pub const ARTIFACT_KEY_SOURCE_PDF: &str = "source_pdf";
pub const ARTIFACT_KEY_TRANSLATED_PDF: &str = "translated_pdf";
pub const ARTIFACT_KEY_TYPST_SOURCE: &str = "typst_source";
pub const ARTIFACT_KEY_TYPST_PDF: &str = "typst_render_pdf";
pub const ARTIFACT_KEY_MARKDOWN_RAW: &str = "markdown_raw";
pub const ARTIFACT_KEY_MARKDOWN_IMAGES_DIR: &str = "markdown_images_dir";
pub const ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP: &str = "markdown_bundle_zip";
pub const ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON: &str = "normalized_document_json";
pub const ARTIFACT_KEY_NORMALIZATION_REPORT_JSON: &str = "normalization_report_json";
pub const ARTIFACT_KEY_LAYOUT_JSON: &str = "layout_json";
pub const ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON: &str = "translation_manifest_json";
pub const ARTIFACT_KEY_PROVIDER_BUNDLE_ZIP: &str = "provider_bundle_zip";
pub const ARTIFACT_KEY_PROVIDER_RESULT_JSON: &str = "provider_result_json";
pub const ARTIFACT_KEY_PROVIDER_RAW_DIR: &str = "provider_raw_dir";
pub const ARTIFACT_KEY_PIPELINE_SUMMARY: &str = "pipeline_summary";
pub const ARTIFACT_KEY_TRANSLATIONS_DIR: &str = "translations_dir";
pub const ARTIFACT_KEY_EVENTS_JSONL: &str = "events_jsonl";
pub const TRANSLATION_MANIFEST_FILE_NAME: &str = "translation-manifest.json";

#[derive(Clone, Debug)]
pub struct JobPaths {
    pub root: PathBuf,
    pub source_dir: PathBuf,
    pub ocr_dir: PathBuf,
    pub markdown_dir: PathBuf,
    pub translated_dir: PathBuf,
    pub rendered_dir: PathBuf,
    pub artifacts_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub specs_dir: PathBuf,
}

impl JobPaths {
    pub fn for_job(output_root: &Path, job_id: &str) -> Self {
        let root = output_root.join(job_id);
        Self {
            source_dir: root.join(OUTPUT_SOURCE_DIR_NAME),
            ocr_dir: root.join(OUTPUT_OCR_DIR_NAME),
            markdown_dir: root.join(OUTPUT_MARKDOWN_DIR_NAME),
            translated_dir: root.join(OUTPUT_TRANSLATED_DIR_NAME),
            rendered_dir: root.join(OUTPUT_RENDERED_DIR_NAME),
            artifacts_dir: root.join(OUTPUT_ARTIFACTS_DIR_NAME),
            logs_dir: root.join(OUTPUT_LOGS_DIR_NAME),
            specs_dir: root.join(OUTPUT_SPECS_DIR_NAME),
            root,
        }
    }

    pub fn create_all(&self) -> Result<()> {
        for path in [
            &self.root,
            &self.source_dir,
            &self.ocr_dir,
            &self.markdown_dir,
            &self.translated_dir,
            &self.rendered_dir,
            &self.artifacts_dir,
            &self.logs_dir,
            &self.specs_dir,
        ] {
            std::fs::create_dir_all(path)?;
        }
        Ok(())
    }
}

pub fn build_job_paths(output_root: &Path, job_id: &str) -> Result<JobPaths> {
    let job_paths = JobPaths::for_job(output_root, job_id);
    job_paths.create_all()?;
    Ok(job_paths)
}

pub fn attach_job_paths(job: &mut JobSnapshot, job_paths: &JobPaths) {
    ensure_job_artifacts(job).job_root = Some(job_paths.root.to_string_lossy().to_string());
}

pub fn data_path_is_absolute(raw: &str) -> bool {
    Path::new(raw).is_absolute()
}

pub fn normalize_relative_data_path(path: &Path) -> Result<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => parts.push(part.to_string_lossy().to_string()),
            Component::ParentDir => {
                bail!("parent-relative paths are not allowed: {}", path.display())
            }
            Component::RootDir | Component::Prefix(_) => {
                bail!("absolute paths are not allowed: {}", path.display())
            }
        }
    }
    if parts.is_empty() {
        bail!("path is empty");
    }
    Ok(parts.join("/"))
}

pub fn to_relative_data_path(data_root: &Path, path: &Path) -> Result<String> {
    if path.is_absolute() {
        let relative = path
            .strip_prefix(data_root)
            .with_context(|| format!("path is outside DATA_ROOT: {}", path.display()))?;
        return normalize_relative_data_path(relative);
    }
    normalize_relative_data_path(path)
}

pub fn resolve_data_path(data_root: &Path, raw: &str) -> Result<PathBuf> {
    let path = PathBuf::from(raw);
    if path.is_absolute() {
        return Ok(path);
    }
    Ok(data_root.join(normalize_relative_data_path(&path)?))
}

pub fn normalize_job_paths_for_storage(data_root: &Path, job: &mut JobSnapshot) -> Result<()> {
    let Some(artifacts) = job.artifacts.as_mut() else {
        return Ok(());
    };
    normalize_job_artifacts_for_storage(data_root, artifacts)
}

pub fn normalize_job_artifacts_for_storage(
    data_root: &Path,
    artifacts: &mut JobArtifacts,
) -> Result<()> {
    normalize_optional_path(data_root, &mut artifacts.job_root)?;
    normalize_optional_path(data_root, &mut artifacts.source_pdf)?;
    normalize_optional_path(data_root, &mut artifacts.layout_json)?;
    normalize_optional_path(data_root, &mut artifacts.normalized_document_json)?;
    normalize_optional_path(data_root, &mut artifacts.normalization_report_json)?;
    normalize_optional_path(data_root, &mut artifacts.provider_raw_dir)?;
    normalize_optional_path(data_root, &mut artifacts.provider_zip)?;
    normalize_optional_path(data_root, &mut artifacts.provider_summary_json)?;
    normalize_optional_path(data_root, &mut artifacts.translations_dir)?;
    normalize_optional_path(data_root, &mut artifacts.output_pdf)?;
    normalize_optional_path(data_root, &mut artifacts.summary)?;
    if let Some(diagnostics) = artifacts.ocr_provider_diagnostics.as_mut() {
        normalize_optional_path(data_root, &mut diagnostics.artifacts.provider_result_json)?;
        normalize_optional_path(data_root, &mut diagnostics.artifacts.provider_bundle_zip)?;
        normalize_optional_path(data_root, &mut diagnostics.artifacts.layout_json)?;
        normalize_optional_path(
            data_root,
            &mut diagnostics.artifacts.normalized_document_json,
        )?;
        normalize_optional_path(
            data_root,
            &mut diagnostics.artifacts.normalization_report_json,
        )?;
    }
    Ok(())
}

pub fn job_uses_legacy_output_layout(job: &JobSnapshot, data_root: &Path) -> bool {
    let Some(job_root) = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_ref())
    else {
        return false;
    };
    let Ok(root) = resolve_data_path(data_root, job_root) else {
        return false;
    };
    LEGACY_LAYOUT_DIR_NAMES
        .iter()
        .any(|name| root.join(name).exists())
}

pub fn job_uses_legacy_path_storage(job: &JobSnapshot) -> bool {
    let Some(artifacts) = job.artifacts.as_ref() else {
        return false;
    };
    let top_level_paths = [
        artifacts.job_root.as_deref(),
        artifacts.source_pdf.as_deref(),
        artifacts.layout_json.as_deref(),
        artifacts.normalized_document_json.as_deref(),
        artifacts.normalization_report_json.as_deref(),
        artifacts.provider_raw_dir.as_deref(),
        artifacts.provider_zip.as_deref(),
        artifacts.provider_summary_json.as_deref(),
        artifacts.translations_dir.as_deref(),
        artifacts.output_pdf.as_deref(),
        artifacts.summary.as_deref(),
    ];
    if top_level_paths
        .into_iter()
        .flatten()
        .any(data_path_is_absolute)
    {
        return true;
    }
    artifacts
        .ocr_provider_diagnostics
        .as_ref()
        .map(|diagnostics| {
            [
                diagnostics.artifacts.provider_result_json.as_deref(),
                diagnostics.artifacts.provider_bundle_zip.as_deref(),
                diagnostics.artifacts.layout_json.as_deref(),
                diagnostics.artifacts.normalized_document_json.as_deref(),
                diagnostics.artifacts.normalization_report_json.as_deref(),
            ]
            .into_iter()
            .flatten()
            .any(data_path_is_absolute)
        })
        .unwrap_or(false)
}

pub fn resolve_markdown_path(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    let root = resolve_data_path(data_root, job_root).ok()?;
    let preferred = root.join(OUTPUT_MARKDOWN_DIR_NAME).join("full.md");
    if preferred.exists() {
        return Some(preferred);
    }
    let fallback = job
        .artifacts
        .as_ref()?
        .provider_raw_dir
        .as_ref()
        .and_then(|path| resolve_data_path(data_root, path).ok())?
        .join("full.md");
    Some(fallback)
}

pub fn resolve_markdown_images_dir(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    let root = resolve_data_path(data_root, job_root).ok()?;
    let preferred = root.join(OUTPUT_MARKDOWN_DIR_NAME).join("images");
    if preferred.exists() {
        return Some(preferred);
    }
    let fallback = job
        .artifacts
        .as_ref()?
        .provider_raw_dir
        .as_ref()
        .and_then(|path| resolve_data_path(data_root, path).ok())?
        .join("images");
    Some(fallback)
}

pub fn resolve_job_root(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    resolve_data_path(data_root, job_root).ok()
}

pub fn resolve_markdown_bundle_zip(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = resolve_job_root(job, data_root)?;
    Some(
        job_root
            .join(OUTPUT_ARTIFACTS_DIR_NAME)
            .join(format!("{}-markdown.zip", job.job_id)),
    )
}

pub fn resolve_output_pdf(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.output_pdf.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_source_pdf(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.source_pdf.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_normalized_document(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.normalized_document_json.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_normalization_report(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.normalization_report_json.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_typst_source(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    Some(
        resolve_data_path(data_root, job_root)
            .ok()?
            .join(OUTPUT_RENDERED_DIR_NAME)
            .join(OUTPUT_TYPST_DIR_NAME)
            .join(OUTPUT_TYPST_BOOK_OVERLAYS_DIR_NAME)
            .join("book-overlay.typ"),
    )
}

pub fn resolve_typst_pdf(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    Some(
        resolve_data_path(data_root, job_root)
            .ok()?
            .join(OUTPUT_RENDERED_DIR_NAME)
            .join(OUTPUT_TYPST_DIR_NAME)
            .join(OUTPUT_TYPST_BOOK_OVERLAYS_DIR_NAME)
            .join("book-overlay.pdf"),
    )
}

pub fn resolve_translation_manifest(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let translations_dir = job.artifacts.as_ref()?.translations_dir.as_ref()?;
    let path = resolve_data_path(data_root, translations_dir)
        .ok()?
        .join(TRANSLATION_MANIFEST_FILE_NAME);
    if path.exists() {
        return Some(path);
    }
    None
}

pub fn resolve_registered_artifact_path(
    data_root: &Path,
    artifact: &JobArtifactRecord,
) -> Result<PathBuf> {
    resolve_data_path(data_root, &artifact.relative_path)
}

pub fn resolve_events_jsonl(job: &JobSnapshot, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    let root = resolve_data_path(data_root, job_root).ok()?;
    Some(root.join(OUTPUT_LOGS_DIR_NAME).join("events.jsonl"))
}

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
        resolve_typst_source(job, data_root)
            .as_ref()
            .map(|path| path.as_path()),
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
        resolve_typst_pdf(job, data_root)
            .as_ref()
            .map(|path| path.as_path()),
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
        resolve_markdown_path(job, data_root)
            .as_ref()
            .map(|path| path.as_path()),
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
        resolve_markdown_images_dir(job, data_root)
            .as_ref()
            .map(|path| path.as_path()),
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
        resolve_markdown_bundle_zip(job, data_root)
            .as_ref()
            .map(|path| path.as_path()),
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
        resolve_translation_manifest(job, data_root)
            .as_ref()
            .map(|path| path.as_path()),
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
        resolve_events_jsonl(job, data_root)
            .as_ref()
            .map(|path| path.as_path()),
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

fn normalize_optional_path(data_root: &Path, slot: &mut Option<String>) -> Result<()> {
    let Some(value) = slot
        .as_ref()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
    else {
        return Ok(());
    };
    *slot = Some(to_relative_data_path(data_root, Path::new(value))?);
    Ok(())
}

fn ensure_job_artifacts(job: &mut JobSnapshot) -> &mut JobArtifacts {
    job.artifacts.get_or_insert_with(JobArtifacts::default)
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

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

    #[test]
    fn normalize_rejects_parent_relative_paths() {
        assert!(normalize_relative_data_path(Path::new("../escape.pdf")).is_err());
    }

    #[test]
    fn to_relative_strips_data_root_prefix() {
        let data_root = Path::new("/tmp/data-root");
        let path = data_root.join("jobs/job-1/rendered/out.pdf");
        assert_eq!(
            to_relative_data_path(data_root, &path).expect("relative path"),
            "jobs/job-1/rendered/out.pdf"
        );
    }

    #[test]
    fn resolve_data_path_expands_relative_paths_under_data_root() {
        let data_root = Path::new("/tmp/data-root");
        let resolved =
            resolve_data_path(data_root, "jobs/job-1/rendered/out.pdf").expect("resolved");
        assert_eq!(resolved, data_root.join("jobs/job-1/rendered/out.pdf"));
    }

    #[test]
    fn collect_job_artifact_entries_includes_registered_downloadables() {
        let root = std::env::temp_dir().join(format!("rust-api-artifacts-{}", fastrand::u64(..)));
        let data_root = root.join("data");
        let job_root = data_root.join("jobs").join("job-1");
        fs::create_dir_all(job_root.join("source")).expect("source dir");
        fs::create_dir_all(job_root.join("rendered/typst/book-overlays")).expect("typst dir");
        fs::create_dir_all(job_root.join("md/images")).expect("markdown images dir");
        fs::create_dir_all(job_root.join("ocr/normalized")).expect("normalized dir");
        fs::create_dir_all(job_root.join("artifacts")).expect("artifacts dir");
        fs::create_dir_all(job_root.join("logs")).expect("logs dir");
        fs::write(job_root.join("source/in.pdf"), b"pdf").expect("source pdf");
        fs::write(job_root.join("rendered/out.pdf"), b"pdf").expect("output pdf");
        fs::write(
            job_root.join("rendered/typst/book-overlays/book-overlay.typ"),
            b"#set page()",
        )
        .expect("typst source");
        fs::write(job_root.join("md/full.md"), b"# doc").expect("markdown");
        fs::write(job_root.join("ocr/normalized/document.v1.json"), b"{}").expect("json");
        fs::write(
            job_root.join("logs/events.jsonl"),
            b"{\"event\":\"job_created\"}\n",
        )
        .expect("events jsonl");

        let mut job = JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.artifacts = Some(JobArtifacts {
            job_root: Some(job_root.to_string_lossy().to_string()),
            source_pdf: Some(job_root.join("source/in.pdf").to_string_lossy().to_string()),
            output_pdf: Some(
                job_root
                    .join("rendered/out.pdf")
                    .to_string_lossy()
                    .to_string(),
            ),
            normalized_document_json: Some(
                job_root
                    .join("ocr/normalized/document.v1.json")
                    .to_string_lossy()
                    .to_string(),
            ),
            ..JobArtifacts::default()
        });

        let items = collect_job_artifact_entries(&job, &data_root).expect("collect entries");
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_SOURCE_PDF));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_TRANSLATED_PDF));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_TYPST_SOURCE));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_MARKDOWN_RAW));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON));
        assert!(items
            .iter()
            .any(|item| item.artifact_key == ARTIFACT_KEY_EVENTS_JSONL));

        let _ = fs::remove_dir_all(root);
    }
}
