use crate::models::domain::{now_iso, JobRuntimeState, JobStatusKind};
use crate::ocr_provider::{
    is_configured_command_provider, parse_provider_kind, uses_paddle_official_cli, OcrProviderKind,
};
use crate::worker_command::{build_ocr_command, build_worker_stage_command, WorkerStageCommand};
use anyhow::Result;

use super::{
    clear_canceled_runtime_artifacts, clear_job_failure, execute_process_job, job_artifacts_mut,
    sync_runtime_state, ProcessRuntimeDeps,
};

mod artifacts;
mod bundle_download;
mod bundle_download_retry;
mod bundle_events;
mod bundle_ready_wait;
mod bundle_retry_policy;
mod dispatch_journal;
mod markdown_bundle;
mod mineru;
mod mineru_polling;
mod mineru_retry;
mod mineru_status_handlers;
mod paddle;
mod paddle_errors;
mod paddle_markdown;
mod paddle_payload;
mod page_subset;
mod polling;
mod provider_result;
mod provider_transport;
mod status;
mod support;
mod transport;
mod workspace;

use super::cancel_registry::is_cancel_requested_any;
use provider_transport::execute_provider_transport;
pub use support::sync_parent_with_ocr_child;
use support::{fail_missing_source_pdf, fail_ocr_transport, save_ocr_job};
use transport::resolve_local_upload_path;
use workspace::OcrWorkspace;

fn uses_provider_worker(ocr: &crate::models::request::OcrInput) -> bool {
    is_configured_command_provider(&ocr.provider) || uses_paddle_official_cli(ocr)
}

pub async fn execute_ocr_job(
    deps: ProcessRuntimeDeps,
    mut job: JobRuntimeState,
    output_job_id_override: Option<String>,
    parent_job_id: Option<String>,
) -> Result<JobRuntimeState> {
    let is_command_provider = is_configured_command_provider(&job.request_payload.ocr.provider);
    let run_provider_worker = uses_provider_worker(&job.request_payload.ocr);
    let provider_kind = if is_command_provider {
        OcrProviderKind::Local
    } else {
        parse_provider_kind(&job.request_payload.ocr.provider)
    };
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
    let upload_path = resolve_local_upload_path(deps.db.as_ref(), &job)?;
    job.command = build_ocr_command(
        &deps.worker_command_runtime(),
        upload_path.as_deref(),
        &job.request_payload,
        &workspace.job_paths,
    )?;
    save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;

    if run_provider_worker {
        return execute_process_job(deps, job, &[]).await;
    }

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

    // 也认父任务的取消。
    //
    // 取消只登记被点的那个 id,而 book 任务里用户点的是父任务——子任务永远
    // 看不到信号,于是 OCR 跑到底,结果被丢弃。`extra_cancel_job_ids` 这套机制
    // 本来就是为此设计的,只是此前所有调用点都传 `&[]`,成了死代码。
    let parent_cancel_ids: Vec<String> = parent_job_id.iter().cloned().collect();
    if is_cancel_requested_any(deps.canceled_jobs.as_ref(), &job.job_id, &parent_cancel_ids).await {
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

    job.command = build_worker_stage_command(
        &deps.worker_command_runtime(),
        &job.request_payload,
        &workspace.job_paths,
        WorkerStageCommand::NormalizeOcr {
            source_json_path: &workspace.layout_json_path,
            source_pdf_path: &source_pdf_path,
            provider_result_json_path: &workspace.provider_result_json_path,
            provider_zip_path: &workspace.provider_zip_path,
            provider_raw_dir: &workspace.provider_raw_dir,
        },
    )?;
    job.stage = Some("normalizing".to_string());
    job.stage_detail = Some("OCR provider 已完成，开始标准化 document.v1".to_string());
    job.updated_at = now_iso();
    sync_runtime_state(&mut job);
    save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;

    execute_process_job(deps, job, &[]).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;
    use serde_json::Value;

    #[test]
    fn paddle_official_cli_uses_provider_worker_but_http_does_not() {
        let mut input = CreateJobInput::default();
        input.ocr.provider = "paddle".to_string();
        assert!(!uses_provider_worker(&input.ocr));

        input.ocr.options.insert(
            "transport".to_string(),
            Value::String("official_http".to_string()),
        );
        assert!(!uses_provider_worker(&input.ocr));

        input.ocr.options.insert(
            "transport".to_string(),
            Value::String("official_cli".to_string()),
        );
        assert!(uses_provider_worker(&input.ocr));
    }

    #[test]
    fn fail_missing_source_pdf_marks_job_failed_with_clear_detail() {
        let mut job = JobSnapshot::new(
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

#[cfg(test)]
mod parent_cancel_contract {
    /// OCR 子任务的取消检查必须带上父任务 id。
    ///
    /// 盯调用点而不是盯 `is_cancel_requested_any` 本身:那个函数一直是对的,
    /// 错的是所有调用点都传 `&[]`,让整套机制成了死代码。只测那个函数的话,
    /// 把这里改回 `&[]` 测试照样全绿——实测过。
    ///
    /// 真正要挡的场景(book 父任务在 OCR 期间被取消)要跑完整流程才复现得出来,
    /// 单元测试够不着,所以直接锁调用点的形状。
    #[test]
    fn ocr_cancel_checks_include_the_parent_job() {
        for (file, source) in [
            ("ocr_flow/mod.rs", include_str!("mod.rs")),
            (
                "ocr_flow/provider_transport.rs",
                include_str!("provider_transport.rs"),
            ),
        ] {
            let call = source
                .find("is_cancel_requested_any(")
                .unwrap_or_else(|| panic!("{file}: 取消检查必须走 is_cancel_requested_any"));
            let tail = &source[call..];
            let end = tail.find(").await").expect("调用应当被 await");
            let args = &tail[..end];
            assert!(
                args.contains("parent_cancel_ids"),
                "{file}: 第三个参数必须带上父任务 id。传 &[] 等于子任务看不见\
                 父任务的取消,OCR 会一路跑到成功然后把产物丢掉"
            );
        }
    }
}
