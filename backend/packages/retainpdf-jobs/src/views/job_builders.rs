#[cfg(test)]
use std::path::Path;

use retainpdf_core::models::WorkflowKind;
#[cfg(test)]
use retainpdf_core::models::{JobSnapshot, JobStatusKind};

use super::super::common::JobLinksView;
#[cfg(test)]
use retainpdf_files::{build_artifact_links, build_job_actions};
#[cfg(test)]
use super::super::common::{
    JobProgressView, JobStageRuntimeView, JobStageStateView, JobStagesView, JobTimestampsView,
};
#[cfg(test)]
use super::super::test_support::{
    build_ocr_job_summary, job_failure_to_legacy_view, load_glossary_summary,
    load_invocation_summary, load_normalization_summary,
};
use retainpdf_files::job_files_list_path;
use super::super::to_absolute_url;
use super::types::*;
#[cfg(test)]
use retainpdf_core::job_failure::classify_job_failure;
#[cfg(test)]
use retainpdf_core::models::public_request_payload;
#[cfg(test)]
use retainpdf_core::models::JobFailureInfo;

pub fn build_job_links(job_id: &str, base_url: &str) -> JobLinksView {
    build_job_links_with_workflow(job_id, &WorkflowKind::Book, base_url)
}

fn job_path_prefix(workflow: &WorkflowKind) -> &'static str {
    workflow.job_api_prefix()
}

pub fn build_job_links_with_workflow(
    job_id: &str,
    workflow: &WorkflowKind,
    base_url: &str,
) -> JobLinksView {
    let prefix = job_path_prefix(workflow);
    let self_path = format!("{prefix}/{job_id}");
    // 产物列表、产物清单都换成文件清单 `/files`；两组旧字段名照旧返回，值相同。
    let artifacts_path = job_files_list_path(job_id);
    let artifacts_manifest_path = artifacts_path.clone();
    let events_path = format!("{prefix}/{job_id}/progress/events");
    let cancel_path = format!("{prefix}/{job_id}/actions/cancel");
    JobLinksView {
        self_path: self_path.clone(),
        self_url: to_absolute_url(base_url, &self_path),
        artifacts_path: artifacts_path.clone(),
        artifacts_url: to_absolute_url(base_url, &artifacts_path),
        artifacts_manifest_path: artifacts_manifest_path.clone(),
        artifacts_manifest_url: to_absolute_url(base_url, &artifacts_manifest_path),
        events_path: events_path.clone(),
        events_url: to_absolute_url(base_url, &events_path),
        cancel_path: cancel_path.clone(),
        cancel_url: to_absolute_url(base_url, &cancel_path),
    }
}

