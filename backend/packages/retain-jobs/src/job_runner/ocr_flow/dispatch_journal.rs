use anyhow::{anyhow, bail, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::db::{PipelineAttemptCursor, PipelineDispatchBegin, PipelineDispatchIntent};
use crate::models::domain::JobRuntimeState;

use super::ProcessRuntimeDeps;

pub(super) const OCR_SUBMIT_DISPATCH_KEY: &str = "ocr-submit";

pub(super) enum OcrDispatchDecision {
    Send { cursor: PipelineAttemptCursor },
    Resume { receipt: Value },
}

pub(super) fn begin_ocr_dispatch(
    deps: &ProcessRuntimeDeps,
    job: &JobRuntimeState,
    provider: &str,
    operation: &str,
    request_identity: &Value,
) -> Result<OcrDispatchDecision> {
    let worker_id = format!("native-ocr:{}:{}", std::process::id(), job.job_id);
    let cursor = deps
        .db
        .acquire_pipeline_attempt(&job.job_id, &worker_id, "ocr", 0)?;
    let request_hash = Sha256::digest(serde_json::to_vec(request_identity)?)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let intent = PipelineDispatchIntent {
        dispatch_key: OCR_SUBMIT_DISPATCH_KEY.to_string(),
        provider: provider.to_string(),
        operation: operation.to_string(),
        request_hash,
    };
    match deps.db.begin_pipeline_dispatch(&cursor, &intent)? {
        PipelineDispatchBegin::Send { cursor } => Ok(OcrDispatchDecision::Send { cursor }),
        PipelineDispatchBegin::Resume { receipt, .. } => {
            Ok(OcrDispatchDecision::Resume { receipt })
        }
        PipelineDispatchBegin::Ambiguous { reason, .. } => {
            bail!("OCR provider request outcome is ambiguous; automatic resubmit blocked: {reason}")
        }
    }
}

pub(super) fn receipt_ocr_dispatch(
    deps: &ProcessRuntimeDeps,
    cursor: &PipelineAttemptCursor,
    receipt: &Value,
) -> Result<PipelineAttemptCursor> {
    deps.db
        .receipt_pipeline_dispatch(cursor, OCR_SUBMIT_DISPATCH_KEY, receipt)
}

pub(super) fn receipt_string(receipt: &Value, key: &str) -> Result<String> {
    receipt
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| anyhow!("durable OCR dispatch receipt is missing {key}"))
}

pub(super) fn receipt_optional_string(receipt: &Value, key: &str) -> Option<String> {
    receipt
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}
