use std::path::PathBuf;

use anyhow::Result;

use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::{provider_artifact_layout, OcrProviderKind};
use crate::storage_paths::{build_job_paths, JobPaths};

use crate::job_runner::{attach_job_paths, job_artifacts_mut, ocr_provider_diagnostics_mut};

pub(super) struct OcrWorkspace {
    pub(super) job_paths: JobPaths,
    pub(super) source_dir: PathBuf,
    pub(super) provider_result_json_path: PathBuf,
    pub(super) provider_zip_path: PathBuf,
    pub(super) provider_raw_dir: PathBuf,
    pub(super) layout_json_path: PathBuf,
}

impl OcrWorkspace {
    pub(super) fn prepare(
        output_root: &std::path::Path,
        job: &mut JobRuntimeState,
        provider_kind: &OcrProviderKind,
        output_job_id_override: Option<String>,
    ) -> Result<Self> {
        let output_job_id = output_job_id_override.unwrap_or_else(|| job.job_id.clone());
        let job_paths = build_job_paths(output_root, &output_job_id)?;
        attach_job_paths(job, &job_paths);

        let source_dir = job_paths.source_dir.clone();
        let ocr_dir = job_paths.ocr_dir.clone();
        let artifact_layout = provider_artifact_layout(provider_kind).unwrap_or_else(|| {
            provider_artifact_layout(&OcrProviderKind::Mineru).expect("mineru artifact layout")
        });
        let provider_result_json_path = ocr_dir.join(&artifact_layout.provider_result_json);
        let provider_zip_path = ocr_dir.join(&artifact_layout.provider_bundle_zip);
        let provider_raw_dir = ocr_dir.join(&artifact_layout.provider_raw_dir);
        let layout_json_path = ocr_dir.join(&artifact_layout.layout_json);

        std::fs::create_dir_all(&source_dir)?;
        std::fs::create_dir_all(&ocr_dir)?;
        std::fs::create_dir_all(&provider_raw_dir)?;

        let workspace = Self {
            job_paths,
            source_dir,
            provider_result_json_path,
            provider_zip_path,
            provider_raw_dir,
            layout_json_path,
        };
        workspace.attach_to_job(job);
        Ok(workspace)
    }

    fn attach_to_job(&self, job: &mut JobRuntimeState) {
        {
            let artifacts = job_artifacts_mut(job);
            artifacts.job_root = Some(self.job_paths.root.to_string_lossy().to_string());
            artifacts.provider_summary_json =
                Some(self.provider_result_json_path.to_string_lossy().to_string());
            artifacts.provider_zip = Some(self.provider_zip_path.to_string_lossy().to_string());
            artifacts.provider_raw_dir = Some(self.provider_raw_dir.to_string_lossy().to_string());
            artifacts.layout_json = Some(self.layout_json_path.to_string_lossy().to_string());
            artifacts.schema_version = Some("document.v1".to_string());
        }
        {
            let provider_artifacts = &mut ocr_provider_diagnostics_mut(job).artifacts;
            provider_artifacts.provider_result_json =
                Some(self.provider_result_json_path.to_string_lossy().to_string());
            provider_artifacts.provider_bundle_zip =
                Some(self.provider_zip_path.to_string_lossy().to_string());
            provider_artifacts.layout_json =
                Some(self.layout_json_path.to_string_lossy().to_string());
        }
    }
}
