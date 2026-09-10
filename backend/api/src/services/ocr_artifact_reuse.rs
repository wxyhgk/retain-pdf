use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use axum::http::StatusCode;

use crate::db::Db;
use crate::error::AppError;
use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::models::request::CreateJobInput;
use crate::ocr_provider::uses_paddle_official_cli;
use crate::storage_paths::resolve_data_path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct TranslationArtifactSelection {
    pub(crate) start_page: i64,
    pub(crate) end_page: i64,
}

pub(crate) fn validate_ocr_artifact_reuse(
    db: &Db,
    data_root: &Path,
    request: &CreateJobInput,
    expected_document_id: Option<&str>,
    expected_document_page_count: Option<u32>,
) -> Result<TranslationArtifactSelection, AppError> {
    let source_job_id = request.source.artifact_job_id.trim();
    let source_job = db.get_job(source_job_id).map_err(|_| {
        reuse_error(
            StatusCode::NOT_FOUND,
            "OCR_JOB_NOT_FOUND",
            "指定的 OCR 任务不存在",
            "job_not_found",
        )
    })?;

    let reusable_ocr_stage_succeeded = ocr_stage_succeeded(db, &source_job);
    if !reusable_ocr_stage_succeeded {
        return Err(reuse_error(
            StatusCode::CONFLICT,
            "OCR_JOB_NOT_SUCCEEDED",
            "指定的 OCR 任务尚未成功完成",
            "job_not_succeeded",
        ));
    }

    if let Some(expected_document_id) = expected_document_id {
        let source_document = db.get_document_by_job_id(source_job_id).map_err(|_| {
            reuse_error(
                StatusCode::CONFLICT,
                "OCR_ARTIFACT_NOT_REUSABLE",
                "无法确认 OCR 任务的文档归属",
                "document_membership_unknown",
            )
        })?;
        if source_document
            .as_ref()
            .map(|document| document.document_id.as_str())
            != Some(expected_document_id)
        {
            return Err(reuse_error(
                StatusCode::CONFLICT,
                "OCR_ARTIFACT_NOT_REUSABLE",
                "OCR 任务不属于当前文档",
                "document_mismatch",
            ));
        }
    }

    if uses_paddle_official_cli(&source_job.request_payload.ocr) {
        return Err(reuse_error(
            StatusCode::CONFLICT,
            "OCR_ARTIFACT_NOT_REUSABLE",
            "现有 OCR 产物格式不支持直接翻译",
            "unsupported_provider_artifact",
        ));
    }

    let artifacts = source_job.artifacts.as_ref().ok_or_else(|| {
        reuse_error(
            StatusCode::CONFLICT,
            "OCR_ARTIFACT_MISSING",
            "OCR 任务没有可复用的产物",
            "artifact_manifest_missing",
        )
    })?;
    require_artifact_file(
        data_root,
        artifacts.normalized_document_json.as_deref(),
        "missing_normalized_document_json",
    )?;
    let source_pdf = require_artifact_file(
        data_root,
        artifacts.source_pdf.as_deref(),
        "missing_source_pdf",
    )?;
    require_layout_file(data_root, artifacts.layout_json.as_deref())?;

    resolve_translation_selection(
        request,
        &source_job,
        &source_pdf,
        expected_document_page_count,
    )
}

fn ocr_stage_succeeded(db: &Db, source_job: &JobSnapshot) -> bool {
    if matches!(source_job.status, JobStatusKind::Succeeded) {
        return true;
    }

    let Some(artifacts) = source_job.artifacts.as_ref() else {
        return false;
    };
    if artifacts
        .ocr_status
        .as_ref()
        .is_some_and(|status| matches!(status, JobStatusKind::Succeeded))
    {
        return true;
    }

    // Older compound jobs may have lost the mirrored status when their OCR
    // child's artifact paths were copied into the parent.  The child job row
    // is the durable authority in that case, so consult it as a compatibility
    // fallback instead of rejecting an otherwise reusable OCR checkpoint.
    artifacts
        .ocr_job_id
        .as_deref()
        .and_then(|ocr_job_id| db.get_job(ocr_job_id).ok())
        .is_some_and(|ocr_job| matches!(ocr_job.status, JobStatusKind::Succeeded))
}

fn require_artifact_file(
    data_root: &Path,
    raw: Option<&str>,
    reason: &'static str,
) -> Result<PathBuf, AppError> {
    let path = raw
        .and_then(|raw| resolve_data_path(data_root, raw).ok())
        .filter(|path| path.is_file())
        .ok_or_else(|| {
            reuse_error(
                StatusCode::CONFLICT,
                "OCR_ARTIFACT_MISSING",
                "OCR 必需产物不存在或已过期",
                reason,
            )
        })?;
    Ok(path)
}

fn require_layout_file(data_root: &Path, raw: Option<&str>) -> Result<PathBuf, AppError> {
    raw.and_then(|raw| resolve_data_path(data_root, raw).ok())
        .filter(|path| path.is_file())
        .ok_or_else(|| {
            reuse_error(
                StatusCode::CONFLICT,
                "OCR_ARTIFACT_NOT_REUSABLE",
                "现有 OCR 产物缺少翻译渲染所需的布局数据",
                "missing_layout_data",
            )
        })
}

