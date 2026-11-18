use retainpdf_api_base::error::AppError;
use crate::views::{ActionBlockReason, JobSubmissionView};
use retainpdf_core::models::domain::{now_iso, JobSnapshot, JobStatusKind, WorkflowKind};
use retainpdf_core::models::request::{CreateJobInput, JobSourceInput};
use crate::actions::stage_plan::resume_plan;
use crate::actions::translation_request_recovery::load_translation_request_recovery;
use crate::lifecycle::managed_credential_gc::cleanup_deleted_job_credentials;

use crate::lifecycle::creation::{relaunch_in_place, submit_job, NewJob, RunFence};
use crate::lifecycle::launcher::VersionLink;
use retainpdf_api_base::job_loading::load_job_or_404;
use crate::facade::JobsFacade;
use crate::actions::ocr_ambiguity::ambiguous_ocr_dispatch;
use crate::actions::stage_retry_overrides::{apply_retry_overrides, discard_ocr_secret_sources};
use retainpdf_data::ocr_provider::strip_server_owned_ocr_options;
use crate::actions::rerun_glossary::{require_source_glossary, restore_inline_glossary_entries};

impl<'a> JobsFacade<'a> {
    /// `overrides` 只会带换过的模型 key（路由层已校验）：续跑出新任务时替换原任务的旧凭据，
    /// 照创建任务的规则把明文 key 导入凭据库。原地重渲染不调模型，用不上它。
    pub fn rerun_submission(
        &self,
        base_url: &str,
        source_job_id: &str,
        overrides: &serde_json::Value,
    ) -> Result<JobSubmissionView, AppError> {
        let source_job = load_job_or_404(self.command.db, source_job_id)?;
        let plan = resume_plan(&source_job, self.command.control.data_root);
        // 在跑最先判：不管下面哪条路，都是「先取消」。
        if plan.reason_code == Some(ActionBlockReason::JobActive) {
            return Err(plan.blocked_error());
        }
        if plan.resume_workflow == Some(WorkflowKind::Render) {
            // 先取读数，再改快照：落库只在库里还是这个终态、这一代时才写（两个请求同时来只开跑一个）。
            let read_as = RunFence::of(&source_job);
            let job = prepare_in_place_render_job(source_job)?;
            // 续跑出来的渲染不精修：清掉没用完的一次性精修覆盖。
            crate::actions::stage_retry_refine::clear_pending_refine_override(
                self.command.control.output_root,
                &job.job_id,
            )?;
            // `rendered/` 不删：上一份 PDF 由 relaunch_in_place 在落库成功后挪开（排队期间阅读接着用，
            // 没跑成时接回来），渲染的其它中间文件照旧覆盖写，和 stage_retry 的原地重渲染一致。
            // 发射被拒（503、额度、409、落库失败）时，除了上面那份没用完的精修覆盖，什么都没动。
            let job = relaunch_in_place(&self.command.submit.launcher, job, &read_as)?;
            // 开跑之后才清理上一轮遗留的 `-ocr` 子任务（重渲染不做 OCR，用不上它；
            // prepare_in_place_render_job 已经断开了父任务指向它的链接）。
            self.discard_stale_ocr_child(&job.job_id);
            return Ok(self.build_submission_view(
                base_url,
                &job,
                JobStatusKind::Queued,
                WorkflowKind::Render,
            ));
        }
        if source_job
            .request_payload
            .translation
            .execution_connection
            .is_some()
        {
            return Err(ActionBlockReason::ModelExecutorUnsupported.conflict("Rust model translation rerun requires receipt-preserving recovery; legacy rerun is disabled"));
        }
        if ambiguous_ocr_dispatch(self.command.db, source_job_id)?.is_some() {
            return Err(ActionBlockReason::AmbiguousOcrDispatch.conflict(
                "OCR request outcome is ambiguous; generic rerun is paused. Use the OCR ambiguity resolution endpoint to bind an existing provider task or explicitly accept duplicate request risk",
            ));
        }
        if let Some(state) =
            load_translation_request_recovery(&source_job, self.command.control.data_root)
                .filter(|state| state.requires_confirmation)
        {
            if state.status == "corrupt" {
                return Err(ActionBlockReason::RequestJournalCorrupt.conflict(
                    "translation request journal is corrupt; generic rerun is paused because duplicate-risk acceptance cannot repair control-state corruption",
                ));
            }
            return Err(ActionBlockReason::AmbiguousTranslationRequest.conflict(
                "translation request outcome is ambiguous; generic rerun is paused. Use retry-stage with stage=translation and ambiguous_request_policy=accept_duplicate_risk",
            ));
        }
        let mut request = build_rerun_request(&source_job, self.command.control.data_root)?;
        apply_retry_overrides(&mut request, overrides)?;
        require_source_glossary(self.command.db, &source_job, &request)?;
        let workflow = request.workflow.clone();
        // 归属（jobs.document_id + 书卡）沿 artifact_job_id 继承；续跑是同一份译文，加进源任务的译文版本。
        let job = submit_job(
            &self.command.submit,
            NewJob::new(request).in_version(VersionLink::JoinVersionOf(&source_job.job_id)),
        )?;
        Ok(self.build_submission_view(base_url, &job, JobStatusKind::Queued, workflow))
    }
}

