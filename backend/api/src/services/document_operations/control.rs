use anyhow::{bail, Result};
use retain_core::models::domain::{now_iso, DocumentOperationStatus};
use retain_data::db::Db;

use super::executor::{DocumentOperationExecutor, ExecutorObservation};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReconciledDocumentOperation {
    pub operation_id: String,
    pub status: DocumentOperationStatus,
}

pub struct DocumentOperationControl<'a, E: DocumentOperationExecutor + ?Sized> {
    db: &'a Db,
    executor: &'a E,
}

impl<'a, E: DocumentOperationExecutor + ?Sized> DocumentOperationControl<'a, E> {
    pub fn new(db: &'a Db, executor: &'a E) -> Self {
        Self { db, executor }
    }

    pub fn confirm(&self, operation_id: &str) -> Result<()> {
        let operation = self
            .db
            .get_document_operation(operation_id)?
            .ok_or_else(|| anyhow::anyhow!("document operation not found: {operation_id}"))?;
        if operation.status == DocumentOperationStatus::AwaitingConfirmation {
            return Ok(());
        }
        if operation.status != DocumentOperationStatus::Draft {
            bail!("document operation cannot be confirmed from its current state");
        }
        let attempt = self
            .db
            .get_document_operation_attempt(operation_id, operation.current_attempt)?
            .ok_or_else(|| anyhow::anyhow!("document operation attempt not found"))?;
        let mut next = attempt.state;
        next.status = DocumentOperationStatus::AwaitingConfirmation;
        next.updated_at = now_iso();
        self.db.transition_document_operation(
            &next,
            "confirmation_received",
            r#"{"confirmed":true}"#,
        )
    }