#[cfg(test)]
pub fn job_to_detail(
    job: &JobSnapshot,
    base_url: &str,
    data_root: &Path,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> JobDetailView {
    let duration_seconds = match (&job.started_at, &job.finished_at, &job.result) {
        (_, _, Some(result)) => Some(result.duration_seconds),
        _ => None,
    };
    let percent = match (job.progress_current, job.progress_total) {
        (Some(current), Some(total)) if total > 0 => Some((current as f64 / total as f64) * 100.0),
        _ => None,
    };
    let stage_snapshot = test_stage_snapshot(job, percent);
    let failure = job
        .failure
        .clone()
        .map(JobFailureInfo::with_formal_fields)
        .or_else(|| classify_job_failure(job).map(JobFailureInfo::with_formal_fields));
    JobDetailView {
        job_id: job.job_id.clone(),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        ocr_reused: !job.request_payload.source.artifact_job_id.trim().is_empty(),
        source_artifact_job_id: Some(
            job.request_payload
                .source
                .artifact_job_id
                .trim()
                .to_string(),
        )
        .filter(|value| !value.is_empty()),
        request_payload: public_request_payload(&job.request_payload),
        trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.trace_id.clone()),
        provider_trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.provider_trace_id.clone()),
        completion_note: test_completion_note(job),
        stage_snapshot: stage_snapshot.clone(),
        background_snapshots: Vec::new(),
        stages: test_stages(job, stage_snapshot.as_ref()),
        timestamps: JobTimestampsView {
            created_at: job.created_at.clone(),
            updated_at: job.updated_at.clone(),
            started_at: job.started_at.clone(),
            finished_at: job.finished_at.clone(),
            duration_seconds,
        },
        links: build_job_links_with_workflow(&job.job_id, &job.workflow, base_url),
        actions: build_job_actions(job, base_url, pdf_ready, markdown_ready, bundle_ready),
        artifacts: build_artifact_links(
            job,
            base_url,
            data_root,
            pdf_ready,
            markdown_ready,
            bundle_ready,
        ),
        artifacts_display: Vec::new(),
        book_summary: BookSummaryView {
            title: job.job_id.clone(),
            authors: None,
            page_count: None,
            source_language: Some(job.request_payload.ocr.language.clone())
                .filter(|value| !value.trim().is_empty()),
            target_language: None,
            source_file_name: None,
            cover_url: None,
            thumbnail_url: None,
            file_size_bytes: None,
            document_id: None,
        },
        contracts: JobContractsView {
            schema_version: "job_stage_contracts.v1".to_string(),
            stages: Vec::new(),
        },
        ocr_job: build_ocr_job_summary(job, base_url),
        ocr_provider_diagnostics: job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.ocr_provider_diagnostics.clone()),
        runtime: job.runtime.clone(),
        failure: failure.clone(),
        error: job.error.clone(),
        failure_diagnostic: failure.as_ref().map(job_failure_to_legacy_view),
        normalization_summary: load_normalization_summary(job, data_root),
        glossary_summary: load_glossary_summary(job, data_root),
        invocation: load_invocation_summary(job, data_root),
        translation_request_recovery: None,
        log_tail: job.log_tail.clone(),
    }
}

#[cfg(test)]
pub fn job_to_list_item(
    job: &JobSnapshot,
    base_url: &str,
    display_name: String,
    data_root: &Path,
) -> JobListItemView {
    let detail_path = format!("{}/{}", job_path_prefix(&job.workflow), job.job_id);
    let percent = match (job.progress_current, job.progress_total) {
        (Some(current), Some(total)) if total > 0 => Some((current as f64 / total as f64) * 100.0),
        _ => None,
    };
    let stage_snapshot = test_stage_snapshot(job, percent);
    JobListItemView {
        job_id: job.job_id.clone(),
        display_name,
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        attempt: job
            .runtime
            .as_ref()
            .map(|runtime| runtime.retry_count.saturating_add(1))
            .unwrap_or(1),
        retry_count: job
            .runtime
            .as_ref()
            .map(|runtime| runtime.retry_count)
            .unwrap_or(0),
        last_retry_at: job
            .runtime
            .as_ref()
            .and_then(|runtime| runtime.last_retry_at.clone()),
        trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.trace_id.clone()),
        completion_note: test_completion_note(job),
        stage_snapshot: stage_snapshot.clone(),
        background_snapshots: Vec::new(),
        stages: test_stages(job, stage_snapshot.as_ref()),
        page_count: job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.pages_processed),
        source_file_name: None,
        cover_url: None,
        thumbnail_url: None,
        output_pdf_ready: false,
        markdown_ready: false,
        bundle_ready: false,
        invocation: load_invocation_summary(job, data_root),
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
        detail_path: detail_path.clone(),
        detail_url: to_absolute_url(base_url, &detail_path),
            // 夹具：这里不构造失败。真实填充在 presentation/listing.rs 与 helpers.rs。
        failure: None,
        source_artifact_job_id: Some(job.request_payload.source.artifact_job_id.trim().to_string())
            .filter(|value| !value.is_empty()),
    }
}

