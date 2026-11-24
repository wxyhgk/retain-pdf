//! Atomic OCR ambiguity recovery persistence.
//!
//! This is intentionally separate from the generic pipeline state machine:
//! it couples one dispatch CAS to creation of a RetainPDF recovery job, its
//! initial attempt/stage, an optional provider receipt, and redacted audit
//! events. Keeping those writes in one module does not split the transaction.

use anyhow::Result;
use rusqlite::{params, TransactionBehavior};
use serde_json::{json, Value};

use crate::models::domain::{now_iso, ocr_child_job_id, ocr_parent_job_id, JobSnapshot, WorkflowKind};

use super::job_derivations::record_job_derivation;
use super::job_writes::{persist_prepared_job, prepare_job_write};
use super::pipeline::{append_state_event, validate_identity, PipelineDispatchRecord};
use super::Db;

impl Db {
    /// Resolves the source dispatch and seeds the recovery job in one transaction.
    ///
    /// The seeded OCR attempt and receipt belong to whichever job will actually call the
    /// provider: the recovery job itself for a standalone OCR workflow, otherwise its
    /// `{id}-ocr` child (book/translate run OCR inline in that child). The child row does not
    /// exist yet at this point, so a queued placeholder is written with it; the runner
    /// overwrites the row when it creates the child and keeps the attempt rows.
    pub fn create_ocr_recovery_job_state(
        &self,
        source_dispatch: &PipelineDispatchRecord,
        recovery_job: &JobSnapshot,
        resolution: &str,
        bound_receipt: Option<&Value>,
    ) -> Result<bool> {
        validate_identity("resolution", resolution)?;
        let prepared = prepare_job_write(self, recovery_job)?;
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let timestamp = now_iso();
        let resolution_detail =
            format!("resolved:{resolution}:recovery_job={}", recovery_job.job_id);
        let changed = tx.execute(
            r#"
            UPDATE pipeline_dispatches
            SET generation = generation + 1, status = 'resolved',
                ambiguity_reason = ?1, updated_at = ?2
            WHERE job_id = ?3 AND attempt = ?4 AND dispatch_key = ?5
              AND stage_key = 'ocr' AND status = 'ambiguous'
              AND provider = ?6 AND operation = ?7 AND request_hash = ?8
              AND generation = ?9
              AND EXISTS (
                  SELECT 1 FROM jobs
                  WHERE (jobs.job_id = ?3 OR jobs.job_id || '-ocr' = ?3)
                    AND jobs.status IN ('failed', 'canceled')
              )
            "#,
            params![
                resolution_detail,
                timestamp,
                source_dispatch.job_id,
                source_dispatch.attempt,
                source_dispatch.dispatch_key,
                source_dispatch.provider,
                source_dispatch.operation,
                source_dispatch.request_hash,
                source_dispatch.generation,
            ],
        )?;
        if changed != 1 {
            return Ok(false);
        }

        persist_prepared_job(&tx, prepared)?;
        // 恢复任务也是从源任务派生的（v38）：之后续跑、重试源任务时看得到它还在跑。
        // 派发记录在真正调服务商的任务名下（`<源任务>-ocr` 或源任务自己）。
        let source_job_id =
            ocr_parent_job_id(&source_dispatch.job_id).unwrap_or(&source_dispatch.job_id);
        record_job_derivation(&tx, &recovery_job.job_id, source_job_id)?;
        let owner_id = if recovery_job.request_payload.workflow == WorkflowKind::Ocr {
            recovery_job.job_id.clone()
        } else {
            let owner_id = ocr_child_job_id(&recovery_job.job_id);
            let mut child_request = recovery_job.request_payload.clone();
            child_request.workflow = WorkflowKind::Ocr;
            child_request.job_id = owner_id.clone();
            let placeholder = JobSnapshot::new(
                owner_id.clone(),
                child_request,
                vec!["ocr-child-pending-provider".to_string()],
            );
            persist_prepared_job(&tx, prepare_job_write(self, &placeholder)?)?;
            owner_id
        };
        let worker_id = format!("ocr-recovery-seed:{}", std::process::id());
        tx.execute(
            r#"
            INSERT INTO pipeline_attempts (
                job_id, attempt, generation, status, worker_id, current_stage,
                created_at, updated_at
            ) VALUES (?1, 1, 1, 'running', ?2, 'ocr', ?3, ?3)
            "#,
            params![owner_id, worker_id, timestamp],
        )?;
        tx.execute(
            r#"
            INSERT INTO pipeline_stages (
                job_id, attempt, stage_key, stage_order, generation, status,
                created_at, updated_at, observation_payload_json
            ) VALUES (?1, 1, 'ocr', 0, 1, 'running', ?2, ?2, '{}')
            "#,
            params![owner_id, timestamp],
        )?;
        let receipt_fields = bound_receipt
            .and_then(Value::as_object)
            .map(|object| {
                let mut fields = object
                    .keys()
                    .filter(|key| key.as_str() != "kind")
                    .cloned()
                    .collect::<Vec<_>>();
                fields.sort();
                fields
            })
            .unwrap_or_default();
        if let Some(receipt) = bound_receipt {
            tx.execute(
                r#"
                INSERT INTO pipeline_dispatches (
                    job_id, attempt, stage_key, dispatch_key, generation,
                    provider, operation, request_hash, status, receipt_json,
                    created_at, updated_at, receipted_at
                ) VALUES (?1, 1, 'ocr', ?2, 1, ?3, ?4, ?5, 'receipted', ?6, ?7, ?7, ?7)
                "#,
                params![
                    owner_id,
                    source_dispatch.dispatch_key,
                    source_dispatch.provider,
                    source_dispatch.operation,
                    source_dispatch.request_hash,
                    serde_json::to_string(receipt)?,
                    timestamp,
                ],
            )?;
        }
        let audit_payload = json!({
            "resolution": resolution,
            "source_job_id": source_dispatch.job_id,
            "recovery_job_id": recovery_job.job_id,
            "provider": source_dispatch.provider,
            "operation": source_dispatch.operation,
            "dispatch_key": source_dispatch.dispatch_key,
            "receipt_present": bound_receipt.is_some(),
            "receipt_fields": receipt_fields,
        });
        append_state_event(
            &tx,
            &source_dispatch.job_id,
            "ocr",
            "ocr_ambiguity_resolved",
            "OCR ambiguous request resolution recorded",
            audit_payload.clone(),
        )?;
        append_state_event(
            &tx,
            &recovery_job.job_id,
            "ocr",
            "ocr_recovery_created",
            "OCR recovery job created from explicit resolution",
            audit_payload,
        )?;
        tx.commit()?;
        Ok(true)
    }
}