    pub fn persist_dispatch_intent(&self, operation_id: &str) -> Result<()> {
        let operation = self
            .db
            .get_document_operation(operation_id)?
            .ok_or_else(|| anyhow::anyhow!("document operation not found: {operation_id}"))?;
        if operation.status != DocumentOperationStatus::AwaitingConfirmation {
            bail!("document operation is not awaiting confirmation");
        }
        let attempt = self
            .db
            .get_document_operation_attempt(operation_id, operation.current_attempt)?
            .ok_or_else(|| anyhow::anyhow!("document operation attempt not found"))?;
        let capability = self.executor.probe(&attempt.manifest.executor_profile);
        if !capability.available || capability.executes_model_code {
            bail!("requested executor profile is unavailable or executes model code");
        }
        let mut next = attempt.state;
        next.status = DocumentOperationStatus::Queued;
        next.dispatch_intent_at = Some(now_iso());
        next.updated_at = now_iso();
        self.db
            .transition_document_operation(&next, "dispatch_intent", r#"{"durable":true}"#)
    }

    pub fn dispatch(&self, operation_id: &str) -> Result<()> {
        self.persist_dispatch_intent(operation_id)?;
        let operation = self
            .db
            .get_document_operation(operation_id)?
            .ok_or_else(|| anyhow::anyhow!("document operation not found after intent"))?;
        let attempt = self
            .db
            .get_document_operation_attempt(operation_id, operation.current_attempt)?
            .ok_or_else(|| anyhow::anyhow!("document operation attempt not found after intent"))?;
        let receipt = self.executor.start(&attempt.manifest)?;
        let mut next = attempt.state;
        next.status = DocumentOperationStatus::Running;
        next.dispatch_receipt = Some(receipt);
        next.updated_at = now_iso();
        self.db
            .transition_document_operation(&next, "dispatch_receipt", r#"{"accepted":true}"#)
    }

    pub fn refresh(&self, operation_id: &str) -> Result<Option<DocumentOperationStatus>> {
        let operation = self
            .db
            .get_document_operation(operation_id)?
            .ok_or_else(|| anyhow::anyhow!("document operation not found: {operation_id}"))?;
        if operation.status != DocumentOperationStatus::Running {
            return Ok(None);
        }
        let attempt = self
            .db
            .get_document_operation_attempt(operation_id, operation.current_attempt)?
            .ok_or_else(|| anyhow::anyhow!("document operation attempt not found"))?;
        let observation = self.executor.inspect(&attempt.manifest.dispatch_id)?;
        let mut next = attempt.state;
        next.updated_at = now_iso();
        let status = match observation {
            ExecutorObservation::NotFound => {
                next.status = DocumentOperationStatus::Ambiguous;
                next.error_code = Some("executor_receipt_missing".to_string());
                next.detail = Some("executor lost a previously accepted dispatch".to_string());
                self.db.transition_document_operation(
                    &next,
                    "dispatch_outcome_ambiguous",
                    r#"{"requires_reconciliation":true}"#,
                )?;
                DocumentOperationStatus::Ambiguous
            }
            ExecutorObservation::Accepted(receipt) => {
                if next.dispatch_receipt.as_ref() != Some(&receipt) {
                    bail!("executor receipt changed after dispatch");
                }
                return Ok(None);
            }
            ExecutorObservation::Completed {
                receipt,
                terminal_at,
                candidate_pdf_sha256,
            } => {
                if next.dispatch_receipt.as_ref() != Some(&receipt) {
                    bail!("executor completion receipt does not match dispatch");
                }
                next.status = DocumentOperationStatus::Validating;
                next.terminal_receipt_at = Some(terminal_at);
                next.candidate_pdf_sha256 = Some(candidate_pdf_sha256);
                self.db.transition_document_operation(
                    &next,
                    "executor_completed",
                    r#"{"validation_required":true}"#,
                )?;
                DocumentOperationStatus::Validating
            }
            ExecutorObservation::Cancelled {
                receipt,
                terminal_at,
            } => {
                if next.dispatch_receipt.as_ref() != Some(&receipt) {
                    bail!("executor cancellation receipt does not match dispatch");
                }
                next.status = DocumentOperationStatus::Cancelled;
                next.terminal_receipt_at = Some(terminal_at);
                self.db.transition_document_operation(
                    &next,
                    "executor_cancelled",
                    r#"{"cancelled":true}"#,
                )?;
                DocumentOperationStatus::Cancelled
            }
            ExecutorObservation::Failed {
                receipt,
                terminal_at,
                error_code,
                detail,
            } => {
                if next.dispatch_receipt.as_ref() != Some(&receipt) {
                    bail!("executor failure receipt does not match dispatch");
                }
                next.status = DocumentOperationStatus::Failed;
                next.terminal_receipt_at = Some(terminal_at);
                next.error_code = Some(error_code);
                next.detail = Some(detail);
                self.db.transition_document_operation(
                    &next,
                    "executor_failed",
                    r#"{"failed":true}"#,
                )?;
                DocumentOperationStatus::Failed
            }
        };
        Ok(Some(status))
    }

    pub fn reconcile_unreceipted_operation(
        &self,
        operation_id: &str,
    ) -> Result<Option<DocumentOperationStatus>> {
        let operation = self
            .db
            .get_document_operation(operation_id)?
            .ok_or_else(|| anyhow::anyhow!("document operation not found: {operation_id}"))?;
        if operation.status != DocumentOperationStatus::Queued {
            return Ok(None);
        }
        let attempt = self
            .db
            .get_document_operation_attempt(operation_id, operation.current_attempt)?
            .ok_or_else(|| anyhow::anyhow!("document operation attempt not found"))?;
        if attempt.state.dispatch_receipt.is_some() {
            return Ok(None);
        }
        let observation = self.executor.inspect(&attempt.manifest.dispatch_id)?;
        let mut state = attempt.state;
        state.updated_at = now_iso();
        let status = match observation {
            ExecutorObservation::NotFound => {
                state.status = DocumentOperationStatus::Ambiguous;
                state.error_code = Some("dispatch_outcome_unknown".to_string());
                state.detail =
                    Some("executor has no receipt for a durable dispatch intent".to_string());
                self.db.transition_document_operation(
                    &state,
                    "dispatch_outcome_ambiguous",
                    r#"{"requires_confirmation":true}"#,
                )?;
                DocumentOperationStatus::Ambiguous
            }
            ExecutorObservation::Accepted(receipt) => {
                state.status = DocumentOperationStatus::Running;
                state.dispatch_receipt = Some(receipt);
                self.db.transition_document_operation(
                    &state,
                    "dispatch_receipt_recovered",
                    r#"{"recovered":true}"#,
                )?;
                DocumentOperationStatus::Running
            }
            ExecutorObservation::Completed {
                receipt,
                terminal_at,
                candidate_pdf_sha256,
            } => {
                state.status = DocumentOperationStatus::Running;
                state.dispatch_receipt = Some(receipt);
                self.db.transition_document_operation(
                    &state,
                    "dispatch_receipt_recovered",
                    r#"{"recovered":true}"#,
                )?;
                state.status = DocumentOperationStatus::Validating;
                state.terminal_receipt_at = Some(terminal_at);
                state.candidate_pdf_sha256 = Some(candidate_pdf_sha256);
                state.updated_at = now_iso();
                self.db.transition_document_operation(
                    &state,
                    "terminal_receipt_recovered",
                    r#"{"recovered":true,"validation_required":true}"#,
                )?;
                DocumentOperationStatus::Validating
            }
            ExecutorObservation::Cancelled {
                receipt,
                terminal_at,
            } => {
                state.status = DocumentOperationStatus::Running;
                state.dispatch_receipt = Some(receipt);
                self.db.transition_document_operation(
                    &state,
                    "dispatch_receipt_recovered",
                    r#"{"recovered":true}"#,
                )?;
                state.status = DocumentOperationStatus::Cancelled;
                state.terminal_receipt_at = Some(terminal_at);
                state.updated_at = now_iso();
                self.db.transition_document_operation(
                    &state,
                    "cancellation_recovered",
                    r#"{"recovered":true}"#,
                )?;
                DocumentOperationStatus::Cancelled
            }
            ExecutorObservation::Failed {
                receipt,
                terminal_at,
                error_code,
                detail,
            } => {
                state.status = DocumentOperationStatus::Running;
                state.dispatch_receipt = Some(receipt);
                self.db.transition_document_operation(
                    &state,
                    "dispatch_receipt_recovered",
                    r#"{"recovered":true}"#,
                )?;
                state.status = DocumentOperationStatus::Failed;
                state.terminal_receipt_at = Some(terminal_at);
                state.error_code = Some(error_code);
                state.detail = Some(detail);
                state.updated_at = now_iso();
                self.db.transition_document_operation(
                    &state,
                    "executor_failure_recovered",
                    r#"{"recovered":true}"#,
                )?;
                DocumentOperationStatus::Failed
            }
        };
        Ok(Some(status))
    }

    pub fn cancel(&self, operation_id: &str, reason: &str) -> Result<()> {
        let operation = self
            .db
            .get_document_operation(operation_id)?
            .ok_or_else(|| anyhow::anyhow!("document operation not found: {operation_id}"))?;
        if operation.status == DocumentOperationStatus::Cancelled {
            return Ok(());
        }
        if matches!(
            operation.status,
            DocumentOperationStatus::Committed
                | DocumentOperationStatus::Failed
                | DocumentOperationStatus::Ambiguous
        ) {
            bail!("document operation cannot be cancelled from its current state");
        }
        let attempt = self
            .db
            .get_document_operation_attempt(operation_id, operation.current_attempt)?
            .ok_or_else(|| anyhow::anyhow!("document operation attempt not found"))?;

        if operation.status == DocumentOperationStatus::Queued
            && attempt.state.dispatch_receipt.is_none()
        {
            let mut ambiguous = attempt.state;
            ambiguous.status = DocumentOperationStatus::Ambiguous;
            ambiguous.detail = Some(
                "cancellation requested after dispatch intent but before a durable receipt"
                    .to_string(),
            );
            ambiguous.updated_at = now_iso();
            return self.db.transition_document_operation(
                &ambiguous,
                "cancellation_outcome_ambiguous",
                r#"{"requires_reconciliation":true}"#,
            );
        }

        if let Some(receipt) = &attempt.state.dispatch_receipt {
            self.executor.cancel(&receipt.run_id, reason)?;
        }
        let mut cancelled = attempt.state;
        cancelled.status = DocumentOperationStatus::Cancelled;
        cancelled.detail = (!reason.trim().is_empty()).then(|| reason.trim().to_string());
        cancelled.updated_at = now_iso();
        self.db
            .transition_document_operation(&cancelled, "cancelled", r#"{"cancelled":true}"#)
    }

    pub fn reconcile_unreceipted(&self) -> Result<Vec<ReconciledDocumentOperation>> {
        let states = self.db.list_unreceipted_document_operation_attempts()?;
        let mut reconciled = Vec::new();
        for state in states {
            let observation = self.executor.inspect(&state.dispatch_id)?;
            let operation_id = state.operation_id.clone();
            let status = match observation {
                ExecutorObservation::NotFound => {
                    let mut next = state;
                    next.status = DocumentOperationStatus::Ambiguous;
                    next.detail =
                        Some("executor has no receipt for a durable dispatch intent".to_string());
                    next.updated_at = now_iso();
                    self.db.transition_document_operation(
                        &next,
                        "dispatch_outcome_ambiguous",
                        r#"{"requires_confirmation":true}"#,
                    )?;
                    DocumentOperationStatus::Ambiguous
                }
                ExecutorObservation::Accepted(receipt) => {
                    let mut next = state;
                    next.status = DocumentOperationStatus::Running;
                    next.dispatch_receipt = Some(receipt);
                    next.updated_at = now_iso();
                    self.db.transition_document_operation(
                        &next,
                        "dispatch_receipt_recovered",
                        r#"{"recovered":true}"#,
                    )?;
                    DocumentOperationStatus::Running
                }
                ExecutorObservation::Completed {
                    receipt,
                    terminal_at,
                    candidate_pdf_sha256,
                } => {
                    let mut running = state;
                    running.status = DocumentOperationStatus::Running;
                    running.dispatch_receipt = Some(receipt);
                    running.updated_at = now_iso();
                    self.db.transition_document_operation(
                        &running,
                        "dispatch_receipt_recovered",
                        r#"{"recovered":true}"#,
                    )?;
                    let mut validating = running;
                    validating.status = DocumentOperationStatus::Validating;
                    validating.terminal_receipt_at = Some(terminal_at);
                    validating.candidate_pdf_sha256 = Some(candidate_pdf_sha256);
                    validating.updated_at = now_iso();
                    self.db.transition_document_operation(
                        &validating,
                        "terminal_receipt_recovered",
                        r#"{"recovered":true,"validation_required":true}"#,
                    )?;
                    DocumentOperationStatus::Validating
                }
                ExecutorObservation::Cancelled {
                    receipt,
                    terminal_at,
                } => {
                    let mut running = state;
                    running.status = DocumentOperationStatus::Running;
                    running.dispatch_receipt = Some(receipt);
                    running.updated_at = now_iso();
                    self.db.transition_document_operation(
                        &running,
                        "dispatch_receipt_recovered",
                        r#"{"recovered":true}"#,
                    )?;
                    let mut cancelled = running;
                    cancelled.status = DocumentOperationStatus::Cancelled;
                    cancelled.terminal_receipt_at = Some(terminal_at);
                    cancelled.updated_at = now_iso();
                    self.db.transition_document_operation(
                        &cancelled,
                        "cancellation_recovered",
                        r#"{"recovered":true}"#,
                    )?;
                    DocumentOperationStatus::Cancelled
                }
                ExecutorObservation::Failed {
                    receipt,
                    terminal_at,
                    error_code,
                    detail,
                } => {
                    let mut running = state;
                    running.status = DocumentOperationStatus::Running;
                    running.dispatch_receipt = Some(receipt);
                    running.updated_at = now_iso();
                    self.db.transition_document_operation(
                        &running,
                        "dispatch_receipt_recovered",
                        r#"{"recovered":true}"#,
                    )?;
                    let mut failed = running;
                    failed.status = DocumentOperationStatus::Failed;
                    failed.terminal_receipt_at = Some(terminal_at);
                    failed.error_code = Some(error_code);
                    failed.detail = Some(detail);
                    failed.updated_at = now_iso();
                    self.db.transition_document_operation(
                        &failed,
                        "executor_failure_recovered",
                        r#"{"recovered":true}"#,
                    )?;
                    DocumentOperationStatus::Failed
                }
            };
            reconciled.push(ReconciledDocumentOperation {
                operation_id,
                status,
            });
        }
        Ok(reconciled)
    }
}
