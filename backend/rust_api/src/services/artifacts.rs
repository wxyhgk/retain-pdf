use std::io::Write;
use std::path::{Path, PathBuf};

use axum::http::HeaderValue;
use axum::response::Response;
use walkdir::WalkDir;
use zip::write::FileOptions;

use crate::error::AppError;
use crate::models::{JobArtifactRecord, JobSnapshot};
use crate::storage_paths::{
    collect_job_artifact_entries, resolve_output_pdf, resolve_registered_artifact_path,
    ARTIFACT_KEY_EVENTS_JSONL, ARTIFACT_KEY_JOB_ROOT, ARTIFACT_KEY_LAYOUT_JSON,
    ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP, ARTIFACT_KEY_MARKDOWN_IMAGES_DIR, ARTIFACT_KEY_MARKDOWN_RAW,
    ARTIFACT_KEY_NORMALIZATION_REPORT_JSON, ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON,
    ARTIFACT_KEY_PIPELINE_SUMMARY, ARTIFACT_KEY_PROVIDER_BUNDLE_ZIP, ARTIFACT_KEY_PROVIDER_RAW_DIR,
    ARTIFACT_KEY_PROVIDER_RESULT_JSON, ARTIFACT_KEY_SOURCE_PDF, ARTIFACT_KEY_TRANSLATED_PDF,
    ARTIFACT_KEY_TRANSLATIONS_DIR, ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON, ARTIFACT_KEY_TYPST_PDF,
    ARTIFACT_KEY_TYPST_SOURCE, ARTIFACT_KIND_DIR,
};
use crate::AppState;

pub fn list_registry_for_job(
    state: &AppState,
    job: &JobSnapshot,
) -> Result<Vec<JobArtifactRecord>, AppError> {
    let mut items = state.db.list_job_artifact_entries(&job.job_id)?;
    let fallback_items = collect_job_artifact_entries(job, &state.config.data_root)
        .map_err(|err| AppError::internal(err.to_string()))?;
    if items.is_empty() {
        return Ok(fallback_items);
    }
    for fallback in fallback_items {
        if !items
            .iter()
            .any(|item| item.artifact_key == fallback.artifact_key)
        {
            items.push(fallback);
        }
    }
    items.sort_by(|a, b| {
        a.artifact_group
            .cmp(&b.artifact_group)
            .then_with(|| a.artifact_key.cmp(&b.artifact_key))
    });
    Ok(items)
}

pub fn find_registry_artifact(
    state: &AppState,
    job: &JobSnapshot,
    artifact_key: &str,
) -> Result<Option<JobArtifactRecord>, AppError> {
    Ok(list_registry_for_job(state, job)?
        .into_iter()
        .find(|item| item.artifact_key == artifact_key))
}

pub fn resolve_registry_artifact(
    state: &AppState,
    job: &JobSnapshot,
    artifact_key: &str,
) -> Result<Option<(JobArtifactRecord, PathBuf)>, AppError> {
    let Some(item) = find_registry_artifact(state, job, artifact_key)? else {
        return Ok(None);
    };
    let path = resolve_registered_artifact_path(&state.config.data_root, &item)
        .map_err(|err| AppError::internal(err.to_string()))?;
    Ok(Some((item, path)))
}