impl JobsFacade<'_> {
    /// 删掉 `<id>-ocr` 子任务的行和（老布局下的）目录，尽力而为。
    fn discard_stale_ocr_child(&self, job_id: &str) {
        let ocr_child_id = format!("{job_id}-ocr");
        let deleted_ocr_child = self.command.db.get_job(&ocr_child_id).ok();
        let _ = self.command.db.delete_job(&ocr_child_id);
        if let Some(deleted_ocr_child) = deleted_ocr_child {
            cleanup_deleted_job_credentials(
                self.command.db,
                self.command.control.data_root,
                &[deleted_ocr_child],
            );
        }
        let ocr_child_dir = self
            .command
            .control
            .data_root
            .join("jobs")
            .join(&ocr_child_id);
        let _ = std::fs::remove_dir_all(&ocr_child_dir);
    }
}

pub(super) fn prepare_in_place_render_job(mut job: JobSnapshot) -> Result<JobSnapshot, AppError> {
    if matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(ActionBlockReason::JobActive.conflict(
            "job is already queued or running; cancel it before rerender",
        ));
    }

    let now = now_iso();
    job.workflow = WorkflowKind::Render;
    job.request_payload.workflow = WorkflowKind::Render;
    job.request_payload.source.upload_id.clear();
    job.request_payload.source.source_url.clear();
    job.request_payload.source.artifact_job_id = job.job_id.clone();
    // Render never contacts OCR providers, so OCR secrets and refs are dropped.
    // Translation/reviewer vault *refs* are kept (inline keys are still
    // dropped): a later in-place refine needs a model, and a ref is only a
    // pointer into the vault, not a secret. Product decision 2026-10-08.
    // A ref that no longer resolves never fails the render; see
    // retainpdf-runner worker_process::apply_job_credentials.
    discard_ocr_secret_sources(&mut job.request_payload.ocr);
    // 只能服务器定的 OCR 选项同样去掉（老任务里可能存着，见 build_rerun_request）。之后的 overrides
    // 再带就 400（stage_retry_overrides）。
    strip_server_owned_ocr_options(&mut job.request_payload.ocr);
    job.request_payload.translation.api_key.clear();
    job.request_payload.translation.reviewer_api_key.clear();
    job.request_payload.runtime.job_id = job.job_id.clone();
    job.status = JobStatusKind::Queued;
    job.updated_at = now;
    job.started_at = None;
    // 上一次跑完的时间连同上一份 PDF 一起留着（见 reset_render_artifacts），阅读排序要用。
    let previous_finished_at = job.finished_at.take();
    job.pid = None;
    job.command.clear();
    job.error = None;
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("重渲染任务排队中，等待可用执行槽位".to_string());
    job.progress_current = Some(0);
    job.progress_total = None;
    job.log_tail.clear();
    job.result = None;
    job.runtime = None;
    job.replace_failure_info(None);
    reset_render_artifacts(&mut job);
    if let Some(artifacts) = job.artifacts.as_mut() {
        if artifacts.previous_output_pdf.is_some() {
            artifacts.previous_finished_at = previous_finished_at;
        }
    }
    // Also clear stale OCR child linkage that would otherwise point to a now-orphaned *-ocr job
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.ocr_job_id = None;
        artifacts.ocr_status = None;
        artifacts.ocr_trace_id = None;
        artifacts.ocr_provider_trace_id = None;
    }
    job.sync_runtime_state();
    Ok(job)
}

