use std::path::Path;

use crate::job_failure::classify_job_failure;
use crate::models::{
    redact_json_value, redact_optional_text, redact_text, sensitive_values, JobEventRecord,
    JobFailureInfo, JobSnapshot,
};

use super::contracts::build_job_contracts_view;

pub fn redacted_error(job: &JobSnapshot) -> Option<String> {
    let secrets = sensitive_values(&job.request_payload);
    redact_optional_text(job.error.as_deref(), &secrets)
}

pub fn redacted_log_tail(job: &JobSnapshot) -> Vec<String> {
    let secrets = sensitive_values(&job.request_payload);
    job.log_tail
        .iter()
        .map(|line| redact_text(line, &secrets))
        .collect()
}

pub fn redact_job_events(
    job: &JobSnapshot,
    data_root: &Path,
    items: Vec<JobEventRecord>,
) -> Vec<JobEventRecord> {
    let secrets = sensitive_values(&job.request_payload);
    let resolved_failure = job
        .failure
        .clone()
        .map(JobFailureInfo::with_formal_fields)
        .or_else(|| classify_job_failure(job).map(JobFailureInfo::with_formal_fields));
    items
        .into_iter()
        .map(|mut item| {
            normalize_failure_event(&mut item, resolved_failure.as_ref());
            attach_contracts_to_failure_event(job, data_root, &mut item);
            item.message = redact_text(&item.message, &secrets);
            item.stage_detail = item
                .stage_detail
                .as_deref()
                .map(|value| redact_text(value, &secrets));
            item.payload = item
                .payload
                .as_ref()
                .map(|payload| redact_json_value(payload, &secrets));
            item
        })
        .collect()
}

fn attach_contracts_to_failure_event(
    job: &JobSnapshot,
    data_root: &Path,
    item: &mut JobEventRecord,
) {
    if !should_attach_contracts(item) {
        return;
    }
    let contracts = build_job_contracts_view(job, data_root);
    let Ok(contracts_value) = serde_json::to_value(contracts) else {
        return;
    };
    let mut payload = item
        .payload
        .take()
        .unwrap_or_else(|| serde_json::Value::Object(Default::default()));
    if let Some(object) = payload.as_object_mut() {
        object
            .entry("contracts".to_string())
            .or_insert(contracts_value);
        item.payload = Some(payload);
    } else {
        item.payload = Some(serde_json::json!({
            "value": payload,
            "contracts": contracts_value,
        }));
    }
}

fn should_attach_contracts(item: &JobEventRecord) -> bool {
    let event = item.event.as_str();
    let event_type = item.event_type.as_deref();
    let is_failure_event =
        matches!(event, "failure_classified") || matches!(event_type, Some("failure_classified"));
    let is_failed_terminal = (matches!(event, "job_terminal")
        || matches!(event_type, Some("job_terminal")))
        && item
            .payload
            .as_ref()
            .and_then(|payload| payload.get("status"))
            .and_then(|status| status.as_str())
            .is_some_and(|status| status == "failed");
    is_failure_event || is_failed_terminal
}

fn normalize_failure_event(item: &mut JobEventRecord, resolved_failure: Option<&JobFailureInfo>) {
    let is_failure_event = matches!(item.event.as_str(), "failure_classified" | "job_terminal")
        || matches!(
            item.event_type.as_deref(),
            Some("failure_classified" | "job_terminal")
        );
    if !is_failure_event {
        return;
    }

    let payload_failure = item
        .payload
        .as_ref()
        .and_then(JobFailureInfo::from_json_value)
        .map(|failure| match resolved_failure {
            Some(fallback) => failure.merge_missing_from(fallback),
            None => failure,
        });
    let failure = payload_failure.or_else(|| resolved_failure.cloned());
    let Some(failure) = failure else {
        return;
    };

    item.stage = Some(failure.failed_stage_value().to_string());
    item.provider = failure
        .provider
        .clone()
        .or_else(|| take_non_empty(item.provider.take()));
    item.provider_stage = failure
        .provider_stage
        .clone()
        .or_else(|| take_non_empty(item.provider_stage.take()));
    if item
        .stage_detail
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        item.stage_detail = Some(failure.summary.clone());
    }
    if item.message.trim().is_empty() {
        item.message = failure.summary.clone();
    }
    item.payload = Some(failure.write_formal_fields_into_payload(item.payload.as_ref()));
}

fn take_non_empty(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        if item.trim().is_empty() {
            None
        } else {
            Some(item)
        }
    })
}
