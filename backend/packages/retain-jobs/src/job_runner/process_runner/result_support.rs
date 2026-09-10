use std::path::Path;
use std::process::ExitStatus;
use std::time::Instant;

use crate::models::api::{redact_text, sensitive_values};
use crate::models::domain::{now_iso, JobRuntimeState, ProcessResult};

pub(super) fn attach_process_result(
    job: &mut JobRuntimeState,
    status: &ExitStatus,
    started: Instant,
    stdout_text: String,
    stderr_text: &str,
    project_root: &Path,
) {
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    job.pid = None;
    // Mirror the redaction applied to log_tail at presentation time (see
    // services::jobs::presentation::security::redacted_log_tail): raw stdout
    // and stderr from the worker process can contain credentials sourced
    // from the job's translation/OCR options, so scrub them before they are
    // persisted into result_json.
    let secrets = sensitive_values(&job.request_payload);
    job.result = Some(ProcessResult {
        success: status.success(),
        return_code: status.code().unwrap_or(-1),
        duration_seconds: started.elapsed().as_secs_f64(),
        command: job.command.clone(),
        cwd: project_root.to_string_lossy().to_string(),
        stdout: redact_text(&stdout_text, &secrets),
        stderr: redact_text(stderr_text, &secrets),
    });
}
