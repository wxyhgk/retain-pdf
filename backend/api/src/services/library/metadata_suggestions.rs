use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use axum::http::StatusCode;
use lopdf::Object;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::error::AppError;
use crate::models::api::{
    ApplyDocumentMetadataSuggestionInput, CreateDocumentMetadataSuggestionInput,
    DocumentMetadataEvidenceView, DocumentMetadataSuggestionApplyView,
    DocumentMetadataSuggestionListView, DocumentMetadataSuggestionView, DocumentRecord,
    DocumentTitleCandidateView, ListDocumentMetadataSuggestionsQuery,
};
use crate::models::domain::build_job_id;
use crate::storage_paths::{resolve_job_root, resolve_normalized_document};
use retain_data::db::{ApplyDocumentMetadataSuggestionResult, StoredDocumentMetadataSuggestion};

use super::documents::require_document_upload;
use super::LibraryDeps;

const MAX_NORMALIZED_DOCUMENT_BYTES: u64 = 256 * 1024 * 1024;
const MAX_SUGGESTIONS: u32 = 100;
const MAX_TITLE_CHARS: usize = 512;

pub fn create_metadata_suggestion(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    input: &CreateDocumentMetadataSuggestionInput,
) -> Result<DocumentMetadataSuggestionView, AppError> {
    validate_fields(&input.fields)?;
    let (document, upload) = require_document_upload(deps, document_id)?;

    let mut candidates = Vec::new();
    if let Some(title) = read_pdf_metadata_title(Path::new(&upload.stored_path)) {
        candidates.push(DocumentTitleCandidateView {
            value: title,
            source: "pdf_metadata".to_string(),
            confidence: 0.92,
            evidence: vec![DocumentMetadataEvidenceView {
                source: "pdf_info_title".to_string(),
                page_idx: None,
                block_id: None,
                structure_role: None,
                layout_role: None,
            }],
        });
    }

    let normalized = resolve_normalized_source(deps, document_id, input.job_id.as_deref())?;
    let mut evidence_hasher = Sha256::new();
    // document_id is already the uploaded PDF's SHA-256 content hash.
    evidence_hasher.update(b"source_pdf_sha256\0");
    evidence_hasher.update(document_id.as_bytes());
    let mut source_job_id = None;
    if let Some((job_id, path)) = normalized {
        let metadata = fs::metadata(&path).map_err(|error| {
            AppError::document_metadata(
                StatusCode::CONFLICT,
                "DOCUMENT_METADATA_SOURCE_NOT_READY",
                format!("无法读取 OCR 规范化产物: {error}"),
            )
        })?;
        if metadata.len() > MAX_NORMALIZED_DOCUMENT_BYTES {
            return Err(AppError::document_metadata(
                StatusCode::PAYLOAD_TOO_LARGE,
                "DOCUMENT_METADATA_SOURCE_TOO_LARGE",
                "OCR 规范化产物过大，无法生成元数据建议",
            ));
        }
        let evidence_bytes = fs::read(&path).map_err(|error| {
            AppError::document_metadata(
                StatusCode::CONFLICT,
                "DOCUMENT_METADATA_SOURCE_NOT_READY",
                format!("无法读取 OCR 规范化产物: {error}"),
            )
        })?;
        evidence_hasher.update(b"normalized_document\0");
        evidence_hasher.update(&evidence_bytes);
        let value: Value = serde_json::from_slice(&evidence_bytes).map_err(|error| {
            AppError::document_metadata(
                StatusCode::UNPROCESSABLE_ENTITY,
                "DOCUMENT_METADATA_SOURCE_INVALID",
                format!("OCR 规范化产物不是有效 JSON: {error}"),
            )
        })?;
        candidates.extend(extract_ocr_title_candidates(&value));
        source_job_id = Some(job_id);
    }

    let candidates = rank_and_deduplicate_candidates(candidates);
    let Some(selected) = candidates.first() else {
        return Err(AppError::document_metadata(
            StatusCode::UNPROCESSABLE_ENTITY,
            "DOCUMENT_TITLE_CANDIDATE_NOT_FOUND",
            "没有找到可靠的文档标题；请先完成 OCR 或手工命名",
        ));
    };
    let needs_ai_review = selected.confidence < 0.90
        || candidates
            .get(1)
            .is_some_and(|next| (selected.confidence - next.confidence).abs() < 0.05);
    let artifact_sha256 = hex_digest(evidence_hasher.finalize());
    let fields = vec!["title".to_string()];
    let record = deps.db.insert_document_metadata_suggestion(
        &format!("meta-{}", build_job_id()),
        document_id,
        source_job_id.as_deref(),
        &artifact_sha256,
        &serde_json::to_string(&fields)
            .map_err(|error| AppError::internal(format!("serialize metadata fields: {error}")))?,
        &serde_json::to_string(&candidates).map_err(|error| {
            AppError::internal(format!("serialize metadata candidates: {error}"))
        })?,
        &selected.value,
        &selected.source,
        needs_ai_review,
    )?;

    if input.apply_if_default {
        match deps.db.apply_document_metadata_suggestion(
            document_id,
            &record.suggestion_id,
            None,
        )? {
            ApplyDocumentMetadataSuggestionResult::Applied {
                suggestion,
                document,
            } => return stored_to_view(suggestion, &document),
            ApplyDocumentMetadataSuggestionResult::TitleChanged(document)
            | ApplyDocumentMetadataSuggestionResult::RevisionConflict(document) => {
                return stored_to_view(record, &document)
            }
            ApplyDocumentMetadataSuggestionResult::SuggestionNotFound
            | ApplyDocumentMetadataSuggestionResult::DocumentNotFound => {
                return Err(AppError::internal(
                    "metadata suggestion disappeared during guarded application",
                ))
            }
        }
    }

    stored_to_view(record, &document)
}

