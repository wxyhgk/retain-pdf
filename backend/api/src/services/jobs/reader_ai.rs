mod artifact_chunks;
mod chunking;
mod config;
mod llm;
mod retrieval;

use std::fs;
use std::path::Path;

use crate::error::AppError;
use crate::models::api::{ReaderAiChatRequest, ReaderAiChatView, ReaderAiUsedContextView};
use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::storage_paths::resolve_markdown_path;
use tracing::info;
use tracing::warn;

use artifact_chunks::chunks_from_translation_artifacts;
use chunking::chunk_markdown;
use config::ReaderAiConfig;
use llm::complete_reader_answer;
use retrieval::retrieve_chunks;

pub(crate) async fn answer_reader_chat(
    data_root: &Path,
    job: &JobSnapshot,
    request: ReaderAiChatRequest,
) -> Result<ReaderAiChatView, AppError> {
    warn!(job_id = %job.job_id, "legacy reader/ai/chat called — deprecated, use POST /api/v1/ai/ask");
    let message = request.message.trim();
    if message.is_empty() {
        return Err(AppError::bad_request("message is required"));
    }
    let scope = normalized_scope(&request.scope)?;
    ensure_markdown_ready(job)?;

    let (chunks, chunk_source) = load_reader_chunks(data_root, job)?;
    if chunks.is_empty() {
        return Err(AppError::not_found(format!(
            "reader text has no readable chunks: {}",
            job.job_id
        )));
    }
    let retrieved = retrieve_chunks(&chunks, message, request.context.as_ref(), 8);
    log_retrieved_chunks(&job.job_id, &retrieved);
    let citations = retrieved
        .iter()
        .map(|item| item.chunk.citation())
        .collect::<Vec<_>>();

    let config = ReaderAiConfig::from_request(Some(&request))?;
    let answer = complete_reader_answer(&config, &request, &retrieved).await?;
    Ok(ReaderAiChatView {
        answer,
        citations,
        used_context: ReaderAiUsedContextView {
            source: chunk_source,
            scope,
        },
    })
}

fn load_reader_chunks(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<(Vec<chunking::MarkdownChunk>, String), AppError> {
    let artifact_chunks = chunks_from_translation_artifacts(data_root, job)?;
    if !artifact_chunks.is_empty() {
        return Ok((artifact_chunks, "translation_manifest".to_string()));
    }
    let markdown_path = resolve_markdown_path(job, data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {}", job.job_id)))?;
    let markdown = fs::read_to_string(&markdown_path).map_err(|err| {
        AppError::internal(format!(
            "failed to read markdown {}: {err}",
            markdown_path.display()
        ))
    })?;
    if markdown.trim().is_empty() {
        return Err(AppError::not_found(format!(
            "markdown is empty: {}",
            job.job_id
        )));
    }
    Ok((chunk_markdown(&markdown), "markdown".to_string()))
}

fn log_retrieved_chunks(job_id: &str, retrieved: &[retrieval::RetrievedChunk]) {
    let chunks = retrieved
        .iter()
        .enumerate()
        .map(|(index, item)| {
            format!(
                "#{} title={:?} page={:?} score={:.2}",
                index + 1,
                item.chunk.title,
                item.chunk.page,
                item.score
            )
        })
        .collect::<Vec<_>>()
        .join(" | ");
    info!(
        job_id = %job_id,
        chunks = %chunks,
        "reader ai retrieved chunks"
    );
}

fn normalized_scope(scope: &str) -> Result<String, AppError> {
    let value = scope.trim();
    if value.is_empty() || value == "document" {
        return Ok("document".to_string());
    }
    Err(AppError::bad_request(format!(
        "unsupported reader ai scope: {value}"
    )))
}

fn ensure_markdown_ready(job: &JobSnapshot) -> Result<(), AppError> {
    if matches!(job.status, JobStatusKind::Succeeded) {
        return Ok(());
    }
    Err(AppError::conflict(format!(
        "job is not complete; markdown is not ready: {}",
        job.job_id
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CreateJobInput, JobSnapshot};

    #[test]
    fn rejects_running_job_before_markdown_chat() {
        let job = JobSnapshot::new(
            "job-running".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );

        let err = ensure_markdown_ready(&job).expect_err("running rejected");
        assert!(matches!(err, AppError::Conflict(_)));
    }

    #[test]
    fn accepts_only_document_scope() {
        assert_eq!(
            normalized_scope("document").expect("scope"),
            "document".to_string()
        );
        assert!(matches!(
            normalized_scope("selection").expect_err("unsupported"),
            AppError::BadRequest(_)
        ));
    }
}