fn resolve_translation_selection(
    request: &CreateJobInput,
    source_job: &JobSnapshot,
    source_pdf: &Path,
    document_page_count: Option<u32>,
) -> Result<TranslationArtifactSelection, AppError> {
    let Some(document_page_count) = document_page_count else {
        return Ok(TranslationArtifactSelection {
            start_page: request.translation.start_page,
            end_page: request.translation.end_page,
        });
    };
    if document_page_count == 0 {
        return Err(page_coverage_error("document_has_no_pages"));
    }

    let requested_pages = requested_document_pages(request, document_page_count)?;
    let source_pages = source_document_pages(source_job, source_pdf, document_page_count)?;
    let requested_set = requested_pages.iter().copied().collect::<BTreeSet<_>>();
    let source_set = source_pages.iter().copied().collect::<BTreeSet<_>>();
    if !requested_set.is_subset(&source_set) {
        return Err(page_coverage_error("page_coverage_mismatch"));
    }

    let local_positions = source_pages
        .iter()
        .enumerate()
        .filter_map(|(index, page)| requested_set.contains(page).then_some(index))
        .collect::<Vec<_>>();
    let Some(first) = local_positions.first().copied() else {
        return Err(page_coverage_error("empty_translation_range"));
    };
    let last = *local_positions.last().expect("first position exists");
    if local_positions.len() != last - first + 1 {
        return Err(page_coverage_error("non_contiguous_artifact_selection"));
    }
    Ok(TranslationArtifactSelection {
        start_page: first as i64,
        end_page: last as i64,
    })
}

fn requested_document_pages(
    request: &CreateJobInput,
    document_page_count: u32,
) -> Result<Vec<u32>, AppError> {
    if !request.translation.page_ranges.is_empty() {
        let pages = request
            .translation
            .page_ranges
            .iter()
            .copied()
            .collect::<BTreeSet<_>>();
        if pages
            .iter()
            .any(|page| *page == 0 || *page > document_page_count)
        {
            return Err(page_coverage_error("requested_page_out_of_bounds"));
        }
        return Ok(pages.into_iter().collect());
    }

    let start = request.translation.start_page.max(0) as u32;
    let end = if request.translation.end_page < 0 {
        document_page_count - 1
    } else {
        request.translation.end_page as u32
    };
    if start > end || end >= document_page_count {
        return Err(page_coverage_error("requested_page_out_of_bounds"));
    }
    Ok((start..=end).map(|page_index| page_index + 1).collect())
}

fn source_document_pages(
    source_job: &JobSnapshot,
    source_pdf: &Path,
    document_page_count: u32,
) -> Result<Vec<u32>, AppError> {
    if let Some(artifacts) = source_job.artifacts.as_ref() {
        if !artifacts.ocr_page_numbers.is_empty() {
            return validate_source_pages(&artifacts.ocr_page_numbers, document_page_count);
        }
    }

    let raw_ranges = source_job.request_payload.ocr.page_ranges.trim();
    if !raw_ranges.is_empty() && !raw_ranges.eq_ignore_ascii_case("all") {
        return parse_page_ranges(raw_ranges, document_page_count);
    }

    let pdf_page_count = lopdf::Document::load(source_pdf)
        .ok()
        .map(|document| document.get_pages().len() as u32);
    if pdf_page_count == Some(document_page_count) {
        return Ok((1..=document_page_count).collect());
    }
    Err(page_coverage_error("ocr_page_coverage_unknown"))
}

fn validate_source_pages(pages: &[u32], document_page_count: u32) -> Result<Vec<u32>, AppError> {
    let pages = pages.iter().copied().collect::<BTreeSet<_>>();
    if pages.is_empty()
        || pages
            .iter()
            .any(|page| *page == 0 || *page > document_page_count)
    {
        return Err(page_coverage_error("invalid_ocr_page_coverage"));
    }
    Ok(pages.into_iter().collect())
}

fn parse_page_ranges(spec: &str, total_pages: u32) -> Result<Vec<u32>, AppError> {
    let mut pages = BTreeSet::new();
    for raw_part in spec.split(',') {
        let part = raw_part.trim();
        if part.is_empty() {
            continue;
        }
        if let Some((start, end)) = part.split_once('-') {
            let start = parse_page(start, total_pages)?;
            let end = parse_page(end, total_pages)?;
            if start > end {
                return Err(page_coverage_error("invalid_ocr_page_coverage"));
            }
            pages.extend(start..=end);
        } else {
            pages.insert(parse_page(part, total_pages)?);
        }
    }
    validate_source_pages(&pages.into_iter().collect::<Vec<_>>(), total_pages)
}

fn parse_page(raw: &str, total_pages: u32) -> Result<u32, AppError> {
    let page = raw
        .parse::<u32>()
        .map_err(|_| page_coverage_error("invalid_ocr_page_coverage"))?;
    if page == 0 || page > total_pages {
        return Err(page_coverage_error("invalid_ocr_page_coverage"));
    }
    Ok(page)
}

fn page_coverage_error(reason: &'static str) -> AppError {
    reuse_error(
        StatusCode::CONFLICT,
        "OCR_PAGE_COVERAGE_MISMATCH",
        "OCR 页码范围不能覆盖本次翻译",
        reason,
    )
}

fn reuse_error(
    status: StatusCode,
    code: &'static str,
    message: &'static str,
    reason: &'static str,
) -> AppError {
    AppError::ocr_artifact_reuse(status, code, message, reason)
}