pub fn list_metadata_suggestions(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    query: &ListDocumentMetadataSuggestionsQuery,
) -> Result<DocumentMetadataSuggestionListView, AppError> {
    let document = deps
        .db
        .get_document(document_id)
        .map_err(|_| AppError::not_found(format!("document not found: {document_id}")))?;
    let suggestions = deps
        .db
        .list_document_metadata_suggestions(document_id, query.limit.clamp(1, MAX_SUGGESTIONS))?
        .into_iter()
        .map(|record| stored_to_view(record, &document))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(DocumentMetadataSuggestionListView { suggestions })
}

pub fn apply_metadata_suggestion(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    suggestion_id: &str,
    input: &ApplyDocumentMetadataSuggestionInput,
) -> Result<DocumentMetadataSuggestionApplyView, AppError> {
    match deps.db.apply_document_metadata_suggestion(
        document_id,
        suggestion_id,
        input.expected_document_updated_at.as_deref(),
    )? {
        ApplyDocumentMetadataSuggestionResult::Applied {
            suggestion,
            document,
        } => Ok(DocumentMetadataSuggestionApplyView {
            suggestion: stored_to_view(suggestion, &document)?,
            document,
        }),
        ApplyDocumentMetadataSuggestionResult::SuggestionNotFound => {
            Err(AppError::document_metadata(
                StatusCode::NOT_FOUND,
                "DOCUMENT_METADATA_SUGGESTION_NOT_FOUND",
                "元数据建议不存在或不属于当前文档",
            ))
        }
        ApplyDocumentMetadataSuggestionResult::DocumentNotFound => Err(AppError::not_found(
            format!("document not found: {document_id}"),
        )),
        ApplyDocumentMetadataSuggestionResult::TitleChanged(_) => Err(AppError::document_metadata(
            StatusCode::CONFLICT,
            "DOCUMENT_TITLE_CHANGED",
            "文档标题已经被修改，未应用自动命名建议",
        )),
        ApplyDocumentMetadataSuggestionResult::RevisionConflict(_) => {
            Err(AppError::document_metadata(
                StatusCode::CONFLICT,
                "DOCUMENT_REVISION_CONFLICT",
                "文档已发生变化，请刷新后重试",
            ))
        }
    }
}

fn validate_fields(fields: &[String]) -> Result<(), AppError> {
    if fields.is_empty() || fields.iter().all(|field| field.trim() == "title") {
        return Ok(());
    }
    Err(AppError::document_metadata(
        StatusCode::BAD_REQUEST,
        "DOCUMENT_METADATA_FIELD_UNSUPPORTED",
        "当前仅支持生成 title 元数据建议",
    ))
}

fn resolve_normalized_source(
    deps: &LibraryDeps<'_>,
    document_id: &str,
    requested_job_id: Option<&str>,
) -> Result<Option<(String, PathBuf)>, AppError> {
    if let Some(job_id) = requested_job_id
        .map(str::trim)
        .filter(|job_id| !job_id.is_empty())
    {
        let job = deps.db.get_job(job_id).map_err(|_| {
            AppError::document_metadata(
                StatusCode::NOT_FOUND,
                "OCR_JOB_NOT_FOUND",
                "指定的 OCR 任务不存在",
            )
        })?;
        let owner = deps.db.get_document_by_job_id(job_id)?.ok_or_else(|| {
            AppError::document_metadata(
                StatusCode::CONFLICT,
                "DOCUMENT_METADATA_JOB_MISMATCH",
                "无法确认指定任务的文档归属",
            )
        })?;
        if owner.document_id != document_id {
            return Err(AppError::document_metadata(
                StatusCode::CONFLICT,
                "DOCUMENT_METADATA_JOB_MISMATCH",
                "指定任务不属于当前文档",
            ));
        }
        let path = normalized_document_path(&job, deps.data_root).ok_or_else(|| {
            AppError::document_metadata(
                StatusCode::CONFLICT,
                "DOCUMENT_METADATA_SOURCE_NOT_READY",
                "指定任务尚无可读取的规范化 OCR 产物",
            )
        })?;
        return Ok(Some((job_id.to_string(), path)));
    }

    for job in deps.db.list_jobs_for_document(document_id, 200, 0)? {
        if let Some(path) = normalized_document_path(&job, deps.data_root) {
            return Ok(Some((job.job_id.clone(), path)));
        }
    }
    Ok(None)
}

