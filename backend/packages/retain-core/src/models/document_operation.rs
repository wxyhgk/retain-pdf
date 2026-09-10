use serde::{Deserialize, Serialize};

pub const DOCUMENT_OPERATION_MANIFEST_SCHEMA: &str = "document_operation_manifest_v1";
pub const DOCUMENT_OPERATION_STATE_SCHEMA: &str = "document_operation_state_v1";
pub const DOCUMENT_OPERATION_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DocumentOperationStatus {
    Draft,
    AwaitingConfirmation,
    Queued,
    Running,
    Validating,
    ResultReady,
    Committed,
    Failed,
    Cancelled,
    Ambiguous,
}

impl DocumentOperationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::AwaitingConfirmation => "awaiting_confirmation",
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Validating => "validating",
            Self::ResultReady => "result_ready",
            Self::Committed => "committed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
            Self::Ambiguous => "ambiguous",
        }
    }

    pub fn can_transition_to(&self, next: &Self) -> bool {
        use DocumentOperationStatus::*;
        matches!(
            (self, next),
            (Draft, AwaitingConfirmation | Cancelled)
                | (AwaitingConfirmation, Queued | Cancelled)
                | (Queued, Running | Failed | Cancelled | Ambiguous)
                | (Running, Validating | Failed | Cancelled | Ambiguous)
                | (Validating, ResultReady | Failed | Cancelled)
                | (ResultReady, Committed | Cancelled)
        )
    }

    pub fn is_terminal_attempt_state(&self) -> bool {
        matches!(
            self,
            Self::Committed | Self::Failed | Self::Cancelled | Self::Ambiguous
        )
    }
}

