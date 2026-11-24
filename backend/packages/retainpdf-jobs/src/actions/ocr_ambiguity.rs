use serde_json::{json, Map, Value};

use retainpdf_data::db::{Db, PipelineDispatchRecord};
use retainpdf_api_base::error::AppError;
use crate::views::{
    ActionBlockReason, AmbiguousRequestPolicy, OcrAmbiguityResolutionKind, OcrAmbiguityResolutionRequest,
    OcrAmbiguityResolutionView, RetryStageKind, RetryStageRequest,
};
use crate::actions::stage_plan::stage_plan;

use crate::lifecycle::creation::{submit_job, NewJob};
use retainpdf_api_base::job_loading::load_job_or_404;
use crate::facade::JobsFacade;
use crate::actions::stage_retry_request::build_retry_request;
use crate::actions::rerun_glossary::require_source_glossary;
use crate::actions::stage_retry_view::build_retry_stage_submission_view;

#[cfg(test)]
const OCR_SUBMIT_DISPATCH_KEY: &str = "ocr-submit";

impl<'a> JobsFacade<'a> {
    pub fn resolve_ocr_ambiguity_submission(
        &self,
        base_url: &str,
        source_job_id: &str,
        request: OcrAmbiguityResolutionRequest,
    ) -> Result<OcrAmbiguityResolutionView, AppError> {
        let source_job = load_job_or_404(self.command.db, source_job_id)?;
        use retainpdf_core::models::domain::JobStatusKind;
        match source_job.status {
            // 取消也算：OCR 上传到一半被取消，请求可能已经到了服务商，派发记录同样拿不准。
            JobStatusKind::Failed | JobStatusKind::Canceled => {}
            // 正在跑：多半是上一次处理已经把它重新拉起来了，先取消或等它结束。
            JobStatusKind::Queued | JobStatusKind::Running => {
                return Err(ActionBlockReason::JobActive.conflict(
                    "job is queued or running; its OCR ambiguity cannot be resolved now",
                ));
            }
            _ => {
                return Err(ActionBlockReason::NoOcrDispatch.conflict(
                    "job is no longer failed or canceled and its OCR ambiguity cannot be resolved",
                ));
            }
        }
        let source_dispatch = ambiguous_ocr_dispatch(self.command.db, source_job_id)?
            .ok_or_else(|| {
                ActionBlockReason::NoOcrDispatch
                    .conflict("job has no durable OCR dispatch to resolve")
            })?;
        if request.resolution_revision != source_dispatch.generation {
            return Err(ActionBlockReason::StaleResolution.conflict(
                "OCR ambiguity resolution revision is stale; reload diagnostics",
            ));
        }

        let resolution = request.resolution;
        let submission = match resolution {
            OcrAmbiguityResolutionKind::AcceptDuplicateRisk => {
                reject_receipt_fields(&request)?;
                self.retry_stage_submission(
                    base_url,
                    source_job_id,
                    RetryStageRequest {
                        stage: RetryStageKind::Ocr,
                        mode: "from_stage".to_string(),
                        create_new_job: Some(true),
                        overrides: Value::Object(Map::new()),
                        ambiguous_request_policy: AmbiguousRequestPolicy::AcceptDuplicateRisk,
                        refine: None,
                    },
                )?
            }
            OcrAmbiguityResolutionKind::BindExistingReceipt => {
                let plan = stage_plan(
                    &source_job,
                    RetryStageKind::Ocr,
                    self.command.control.data_root,
                );
                if !plan.can_retry {
                    return Err(plan.blocked_error());
                }
                let receipt = build_bound_receipt(&source_dispatch, &request)?;
                let request_input = build_retry_request(&source_job, &RetryStageKind::Ocr)?;
                require_source_glossary(self.command.db, &source_job, &request_input)?;
                let workflow = request_input.workflow.clone();
                let job = submit_job(
                    &self.command.submit,
                    NewJob::new(request_input)
                        .derived_run_of(source_job_id)
                        .resolving_ocr_ambiguity(
                            &source_dispatch,
                            "bind_existing_receipt",
                            Some(&receipt),
                        ),
                )?;
                build_retry_stage_submission_view(
                    base_url,
                    source_job_id,
                    &job,
                    RetryStageKind::Ocr,
                    vec!["provider_dispatch_receipt".to_string()],
                    vec![
                        "ocr_polling".to_string(),
                        "translation".to_string(),
                        "render".to_string(),
                    ],
                    workflow,
                    AmbiguousRequestPolicy::Block,
                )
            }
        };

        Ok(OcrAmbiguityResolutionView {
            resolution,
            provider: source_dispatch.provider,
            operation: source_dispatch.operation,
            submission,
        })
    }
}

