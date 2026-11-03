use retainpdf_api_base::error::AppError;
use crate::views::{
    ActionBlockReason, AmbiguousRequestPolicy, RetryStageKind, RetryStageRequest, RetryStageSubmissionView,
    StageActionsView,
};
use crate::actions::stage_plan::stage_plan;
use crate::actions::translation_request_recovery::load_translation_request_recovery;

use crate::lifecycle::creation::{relaunch_in_place, submit_job, NewJob, RunFence};
use retainpdf_api_base::job_loading::load_job_or_404;
use crate::facade::JobsFacade;
use crate::actions::ocr_ambiguity::ambiguous_ocr_dispatch;
use crate::actions::rerun::prepare_in_place_render_job;
use crate::actions::stage_retry_overrides::{
    apply_retry_overrides, apply_retry_overrides_to_resolved_spec, discard_ocr_secret_sources,
};
use crate::actions::stage_retry_refine::{
    clear_pending_refine_override, import_inline_refine_keys, prepare_in_place_refine_job,
    validate_refine_request,
};
use crate::actions::stage_retry_request::build_retry_request;
use crate::actions::rerun_glossary::require_source_glossary;
use crate::actions::stage_retry_view::{build_retry_stage_submission_view, build_stage_actions_view};
use crate::actions::streamed_ocr_artifacts::{adopt_streamed_ocr_artifacts, with_streamed_ocr_artifacts};

impl<'a> JobsFacade<'a> {
    pub fn stage_actions_view(
        &self,
        base_url: &str,
        job_id: &str,
    ) -> Result<StageActionsView, AppError> {
        // 边识别边翻译的书翻译失败时，以前 OCR 产物没并回父任务：从 OCR 子任务补上再判（见 streamed_ocr_artifacts）。
        let job = with_streamed_ocr_artifacts(self.command.db, load_job_or_404(self.command.db, job_id)?);
        Ok(build_stage_actions_view(
            base_url,
            &job,
            self.command.control.data_root,
        ))
    }

    pub fn retry_stage_submission(
        &self,
        base_url: &str,
        source_job_id: &str,
        request: RetryStageRequest,
    ) -> Result<RetryStageSubmissionView, AppError> {
        if !request.mode.trim().is_empty() && request.mode.trim() != "from_stage" {
            return Err(AppError::bad_request(format!(
                "unsupported retry mode: {}",
                request.mode
            )));
        }

        // refine 对象只属于 stage=refine；带在别的 stage 上多半是以为普通重渲染也会精修。
        if request.refine.is_some() && !matches!(request.stage, RetryStageKind::Refine) {
            return Err(AppError::bad_request(
                "refine options are only accepted with stage=refine",
            ));
        }
        // 只有 render / refine 能原地执行；ocr / translation 一律新建任务。这是请求写错了（400），
        // 和任务现在是什么状态无关，所以放在最前面，不让「在跑」的 409 盖住它。
        if !request.creates_new_job()
            && !matches!(request.stage, RetryStageKind::Render | RetryStageKind::Refine)
        {
            return Err(AppError::bad_request(
                "create_new_job=false is currently supported only for render and refine retry",
            ));
        }
        let refine_override = if matches!(request.stage, RetryStageKind::Refine) {
            if request.creates_new_job() {
                return Err(AppError::bad_request(
                    "refine retry runs in place on the source job; set create_new_job=false",
                ));
            }
            Some(validate_refine_request(request.refine.as_ref())?)
        } else {
            None
        };

        let source_job = load_job_or_404(self.command.db, source_job_id)?;
        // 重试翻译要复用源任务的 OCR 结果，新任务运行时按 artifact_job_id 回库里读：缺的从 OCR 子任务补上并写回。
        let source_job = if matches!(request.stage, RetryStageKind::Translation) {
            adopt_streamed_ocr_artifacts(self.command.db, source_job)?
        } else {
            source_job
        };
        if let Some(refine_override) = refine_override {
            return self.submit_in_place_refine(base_url, source_job, &request, refine_override);
        }
        let plan = stage_plan(
            &source_job,
            request.stage.clone(),
            self.command.control.data_root,
        );
        // 在跑最先判：不管哪个阶段、什么类型的任务，都是「先取消」。
        if plan.disabled_code == Some(ActionBlockReason::JobActive) {
            return Err(plan.blocked_error());
        }
        if !matches!(request.stage, RetryStageKind::Render)
            && source_job
                .request_payload
                .translation
                .execution_connection
                .is_some()
        {
            return Err(ActionBlockReason::ModelExecutorUnsupported.conflict("Rust model translation retry requires receipt-preserving recovery; legacy retry is disabled even with duplicate-risk acceptance"));
        }
        let ambiguous_ocr = if matches!(request.stage, RetryStageKind::Ocr) {
            ambiguous_ocr_dispatch(self.command.db, source_job_id)?
        } else {
            None
        };
        if ambiguous_ocr.is_some()
            && request.ambiguous_request_policy != AmbiguousRequestPolicy::AcceptDuplicateRisk
        {
            return Err(ActionBlockReason::AmbiguousOcrDispatch.conflict(
                "OCR request outcome is ambiguous; retry is paused. Use the OCR ambiguity resolution endpoint to bind an existing provider task, or retry-stage with ambiguous_request_policy=accept_duplicate_risk",
            ));
        }
        if !plan.can_retry {
            return Err(plan.blocked_error());
        }
        if matches!(request.stage, RetryStageKind::Translation) {
            // 请求日志损坏已在上面的 plan 里挡住（request_journal_corrupt）；这里只剩
            // 「结果不确定、没接受重复风险」。
            if let Some(state) =
                load_translation_request_recovery(&source_job, self.command.control.data_root)
            {
                if state.requires_confirmation
                    && request.ambiguous_request_policy
                        != AmbiguousRequestPolicy::AcceptDuplicateRisk
                {
                    return Err(ActionBlockReason::AmbiguousTranslationRequest.conflict(
                        "translation request outcome is ambiguous; retry is paused. Resubmit retry-stage with ambiguous_request_policy=accept_duplicate_risk to acknowledge possible duplicate upstream work or billing",
                    ));
                }
            }
        }

        let request_input = if request.creates_new_job() {
            build_retry_request(&source_job, &request.stage)?
        } else if matches!(request.stage, RetryStageKind::Render) {
            let read_as = RunFence::of(&source_job);
            let mut job = prepare_in_place_render_job(source_job)?;
            // 普通重渲染永远不精修：清掉上一次精修重试没用完的一次性覆盖（例如运行时
            // 重启时被判成 failed 的那次），否则这次渲染会意外带上它。
            clear_pending_refine_override(self.command.control.output_root, &job.job_id)?;
            apply_retry_overrides_to_resolved_spec(&mut job.request_payload, &request.overrides)?;
            discard_ocr_secret_sources(&mut job.request_payload.ocr);
            // 与 prepare_in_place_render_job 一致：只清内联 key，保留凭据引用，
            // 之后的原地精修还要用。
            job.request_payload.translation.api_key.clear();
            job.request_payload.translation.reviewer_api_key.clear();
            job.request_payload.runtime.job_id = job.job_id.clone();
            job.sync_runtime_state();
            let job = relaunch_in_place(&self.command.submit.launcher, job, &read_as)?;
            return Ok(build_retry_stage_submission_view(
                base_url,
                source_job_id,
                &job,
                RetryStageKind::Render,
                plan.will_reuse,
                plan.will_rerun,
                plan.retry_workflow,
                request.ambiguous_request_policy,
            ));
        } else {
            // 上面已拒绝 ocr / translation 的 create_new_job=false，走不到这里；留一道防线。
            return Err(AppError::bad_request(
                "create_new_job=false is currently supported only for render and refine retry",
            ));
        };

        let mut request_input = request_input;
        apply_retry_overrides(&mut request_input, &request.overrides)?;
        require_source_glossary(self.command.db, &source_job, &request_input)?;
        request_input.translation.accepted_ambiguous_request_risk =
            request.ambiguous_request_policy == AmbiguousRequestPolicy::AcceptDuplicateRisk;
        let workflow = request_input.workflow.clone();
        let reuses_artifacts = !request_input.source.artifact_job_id.trim().is_empty();
        let mut new_job = NewJob::new(request_input);
        if let Some(dispatch) = ambiguous_ocr.as_ref() {
            new_job = new_job.resolving_ocr_ambiguity(dispatch, "accept_duplicate_risk", None);
        } else if !reuses_artifacts {
            // OCR 重试只带 upload_id / source_url、不带 artifact_job_id：按 upload 归不到书时，
            // 归属从源任务继承。
            new_job = new_job.derived_from(source_job_id);
        }
        let job = submit_job(&self.command.submit, new_job)?;
        Ok(build_retry_stage_submission_view(
            base_url,
            source_job_id,
            &job,
            request.stage,
            plan.will_reuse,
            plan.will_rerun,
            workflow,
            request.ambiguous_request_policy,
        ))
    }

