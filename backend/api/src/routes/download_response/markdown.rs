use axum::http::{header, HeaderMap};
use axum::response::{IntoResponse, Response};

use crate::error::AppError;
use crate::models::api::{to_absolute_url, MarkdownQuery, MarkdownView};
use crate::routes::common::ok_json;
use crate::services::jobs::MarkdownDownload;

use super::files::jobs_facade_ref;
use crate::routes::common::{request_base_url, JobsRouteDeps};

pub async fn markdown_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: String,
    query: &MarkdownQuery,
) -> Result<Response, AppError> {
    let markdown = jobs_facade_ref(deps).markdown_document(job_id).await?;
    markdown_download_response(
        headers,
        markdown,
        query.raw,
        deps.default_port,
        &deps.bind_host,
    )
}

pub async fn markdown_document_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Response, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    let view = jobs_facade_ref(deps)
        .markdown_document_view(job_id, &base_url)
        .await?;
    Ok(ok_json(view).into_response())
}

fn markdown_download_response(
    headers: &HeaderMap,
    markdown: MarkdownDownload,
    raw: bool,
    default_port: u16,
    bind_host: &str,
) -> Result<Response, AppError> {
    if raw {
        return Ok((
            [(header::CONTENT_TYPE, "text/markdown; charset=utf-8")],
            markdown.content,
        )
            .into_response());
    }
    let base_url = request_base_url(headers, default_port, bind_host);
    let raw_path = format!("/api/v1/jobs/{}/markdown?raw=true", markdown.job_id);
    let images_base_path = format!("/api/v1/jobs/{}/markdown/images/", markdown.job_id);
    Ok(ok_json(MarkdownView {
        job_id: markdown.job_id,
        content: markdown.content,
        raw_path: raw_path.clone(),
        raw_url: to_absolute_url(&base_url, &raw_path),
        images_base_path: images_base_path.clone(),
        images_base_url: to_absolute_url(&base_url, &images_base_path),
    })
    .into_response())
}