pub(crate) fn ambiguous_ocr_dispatch(
    db: &Db,
    job_id: &str,
) -> Result<Option<PipelineDispatchRecord>, AppError> {
    // 派发记录在真正调服务商的任务名下：book/translate 任务的 OCR 在 `<id>-ocr` 子任务里跑。
    Ok(db
        .latest_ocr_dispatch_for_job(job_id)?
        .filter(|dispatch| dispatch.stage_key == "ocr" && dispatch.status == "ambiguous"))
}

fn build_bound_receipt(
    dispatch: &retainpdf_data::db::PipelineDispatchRecord,
    request: &OcrAmbiguityResolutionRequest,
) -> Result<Value, AppError> {
    let mut receipt = Map::new();
    match (dispatch.provider.as_str(), dispatch.operation.as_str()) {
        ("mineru", "apply_upload_url") => {
            let batch_id = required_field("batch_id", &request.batch_id)?;
            let upload_url = required_field("upload_url", &request.upload_url)?;
            if !request.task_id.trim().is_empty() {
                return Err(AppError::bad_request(
                    "task_id is not valid for a MinerU upload-target receipt",
                ));
            }
            receipt.insert("kind".to_string(), json!("mineru_upload_target"));
            receipt.insert("batch_id".to_string(), json!(batch_id));
            receipt.insert("upload_url".to_string(), json!(upload_url));
        }
        ("mineru", "create_extract_task") => {
            reject_batch_fields(request)?;
            receipt.insert("kind".to_string(), json!("mineru_task"));
            receipt.insert(
                "task_id".to_string(),
                json!(required_field("task_id", &request.task_id)?),
            );
        }
        ("paddle", "submit_local_file" | "submit_remote_url") => {
            reject_batch_fields(request)?;
            receipt.insert("kind".to_string(), json!("paddle_task"));
            receipt.insert(
                "task_id".to_string(),
                json!(required_field("task_id", &request.task_id)?),
            );
        }
        _ => {
            return Err(ActionBlockReason::OcrDispatchUnsupported.conflict(format!(
                "unsupported OCR dispatch identity: provider={} operation={}",
                dispatch.provider, dispatch.operation
            )))
        }
    }
    if !request.trace_id.trim().is_empty() {
        receipt.insert("trace_id".to_string(), json!(request.trace_id.trim()));
    }
    Ok(Value::Object(receipt))
}

fn required_field<'a>(name: &str, value: &'a str) -> Result<&'a str, AppError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(AppError::bad_request(format!(
            "{name} is required when binding this OCR receipt"
        )));
    }
    Ok(value)
}

fn reject_batch_fields(request: &OcrAmbiguityResolutionRequest) -> Result<(), AppError> {
    if !request.batch_id.trim().is_empty() || !request.upload_url.trim().is_empty() {
        return Err(AppError::bad_request(
            "batch_id and upload_url are not valid for an OCR task receipt",
        ));
    }
    Ok(())
}

