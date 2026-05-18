use std::path::{Path, PathBuf};

use crate::models::{
    JobContractsView, JobSnapshot, JobStageContractArtifactView, JobStageContractView,
};
use crate::storage_paths::{resolve_data_path, TRANSLATION_MANIFEST_FILE_NAME};

const CONTRACT_SCHEMA_VERSION: &str = "job_stage_contracts.v1";

pub fn build_job_contracts_view(job: &JobSnapshot, data_root: &Path) -> JobContractsView {
    JobContractsView {
        schema_version: CONTRACT_SCHEMA_VERSION.to_string(),
        stages: vec![
            stage_contract(
                "ocr_ready_for_translation",
                vec![
                    artifact(
                        job,
                        data_root,
                        "source_pdf",
                        artifact_path(job, "source_pdf"),
                        true,
                        ArtifactKind::File,
                    ),
                    artifact(
                        job,
                        data_root,
                        "normalized_document_json",
                        artifact_path(job, "normalized_document_json"),
                        true,
                        ArtifactKind::File,
                    ),
                    artifact(
                        job,
                        data_root,
                        "layout_json",
                        artifact_path(job, "layout_json"),
                        false,
                        ArtifactKind::File,
                    ),
                ],
            ),
            stage_contract(
                "translation_ready_for_render",
                vec![
                    artifact(
                        job,
                        data_root,
                        "source_pdf",
                        artifact_path(job, "source_pdf"),
                        true,
                        ArtifactKind::File,
                    ),
                    artifact(
                        job,
                        data_root,
                        "translations_dir",
                        artifact_path(job, "translations_dir"),
                        true,
                        ArtifactKind::Dir,
                    ),
                    artifact(
                        job,
                        data_root,
                        "translation_manifest_json",
                        translation_manifest_path(job, data_root),
                        true,
                        ArtifactKind::File,
                    ),
                ],
            ),
            stage_contract(
                "render_complete",
                vec![
                    artifact(
                        job,
                        data_root,
                        "output_pdf",
                        artifact_path(job, "output_pdf"),
                        true,
                        ArtifactKind::File,
                    ),
                    artifact(
                        job,
                        data_root,
                        "summary",
                        artifact_path(job, "summary"),
                        true,
                        ArtifactKind::File,
                    ),
                ],
            ),
        ],
    }
}

#[derive(Clone, Copy)]
enum ArtifactKind {
    File,
    Dir,
}

fn stage_contract(
    stage: &str,
    artifacts: Vec<JobStageContractArtifactView>,
) -> JobStageContractView {
    let ready = artifacts
        .iter()
        .filter(|artifact| artifact.required)
        .all(|artifact| artifact.ready);
    JobStageContractView {
        stage: stage.to_string(),
        ready,
        artifacts,
    }
}

fn artifact(
    job: &JobSnapshot,
    data_root: &Path,
    artifact_key: &str,
    relative_path: Option<String>,
    required: bool,
    kind: ArtifactKind,
) -> JobStageContractArtifactView {
    let resolved = relative_path
        .as_deref()
        .and_then(|raw| resolve_data_path(data_root, raw).ok());
    let ready = resolved
        .as_deref()
        .is_some_and(|path| artifact_path_ready(path, kind));
    JobStageContractArtifactView {
        artifact_key: artifact_key.to_string(),
        required,
        ready,
        relative_path,
        detail: artifact_detail(
            job,
            artifact_key,
            required,
            ready,
            resolved.as_deref(),
            kind,
        ),
    }
}

fn artifact_detail(
    job: &JobSnapshot,
    artifact_key: &str,
    required: bool,
    ready: bool,
    path: Option<&Path>,
    kind: ArtifactKind,
) -> Option<String> {
    if ready {
        return None;
    }
    if let Some(path) = path {
        let kind_label = match kind {
            ArtifactKind::File => "file",
            ArtifactKind::Dir => "directory",
        };
        return Some(format!(
            "{artifact_key} {kind_label} is not ready for {}: {}",
            job.job_id,
            path.display()
        ));
    }
    if required {
        return Some(format!("{} has not published {artifact_key}", job.job_id));
    }
    None
}

fn artifact_path_ready(path: &Path, kind: ArtifactKind) -> bool {
    match kind {
        ArtifactKind::File => path.is_file(),
        ArtifactKind::Dir => path.is_dir(),
    }
}

fn artifact_path(job: &JobSnapshot, artifact_key: &str) -> Option<String> {
    let artifacts = job.artifacts.as_ref()?;
    match artifact_key {
        "source_pdf" => artifacts.source_pdf.clone(),
        "normalized_document_json" => artifacts.normalized_document_json.clone(),
        "layout_json" => artifacts.layout_json.clone(),
        "translations_dir" => artifacts.translations_dir.clone(),
        "output_pdf" => artifacts.output_pdf.clone(),
        "summary" => artifacts.summary.clone(),
        _ => None,
    }
}

fn translation_manifest_path(job: &JobSnapshot, data_root: &Path) -> Option<String> {
    let translations_dir = artifact_path(job, "translations_dir")?;
    let translations_path = resolve_data_path(data_root, &translations_dir).ok()?;
    let manifest_path = translations_path.join(TRANSLATION_MANIFEST_FILE_NAME);
    to_relative_data_path_lossy(data_root, &manifest_path).or_else(|| {
        Some(
            PathBuf::from(translations_dir)
                .join(TRANSLATION_MANIFEST_FILE_NAME)
                .to_string_lossy()
                .to_string(),
        )
    })
}

fn to_relative_data_path_lossy(data_root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(data_root)
        .ok()
        .map(|relative| relative.to_string_lossy().to_string())
}
