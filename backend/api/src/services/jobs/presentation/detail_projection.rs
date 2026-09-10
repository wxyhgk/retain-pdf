use std::path::Path;

use crate::db::Db;
use crate::job_failure::classify_job_failure;
use crate::models::api::{
    build_artifact_links, build_job_actions, build_job_links_with_workflow, public_request_payload,
    ArtifactDisplayItemView, ArtifactLinksView, BookSummaryView, GlossaryUsageSummaryView,
    InvocationSummaryView, JobActionsView, JobContractsView, JobFailureDiagnosticView,
    JobLinksView, JobStageSnapshotView, JobStagesView, JobTimestampsView, NormalizationSummaryView,
    OcrJobSummaryView, PublicResolvedJobSpec,
};
use crate::models::domain::{JobFailureInfo, JobRuntimeInfo, JobSnapshot, OcrProviderDiagnostics};
use crate::services::book_projection::build_artifacts_display;

use super::super::job_readiness;
use super::super::live_stage::load_live_stage_snapshot;
use super::super::stage_view::build_job_stage_view;
use super::super::summary_loaders::{
    load_glossary_summary, load_invocation_summary, load_normalization_summary,
};
use super::contracts::build_job_contracts_view;
use super::helpers::{
    build_book_summary, build_ocr_job_summary, derive_display_name, job_failure_to_legacy_view,
};
use super::security::{redacted_error, redacted_log_tail};

pub(super) struct DetailCoreProjection {
    pub request_payload: PublicResolvedJobSpec,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub runtime: Option<JobRuntimeInfo>,
    pub timestamps: JobTimestampsView,
    pub links: JobLinksView,
    pub actions: JobActionsView,
}

pub(super) struct DetailLiveProjection {
    pub stage_snapshot: Option<JobStageSnapshotView>,
    pub background_snapshots: Vec<JobStageSnapshotView>,
    pub stages: JobStagesView,
}

pub(super) struct DetailArtifactProjection {
    pub links: ArtifactLinksView,
    pub display: Vec<ArtifactDisplayItemView>,
}

pub(super) struct DetailFailureProjection {
    pub failure: Option<JobFailureInfo>,
    pub error: Option<String>,
    pub diagnostic: Option<JobFailureDiagnosticView>,
    pub log_tail: Vec<String>,
}

pub(super) struct DetailSummaryProjection {
    pub book: BookSummaryView,
    pub contracts: JobContractsView,
    pub ocr_job: Option<OcrJobSummaryView>,
    pub ocr_provider_diagnostics: Option<OcrProviderDiagnostics>,
    pub normalization: Option<NormalizationSummaryView>,
    pub glossary: Option<GlossaryUsageSummaryView>,
    pub invocation: Option<InvocationSummaryView>,
}

pub(super) fn detail_readiness(job: &JobSnapshot, data_root: &Path) -> (bool, bool, bool) {
    job_readiness(job, data_root)
}

pub(super) fn build_core_projection(
    job: &JobSnapshot,
    base_url: &str,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> DetailCoreProjection {
    DetailCoreProjection {
        request_payload: public_request_payload(&job.request_payload),
        trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.trace_id.clone()),
        provider_trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.provider_trace_id.clone()),
        runtime: job.runtime.clone(),
        timestamps: build_timestamps(job),
        links: build_job_links_with_workflow(&job.job_id, &job.workflow, base_url),
        actions: build_job_actions(job, base_url, pdf_ready, markdown_ready, bundle_ready),
    }
}

pub(super) fn build_live_projection(
    db: &Db,
    job: &JobSnapshot,
    data_root: &Path,
) -> DetailLiveProjection {
    let live_stage = load_live_stage_snapshot(db, job, data_root);
    let stage = build_job_stage_view(job, live_stage.as_ref());
    DetailLiveProjection {
        stage_snapshot: stage.stage_snapshot,
        background_snapshots: stage.background_snapshots,
        stages: stage.stages,
    }
}

pub(super) fn build_artifact_projection(
    job: &JobSnapshot,
    data_root: &Path,
    base_url: &str,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> DetailArtifactProjection {
    let links = build_artifact_links(
        job,
        base_url,
        data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    );
    let display = build_artifacts_display(&links);
    DetailArtifactProjection { links, display }
}

pub(super) fn build_failure_projection(job: &JobSnapshot) -> DetailFailureProjection {
    let failure = job
        .failure
        .clone()
        .map(JobFailureInfo::with_formal_fields)
        .or_else(|| classify_job_failure(job).map(JobFailureInfo::with_formal_fields));
    DetailFailureProjection {
        diagnostic: failure.as_ref().map(job_failure_to_legacy_view),
        failure,
        error: redacted_error(job),
        log_tail: redacted_log_tail(job),
    }
}

pub(super) fn build_summary_projection(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
) -> DetailSummaryProjection {
    let display_name = derive_display_name(db, job);
    let cover_url = super::helpers::cover_url(job, data_root, base_url);
    DetailSummaryProjection {
        book: build_book_summary(db, job, data_root, base_url, &display_name)
            .with_cover_url(cover_url),
        contracts: build_job_contracts_view(job, data_root),
        ocr_job: build_ocr_job_summary(job, base_url),
        ocr_provider_diagnostics: job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.ocr_provider_diagnostics.clone()),
        normalization: load_normalization_summary(job, data_root),
        glossary: load_glossary_summary(job, data_root),
        invocation: load_invocation_summary(job, data_root),
    }
}

fn build_timestamps(job: &JobSnapshot) -> JobTimestampsView {
    JobTimestampsView {
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
        started_at: job.started_at.clone(),
        finished_at: job.finished_at.clone(),
        duration_seconds: job.result.as_ref().map(|result| result.duration_seconds),
    }
}
