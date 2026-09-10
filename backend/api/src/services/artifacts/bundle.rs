use std::fs::{File, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};

use walkdir::WalkDir;
use zip::write::FileOptions;

use crate::db::Db;
use crate::error::AppError;
use crate::models::domain::{JobArtifactRecord, JobSnapshot};
use crate::storage_paths::{
    resolve_output_pdf, resolve_registered_artifact_path, ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP,
    ARTIFACT_KEY_MARKDOWN_IMAGES_DIR, ARTIFACT_KEY_MARKDOWN_RAW, ARTIFACT_KEY_TRANSLATED_PDF,
};

use super::registry::find_registry_artifact;

/// Owns an unpublished same-directory file; dropping after any error removes it.
struct PendingOutput {
    path: PathBuf,
}

impl PendingOutput {
    fn create(destination: &Path) -> io::Result<(Self, File)> {
        let parent = destination
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        for _ in 0..16 {
            let path = parent.join(format!(".retain-bundle-{:032x}.tmp", fastrand::u128(..)));
            match OpenOptions::new().write(true).create_new(true).open(&path) {
                Ok(file) => return Ok((Self { path }, file)),
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "cannot reserve bundle temporary file",
        ))
    }

    fn publish(self, file: File, destination: &Path) -> io::Result<()> {
        file.sync_all()?;
        // Close before rename, including on Windows. Never remove the old output.
        drop(file);
        std::fs::rename(&self.path, destination)
    }
}

impl Drop for PendingOutput {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn copy_bundle_atomically(source: &Path, destination: &Path) -> io::Result<()> {
    let mut source = File::open(source)?;
    let (pending, mut file) = PendingOutput::create(destination)?;
    io::copy(&mut source, &mut file)?;
    pending.publish(file, destination)
}

pub fn build_bundle_for_job(
    db: &Db,
    data_root: &Path,
    downloads_dir: &Path,
    job: &JobSnapshot,
) -> Result<PathBuf, AppError> {
    let zip_path = downloads_dir.join(format!("{}.zip", job.job_id));
    let pdf_path = find_registry_artifact(db, data_root, job, ARTIFACT_KEY_TRANSLATED_PDF)?
        .and_then(|item| resolve_registered_artifact_path(data_root, &item).ok());
    let markdown_path = find_registry_artifact(db, data_root, job, ARTIFACT_KEY_MARKDOWN_RAW)?
        .and_then(|item| resolve_registered_artifact_path(data_root, &item).ok());
    let markdown_images_dir =
        find_registry_artifact(db, data_root, job, ARTIFACT_KEY_MARKDOWN_IMAGES_DIR)?
            .and_then(|item| resolve_registered_artifact_path(data_root, &item).ok());
    build_zip(
        &zip_path,
        pdf_path.as_deref(),
        markdown_path.as_deref(),
        markdown_images_dir.as_deref(),
    )?;
    persist_bundle_copy(job, &zip_path, data_root)?;
    Ok(zip_path)
}

pub fn build_markdown_bundle_for_job(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    include_job_dir: bool,
) -> Result<(JobArtifactRecord, PathBuf), AppError> {
    let markdown_item = find_registry_artifact(db, data_root, job, ARTIFACT_KEY_MARKDOWN_RAW)?
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {}", job.job_id)))?;
    if !markdown_item.ready {
        return Err(AppError::not_found(format!(
            "markdown not ready: {}",
            job.job_id
        )));
    }
    let bundle_item = find_registry_artifact(db, data_root, job, ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP)?
        .ok_or_else(|| AppError::not_found(format!("markdown bundle not found: {}", job.job_id)))?;
    let registered_zip_path = resolve_registered_artifact_path(data_root, &bundle_item)
        .map_err(|err| AppError::internal(err.to_string()))?;
    let zip_path = markdown_bundle_variant_path(&registered_zip_path, include_job_dir);
    if let Some(parent) = zip_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let markdown_path = resolve_registered_artifact_path(data_root, &markdown_item)
        .map_err(|err| AppError::internal(err.to_string()))?;
    let markdown_images_dir =
        find_registry_artifact(db, data_root, job, ARTIFACT_KEY_MARKDOWN_IMAGES_DIR)?
            .and_then(|item| resolve_registered_artifact_path(data_root, &item).ok());
    build_markdown_zip(
        &zip_path,
        &markdown_path,
        markdown_images_dir.as_deref(),
        markdown_zip_root(job, include_job_dir),
    )?;
    Ok((bundle_item, zip_path))
}

fn build_zip(
    zip_path: &Path,
    pdf_path: Option<&Path>,
    markdown_path: Option<&Path>,
    markdown_images_dir: Option<&Path>,
) -> Result<(), AppError> {
    let (pending, file) = PendingOutput::create(zip_path)?;
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
    pending.publish(zip.finish()?, zip_path)?;
    Ok(())
}

fn build_markdown_zip(
    zip_path: &Path,
    markdown_path: &Path,
    markdown_images_dir: Option<&Path>,
    archive_root: String,
) -> Result<(), AppError> {
    let (pending, file) = PendingOutput::create(zip_path)?;
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
    pending.publish(zip.finish()?, zip_path)?;
    Ok(())
}

fn add_file_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    path: &Path,
    archive_name: &str,
    options: FileOptions,
) -> Result<(), AppError> {
    let mut file = File::open(path)?;
    zip.start_file(archive_name, options)?;
    io::copy(&mut file, zip)?;
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
        copy_bundle_atomically(zip_path, &target_path)?;
    }
    Ok(Some(target_path))
}

#[cfg(test)]
#[path = "bundle_tests.rs"]
mod tests;

fn markdown_zip_root(job: &JobSnapshot, include_job_dir: bool) -> String {
    if include_job_dir {
        format!("{}-markdown", job.job_id)
    } else {
        "markdown".to_string()
    }
}

/// Different archive layouts cannot safely publish to the same cache file.
fn markdown_bundle_variant_path(registered_path: &Path, include_job_dir: bool) -> PathBuf {
    if include_job_dir {
        return registered_path.to_owned();
    }
    let mut name = registered_path
        .file_stem()
        .unwrap_or_default()
        .to_os_string();
    name.push("-flat");
    if let Some(extension) = registered_path.extension() {
        name.push(".");
        name.push(extension);
    }
    registered_path.with_file_name(name)
}