fn normalized_document_path(
    job: &crate::models::domain::JobSnapshot,
    data_root: &Path,
) -> Option<PathBuf> {
    resolve_normalized_document(job, data_root)
        .filter(|path| path.is_file())
        .or_else(|| {
            resolve_job_root(job, data_root)
                .map(|root| root.join("ocr/normalized/document.v1.json"))
                .filter(|path| path.is_file())
        })
}

fn extract_ocr_title_candidates(document: &Value) -> Vec<DocumentTitleCandidateView> {
    let mut candidates = Vec::new();
    let pages = document
        .get("pages")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or_default();
    for (page_offset, page) in pages.iter().enumerate().take(8) {
        let page_idx = page
            .get("page_index")
            .and_then(Value::as_i64)
            .unwrap_or(page_offset as i64);
        let blocks = page
            .get("blocks")
            .and_then(Value::as_array)
            .map(Vec::as_slice)
            .unwrap_or_default();
        for block in blocks {
            let Some(value) = block_title_text(block) else {
                continue;
            };
            let structure_role = normalized_field(block, "structure_role");
            let layout_role = normalized_field(block, "layout_role");
            let sub_type = normalized_field(block, "sub_type");
            let raw_type = block
                .pointer("/source/raw_type")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim()
                .to_ascii_lowercase();
            let (source, mut confidence) = if structure_role == "document_title" {
                ("ocr_structure", 0.99)
            } else if raw_type == "doc_title" {
                ("ocr_provider_label", 0.97)
            } else if structure_role == "title" && layout_role == "title" {
                ("ocr_legacy_structure", 0.94)
            } else if layout_role == "title" && matches!(sub_type.as_str(), "title" | "doc_title") {
                ("ocr_layout", 0.84)
            } else {
                continue;
            };
            if page_idx > 1 {
                confidence -= ((page_idx - 1).min(5) as f64) * 0.03;
            }
            candidates.push(DocumentTitleCandidateView {
                value,
                source: source.to_string(),
                confidence,
                evidence: vec![DocumentMetadataEvidenceView {
                    source: "normalized_document".to_string(),
                    page_idx: Some(page_idx),
                    block_id: block
                        .get("block_id")
                        .or_else(|| block.get("item_id"))
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    structure_role: (!structure_role.is_empty()).then_some(structure_role),
                    layout_role: (!layout_role.is_empty()).then_some(layout_role),
                }],
            });
        }
    }
    candidates
}

fn block_title_text(block: &Value) -> Option<String> {
    block
        .get("text")
        .and_then(Value::as_str)
        .or_else(|| block.pointer("/content/text").and_then(Value::as_str))
        .and_then(normalize_title)
}

fn normalized_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .or_else(|| {
            value
                .pointer(&format!("/metadata/{key}"))
                .and_then(Value::as_str)
        })
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
}

fn rank_and_deduplicate_candidates(
    mut candidates: Vec<DocumentTitleCandidateView>,
) -> Vec<DocumentTitleCandidateView> {
    candidates.sort_by(|left, right| {
        right
            .confidence
            .total_cmp(&left.confidence)
            .then_with(|| left.value.len().cmp(&right.value.len()))
    });
    let mut positions = HashMap::<String, usize>::new();
    let mut deduplicated: Vec<DocumentTitleCandidateView> = Vec::new();
    for candidate in candidates {
        let key = candidate.value.to_lowercase();
        if let Some(index) = positions.get(&key).copied() {
            deduplicated[index].evidence.extend(candidate.evidence);
            continue;
        }
        positions.insert(key, deduplicated.len());
        deduplicated.push(candidate);
        if deduplicated.len() == 5 {
            break;
        }
    }
    deduplicated
}

fn read_pdf_metadata_title(path: &Path) -> Option<String> {
    let document = lopdf::Document::load(path).ok()?;
    let info = document.trailer.get(b"Info").ok()?;
    let dictionary = match info {
        Object::Reference(id) => document.get_object(*id).ok()?.as_dict().ok()?,
        Object::Dictionary(dictionary) => dictionary,
        _ => return None,
    };
    let bytes = dictionary.get(b"Title").ok()?.as_str().ok()?;
    normalize_title(&decode_pdf_string(bytes))
}

