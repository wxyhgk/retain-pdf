use crate::models::domain::{now_iso, JobRuntimeState, JobStatusKind};
use crate::ocr_provider::{
    is_configured_command_provider, parse_provider_kind, uses_paddle_official_cli, OcrProviderKind,
};
use crate::worker_command::{
    build_ocr_command, build_streaming_ocr_command, build_worker_stage_command, WorkerStageCommand,
};
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
mod transfer_watch;
mod transport;
mod workspace;
#[cfg(test)]
mod parent_cancel_tests;

use super::cancel_registry::should_stop_ocr_child;
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
    job: JobRuntimeState,
    output_job_id_override: Option<String>,
    parent_job_id: Option<String>,
) -> Result<JobRuntimeState> {
    // 装箱：多包这一层，future 直接内联会把 job worker 线程的栈撑爆（测试线程先爆）
    Box::pin(run_ocr_job(deps, job, output_job_id_override, parent_job_id, false)).await
}

/// OCR 和翻译并行时用：能流式公布页的 OCR（GLM-OCR、Paddle 官方 HTTP）都在 Python worker 里跑，一片片公布到 `ocr/stream/`，
/// 翻译跟着它（Paddle 平时由 Rust 自己提交、轮询，那样只能整份做完才有结果）。只有 `run_ocr_and_translation_together` 调。
pub async fn execute_ocr_job_streaming(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
    output_job_id_override: Option<String>,
    parent_job_id: Option<String>,
) -> Result<JobRuntimeState> {
    Box::pin(run_ocr_job(deps, job, output_job_id_override, parent_job_id, true)).await
}

async fn run_ocr_job(
    deps: ProcessRuntimeDeps,
    mut job: JobRuntimeState,
    output_job_id_override: Option<String>,
    parent_job_id: Option<String>,
    stream_pages: bool,
) -> Result<JobRuntimeState> {
    let is_command_provider = is_configured_command_provider(&job.request_payload.ocr.provider);
    let run_provider_worker = uses_provider_worker(&job.request_payload.ocr) || stream_pages;
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
    let build_command = if stream_pages { build_streaming_ocr_command } else { build_ocr_command };
    job.command = build_command(
        &deps.worker_command_runtime(),
        upload_path.as_deref(),
        &job.request_payload,
        &workspace.job_paths,
    )?;
    save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;

    // 也认父任务的取消（内存登记 + 库里的父任务状态，见 should_stop_ocr_child）。
    let parent_cancel_ids: Vec<String> = parent_job_id.iter().cloned().collect();

    // 调任何付费接口（上传、CLI worker）之前先看一眼：父任务在子任务建出来前后被取消时，
    // 这是唯一来得及一分钱不花的检查点。以前第一个检查点在上传、轮询都结束之后——小文件
    // 几百毫秒就传完了，上传期间的定时检查一次都没轮上。
    if should_stop_ocr_child(deps.canceled_jobs.as_ref(), deps.db.as_ref(), &job.job_id, &parent_cancel_ids).await {
        mark_ocr_canceled(&mut job);
        save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;
        return Ok(job);
    }

    if run_provider_worker {
        return execute_process_job(deps, job, &parent_cancel_ids).await;
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
            // 父任务已经取消了：服务商这边的失败多半就是被取消连带的（源文件被清掉等），
            // 记成 canceled，别在统计里多出一个「失败」。
            if should_stop_ocr_child(deps.canceled_jobs.as_ref(), deps.db.as_ref(), &job.job_id, &parent_cancel_ids)
                .await
            {
                job.append_log(&format!("OCR stopped after parent cancel: {err:#}"));
                mark_ocr_canceled(&mut job);
                save_ocr_job(&deps, &job, parent_job_id.as_deref()).await?;
                return Ok(job);
            }
            fail_ocr_transport(&mut job, &err);
            return Ok(job);
        }
    };

    // 也认父任务的取消。
    //
    // 取消只登记被点的那个 id,而 book 任务里用户点的是父任务——子任务永远
    // 看不到信号,于是 OCR 跑到底,结果被丢弃。`extra_cancel_job_ids` 这套机制
    // 本来就是为此设计的,只是此前所有调用点都传 `&[]`,成了死代码。
    if should_stop_ocr_child(deps.canceled_jobs.as_ref(), deps.db.as_ref(), &job.job_id, &parent_cancel_ids).await {
        mark_ocr_canceled(&mut job);
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
    adopt_provider_source_document(&deps, &job, parent_job_id.as_deref());

    execute_process_job(deps, job, &parent_cancel_ids).await
}

fn mark_ocr_canceled(job: &mut JobRuntimeState) {
    job.status = JobStatusKind::Canceled;
    job.stage = Some("canceled".to_string());
    job.stage_detail = Some("OCR 任务已取消".to_string());
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    clear_canceled_runtime_artifacts(job);
    clear_job_failure(job);
    sync_runtime_state(job);
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
    /// OCR 子任务的取消检查必须走 should_stop_ocr_child 并带上父任务 id。
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
            (
                "ocr_flow/transfer_watch.rs",
                include_str!("transfer_watch.rs"),
            ),
        ] {
            // 只看产品代码：这个测试自己就在 mod.rs 里，别匹配到下面的字符串。
            let source = source.split("#[cfg(test)]\nmod tests {").next().unwrap();
            assert!(
                !source.contains("is_cancel_requested_any("),
                "{file}: OCR 子任务的取消检查要走 should_stop_ocr_child——只看内存登记会错过父任务的取消"
            );
            let call = source
                .find("should_stop_ocr_child(")
                .unwrap_or_else(|| panic!("{file}: 取消检查必须走 should_stop_ocr_child"));
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

/// 原文是 OCR 服务商这边拿到的（从 `source_url` 建的任务，没有上传记录）：原文一落盘就登记成一本书，
/// 父任务（翻译任务）也归到这本书。不等任务结束，跑着的时候书架、文件清单里也有原文。失败只记日志。
fn adopt_provider_source_document(deps: &ProcessRuntimeDeps, job: &JobRuntimeState, parent_job_id: Option<&str>) {
    if !job.source_upload_id().trim().is_empty() {
        return;
    }
    let snapshot = match deps.db.get_job(&job.job_id) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            tracing::warn!("library: reload job {} to adopt its source pdf failed: {error}", job.job_id);
            return;
        }
    };
    let document_id = match super::adopt_job_source_document(&deps.config, &deps.db, &snapshot) {
        Ok(Some(document_id)) => document_id,
        Ok(None) => return,
        Err(error) => {
            tracing::warn!("library: adopt source pdf of job {} failed: {error}", job.job_id);
            return;
        }
    };
    let Some(parent_job_id) = parent_job_id.filter(|id| !id.is_empty()) else {
        return;
    };
    match deps.db.document_id_for_job(parent_job_id) {
        Ok(Some(_)) => {}
        Ok(None) => {
            if let Err(error) = deps.db.set_job_document_id(parent_job_id, &document_id) {
                tracing::warn!("library: link parent job {parent_job_id} to {document_id} failed: {error}");
            }
        }
        Err(error) => tracing::warn!("library: resolve document for parent job {parent_job_id} failed: {error}"),
    }
}
