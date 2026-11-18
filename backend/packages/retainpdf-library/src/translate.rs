//! Translate-from-library: reuse a document's stored upload and submit via JobsFacade.

use retainpdf_api_base::error::AppError;
use retainpdf_jobs::JobSubmissionView;
use retainpdf_core::models::domain::WorkflowKind;
use retainpdf_core::models::request::CreateJobInput;
use retainpdf_jobs::{
    reject_client_job_id, reusable_ocr_coverage, validate_ocr_artifact_reuse,
    validate_ocr_credential_reference, validate_provider_credentials, JobsFacade, VersionLink,
};

use super::versions;

use super::translate_plan::{contiguous_runs, plan_segments, SegmentPlan};

use super::documents::require_document_upload;
use super::LibraryDeps;
use crate::views::DocumentJobRequest;

/// Bind `request` to the document's stored upload, normalize workflow, and create a job.
///
/// 和 `POST /jobs` 一样严格：`workflow=ocr|render`、`source.source_url` 和这个入口矛盾，400，不悄悄清掉。
/// 先看请求写没写对（400），再看书、原文、要复用的 OCR 在不在（404 / 409）。
pub fn translate_document(
    deps: &LibraryDeps<'_>,
    jobs: &JobsFacade<'_>,
    document_id: &str,
    request: DocumentJobRequest,
    base_url: &str,
) -> Result<JobSubmissionView, AppError> {
    let mut request = request.input;
    reject_client_job_id(&request)?;
    if matches!(request.workflow, WorkflowKind::Ocr | WorkflowKind::Render) {
        return Err(AppError::bad_request(
            "document translate supports workflow=book or translate; default is book",
        ));
    }
    if !request.source.source_url.trim().is_empty() {
        return Err(AppError::bad_request(
            "source.source_url is not accepted on /documents/:document_id/translate: the document's stored PDF is used",
        ));
    }

    let (document, upload) = require_document_upload(deps, document_id)?;
    // 开发栈的翻译默认值要在拆段预检（会校验翻译凭据）之前补上。
    request = retainpdf_jobs::with_dev_translation_defaults(&request);

    if !request.source.upload_id.trim().is_empty()
        && request.source.upload_id.trim() != upload.upload_id
    {
        return Err(AppError::bad_request(
            "source.upload_id does not match this document's stored upload",
        ));
    }
    request.source.upload_id = upload.upload_id;

    let reuses_ocr = !request.source.artifact_job_id.trim().is_empty();
    // 复用 OCR + 指定了页：页不连续、或超出所选 OCR 的覆盖范围时，按连续段拆成几个任务
    // （见 `translate_plan`）。一段且覆盖得住就落到下面原来那条路，行为不变。
    // 译文版本：整本翻译开一个没有来源的新版本；只翻一部分页的，其余页沿用用户正在看的版本
    let base = if is_partial(&request) { versions::reading_base_version(deps.db, document_id)? } else { None };
    if reuses_ocr && !request.translation.page_ranges.is_empty() {
        if let Some(segments) = split_plan(deps, document_id, document.page_count, &request)? {
            return submit_segments(jobs, deps, document_id, &request, &segments, base_url, base.as_deref());
        }
    }
    if reuses_ocr {
        validate_ocr_artifact_reuse(
            deps.db,
            deps.data_root,
            &request,
            Some(document_id),
            Some(document.page_count),
        )?;
    }

    if !matches!(request.workflow, WorkflowKind::Translate) {
        request.workflow = WorkflowKind::Book;
    } else if reuses_ocr {
        request.runtime.render_after_translation = true;
    }

    jobs.create_document_submission_in_version(
        base_url,
        &request,
        document_id,
        VersionLink::New { base: base.as_deref(), origin: "translate" },
    )
}

/// 只翻这本书的一部分页（指定了页或起止页）。
fn is_partial(request: &CreateJobInput) -> bool {
    let translation = &request.translation;
    !translation.page_ranges.is_empty() || translation.start_page > 0 || translation.end_page >= 0
}