/// `terminal_completion_note` 的测试镜像。
///
/// 生产实现在 backend/api 的 stage_view.rs，retainpdf-core 不依赖它，所以这里照抄
/// 语义：只有终态、且 stage_detail 不是无条件写入的「任务完成」时才算有额外信息。
/// 这两个构造器本来就是 cfg(test) 的镜像，写死 None 会让它悄悄偏离生产形状。
#[cfg(test)]
fn test_completion_note(job: &JobSnapshot) -> Option<String> {
    if !matches!(
        job.status,
        JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
    ) {
        return None;
    }
    let detail = job.stage_detail.as_deref()?.trim();
    if detail.is_empty() || detail == "任务完成" {
        return None;
    }
    Some(detail.to_string())
}

#[cfg(test)]
fn test_stage_snapshot(job: &JobSnapshot, percent: Option<f64>) -> Option<JobStageSnapshotView> {
    if matches!(
        job.status,
        JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
    ) {
        return None;
    }
    let display_stage =
        retainpdf_core::models::public_stage_for_raw_stage(job.stage.as_deref()).map(str::to_string)?;
    Some(JobStageSnapshotView {
        display_stage: Some(display_stage),
        stage: job.stage.clone(),
        substage: None,
        lane: Some("main".to_string()),
        stage_detail: job.stage_detail.clone(),
        progress: JobProgressView {
            current: job.progress_current,
            total: job.progress_total,
            percent,
            unit: None,
        },
        upstream_wait: None,
    })
}

#[cfg(test)]
fn test_stages(job: &JobSnapshot, stage_snapshot: Option<&JobStageSnapshotView>) -> JobStagesView {
    JobStagesView {
        ocr: test_stage_runtime("ocr", job, stage_snapshot),
        translation: test_stage_runtime("translation", job, stage_snapshot),
        render: test_stage_runtime("render", job, stage_snapshot),
    }
}

#[cfg(test)]
fn test_stage_runtime(
    stage_name: &str,
    job: &JobSnapshot,
    stage_snapshot: Option<&JobStageSnapshotView>,
) -> JobStageRuntimeView {
    let included = match job.workflow {
        WorkflowKind::Book => matches!(stage_name, "ocr" | "translation" | "render"),
        WorkflowKind::Translate => matches!(stage_name, "ocr" | "translation"),
        WorkflowKind::Render => stage_name == "render",
        WorkflowKind::Ocr => stage_name == "ocr",
    };
    if !included {
        return test_runtime(JobStageStateView::Skipped, None);
    }
    if stage_snapshot.and_then(|item| item.display_stage.as_deref()) == Some(stage_name) {
        return JobStageRuntimeView {
            state: JobStageStateView::InProgress,
            progress: stage_snapshot
                .map(|item| item.progress.clone())
                .unwrap_or_else(empty_progress),
        };
    }
    if matches!(job.status, JobStatusKind::Succeeded) {
        return test_runtime(JobStageStateView::Completed, None);
    }
    test_runtime(JobStageStateView::Pending, None)
}

#[cfg(test)]
fn test_runtime(state: JobStageStateView, unit: Option<String>) -> JobStageRuntimeView {
    JobStageRuntimeView {
        state,
        progress: JobProgressView {
            current: None,
            total: None,
            percent: None,
            unit,
        },
    }
}

#[cfg(test)]
fn empty_progress() -> JobProgressView {
    JobProgressView {
        current: None,
        total: None,
        percent: None,
        unit: None,
    }
}

pub fn summarize_list_invocation(items: &[JobListItemView]) -> JobListInvocationSummaryView {
    let stage_spec_count = items
        .iter()
        .filter(|item| {
            item.invocation
                .as_ref()
                .map(|value| value.input_protocol == "stage_spec")
                .unwrap_or(false)
        })
        .count();
    JobListInvocationSummaryView {
        stage_spec_count,
        unknown_count: items.len().saturating_sub(stage_spec_count),
    }
}

