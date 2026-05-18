use crate::error::AppError;
use crate::models::{CreateJobInput, JobSnapshot, UploadRecord, WorkflowKind};
use crate::services::job_snapshot_factory::{build_job_snapshot, JobCommandKind, JobInit};

use super::context::SnapshotBuildDeps;
use super::prepare::{
    prepare_full_pipeline_input, prepare_ocr_input, prepare_render_input,
    prepare_translate_only_input,
};

pub(super) fn build_translation_job_snapshot(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    match input.workflow {
        WorkflowKind::Ocr => {
            return Err(AppError::bad_request(
                "use /api/v1/ocr/jobs for workflow=ocr",
            ));
        }
        WorkflowKind::Render => return build_render_job_snapshot(ctx, input),
        WorkflowKind::Translate => return build_translate_only_job_snapshot(ctx, input),
        WorkflowKind::Book => {}
    }
    build_full_pipeline_job_snapshot(ctx, input)
}

fn build_full_pipeline_job_snapshot(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    let prepared = prepare_full_pipeline_input(ctx, input)?;
    if !prepared.spec.source.artifact_job_id.trim().is_empty() {
        return build_job_snapshot(
            &ctx.config,
            prepared.spec,
            JobCommandKind::Deferred {
                label: "book-workflow-pending-artifacts",
            },
            JobInit::book_default(),
        );
    }
    build_job_snapshot(
        &ctx.config,
        prepared.spec,
        JobCommandKind::Deferred {
            label: "book-workflow-rust-orchestrated",
        },
        JobInit::book_default(),
    )
}

fn build_translate_only_job_snapshot(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    let prepared = prepare_translate_only_input(ctx, input)?;
    build_job_snapshot(
        &ctx.config,
        prepared.spec,
        JobCommandKind::Deferred {
            label: "translate-workflow-pending-ocr",
        },
        JobInit::translate_default(),
    )
}

fn build_render_job_snapshot(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    let prepared = prepare_render_input(ctx, input)?;
    build_job_snapshot(
        &ctx.config,
        prepared.spec,
        JobCommandKind::Deferred {
            label: "render-workflow-pending-artifacts",
        },
        JobInit::render_default(),
    )
}

pub(super) fn build_ocr_job_snapshot(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
    upload: Option<&UploadRecord>,
) -> Result<JobSnapshot, AppError> {
    let prepared = prepare_ocr_input(ctx, input, upload)?;
    build_job_snapshot(
        &ctx.config,
        prepared.spec,
        JobCommandKind::Ocr {
            upload_path: prepared.upload_path,
        },
        JobInit::ocr_default(),
    )
}