pub fn artifact_resource_path(job: &JobSnapshot, artifact_key: &str) -> Option<String> {
    let prefix = match job.workflow {
        crate::models::WorkflowKind::Ocr => "/api/v1/ocr/jobs",
        crate::models::WorkflowKind::Mineru
        | crate::models::WorkflowKind::Translate
        | crate::models::WorkflowKind::Render => "/api/v1/jobs",
    };
    let job_prefix = format!("{prefix}/{}", job.job_id);
    match artifact_key {
        ARTIFACT_KEY_SOURCE_PDF => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        ARTIFACT_KEY_TRANSLATED_PDF => Some(format!("{job_prefix}/pdf")),
        ARTIFACT_KEY_TYPST_SOURCE => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        ARTIFACT_KEY_TYPST_PDF => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        ARTIFACT_KEY_MARKDOWN_RAW => Some(format!("{job_prefix}/markdown?raw=true")),
        ARTIFACT_KEY_MARKDOWN_IMAGES_DIR => Some(format!("{job_prefix}/markdown/images/")),
        ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON => Some(format!("{job_prefix}/normalized-document")),
        ARTIFACT_KEY_NORMALIZATION_REPORT_JSON => {
            Some(format!("{job_prefix}/normalization-report"))
        }
        ARTIFACT_KEY_LAYOUT_JSON
        | ARTIFACT_KEY_PROVIDER_BUNDLE_ZIP
        | ARTIFACT_KEY_PROVIDER_RESULT_JSON
        | ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON
        | ARTIFACT_KEY_PIPELINE_SUMMARY
        | ARTIFACT_KEY_EVENTS_JSONL
        | ARTIFACT_KEY_PROVIDER_RAW_DIR
        | ARTIFACT_KEY_TRANSLATIONS_DIR
        | ARTIFACT_KEY_JOB_ROOT => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        _ => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
    }
}

pub fn artifact_is_direct_downloadable(item: &JobArtifactRecord) -> bool {
    item.artifact_kind != ARTIFACT_KIND_DIR
}

pub fn build_bundle_for_job(state: &AppState, job: &JobSnapshot) -> Result<PathBuf, AppError> {
    let zip_path = state
        .config
        .downloads_dir
        .join(format!("{}.zip", job.job_id));
    let pdf_path = find_registry_artifact(state, job, ARTIFACT_KEY_TRANSLATED_PDF)?
        .and_then(|item| resolve_registered_artifact_path(&state.config.data_root, &item).ok());
    let markdown_path = find_registry_artifact(state, job, ARTIFACT_KEY_MARKDOWN_RAW)?
        .and_then(|item| resolve_registered_artifact_path(&state.config.data_root, &item).ok());
    let markdown_images_dir = find_registry_artifact(state, job, ARTIFACT_KEY_MARKDOWN_IMAGES_DIR)?
        .and_then(|item| resolve_registered_artifact_path(&state.config.data_root, &item).ok());
    build_zip(
        &zip_path,
        pdf_path.as_deref(),
        markdown_path.as_deref(),
        markdown_images_dir.as_deref(),
    )?;
    persist_bundle_copy(job, &zip_path, &state.config.data_root)?;
    Ok(zip_path)
}

pub fn build_markdown_bundle_for_job(
    state: &AppState,
    job: &JobSnapshot,
    include_job_dir: bool,
) -> Result<(JobArtifactRecord, PathBuf), AppError> {
    let markdown_item = find_registry_artifact(state, job, ARTIFACT_KEY_MARKDOWN_RAW)?
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {}", job.job_id)))?;
    if !markdown_item.ready {
        return Err(AppError::not_found(format!(
            "markdown not ready: {}",
            job.job_id
        )));
    }
    let bundle_item = find_registry_artifact(state, job, ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP)?
        .ok_or_else(|| AppError::not_found(format!("markdown bundle not found: {}", job.job_id)))?;
    let zip_path = resolve_registered_artifact_path(&state.config.data_root, &bundle_item)
        .map_err(|err| AppError::internal(err.to_string()))?;
    if let Some(parent) = zip_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let markdown_path = resolve_registered_artifact_path(&state.config.data_root, &markdown_item)
        .map_err(|err| AppError::internal(err.to_string()))?;
    let markdown_images_dir = find_registry_artifact(state, job, ARTIFACT_KEY_MARKDOWN_IMAGES_DIR)?
        .and_then(|item| resolve_registered_artifact_path(&state.config.data_root, &item).ok());
    build_markdown_zip(
        &zip_path,
        &markdown_path,
        markdown_images_dir.as_deref(),
        markdown_zip_root(job, include_job_dir),
    )?;
    Ok((bundle_item, zip_path))
}