fn decode_pdf_string(bytes: &[u8]) -> String {
    if bytes.starts_with(&[0xfe, 0xff]) {
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16_lossy(&units);
    }
    String::from_utf8_lossy(bytes).into_owned()
}

fn normalize_title(value: &str) -> Option<String> {
    let title = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let char_count = title.chars().count();
    if !(2..=MAX_TITLE_CHARS).contains(&char_count) {
        return None;
    }
    if matches!(
        title.to_ascii_lowercase().as_str(),
        "untitled" | "document" | "title"
    ) {
        return None;
    }
    Some(title)
}

fn hex_digest(digest: impl AsRef<[u8]>) -> String {
    digest
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn stored_to_view(
    record: StoredDocumentMetadataSuggestion,
    document: &DocumentRecord,
) -> Result<DocumentMetadataSuggestionView, AppError> {
    let fields = serde_json::from_str(&record.fields_json).map_err(|error| {
        AppError::internal(format!("invalid persisted metadata fields: {error}"))
    })?;
    let title_candidates = serde_json::from_str(&record.candidates_json).map_err(|error| {
        AppError::internal(format!("invalid persisted title candidates: {error}"))
    })?;
    let applied = record.status == "applied"
        && document.title == record.selected_title
        && document.title_source != "user";
    let can_apply = applied
        || (!document.title_locked
            && document.title_source == "filename"
            && document.title == default_title_from_filename(&document.source_filename));
    Ok(DocumentMetadataSuggestionView {
        suggestion_id: record.suggestion_id,
        document_id: record.document_id,
        source_job_id: record.source_job_id,
        artifact_sha256: record.artifact_sha256,
        status: record.status,
        fields,
        title_candidates,
        selected_title: record.selected_title,
        generation_method: record.generation_method,
        needs_ai_review: record.needs_ai_review,
        applied,
        can_apply,
        created_at: record.created_at,
        updated_at: record.updated_at,
    })
}

fn default_title_from_filename(filename: &str) -> String {
    filename
        .strip_suffix(".pdf")
        .or_else(|| filename.strip_suffix(".PDF"))
        .unwrap_or(filename)
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_document_title_outranks_legacy_title() {
        let document = serde_json::json!({
            "pages": [{
                "page_index": 0,
                "blocks": [
                    {"block_id":"legacy", "text":"Legacy", "layout_role":"title", "structure_role":"title", "sub_type":"title"},
                    {"block_id":"exact", "text":"Exact title", "layout_role":"title", "structure_role":"document_title", "sub_type":"title"}
                ]
            }]
        });
        let candidates = rank_and_deduplicate_candidates(extract_ocr_title_candidates(&document));
        assert_eq!(candidates[0].value, "Exact title");
        assert_eq!(candidates[0].source, "ocr_structure");
    }

    #[test]
    fn repeated_title_candidates_merge_evidence() {
        let candidates = rank_and_deduplicate_candidates(vec![
            DocumentTitleCandidateView {
                value: "A useful paper".into(),
                source: "ocr_structure".into(),
                confidence: 0.99,
                evidence: vec![DocumentMetadataEvidenceView {
                    source: "one".into(),
                    page_idx: Some(0),
                    block_id: None,
                    structure_role: None,
                    layout_role: None,
                }],
            },
            DocumentTitleCandidateView {
                value: "A useful paper".into(),
                source: "pdf_metadata".into(),
                confidence: 0.92,
                evidence: vec![DocumentMetadataEvidenceView {
                    source: "two".into(),
                    page_idx: None,
                    block_id: None,
                    structure_role: None,
                    layout_role: None,
                }],
            },
        ]);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].evidence.len(), 2);
    }

    #[test]
    fn legacy_ocr_document_title_outranks_pdf_metadata() {
        let document = serde_json::json!({
            "pages": [{
                "page_index": 0,
                "blocks": [{
                    "block_id":"legacy",
                    "text":"OCR paper title",
                    "layout_role":"title",
                    "structure_role":"title",
                    "sub_type":"title"
                }]
            }]
        });
        let mut candidates = extract_ocr_title_candidates(&document);
        candidates.push(DocumentTitleCandidateView {
            value: "Stale PDF metadata".into(),
            source: "pdf_metadata".into(),
            confidence: 0.92,
            evidence: Vec::new(),
        });
        let candidates = rank_and_deduplicate_candidates(candidates);
        assert_eq!(candidates[0].value, "OCR paper title");
        assert_eq!(candidates[0].source, "ocr_legacy_structure");
    }
}