/// 需要拆分时返回各段的计划；一段且所选 OCR 覆盖得住时返回 `None`（走原来的单任务路径）。
fn split_plan(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    document_page_count: u32,
    request: &CreateJobInput,
) -> Result<Option<Vec<SegmentPlan>>, AppError> {
    if request
        .translation
        .page_ranges
        .iter()
        .any(|page| *page == 0 || *page > document_page_count)
    {
        return Err(AppError::bad_request(format!(
            "requested pages must be within 1-{document_page_count}"
        )));
    }
    let runs = contiguous_runs(&request.translation.page_ranges);
    let chosen = request.source.artifact_job_id.trim().to_string();
    let chosen_coverage =
        reusable_ocr_coverage(deps.db, deps.data_root, &chosen, document_id, document_page_count);
    // 用户选的那份 OCR 能复用，而且整段都在里面：不用拆。
    if runs.len() == 1 {
        let (first, last) = runs[0];
        if chosen_coverage
            .as_ref()
            .is_some_and(|coverage| (first..=last).all(|page| coverage.binary_search(&page).is_ok()))
        {
            return Ok(None);
        }
    }
    // 候选：用户选的那份在前，其余这本书能复用的 OCR 按新到旧。
    let mut sources: Vec<(String, Vec<u32>)> = chosen_coverage.map(|c| (chosen.clone(), c)).into_iter().collect();
    let mut others = deps.db.list_jobs_for_document(document_id, 200, 0)?;
    others.sort_by(|a, b| (&b.created_at, &b.job_id).cmp(&(&a.created_at, &a.job_id)));
    for job in others {
        if job.job_id == chosen {
            continue;
        }
        if let Some(coverage) =
            reusable_ocr_coverage(deps.db, deps.data_root, &job.job_id, document_id, document_page_count)
        {
            sources.push((job.job_id.clone(), coverage));
        }
    }
    Ok(Some(plan_segments(&runs, &sources)))
}

fn submit_segments(
    jobs: &JobsFacade<'_>,
    deps: &LibraryDeps<'_>,
    document_id: &str,
    request: &CreateJobInput,
    segments: &[SegmentPlan],
    base_url: &str,
    base_version: Option<&str>,
) -> Result<JobSubmissionView, AppError> {
    // 先把每一段都校验完再建任务：建到一半失败会留下半截提交（翻了 1-3 页、12-13 页没了），
    // 用户看不出来。补 OCR 的段最可能失败（要 OCR 凭据），校验和创建都排在前面。
    let mut ordered: Vec<(&SegmentPlan, CreateJobInput)> =
        segments.iter().map(|segment| (segment, segment_request(request, segment))).collect();
    ordered.sort_by_key(|(segment, _)| !matches!(segment, SegmentPlan::FreshOcr { .. }));
    for (segment, segment_request) in &ordered {
        match segment {
            SegmentPlan::FreshOcr { first, last } => {
                validate_provider_credentials(segment_request)
                    .and_then(|()| validate_ocr_credential_reference(segment_request, deps.data_root))
                    .map_err(|error| {
                        AppError::bad_request(format!(
                            "第 {} 页还没有可复用的 OCR，需要重新识别，但 OCR 设置不完整：{}",
                            page_label(*first, *last),
                            error
                        ))
                    })?;
            }
            SegmentPlan::Reuse { .. } => {
                validate_ocr_artifact_reuse(deps.db, deps.data_root, segment_request, Some(document_id), None)?;
            }
        }
    }
    // 几段是一次翻译：第一段开新版本，后几段加进同一个版本
    let mut submissions: Vec<JobSubmissionView> = Vec::new();
    let mut version: Option<String> = None;
    for (_, segment_request) in &ordered {
        let link = match version.as_deref() {
            Some(version_id) => VersionLink::Existing(version_id),
            None => VersionLink::New { base: base_version, origin: "translate" },
        };
        let submission = jobs.create_document_submission_in_version(base_url, segment_request, document_id, link)?;
        if version.is_none() {
            version = deps.db.translation_version_of_job(&submission.job_id)?;
        }
        submissions.push(submission);
    }
    let mut submissions = submissions.into_iter();
    let mut first = submissions
        .next()
        .ok_or_else(|| AppError::bad_request("no pages to translate"))?;
    first.sibling_job_ids = submissions.map(|submission| submission.job_id).collect();
    Ok(first)
}

fn page_label(first: u32, last: u32) -> String {
    if first == last {
        first.to_string()
    } else {
        format!("{first}-{last}")
    }
}

/// 一段的请求：复用段指向那份 OCR、只翻这几页；重新 OCR 的段清掉复用、只 OCR 这一段。
fn segment_request(request: &CreateJobInput, segment: &SegmentPlan) -> CreateJobInput {
    let mut segment_request = request.clone();
    match segment {
        SegmentPlan::Reuse { source_job_id, first, last } => {
            segment_request.source.artifact_job_id = source_job_id.clone();
            segment_request.translation.page_ranges = (*first..=*last).collect();
            if matches!(segment_request.workflow, WorkflowKind::Translate) {
                segment_request.runtime.render_after_translation = true;
            } else {
                segment_request.workflow = WorkflowKind::Book;
            }
        }
        SegmentPlan::FreshOcr { first, last } => {
            segment_request.source.artifact_job_id.clear();
            segment_request.workflow = WorkflowKind::Book;
            segment_request.ocr.page_ranges = page_label(*first, *last);
            segment_request.translation.page_ranges.clear();
            segment_request.translation.start_page = 0;
            segment_request.translation.end_page = -1;
        }
    }
    segment_request
}