pub fn attach_job_id_header(response: &mut Response, job_id: &str) -> Result<(), AppError> {
    response.headers_mut().insert(
        "X-Job-Id",
        HeaderValue::from_str(job_id).map_err(|e| AppError::internal(e.to_string()))?,
    );
    Ok(())
}

fn build_zip(
    zip_path: &Path,
    pdf_path: Option<&Path>,
    markdown_path: Option<&Path>,
    markdown_images_dir: Option<&Path>,
) -> Result<(), AppError> {
    let file = std::fs::File::create(zip_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    if let Some(pdf_path) = pdf_path {
        if pdf_path.exists() {
            add_file_to_zip(
                &mut zip,
                pdf_path,
                pdf_path.file_name().unwrap().to_string_lossy().as_ref(),
                options,
            )?;
        }
    }
    if let Some(markdown_path) = markdown_path {
        if markdown_path.exists() {
            add_file_to_zip(&mut zip, markdown_path, "markdown/full.md", options)?;
        }
    }
    if let Some(images_dir) = markdown_images_dir {
        if images_dir.exists() && images_dir.is_dir() {
            for entry in WalkDir::new(images_dir).into_iter().filter_map(|e| e.ok()) {
                if !entry.file_type().is_file() {
                    continue;
                }
                let rel = entry
                    .path()
                    .strip_prefix(images_dir)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                add_file_to_zip(
                    &mut zip,
                    entry.path(),
                    &format!("markdown/images/{rel}"),
                    options,
                )?;
            }
        }
    }
    zip.finish()?;
    Ok(())
}

fn build_markdown_zip(
    zip_path: &Path,
    markdown_path: &Path,
    markdown_images_dir: Option<&Path>,
    archive_root: String,
) -> Result<(), AppError> {
    let file = std::fs::File::create(zip_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    if markdown_path.exists() {
        add_file_to_zip(
            &mut zip,
            markdown_path,
            &format!("{archive_root}/full.md"),
            options,
        )?;
    }
    if let Some(images_dir) = markdown_images_dir {
        if images_dir.exists() && images_dir.is_dir() {
            for entry in WalkDir::new(images_dir).into_iter().filter_map(|e| e.ok()) {
                if !entry.file_type().is_file() {
                    continue;
                }
                let rel = entry
                    .path()
                    .strip_prefix(images_dir)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                add_file_to_zip(
                    &mut zip,
                    entry.path(),
                    &format!("{archive_root}/images/{rel}"),
                    options,
                )?;
            }
        }
    }
    zip.finish()?;
    Ok(())
}

fn add_file_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    path: &Path,
    archive_name: &str,
    options: FileOptions,
) -> Result<(), AppError> {
    let bytes = std::fs::read(path)?;
    zip.start_file(archive_name, options)?;
    zip.write_all(&bytes)?;
    Ok(())
}

fn persist_bundle_copy(
    job: &JobSnapshot,
    zip_path: &Path,
    data_root: &Path,
) -> Result<Option<PathBuf>, AppError> {
    let Some(pdf_path) = resolve_output_pdf(job, data_root) else {
        return Ok(None);
    };
    let Some(translated_dir) = pdf_path.parent() else {
        return Ok(None);
    };
    std::fs::create_dir_all(translated_dir)?;
    let target_path = translated_dir.join(format!("{}.zip", job.job_id));
    if target_path != zip_path {
        std::fs::copy(zip_path, &target_path)?;
    }
    Ok(Some(target_path))
}

fn markdown_zip_root(job: &JobSnapshot, include_job_dir: bool) -> String {
    if include_job_dir {
        format!("{}-markdown", job.job_id)
    } else {
        "markdown".to_string()
    }
}