fn reject_receipt_fields(request: &OcrAmbiguityResolutionRequest) -> Result<(), AppError> {
    if [
        request.task_id.as_str(),
        request.batch_id.as_str(),
        request.upload_url.as_str(),
        request.trace_id.as_str(),
    ]
    .into_iter()
    .any(|value| !value.trim().is_empty())
    {
        return Err(AppError::bad_request(
            "provider receipt fields are not valid when accepting duplicate request risk",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::presentation::build_ocr_ambiguity_view;

    fn dispatch(provider: &str, operation: &str) -> PipelineDispatchRecord {
        PipelineDispatchRecord {
            job_id: "source-job".to_string(),
            attempt: 1,
            stage_key: "ocr".to_string(),
            dispatch_key: OCR_SUBMIT_DISPATCH_KEY.to_string(),
            generation: 3,
            provider: provider.to_string(),
            operation: operation.to_string(),
            request_hash: "a".repeat(64),
            status: "ambiguous".to_string(),
            receipt: None,
            ambiguity_reason: Some("lost receipt".to_string()),
        }
    }

    fn request() -> OcrAmbiguityResolutionRequest {
        OcrAmbiguityResolutionRequest {
            resolution: OcrAmbiguityResolutionKind::BindExistingReceipt,
            resolution_revision: 3,
            task_id: String::new(),
            batch_id: String::new(),
            upload_url: String::new(),
            trace_id: String::new(),
        }
    }

    #[test]
    fn task_receipt_rejects_batch_fields() {
        let mut request = request();
        request.task_id = "task-1".to_string();
        request.batch_id = "batch-1".to_string();
        assert!(
            build_bound_receipt(&dispatch("paddle", "submit_remote_url"), &request)
                .expect_err("mixed handle shapes must fail")
                .to_string()
                .contains("not valid")
        );
    }

    #[test]
    fn upload_target_receipt_requires_signed_upload_url() {
        let mut request = request();
        request.batch_id = "batch-1".to_string();
        assert!(
            build_bound_receipt(&dispatch("mineru", "apply_upload_url"), &request)
                .expect_err("missing upload URL must fail")
                .to_string()
                .contains("upload_url is required")
        );
    }

    #[test]
    fn resolution_request_rejects_unknown_receipt_fields() {
        assert!(
            serde_json::from_value::<OcrAmbiguityResolutionRequest>(json!({
                "resolution": "bind_existing_receipt",
                "resolution_revision": 3,
                "provider_job_id": "misspelled-or-unsupported"
            }))
            .is_err()
        );
    }

    #[test]
    fn diagnostics_contract_derives_receipt_fields_from_dispatch_identity() {
        let cases = [
            (
                "paddle",
                "submit_local_file",
                json!([
                    {"name": "task_id", "label": "Task ID", "required": true, "secret": false},
                    {"name": "trace_id", "label": "Trace ID", "required": false, "secret": false}
                ]),
            ),
            (
                "paddle",
                "submit_remote_url",
                json!([
                    {"name": "task_id", "label": "Task ID", "required": true, "secret": false},
                    {"name": "trace_id", "label": "Trace ID", "required": false, "secret": false}
                ]),
            ),
            (
                "mineru",
                "create_extract_task",
                json!([
                    {"name": "task_id", "label": "Task ID", "required": true, "secret": false},
                    {"name": "trace_id", "label": "Trace ID", "required": false, "secret": false}
                ]),
            ),
            (
                "mineru",
                "apply_upload_url",
                json!([
                    {"name": "batch_id", "label": "Batch ID", "required": true, "secret": false},
                    {"name": "upload_url", "label": "Upload URL", "required": true, "secret": true},
                    {"name": "trace_id", "label": "Trace ID", "required": false, "secret": false}
                ]),
            ),
        ];

        for (provider, operation, expected_fields) in cases {
            let view = build_ocr_ambiguity_view(&dispatch(provider, operation))
                .expect("supported dispatch contract");
            assert_eq!(view.resolution_revision, 3);
            assert_eq!(
                serde_json::to_value(view.receipt_fields).expect("receipt fields JSON"),
                expected_fields
            );
        }
        assert!(build_ocr_ambiguity_view(&dispatch("unknown", "submit")).is_none());
    }
}