impl std::str::FromStr for DocumentOperationStatus {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "draft" => Ok(Self::Draft),
            "awaiting_confirmation" => Ok(Self::AwaitingConfirmation),
            "queued" => Ok(Self::Queued),
            "running" => Ok(Self::Running),
            "validating" => Ok(Self::Validating),
            "result_ready" => Ok(Self::ResultReady),
            "committed" => Ok(Self::Committed),
            "failed" => Ok(Self::Failed),
            "cancelled" => Ok(Self::Cancelled),
            "ambiguous" => Ok(Self::Ambiguous),
            _ => Err(format!("unsupported document operation status: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DocumentOperationLimits {
    pub wall_time_seconds: u64,
    pub cpu_time_seconds: u64,
    pub memory_bytes: u64,
    pub scratch_bytes: u64,
    pub output_bytes: u64,
    pub process_count: u32,
    pub file_descriptor_count: u32,
    pub file_count: u32,
    pub stdout_bytes: u64,
    pub stderr_bytes: u64,
}

impl DocumentOperationLimits {
    pub fn validate(&self) -> Result<(), String> {
        if self.wall_time_seconds == 0 {
            return Err("wall_time_seconds must be positive".to_string());
        }
        if self.cpu_time_seconds == 0 {
            return Err("cpu_time_seconds must be positive".to_string());
        }
        if self.memory_bytes == 0 {
            return Err("memory_bytes must be positive".to_string());
        }
        if self.scratch_bytes == 0 {
            return Err("scratch_bytes must be positive".to_string());
        }
        if self.output_bytes == 0 {
            return Err("output_bytes must be positive".to_string());
        }
        if self.process_count == 0 {
            return Err("process_count must be positive".to_string());
        }
        if self.file_descriptor_count == 0 {
            return Err("file_descriptor_count must be positive".to_string());
        }
        if self.file_count == 0 {
            return Err("file_count must be positive".to_string());
        }
        if self.stdout_bytes == 0 || self.stderr_bytes == 0 {
            return Err("stdout_bytes and stderr_bytes must be positive".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DocumentOperationWorkspaceManifest {
    pub schema: String,
    pub schema_version: u32,
    pub operation_id: String,
    pub attempt: u32,
    pub dispatch_id: String,
    pub document_id: String,
    pub base_job_id: String,
    pub conversation_id: String,
    pub request_message_id: String,
    pub intent_summary: String,
    pub source_pdf_sha256: String,
    pub normalized_document_sha256: Option<String>,
    pub program_sha256: String,
    pub executor_profile: String,
    pub limits: DocumentOperationLimits,
    pub created_at: String,
}

impl DocumentOperationWorkspaceManifest {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != DOCUMENT_OPERATION_MANIFEST_SCHEMA
            || self.schema_version != DOCUMENT_OPERATION_SCHEMA_VERSION
        {
            return Err("unsupported document operation manifest contract".to_string());
        }
        validate_operation_id(&self.operation_id)?;
        if self.attempt == 0 {
            return Err("attempt must start at 1".to_string());
        }
        validate_operation_id(&self.dispatch_id)
            .map_err(|_| "dispatch_id is not a safe identifier".to_string())?;
        for (name, value) in [
            ("document_id", self.document_id.as_str()),
            ("base_job_id", self.base_job_id.as_str()),
            ("intent_summary", self.intent_summary.as_str()),
            ("executor_profile", self.executor_profile.as_str()),
            ("created_at", self.created_at.as_str()),
        ] {
            if value.trim().is_empty() {
                return Err(format!("{name} must not be empty"));
            }
        }
        validate_sha256("source_pdf_sha256", &self.source_pdf_sha256)?;
        if let Some(value) = &self.normalized_document_sha256 {
            validate_sha256("normalized_document_sha256", value)?;
        }
        validate_sha256("program_sha256", &self.program_sha256)?;
        self.limits.validate()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DocumentOperationDispatchReceipt {
    pub dispatch_id: String,
    pub run_id: String,
    pub executor_profile_digest: String,
    pub accepted_at: String,
}

impl DocumentOperationDispatchReceipt {
    pub fn validate_for(
        &self,
        manifest: &DocumentOperationWorkspaceManifest,
    ) -> Result<(), String> {
        if self.dispatch_id != manifest.dispatch_id {
            return Err("receipt dispatch_id does not match workspace manifest".to_string());
        }
        validate_operation_id(&self.run_id)
            .map_err(|_| "receipt run_id is not a safe identifier".to_string())?;
        validate_sha256("executor_profile_digest", &self.executor_profile_digest)?;
        if self.accepted_at.trim().is_empty() {
            return Err("receipt accepted_at must not be empty".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DocumentOperationWorkspaceState {
    pub schema: String,
    pub schema_version: u32,
    pub operation_id: String,
    pub attempt: u32,
    pub dispatch_id: String,
    pub program_sha256: String,
    pub status: DocumentOperationStatus,
    pub dispatch_intent_at: Option<String>,
    pub dispatch_receipt: Option<DocumentOperationDispatchReceipt>,
    pub terminal_receipt_at: Option<String>,
    pub candidate_pdf_sha256: Option<String>,
    pub error_code: Option<String>,
    pub detail: Option<String>,
    pub updated_at: String,
}

impl DocumentOperationWorkspaceState {
    pub fn validate_for(
        &self,
        manifest: &DocumentOperationWorkspaceManifest,
    ) -> Result<(), String> {
        if self.schema != DOCUMENT_OPERATION_STATE_SCHEMA
            || self.schema_version != DOCUMENT_OPERATION_SCHEMA_VERSION
        {
            return Err("unsupported document operation state contract".to_string());
        }
        if self.operation_id != manifest.operation_id
            || self.attempt != manifest.attempt
            || self.dispatch_id != manifest.dispatch_id
            || self.program_sha256 != manifest.program_sha256
        {
            return Err("state identity does not match workspace manifest".to_string());
        }
        if self.updated_at.trim().is_empty() {
            return Err("updated_at must not be empty".to_string());
        }
        if let Some(receipt) = &self.dispatch_receipt {
            receipt.validate_for(manifest)?;
        }
        if matches!(
            self.status,
            DocumentOperationStatus::Queued
                | DocumentOperationStatus::Running
                | DocumentOperationStatus::Validating
                | DocumentOperationStatus::ResultReady
                | DocumentOperationStatus::Committed
                | DocumentOperationStatus::Ambiguous
        ) && self.dispatch_intent_at.is_none()
        {
            return Err("dispatched state requires dispatch_intent_at".to_string());
        }
        if matches!(
            self.status,
            DocumentOperationStatus::Running
                | DocumentOperationStatus::Validating
                | DocumentOperationStatus::ResultReady
                | DocumentOperationStatus::Committed
        ) && self.dispatch_receipt.is_none()
        {
            return Err("running or result state requires dispatch_receipt".to_string());
        }
        if matches!(
            self.status,
            DocumentOperationStatus::ResultReady | DocumentOperationStatus::Committed
        ) {
            let candidate = self
                .candidate_pdf_sha256
                .as_deref()
                .ok_or_else(|| "result state requires candidate_pdf_sha256".to_string())?;
            validate_sha256("candidate_pdf_sha256", candidate)?;
        } else if let Some(candidate) = &self.candidate_pdf_sha256 {
            validate_sha256("candidate_pdf_sha256", candidate)?;
        }
        Ok(())
    }
}

pub fn validate_operation_id(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 128 || value.contains("..") {
        return Err("operation_id is not a safe workspace identifier".to_string());
    }
    let mut chars = value.chars();
    if !chars.next().is_some_and(|ch| ch.is_ascii_alphanumeric())
        || !chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        return Err("operation_id is not a safe workspace identifier".to_string());
    }
    Ok(())
}

fn validate_sha256(name: &str, value: &str) -> Result<(), String> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(format!("{name} must be a SHA-256 hex digest"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn digest(character: char) -> String {
        std::iter::repeat_n(character, 64).collect()
    }

    fn manifest() -> DocumentOperationWorkspaceManifest {
        DocumentOperationWorkspaceManifest {
            schema: DOCUMENT_OPERATION_MANIFEST_SCHEMA.to_string(),
            schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
            operation_id: "op-20260823-abc123".to_string(),
            attempt: 1,
            dispatch_id: "dispatch-abc123".to_string(),
            document_id: "document-a".to_string(),
            base_job_id: "job-a".to_string(),
            conversation_id: "conversation-a".to_string(),
            request_message_id: "message-a".to_string(),
            intent_summary: "Create a candidate PDF".to_string(),
            source_pdf_sha256: digest('a'),
            normalized_document_sha256: Some(digest('b')),
            program_sha256: digest('c'),
            executor_profile: "deterministic_test_v1".to_string(),
            limits: DocumentOperationLimits {
                wall_time_seconds: 60,
                cpu_time_seconds: 45,
                memory_bytes: 512 * 1024 * 1024,
                scratch_bytes: 256 * 1024 * 1024,
                output_bytes: 128 * 1024 * 1024,
                process_count: 1,
                file_descriptor_count: 32,
                file_count: 16,
                stdout_bytes: 1024 * 1024,
                stderr_bytes: 1024 * 1024,
            },
            created_at: "2026-08-23T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn manifest_and_state_keep_attempt_identity_locked() {
        let manifest = manifest();
        manifest.validate().expect("valid manifest");
        let state = DocumentOperationWorkspaceState {
            schema: DOCUMENT_OPERATION_STATE_SCHEMA.to_string(),
            schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
            operation_id: manifest.operation_id.clone(),
            attempt: manifest.attempt,
            dispatch_id: manifest.dispatch_id.clone(),
            program_sha256: manifest.program_sha256.clone(),
            status: DocumentOperationStatus::ResultReady,
            dispatch_intent_at: Some("2026-08-23T00:00:30Z".to_string()),
            dispatch_receipt: Some(DocumentOperationDispatchReceipt {
                dispatch_id: manifest.dispatch_id.clone(),
                run_id: "test-run-1".to_string(),
                executor_profile_digest: digest('e'),
                accepted_at: "2026-08-23T00:00:31Z".to_string(),
            }),
            terminal_receipt_at: Some("2026-08-23T00:00:59Z".to_string()),
            candidate_pdf_sha256: Some(digest('d')),
            error_code: None,
            detail: None,
            updated_at: "2026-08-23T00:01:00Z".to_string(),
        };
        state.validate_for(&manifest).expect("valid state");

        let mut mismatched = state;
        mismatched.attempt = 2;
        assert!(mismatched.validate_for(&manifest).is_err());
    }

    #[test]
    fn result_ready_requires_candidate_identity() {
        let manifest = manifest();
        let state = DocumentOperationWorkspaceState {
            schema: DOCUMENT_OPERATION_STATE_SCHEMA.to_string(),
            schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
            operation_id: manifest.operation_id.clone(),
            attempt: manifest.attempt,
            dispatch_id: manifest.dispatch_id.clone(),
            program_sha256: manifest.program_sha256.clone(),
            status: DocumentOperationStatus::ResultReady,
            dispatch_intent_at: Some("2026-08-23T00:00:30Z".to_string()),
            dispatch_receipt: Some(DocumentOperationDispatchReceipt {
                dispatch_id: manifest.dispatch_id.clone(),
                run_id: "test-run-1".to_string(),
                executor_profile_digest: digest('e'),
                accepted_at: "2026-08-23T00:00:31Z".to_string(),
            }),
            terminal_receipt_at: Some("2026-08-23T00:00:59Z".to_string()),
            candidate_pdf_sha256: None,
            error_code: None,
            detail: None,
            updated_at: "2026-08-23T00:01:00Z".to_string(),
        };
        assert!(state.validate_for(&manifest).is_err());
    }

    #[test]
    fn workspace_identifier_rejects_path_traversal() {
        for value in [
            "../job",
            "operation/child",
            ".hidden",
            "",
            "operation\\child",
        ] {
            assert!(validate_operation_id(value).is_err(), "accepted {value:?}");
        }
        assert!(validate_operation_id("op-20260823_a.1").is_ok());
    }

    #[test]
    fn status_machine_does_not_skip_confirmation_or_validation() {
        use DocumentOperationStatus::*;

        assert!(Draft.can_transition_to(&AwaitingConfirmation));
        assert!(!Draft.can_transition_to(&Running));
        assert!(AwaitingConfirmation.can_transition_to(&Queued));
        assert!(Running.can_transition_to(&Validating));
        assert!(!Running.can_transition_to(&ResultReady));
        assert!(Validating.can_transition_to(&ResultReady));
        assert!(ResultReady.can_transition_to(&Committed));
        assert!(!Committed.can_transition_to(&Running));
        assert!(Ambiguous.is_terminal_attempt_state());
    }

    #[test]
    fn serde_contract_uses_snake_case_statuses() {
        assert_eq!(
            serde_json::to_string(&DocumentOperationStatus::AwaitingConfirmation)
                .expect("serialize status"),
            "\"awaiting_confirmation\""
        );
        let encoded = serde_json::to_vec(&manifest()).expect("serialize manifest");
        let decoded: DocumentOperationWorkspaceManifest =
            serde_json::from_slice(&encoded).expect("deserialize manifest");
        decoded.validate().expect("round-trip manifest");
    }
}
