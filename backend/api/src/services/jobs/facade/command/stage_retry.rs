use crate::error::AppError;
use crate::models::api::{
    AmbiguousRequestPolicy, RetryStageKind, RetryStageRequest, RetryStageSubmissionView,
    StageActionsView,
};
use crate::services::job_launcher::{link_new_job_to_document, start_job_execution};
use crate::services::jobs::stage_plan::stage_plan;
use crate::services::jobs::translation_request_recovery::load_translation_request_recovery;

use super::super::super::creation::{create_ocr_ambiguity_recovery_job, create_translation_job};
use super::super::super::query::load_job_or_404;
use super::super::JobsFacade;
use super::ocr_ambiguity::ambiguous_ocr_dispatch;
use super::rerun::prepare_in_place_render_job;
use super::stage_retry_overrides::{
    apply_retry_overrides, apply_retry_overrides_to_resolved_spec, discard_ocr_secret_sources,
};
use super::stage_retry_refine::{
    clear_pending_refine_override, prepare_in_place_refine_job, validate_refine_request,
};
use super::stage_retry_request::build_retry_request;
use super::stage_retry_view::{build_retry_stage_submission_view, build_stage_actions_view};

impl<'a> JobsFacade<'a> {
    pub fn stage_actions_view(
        &self,
        base_url: &str,
        job_id: &str,
    ) -> Result<StageActionsView, AppError> {
        let job = load_job_or_404(self.command.db, job_id)?;
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
        if let Some(refine_override) = refine_override {
            return self.submit_in_place_refine(base_url, source_job, &request, refine_override);
        }
        if !matches!(request.stage, RetryStageKind::Render)
            && source_job
                .request_payload
                .translation
                .execution_connection
                .is_some()
        {
            return Err(AppError::conflict("Rust model translation retry requires receipt-preserving recovery; legacy retry is disabled even with duplicate-risk acceptance"));
        }
        let ambiguous_ocr = if matches!(request.stage, RetryStageKind::Ocr) {
            ambiguous_ocr_dispatch(self.command.db, source_job_id)?
        } else {
            None
        };
        if ambiguous_ocr.is_some()
            && request.ambiguous_request_policy != AmbiguousRequestPolicy::AcceptDuplicateRisk
        {
            return Err(AppError::conflict(
                "OCR request outcome is ambiguous; retry is paused. Use the OCR ambiguity resolution endpoint to bind an existing provider task, or retry-stage with ambiguous_request_policy=accept_duplicate_risk",
            ));
        }
        let plan = stage_plan(
            &source_job,
            request.stage.clone(),
            self.command.control.data_root,
        );
        if !plan.can_retry {
            return Err(AppError::bad_request(plan.disabled_reason));
        }
        if matches!(request.stage, RetryStageKind::Translation) {
            if let Some(state) =
                load_translation_request_recovery(&source_job, self.command.control.data_root)
            {
                if state.status == "corrupt" {
                    return Err(AppError::conflict(
                        "translation request journal is corrupt; retry remains paused because duplicate-risk acceptance cannot repair control-state corruption",
                    ));
                }
                if state.requires_confirmation
                    && request.ambiguous_request_policy
                        != AmbiguousRequestPolicy::AcceptDuplicateRisk
                {
                    return Err(AppError::conflict(
                        "translation request outcome is ambiguous; retry is paused. Resubmit retry-stage with ambiguous_request_policy=accept_duplicate_risk to acknowledge possible duplicate upstream work or billing",
                    ));
                }
            }
        }

        let request_input = if request.creates_new_job() {
            build_retry_request(&source_job, &request.stage)?
        } else if matches!(request.stage, RetryStageKind::Render) {
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
            let job = start_job_execution(&self.command.submit.launcher, job)?;
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
            return Err(AppError::bad_request(
                "create_new_job=false is currently supported only for render and refine retry",
            ));
        };

        let mut request_input = request_input;
        apply_retry_overrides(&mut request_input, &request.overrides)?;
        request_input.translation.accepted_ambiguous_request_risk =
            request.ambiguous_request_policy == AmbiguousRequestPolicy::AcceptDuplicateRisk;
        let workflow = request_input.workflow.clone();
        let job = match ambiguous_ocr.as_ref() {
            Some(dispatch) => create_ocr_ambiguity_recovery_job(
                &self.command.submit,
                &request_input,
                dispatch,
                "accept_duplicate_risk",
                None,
            )?,
            None => {
                let job = create_translation_job(&self.command.submit, &request_input)?;
                // OCR 重试只带 upload_id / source_url、不带 artifact_job_id：start_job_execution
                // 按 upload 关联不上时，归属从源任务继承（同一个实现，只是多给一个来源）。
                if request_input.source.artifact_job_id.trim().is_empty() {
                    link_new_job_to_document(self.command.db, &job, Some(source_job_id));
                }
                job
            }
        };
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
        source_job: crate::models::domain::JobSnapshot,
        request: &RetryStageRequest,
        refine_override: crate::models::domain::RefineOverride,
    ) -> Result<RetryStageSubmissionView, AppError> {
        let source_job_id = source_job.job_id.clone();
        // 先判「在跑」：plan 也会挡，但那条走 400，这里按 rerender 的规则给 409。
        if matches!(
            source_job.status,
            crate::models::domain::JobStatusKind::Queued
                | crate::models::domain::JobStatusKind::Running
        ) {
            return Err(AppError::conflict(
                "job is already queued or running; cancel it or wait before refining",
            ));
        }
        let plan = stage_plan(
            &source_job,
            RetryStageKind::Refine,
            self.command.control.data_root,
        );
        if !plan.can_retry {
            if source_job
                .request_payload
                .translation
                .execution_connection
                .is_some()
            {
                return Err(AppError::conflict(plan.disabled_reason));
            }
            return Err(AppError::bad_request(plan.disabled_reason));
        }
        let job = prepare_in_place_refine_job(
            source_job,
            &request.overrides,
            self.command.control.data_root,
        )?;
        // 覆盖必须在启动之前写好：start_job_execution 之后运行时随时可能读它。
        let job_paths = crate::storage_paths::JobPaths::for_job(
            self.command.control.output_root,
            &job.job_id,
        );
        crate::worker_command::refine_override::write_refine_override(&job_paths, &refine_override)
            .map_err(|error| {
                AppError::internal(format!("failed to stage refine override: {error:#}"))
            })?;
        let job = match start_job_execution(&self.command.submit.launcher, job) {
            Ok(job) => job,
            Err(error) => {
                let _ = crate::worker_command::refine_override::clear_refine_override(&job_paths);
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
