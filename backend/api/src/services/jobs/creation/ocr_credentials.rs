use retain_data::credentials::resolve_credential;

use crate::error::AppError;
use crate::models::domain::{JobSnapshot, WorkflowKind};
use crate::ocr_provider::{
    is_configured_command_provider, parse_provider_kind, provider_token, OcrProviderKind,
};
use crate::services::credentials::{
    acquire_credential_usage_lock, get_or_create_managed_credential, CredentialUsageLock,
};
use crate::services::job_validation::map_credential_reference_error;

use crate::services::jobs::deps::JobSubmitDeps;

const OCR_CREDENTIAL_KIND: &str = "ocr_provider_token";
const TRANSLATION_CREDENTIAL_KIND: &str = "translation_api_key";
const LEGACY_OCR_CREDENTIAL_LABEL: &str = "Imported legacy OCR credential";
const LEGACY_TRANSLATION_CREDENTIAL_LABEL: &str = "Imported legacy translation credential";
const CONFIGURED_PROVIDER_SECRET_KEYS: [&str; 3] = ["credential", "token", "api_key"];

/// Converts legacy inline provider secrets into vault references before the
/// job is persisted. Credentials for stages that the job will not execute are
/// discarded. Callers acquire the combined usage guard immediately afterwards
/// and keep it alive through persistence.
pub(super) fn secure_job_credentials(
    deps: &JobSubmitDeps<'_>,
    mut job: JobSnapshot,
) -> Result<JobSnapshot, AppError> {
    secure_translation_job_credential(deps, &mut job)?;
    secure_ocr_job_credential(deps, &mut job)?;
    Ok(job)
}

fn secure_translation_job_credential(
    deps: &JobSubmitDeps<'_>,
    job: &mut JobSnapshot,
) -> Result<(), AppError> {
    if !job_runs_translation(job) {
        clear_translation_secret_sources(job);
        return Ok(());
    }

    let api_key = job.request_payload.translation.api_key.trim().to_string();
    let credential_ref = job
        .request_payload
        .translation
        .credential_ref
        .trim()
        .to_string();
    if !api_key.is_empty() && !credential_ref.is_empty() {
        return Err(AppError::bad_request(
            "translation.api_key and translation.credential_ref are mutually exclusive",
        ));
    }
    if !api_key.is_empty() {
        let created = get_or_create_managed_credential(
            deps.snapshot.config.data_root,
            TRANSLATION_CREDENTIAL_KIND,
            "openai_compatible",
            LEGACY_TRANSLATION_CREDENTIAL_LABEL,
            &api_key,
        )?;
        job.request_payload.translation.credential_ref = created.credential.credential_ref;
    } else {
        job.request_payload.translation.credential_ref = credential_ref;
    }
    job.request_payload.translation.api_key.clear();
    Ok(())
}

fn secure_ocr_job_credential(
    deps: &JobSubmitDeps<'_>,
    job: &mut JobSnapshot,
) -> Result<(), AppError> {
    if !job_runs_ocr(&job) {
        clear_inline_ocr_secrets(job);
        job.request_payload.ocr.credential_ref.clear();
        return Ok(());
    }

    let provider = job.request_payload.ocr.provider.trim().to_ascii_lowercase();
    let credential_ref = job.request_payload.ocr.credential_ref.trim().to_string();
    if credential_ref.is_empty() {
        if let Some(secret) = inline_ocr_secret(job) {
            let created = get_or_create_managed_credential(
                deps.snapshot.config.data_root,
                OCR_CREDENTIAL_KIND,
                &provider,
                LEGACY_OCR_CREDENTIAL_LABEL,
                &secret,
            )?;
            job.request_payload.ocr.credential_ref = created.credential.credential_ref;
        }
    }
    clear_inline_ocr_secrets(job);

    Ok(())
}

