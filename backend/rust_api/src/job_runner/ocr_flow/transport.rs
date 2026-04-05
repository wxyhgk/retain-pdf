use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};

use crate::models::JobRuntimeState;
use crate::ocr_provider::OcrProviderKind;
use crate::AppState;

use super::artifacts::{download_source_pdf, ensure_source_pdf_from_bundle};
use super::is_cancel_requested;
use super::mineru::{run_local_ocr_transport_mineru, run_remote_ocr_transport_mineru};
use super::paddle::{run_local_ocr_transport_paddle, run_remote_ocr_transport_paddle};
use super::page_subset::prepare_uploaded_source_pdf;
use super::workspace::OcrWorkspace;

pub(super) async fn execute_transport(
    state: &AppState,
    job: &mut JobRuntimeState,
    provider_kind: &OcrProviderKind,
    workspace: &OcrWorkspace,
    parent_job_id: Option<&str>,
) -> Result<PathBuf> {
    if let Some(upload_path) = resolve_local_upload_path(state, job).await? {
        let prepared_source = prepare_uploaded_source_pdf(
            &upload_path,
            &workspace.source_dir,
            &job.request_payload.ocr.page_ranges,
        )?;
        if prepared_source.is_subset() {
            job.append_log(&format!(
                "prepared subset source pdf: {} pages {:?}/{}",
                prepared_source.path.display(),
                prepared_source.selected_pages,
                prepared_source.total_pages
            ));
        }
        execute_local_transport(
            state,
            job,
            provider_kind,
            &prepared_source.path,
            &workspace.provider_result_json_path,
            parent_job_id,
        )
        .await?;
        return Ok(prepared_source.path);
    }

    execute_remote_transport(
        state,
        job,
        provider_kind,
        &workspace.provider_result_json_path,
        parent_job_id,
    )
    .await?;

    if is_cancel_requested(state, &job.job_id).await {
        return Ok(PathBuf::new());
    }

    match provider_kind {
        OcrProviderKind::Mineru => {
            ensure_source_pdf_from_bundle(&workspace.provider_raw_dir, &workspace.source_dir)
        }
        OcrProviderKind::Paddle => {
            download_source_pdf(
                &job.request_payload.source.source_url,
                &workspace.source_dir,
            )
            .await
        }
        OcrProviderKind::Unknown => Err(anyhow!("unsupported OCR provider")),
    }
}

async fn resolve_local_upload_path(
    state: &AppState,
    job: &JobRuntimeState,
) -> Result<Option<PathBuf>> {
    let upload_id = job.request_payload.source.upload_id.trim();
    if upload_id.is_empty() {
        return Ok(None);
    }
    let upload = state.db.get_upload(upload_id)?;
    let upload_path = PathBuf::from(&upload.stored_path);
    if !upload_path.exists() {
        return Err(anyhow!("uploaded file missing: {}", upload_path.display()));
    }
    Ok(Some(upload_path))
}

async fn execute_local_transport(
    state: &AppState,
    job: &mut JobRuntimeState,
    provider_kind: &OcrProviderKind,
    upload_path: &Path,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    match provider_kind {
        OcrProviderKind::Mineru => {
            let client = crate::ocr_provider::mineru::MineruClient::new(
                "",
                job.request_payload.ocr.mineru_token.clone(),
            );
            run_local_ocr_transport_mineru(
                state,
                job,
                &client,
                upload_path,
                provider_result_json_path,
                parent_job_id,
            )
            .await
        }
        OcrProviderKind::Paddle => {
            let client = crate::ocr_provider::paddle::PaddleClient::new(
                job.request_payload.ocr.paddle_api_url.clone(),
                job.request_payload.ocr.paddle_token.clone(),
            );
            run_local_ocr_transport_paddle(
                state,
                job,
                &client,
                upload_path,
                provider_result_json_path,
                parent_job_id,
            )
            .await
        }
        OcrProviderKind::Unknown => Err(anyhow!("unsupported OCR provider")),
    }
}

async fn execute_remote_transport(
    state: &AppState,
    job: &mut JobRuntimeState,
    provider_kind: &OcrProviderKind,
    provider_result_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    match provider_kind {
        OcrProviderKind::Mineru => {
            let client = crate::ocr_provider::mineru::MineruClient::new(
                "",
                job.request_payload.ocr.mineru_token.clone(),
            );
            run_remote_ocr_transport_mineru(
                state,
                job,
                &client,
                provider_result_json_path,
                parent_job_id,
            )
            .await
        }
        OcrProviderKind::Paddle => {
            let client = crate::ocr_provider::paddle::PaddleClient::new(
                job.request_payload.ocr.paddle_api_url.clone(),
                job.request_payload.ocr.paddle_token.clone(),
            );
            run_remote_ocr_transport_paddle(
                state,
                job,
                &client,
                provider_result_json_path,
                parent_job_id,
            )
            .await
        }
        OcrProviderKind::Unknown => Err(anyhow!("unsupported OCR provider")),
    }
}
