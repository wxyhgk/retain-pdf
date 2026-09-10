use std::collections::BTreeSet;
use std::path::Path;

use crate::db::Db;
use crate::models::domain::JobSnapshot;
use crate::services::credentials::delete_unreferenced_managed_credential;

/// Best-effort cleanup for credentials that were created solely to migrate
/// legacy inline job secrets. Call this only after every relevant job row has
/// been deleted so the database remains the authority for replay references.
pub(crate) fn cleanup_deleted_job_credentials(
    db: &Db,
    data_root: &Path,
    deleted_jobs: &[JobSnapshot],
) {
    let mut credential_refs = BTreeSet::new();
    for job in deleted_jobs {
        let translation_ref = job.request_payload.translation.credential_ref.trim();
        if !translation_ref.is_empty() {
            credential_refs.insert(translation_ref.to_string());
        }
        let ocr_ref = job.request_payload.ocr.credential_ref.trim();
        if !ocr_ref.is_empty() {
            credential_refs.insert(ocr_ref.to_string());
        }
    }

    for credential_ref in credential_refs {
        if let Err(error) = delete_unreferenced_managed_credential(db, data_root, &credential_ref) {
            // Job deletion is already durable. Credential cleanup is safe to
            // retry later and must not turn a successful deletion into a 500.
            eprintln!("[credentials] managed credential cleanup failed: {error}");
        }
    }
}