/// Fences every opaque job credential from the last existence check through
/// database persistence. One shared guard is sufficient for both translation
/// and OCR references and avoids nested read/write locking when a legacy OCR
/// token has just been imported into the vault.
pub(super) fn acquire_job_credential_usage_lock(
    deps: &JobSubmitDeps<'_>,
    job: &JobSnapshot,
) -> Result<Option<CredentialUsageLock>, AppError> {
    let translation_ref = job.request_payload.translation.credential_ref.trim();
    let ocr_ref = job.request_payload.ocr.credential_ref.trim();
    if translation_ref.is_empty() && ocr_ref.is_empty() {
        return Ok(None);
    }
    let guard = acquire_credential_usage_lock(deps.snapshot.config.data_root)?;
    if !translation_ref.is_empty() {
        resolve_credential(
            deps.snapshot.config.data_root,
            translation_ref,
            TRANSLATION_CREDENTIAL_KIND,
        )
        .map_err(map_credential_reference_error)?;
    }
    if !ocr_ref.is_empty() {
        let resolved =
            resolve_credential(deps.snapshot.config.data_root, ocr_ref, OCR_CREDENTIAL_KIND)
                .map_err(map_credential_reference_error)?;
        let provider = job.request_payload.ocr.provider.trim();
        if !resolved.provider.trim().eq_ignore_ascii_case(provider) {
            return Err(AppError::credential_reference(
                axum::http::StatusCode::BAD_REQUEST,
                "CREDENTIAL_PROVIDER_MISMATCH",
                "OCR credential provider does not match requested provider",
            ));
        }
    }
    Ok(Some(guard))
}

fn job_runs_ocr(job: &JobSnapshot) -> bool {
    match job.request_payload.workflow {
        WorkflowKind::Ocr => true,
        WorkflowKind::Book | WorkflowKind::Translate => {
            job.request_payload.source.artifact_job_id.trim().is_empty()
        }
        WorkflowKind::Render => false,
    }
}

fn job_runs_translation(job: &JobSnapshot) -> bool {
    matches!(
        job.request_payload.workflow,
        WorkflowKind::Book | WorkflowKind::Translate
    )
}

fn clear_translation_secret_sources(job: &mut JobSnapshot) {
    job.request_payload.translation.api_key.clear();
    job.request_payload.translation.credential_ref.clear();
}

fn inline_ocr_secret(job: &JobSnapshot) -> Option<String> {
    let input = &job.request_payload.ocr;
    if is_configured_command_provider(&input.provider) {
        return CONFIGURED_PROVIDER_SECRET_KEYS.iter().find_map(|key| {
            input
                .options
                .get(*key)
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        });
    }
    let provider_kind = parse_provider_kind(&input.provider);
    if matches!(
        provider_kind,
        OcrProviderKind::Local | OcrProviderKind::Unknown
    ) {
        return None;
    }
    let token = provider_token(&provider_kind, input);
    (!token.is_empty()).then(|| token.to_string())
}

fn clear_inline_ocr_secrets(job: &mut JobSnapshot) {
    job.request_payload.ocr.mineru_token.clear();
    job.request_payload.ocr.paddle_token.clear();
    for key in CONFIGURED_PROVIDER_SECRET_KEYS {
        job.request_payload.ocr.options.remove(key);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inline_secret_detection_is_scoped_to_selected_provider() {
        let mut job = JobSnapshot::new(
            "job-inline-secret".to_string(),
            crate::models::request::CreateJobInput::default(),
            Vec::new(),
        );
        job.request_payload.workflow = WorkflowKind::Ocr;
        job.request_payload.ocr.provider = "paddle".to_string();
        job.request_payload.ocr.paddle_token = "paddle-secret".to_string();
        job.request_payload.ocr.mineru_token = "unrelated-secret".to_string();

        assert_eq!(inline_ocr_secret(&job).as_deref(), Some("paddle-secret"));
        clear_inline_ocr_secrets(&mut job);
        assert!(job.request_payload.ocr.paddle_token.is_empty());
        assert!(job.request_payload.ocr.mineru_token.is_empty());
    }

    #[test]
    fn artifact_reuse_does_not_retain_unused_ocr_credentials() {
        let mut job = JobSnapshot::new(
            "job-artifact-reuse".to_string(),
            crate::models::request::CreateJobInput::default(),
            Vec::new(),
        );
        job.request_payload.workflow = WorkflowKind::Translate;
        job.request_payload.source.artifact_job_id = "ocr-job".to_string();
        job.request_payload.ocr.credential_ref = "cred_unused".to_string();

        assert!(!job_runs_ocr(&job));
    }
}