    /// `stage=refine`：原地跑一次 Render workflow，渲染阶段在真正渲染之前先精修。
    /// 一次性覆盖落在任务目录的 `specs/refine-override.json`，不写进 `translation.refine`。
    fn submit_in_place_refine(
        &self,
        base_url: &str,
        source_job: retainpdf_core::models::domain::JobSnapshot,
        request: &RetryStageRequest,
        refine_override: retainpdf_core::models::domain::RefineOverride,
    ) -> Result<RetryStageSubmissionView, AppError> {
        let source_job_id = source_job.job_id.clone();
        let plan = stage_plan(
            &source_job,
            RetryStageKind::Refine,
            self.command.control.data_root,
        );
        if !plan.can_retry {
            return Err(plan.blocked_error());
        }
        // 换了 key 后带来的明文 key 先导入凭据库；锁持有到 relaunch_in_place 落库之后。
        let (overrides, _credential_usage) =
            import_inline_refine_keys(&request.overrides, self.command.control.data_root)?;
        let read_as = RunFence::of(&source_job);
        let job = prepare_in_place_refine_job(source_job, &overrides, self.command.control.data_root)?;
        // 覆盖必须在启动之前写好：relaunch_in_place 之后运行时随时可能读它。
        let job_paths = retainpdf_core::storage_paths::JobPaths::for_job(
            self.command.control.output_root,
            &job.job_id,
        );
        retainpdf_data::worker_command::refine_override::write_refine_override(&job_paths, &refine_override)
            .map_err(|error| {
                AppError::internal(format!("failed to stage refine override: {error:#}"))
            })?;
        let job = match relaunch_in_place(&self.command.submit.launcher, job, &read_as) {
            Ok(job) => job,
            Err(error) => {
                // 别的请求已经开跑了（409 job_active）：那一次运行可能正要读覆盖，不删。
                let someone_else_started = matches!(
                    &error,
                    AppError::Reasoned { reason, .. } if *reason == ActionBlockReason::JobActive.as_str()
                );
                if !someone_else_started {
                    let _ = retainpdf_data::worker_command::refine_override::clear_refine_override(&job_paths);
                }
                return Err(error);
            }
        };
        Ok(build_retry_stage_submission_view(
            base_url,
            &source_job_id,
            &job,
            RetryStageKind::Refine,
            plan.will_reuse,
            plan.will_rerun,
            plan.retry_workflow,
            request.ambiguous_request_policy,
        ))
    }
}
