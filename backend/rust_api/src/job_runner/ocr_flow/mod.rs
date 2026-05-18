use crate::models::{now_iso, JobRuntimeState, JobStatusKind};
use crate::ocr_provider::mineru::MineruClient;
use crate::ocr_provider::paddle::PaddleClient;
use crate::ocr_provider::parse_provider_kind;
use crate::ocr_provider::OcrProviderKind;
use anyhow::{anyhow, Result};

use super::{
    build_normalize_ocr_command, clear_canceled_runtime_artifacts, clear_job_failure,
    execute_process_job, job_artifacts_mut, sync_runtime_state, ProcessRuntimeDeps,
};

mod artifacts;
mod bundle_download;
mod markdown_bundle;
mod mineru;
mod mineru_polling;
mod mineru_retry;
mod paddle;
mod paddle_markdown;
mod page_subset;
mod polling;
mod provider_result;
mod status;
mod support;
mod transport;
mod workspace;

use super::cancel_registry::is_cancel_requested_with_registry;
pub use support::sync_parent_with_ocr_child;
use support::{fail_missing_source_pdf, fail_ocr_transport, save_ocr_job};
use transport::{prepare_local_upload_source, recover_remote_source_pdf};
use workspace::OcrWorkspace;

pub async fn execute_ocr_job(
    deps: ProcessRuntimeDeps,
    mut job: JobRuntimeState,
    output_job_id_override: Option<String>,
    parent_job_id: Option<String>,
) -> Result<JobRuntimeState> {
    let provider_kind = parse_provider_kind(&job.request_payload.ocr.provider);
    job.status = JobStatusKind::Running;
    if job.started_at.is_none() {
        job.started_at = Some(now_iso());
    }
    job.updated_at = now_iso();
    job.stage = Some("ocr_upload".to_string());
    job.stage_detail = Some("OCR provider transport 启动中".to_string());
    clear_job_failure(&mut job);
    sync_runtime_state(&mut job);
    save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;

    let workspace = OcrWorkspace::prepare(
        &deps.persist.output_root,
        &mut job,
        &provider_kind,
        output_job_id_override,
    )?;
    save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;

    let source_pdf_path = match execute_provider_transport(
        &deps,
        &mut job,
        &provider_kind,
        &workspace,
        parent_job_id.as_deref(),
    )
    .await
    {
        Ok(path) => path,
        Err(err) => {
            fail_ocr_transport(&mut job, &err);
            return Ok(job);
        }
    };

    if is_cancel_requested_with_registry(deps.canceled_jobs.as_ref(), &job.job_id).await {
        job.status = JobStatusKind::Canceled;
        job.stage = Some("canceled".to_string());
        job.stage_detail = Some("OCR 任务已取消".to_string());
        job.updated_at = now_iso();
        job.finished_at = Some(now_iso());
        clear_canceled_runtime_artifacts(&mut job);
        clear_job_failure(&mut job);
        sync_runtime_state(&mut job);
        save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;
        return Ok(job);
    }

    if !source_pdf_path.exists() {
        fail_missing_source_pdf(&mut job, &source_pdf_path);
        save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;
        return Ok(job);
    }

    let source_pdf_string = source_pdf_path.to_string_lossy().to_string();
    job_artifacts_mut(&mut job).source_pdf = Some(source_pdf_string);

    job.command = build_normalize_ocr_command(
        &deps.worker_command_runtime(),
        &job.request_payload,
        &workspace.job_paths,
        &workspace.layout_json_path,
        &source_pdf_path,
        &workspace.provider_result_json_path,
        &workspace.provider_zip_path,
        &workspace.provider_raw_dir,
    );
    job.stage = Some("normalizing".to_string());
    job.stage_detail = Some("OCR provider 已完成，开始标准化 document.v1".to_string());
    job.updated_at = now_iso();
    sync_runtime_state(&mut job);
    save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;

    execute_process_job(deps, job, &[]).await
}

async fn execute_provider_transport(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    provider_kind: &OcrProviderKind,
    workspace: &OcrWorkspace,
    parent_job_id: Option<&str>,
) -> Result<std::path::PathBuf> {
    if let Some(upload_path) =
        prepare_local_upload_source(deps.db.as_ref(), job, &workspace.source_dir)?
    {
        match provider_kind {
            OcrProviderKind::Mineru => {
                let client = MineruClient::with_runtime(
                    "",
                    job.request_payload.ocr.mineru_token.clone(),
                    deps.mineru_runtime().clone(),
                );
                mineru::run_local_ocr_transport_mineru(
                    deps,
                    job,
                    &client,
                    &upload_path,
                    &workspace.provider_result_json_path,
                    parent_job_id,
                )
                .await?;
            }
            OcrProviderKind::Paddle => {
                let client = PaddleClient::with_runtime(
                    job.request_payload.ocr.paddle_api_url.clone(),
                    job.request_payload.ocr.paddle_token.clone(),
                    deps.paddle_runtime().clone(),
                );
                paddle::run_local_ocr_transport_paddle(
                    deps,
                    job,
                    &client,
                    &upload_path,
                    &workspace.provider_result_json_path,
                    &workspace.job_paths.root,
                    parent_job_id,
                )
                .await?;
            }
            OcrProviderKind::Unknown => return Err(anyhow!("unsupported OCR provider")),
        }
        return Ok(upload_path);
    }

    match provider_kind {
        OcrProviderKind::Mineru => {
            let client = MineruClient::with_runtime(
                "",
                job.request_payload.ocr.mineru_token.clone(),
                deps.mineru_runtime().clone(),
            );
            mineru::run_remote_ocr_transport_mineru(
                deps,
                job,
                &client,
                &workspace.provider_result_json_path,
                parent_job_id,
            )
            .await?;
        }
        OcrProviderKind::Paddle => {
            let client = PaddleClient::with_runtime(
                job.request_payload.ocr.paddle_api_url.clone(),
                job.request_payload.ocr.paddle_token.clone(),
                deps.paddle_runtime().clone(),
            );
            paddle::run_remote_ocr_transport_paddle(
                deps,
                job,
                &client,
                &workspace.provider_result_json_path,
                &workspace.job_paths.root,
                parent_job_id,
            )
            .await?;
        }
        OcrProviderKind::Unknown => return Err(anyhow!("unsupported OCR provider")),
    }

    if is_cancel_requested_with_registry(deps.canceled_jobs.as_ref(), &job.job_id).await {
        return Ok(std::path::PathBuf::new());
    }

    recover_remote_source_pdf(
        provider_kind,
        job,
        &workspace.source_dir,
        &workspace.provider_raw_dir,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateJobInput;

    #[test]
    fn fail_missing_source_pdf_marks_job_failed_with_clear_detail() {
        let mut job = crate::models::JobSnapshot::new(
            "job-missing-source-pdf".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
        .into_runtime();
        let missing = std::path::Path::new("/definitely/missing/source.pdf");

        fail_missing_source_pdf(&mut job, missing);

        assert_eq!(job.status, JobStatusKind::Failed);
        assert_eq!(job.stage.as_deref(), Some("failed"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("OCR 已完成，但任务源 PDF 缺失")
        );
        let failure = job.failure.as_ref().expect("failure");
        assert_eq!(failure.category, "source_pdf_missing");
        assert_eq!(failure.summary, "源 PDF 缺失");
        assert!(!failure.retryable);
    }
}