fn reset_render_artifacts(job: &mut JobSnapshot) {
    let Some(artifacts) = job.artifacts.as_mut() else {
        return;
    };
    if let Some(previous) = artifacts.output_pdf.take() {
        artifacts.previous_output_pdf = Some(previous);
    }
    artifacts.summary = None;
    artifacts.events_jsonl = None;
    artifacts.pages_processed = None;
    artifacts.translate_render_time_seconds = None;
    artifacts.save_time_seconds = None;
    artifacts.total_time_seconds = None;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn in_place_render_drops_unused_provider_credentials() {
        let mut input = CreateJobInput::default();
        input.ocr.credential_ref = "cred_ocr_old".to_string();
        input.ocr.mineru_token = "mineru-old".to_string();
        input.ocr.options.insert(
            "credential".to_string(),
            serde_json::Value::String("configured-old".to_string()),
        );
        input.translation.credential_ref = "cred_translation_old".to_string();
        input.translation.api_key = "translation-old".to_string();
        let mut job = JobSnapshot::new("job-render-retry".to_string(), input, Vec::new());
        job.status = JobStatusKind::Failed;

        let job = prepare_in_place_render_job(job).expect("prepare in-place render");

        assert!(job.request_payload.ocr.credential_ref.is_empty());
        assert!(job.request_payload.ocr.mineru_token.is_empty());
        assert!(!job.request_payload.ocr.options.contains_key("credential"));
        // 翻译凭据引用保留（之后原地精修要用），内联 key 照旧清掉。
        assert_eq!(job.request_payload.translation.credential_ref, "cred_translation_old");
        assert!(job.request_payload.translation.api_key.is_empty());
    }

    #[test]
    fn in_place_rerun_keeps_the_previous_pdf_for_reading_until_it_runs() {
        let mut job = JobSnapshot::new("job-refine-again".to_string(), CreateJobInput::default(), Vec::new());
        job.status = JobStatusKind::Succeeded;
        job.finished_at = Some("2026-10-09T17:35:34Z".to_string());
        job.artifacts = Some(retainpdf_core::models::domain::JobArtifacts {
            output_pdf: Some("jobs/job-refine-again/rendered/out.pdf".to_string()),
            ..Default::default()
        });

        let job = prepare_in_place_render_job(job).expect("prepare in-place render");

        let artifacts = job.artifacts.as_ref().unwrap();
        assert_eq!(artifacts.output_pdf, None);
        assert_eq!(artifacts.previous_output_pdf.as_deref(), Some("jobs/job-refine-again/rendered/out.pdf"));
        assert_eq!(artifacts.previous_finished_at.as_deref(), Some("2026-10-09T17:35:34Z"));
        assert_eq!(job.finished_at, None);
    }
}

fn build_rerun_request(
    source_job: &JobSnapshot,
    data_root: &std::path::Path,
) -> Result<CreateJobInput, AppError> {
    let plan = resume_plan(source_job, data_root);
    let workflow = plan
        .resume_workflow
        .clone()
        .ok_or_else(|| plan.blocked_error())?;
    let mut request = CreateJobInput {
        workflow,
        source: JobSourceInput {
            upload_id: source_job.request_payload.source.upload_id.clone(),
            source_url: source_job.request_payload.source.source_url.clone(),
            artifact_job_id: source_job.request_payload.source.artifact_job_id.clone(),
        },
        ocr: source_job.request_payload.ocr.clone(),
        translation: source_job.request_payload.translation.clone(),
        render: source_job.request_payload.render.clone(),
        runtime: source_job.request_payload.runtime.clone(),
    };
    request.source.upload_id.clear();
    request.source.source_url.clear();
    request.source.artifact_job_id = source_job.job_id.clone();
    request.runtime.job_id.clear();
    // 老任务的请求里可能存着只能服务器定的 OCR 选项（2026-10-22 之前建任务不拦）：复制时去掉，
    // 重跑不因此 400，也不再带下去。
    strip_server_owned_ocr_options(&mut request.ocr);
    restore_inline_glossary_entries(source_job, &mut request);
    Ok(request)
}
