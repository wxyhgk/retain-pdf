use std::path::Path;

use anyhow::{Context, Result};
use retain_data::credentials::resolve_credential;

use crate::models::domain::JobRuntimeState;

pub(super) const OCR_PROVIDER_CREDENTIAL_KIND: &str = "ocr_provider_token";

/// Resolve an OCR credential reference at the last responsible moment.
///
/// Persisted jobs intentionally contain only the opaque reference. The caller
/// must keep the returned secret in memory and must not copy it back into the
/// job snapshot, stage spec, events, or logs.
pub(super) fn resolve_ocr_provider_token(
    data_root: &Path,
    job: &JobRuntimeState,
) -> Result<Option<String>> {
    let credential_ref = job.request_payload.ocr.credential_ref.trim();
    if credential_ref.is_empty() {
        return Ok(None);
    }
    let expected_provider = job.request_payload.ocr.provider.trim().to_ascii_lowercase();
    let resolved = resolve_credential(data_root, credential_ref, OCR_PROVIDER_CREDENTIAL_KIND)
        .with_context(|| format!("resolve OCR credential_ref {credential_ref}"))?;
    if resolved.provider.trim().to_ascii_lowercase() != expected_provider {
        anyhow::bail!(
            "OCR credential provider mismatch for credential_ref {credential_ref}: expected {expected_provider}"
        );
    }
    Ok(Some(resolved.secret))
}
