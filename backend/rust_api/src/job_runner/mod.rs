use crate::models::{JobRuntimeState, JobSnapshot};

mod commands;
mod lifecycle;
mod ocr_flow;
mod process_runner;
mod render_flow;
mod runtime_state;
mod stdout_parser;
mod translation_flow;

pub(crate) use commands::{
    build_command, build_normalize_ocr_command, build_ocr_command, build_render_only_command,
};
pub use lifecycle::{clear_cancel_request, is_cancel_requested, request_cancel, spawn_job};
pub(crate) use process_runner::execute_process_job;
pub use process_runner::terminate_job_process_tree;
pub(crate) use runtime_state::{
    attach_job_paths, attach_job_provider_failure, clear_canceled_runtime_artifacts,
    clear_job_failure, job_artifacts_mut, ocr_provider_diagnostics_mut, refresh_job_failure,
    register_job_retry, sync_runtime_state,
};

const QUEUE_POLL_INTERVAL_MS: u64 = 250;
const MINERU_RESULT_FILE_NAME: &str = "mineru_result.json";
const MINERU_BUNDLE_FILE_NAME: &str = "mineru_bundle.zip";
const MINERU_UNPACK_DIR_NAME: &str = "unpacked";
const MINERU_LAYOUT_JSON_FILE_NAME: &str = "layout.json";

pub(crate) fn format_error_chain(err: &anyhow::Error) -> String {
    let causes: Vec<String> = err
        .chain()
        .map(|cause| cause.to_string().trim().to_string())
        .filter(|cause| !cause.is_empty())
        .collect();
    if causes.is_empty() {
        return "unknown error".to_string();
    }
    if causes.len() == 1 {
        return causes[0].clone();
    }
    let mut message = causes[0].clone();
    message.push_str("\nCaused by:");
    for cause in causes.iter().skip(1) {
        message.push_str("\n- ");
        message.push_str(cause);
    }
    message
}

pub(crate) trait LogAppend {
    fn push_job_log(&mut self, line: &str);
}

impl LogAppend for JobSnapshot {
    fn push_job_log(&mut self, line: &str) {
        self.append_log(line);
    }
}

impl LogAppend for JobRuntimeState {
    fn push_job_log(&mut self, line: &str) {
        self.append_log(line);
    }
}

fn append_error_chain_log<T: LogAppend>(job: &mut T, err: &anyhow::Error) {
    for (idx, cause) in err.chain().enumerate() {
        let text = cause.to_string().trim().to_string();
        if text.is_empty() {
            continue;
        }
        if idx == 0 {
            job.push_job_log(&format!("ERROR: {text}"));
        } else {
            job.push_job_log(&format!("CAUSE[{idx}]: {text}"));
        }
    }
}
