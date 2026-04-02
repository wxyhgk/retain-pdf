use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::extract::{Multipart, Path as AxumPath, Query, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use tokio_util::io::ReaderStream;
use walkdir::WalkDir;
use zip::write::FileOptions;

use crate::error::AppError;
use crate::job_events::persist_job;
use crate::job_runner::{
    attach_job_paths, build_command, build_job_paths, build_ocr_command, request_cancel, spawn_job,
    terminate_job_process_tree,
};
use crate::models::{
    build_artifact_links, build_job_actions, build_job_links, build_job_links_with_workflow,
    job_to_detail, job_to_list_item, job_uses_legacy_output_layout, job_uses_legacy_path_storage,
    resolve_markdown_images_dir, resolve_markdown_path, resolve_normalization_report,
    resolve_normalized_document, resolve_output_pdf, to_absolute_url, ApiResponse,
    ArtifactLinksData, CreateJobRequest, CreateJobResponseData, JobEventListResponseData,
    JobListResponseData, JobStatusKind, ListJobEventsQuery, ListJobsQuery, MarkdownQuery,
    MarkdownResponseData, StoredJob, LEGACY_JOB_UNSUPPORTED_MESSAGE,
};
use crate::ocr_provider::require_supported_provider;
use crate::routes::uploads::store_upload;
use crate::AppState;

const SYNC_BUNDLE_WAIT_INTERVAL_MS: u64 = 1500;
const MINERU_MAX_BYTES: u64 = 200 * 1024 * 1024;
const MINERU_MAX_PAGES: u32 = 600;

pub async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateJobRequest>,
) -> Result<Json<ApiResponse<CreateJobResponseData>>, AppError> {
    if request.upload_id.trim().is_empty() {
        return Err(AppError::bad_request("upload_id is required"));
    }
    validate_provider_credentials(&request)?;
    let upload = state
        .db
        .get_upload(&request.upload_id)
        .map_err(|_| AppError::not_found(format!("upload not found: {}", request.upload_id)))?;
    validate_mineru_upload_limits(&request, &upload)?;
    let job_id = request.resolved_job_id();
    let job_paths = build_job_paths(&state, &job_id)?;
    let upload_path = PathBuf::from(&upload.stored_path);
    if !upload_path.exists() {
        return Err(AppError::not_found(format!(
            "uploaded file missing: {}",
            upload.stored_path
        )));
    }
    let command = build_command(&state, &upload_path, &request, &job_paths);
    let mut job = StoredJob::new(job_id.clone(), request.clone(), command);
    attach_job_paths(&mut job, &job_paths);
    persist_job(&state, &job)?;
    spawn_job(state.clone(), job_id.clone());
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(CreateJobResponseData {
        job_id,
        status: JobStatusKind::Queued,
        workflow: request.workflow,
        links: build_job_links(&job.job_id, &base_url),
        actions: build_job_actions(&job, &base_url, false, false, false),
    })))
}

pub async fn create_ocr_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<CreateJobResponseData>>, AppError> {
    let parsed = parse_ocr_job_multipart(&mut multipart).await?;
    validate_ocr_provider_request(&parsed.request)?;

    let upload = match (parsed.filename, parsed.file_bytes) {
        (Some(filename), Some(bytes)) => {
            let upload = store_upload(&state, filename, bytes, parsed.developer_mode).await?;
            state.db.save_upload(&upload)?;
            Some(upload)
        }
        (None, None) => None,
        _ => return Err(AppError::bad_request("file upload is incomplete")),
    };

    if upload.is_none() && parsed.request.source_url.trim().is_empty() {
        return Err(AppError::bad_request(
            "either file or source_url is required",
        ));
    }

    let mut request = parsed.request;
    request.workflow = crate::models::WorkflowKind::Ocr;
    if let Some(upload) = upload.as_ref() {
        request.upload_id = upload.upload_id.clone();
        validate_mineru_upload_limits(&request, upload)?;
    }
    let job_id = request.resolved_job_id();
    let trace_id = build_trace_id(&job_id);
    let job_paths = build_job_paths(&state, &job_id)?;
    let upload_path = upload.as_ref().map(|item| PathBuf::from(&item.stored_path));
    let command = build_ocr_command(&state, upload_path.as_deref(), &request, &job_paths);
    let mut job = StoredJob::new(job_id.clone(), request, command);
    attach_job_paths(&mut job, &job_paths);
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.trace_id = Some(trace_id);
        artifacts.schema_version = Some("document.v1".to_string());
    }
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("OCR 任务已创建，等待可用执行槽位".to_string());
    persist_job(&state, &job)?;
    spawn_job(state.clone(), job_id.clone());
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(CreateJobResponseData {
        job_id,
        status: JobStatusKind::Queued,
        workflow: crate::models::WorkflowKind::Ocr,
        links: build_job_links_with_workflow(&job.job_id, &job.workflow, &base_url),
        actions: build_job_actions(&job, &base_url, false, false, false),
    })))
}

pub async fn translate_bundle(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Response, AppError> {
    let parsed = parse_translate_bundle_multipart(&mut multipart).await?;
    validate_provider_credentials(&parsed.request)?;
    let upload = store_upload(
        &state,
        parsed.filename,
        parsed.file_bytes,
        parsed.developer_mode,
    )
    .await?;
    state.db.save_upload(&upload)?;

    let mut request = parsed.request;
    request.upload_id = upload.upload_id.clone();
    validate_mineru_upload_limits(&request, &upload)?;
    let job = start_job_for_upload(&state, &upload, &request)?;
    let finished_job = wait_for_terminal_job(&state, &job.job_id, request.poll_timeout).await?;

    let _guard = state.downloads_lock.lock().await;
    let zip_path = state
        .config
        .downloads_dir
        .join(format!("{}.zip", finished_job.job_id));
    let pdf_path = resolve_output_pdf(&finished_job, &state.config.data_root);
    let markdown_path = resolve_markdown_path(&finished_job, &state.config.data_root);
    let markdown_images_dir = resolve_markdown_images_dir(&finished_job, &state.config.data_root);
    build_zip(
        &zip_path,
        pdf_path.as_deref(),
        markdown_path.as_deref(),
        markdown_images_dir.as_deref(),
    )?;
    persist_bundle_copy(&finished_job, &zip_path, &state.config.data_root)?;
    let mut response = stream_file(
        zip_path,
        "application/zip",
        Some(format!("{}.zip", finished_job.job_id)),
    )
    .await?;
    attach_job_id_header(&mut response, &finished_job.job_id)?;
    Ok(response)
}

pub async fn list_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListResponseData>>, AppError> {
    let jobs = state.db.list_jobs(
        query.limit,
        query.offset,
        query.status.as_ref(),
        query.workflow.as_ref(),
    )?;
    let jobs: Vec<_> = jobs
        .into_iter()
        .filter(|job| {
            query
                .provider
                .as_deref()
                .map(|provider| {
                    job.artifacts
                        .as_ref()
                        .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
                        .map(|diag| {
                            format!("{:?}", diag.provider).to_ascii_lowercase()
                                == provider.to_ascii_lowercase()
                        })
                        .unwrap_or(false)
                })
                .unwrap_or(true)
        })
        .collect();
    let base_url = request_base_url(&headers, &state);
    let items = jobs
        .iter()
        .map(|job| job_to_list_item(job, &base_url))
        .collect();
    Ok(Json(ApiResponse::ok(JobListResponseData { items })))
}

pub async fn list_ocr_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(mut query): Query<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListResponseData>>, AppError> {
    query.workflow = Some(crate::models::WorkflowKind::Ocr);
    list_jobs(State(state), headers, Query(query)).await
}

pub async fn get_ocr_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<crate::models::JobDetailData>>, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    if !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    ensure_supported_job_layout(&state, &job)?;
    let (pdf_ready, markdown_ready, bundle_ready) = readiness(&job, &state.config.data_root);
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(job_to_detail(
        &job,
        &base_url,
        &state.config.data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    ))))
}

pub async fn get_ocr_job_events(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    Query(query): Query<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListResponseData>>, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    if !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    let limit = query.limit.clamp(1, 500);
    let items = state.db.list_job_events(&job_id, limit, query.offset)?;
    Ok(Json(ApiResponse::ok(JobEventListResponseData {
        items,
        limit,
        offset: query.offset,
    })))
}

pub async fn get_ocr_job_artifacts(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksData>>, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    if !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    ensure_supported_job_layout(&state, &job)?;
    let (pdf_ready, markdown_ready, bundle_ready) = readiness(&job, &state.config.data_root);
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(build_artifact_links(
        &job,
        &base_url,
        &state.config.data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    ))))
}

pub async fn cancel_ocr_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<CreateJobResponseData>>, AppError> {
    let mut job = load_job_or_404(&state, &job_id)?;
    if !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "job is not cancelable in status {:?}",
            job.status
        )));
    }
    request_cancel(&state, &job_id).await;
    if !matches!(job.stage.as_deref(), Some("normalizing")) {
        if let Some(pid) = job.pid {
            terminate_job_process_tree(pid).await.map_err(|e| {
                AppError::internal(format!("failed to terminate job process tree: {e}"))
            })?;
        }
    }
    if matches!(job.stage.as_deref(), Some("queued")) {
        job.status = JobStatusKind::Canceled;
        job.stage = Some("canceled".to_string());
        job.stage_detail = Some("OCR 任务已取消".to_string());
        job.updated_at = crate::models::now_iso();
        job.finished_at = Some(crate::models::now_iso());
        job.pid = None;
        persist_job(&state, &job)?;
    }
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(CreateJobResponseData {
        job_id,
        status: if matches!(job.status, JobStatusKind::Canceled) {
            JobStatusKind::Canceled
        } else {
            job.status.clone()
        },
        workflow: job.workflow.clone(),
        links: build_job_links(&job.job_id, &base_url),
        actions: build_job_actions(&job, &base_url, false, false, false),
    })))
}

pub async fn get_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<crate::models::JobDetailData>>, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    ensure_supported_job_layout(&state, &job)?;
    let (pdf_ready, markdown_ready, bundle_ready) = readiness(&job, &state.config.data_root);
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(job_to_detail(
        &job,
        &base_url,
        &state.config.data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    ))))
}

pub async fn get_job_events(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    Query(query): Query<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListResponseData>>, AppError> {
    let _job = load_job_or_404(&state, &job_id)?;
    let limit = query.limit.clamp(1, 500);
    let items = state.db.list_job_events(&job_id, limit, query.offset)?;
    Ok(Json(ApiResponse::ok(JobEventListResponseData {
        items,
        limit,
        offset: query.offset,
    })))
}

pub async fn get_job_artifacts(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksData>>, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    ensure_supported_job_layout(&state, &job)?;
    let (pdf_ready, markdown_ready, bundle_ready) = readiness(&job, &state.config.data_root);
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(build_artifact_links(
        &job,
        &base_url,
        &state.config.data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    ))))
}

pub async fn download_pdf(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    ensure_supported_job_layout(&state, &job)?;
    let pdf_path = resolve_output_pdf(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("pdf not ready: {job_id}")))?;
    stream_file(pdf_path, "application/pdf", None).await
}

pub async fn download_normalized_document(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    ensure_supported_job_layout(&state, &job)?;
    let path = resolve_normalized_document(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("normalized document not ready: {job_id}")))?;
    stream_file(path, "application/json", None).await
}

pub async fn download_ocr_normalized_document(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    if !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    ensure_supported_job_layout(&state, &job)?;
    let path = resolve_normalized_document(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("normalized document not ready: {job_id}")))?;
    stream_file(path, "application/json", None).await
}

pub async fn download_normalization_report(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    ensure_supported_job_layout(&state, &job)?;
    let path = resolve_normalization_report(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("normalization report not ready: {job_id}")))?;
    stream_file(path, "application/json", None).await
}

pub async fn download_ocr_normalization_report(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    if !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    ensure_supported_job_layout(&state, &job)?;
    let path = resolve_normalization_report(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("normalization report not ready: {job_id}")))?;
    stream_file(path, "application/json", None).await
}

pub async fn download_markdown(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
    Query(query): Query<MarkdownQuery>,
) -> Result<Response, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    ensure_supported_job_layout(&state, &job)?;
    let markdown_path = resolve_markdown_path(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {job_id}")))?;
    let content = tokio::fs::read_to_string(&markdown_path).await?;
    if query.raw {
        return Ok((
            [(header::CONTENT_TYPE, "text/markdown; charset=utf-8")],
            content,
        )
            .into_response());
    }
    let base_url = request_base_url(&headers, &state);
    let raw_path = format!("/api/v1/jobs/{}/markdown?raw=true", job.job_id);
    let images_base_path = format!("/api/v1/jobs/{}/markdown/images/", job.job_id);
    Ok(Json(ApiResponse::ok(MarkdownResponseData {
        job_id,
        content,
        raw_path: raw_path.clone(),
        raw_url: to_absolute_url(&base_url, &raw_path),
        images_base_path: images_base_path.clone(),
        images_base_url: to_absolute_url(&base_url, &images_base_path),
    }))
    .into_response())
}

pub async fn download_markdown_image(
    State(state): State<AppState>,
    AxumPath((job_id, path)): AxumPath<(String, String)>,
) -> Result<Response, AppError> {
    let job = load_job_or_404(&state, &job_id)?;
    ensure_supported_job_layout(&state, &job)?;
    let images_dir = resolve_markdown_images_dir(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown images not found: {job_id}")))?;
    let file_path = images_dir.join(&path);
    if !file_path.exists() || !file_path.is_file() {
        return Err(AppError::not_found(format!(
            "markdown image not found: {path}"
        )));
    }
    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
    stream_file(file_path, mime.as_ref(), None).await
}

pub async fn download_bundle(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let _guard = state.downloads_lock.lock().await;
    let job = load_job_or_404(&state, &job_id)?;
    ensure_supported_job_layout(&state, &job)?;
    if !matches!(job.status, JobStatusKind::Succeeded) {
        return Err(AppError::conflict("job is not finished successfully"));
    }
    let zip_path = state.config.downloads_dir.join(format!("{job_id}.zip"));
    let pdf_path = resolve_output_pdf(&job, &state.config.data_root);
    let markdown_path = resolve_markdown_path(&job, &state.config.data_root);
    let markdown_images_dir = resolve_markdown_images_dir(&job, &state.config.data_root);
    build_zip(
        &zip_path,
        pdf_path.as_deref(),
        markdown_path.as_deref(),
        markdown_images_dir.as_deref(),
    )?;
    persist_bundle_copy(&job, &zip_path, &state.config.data_root)?;
    let mut response =
        stream_file(zip_path, "application/zip", Some(format!("{job_id}.zip"))).await?;
    attach_job_id_header(&mut response, &job_id)?;
    Ok(response)
}

pub async fn cancel_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<CreateJobResponseData>>, AppError> {
    let mut job = load_job_or_404(&state, &job_id)?;
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "job is not cancelable in status {:?}",
            job.status
        )));
    }
    request_cancel(&state, &job_id).await;
    if let Some(pid) = job.pid {
        terminate_job_process_tree(pid).await.map_err(|e| {
            AppError::internal(format!("failed to terminate job process tree: {e}"))
        })?;
    }
    job.status = JobStatusKind::Canceled;
    job.stage = Some("canceled".to_string());
    job.stage_detail = Some("任务已取消".to_string());
    job.updated_at = crate::models::now_iso();
    job.finished_at = Some(crate::models::now_iso());
    job.pid = None;
    persist_job(&state, &job)?;
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(CreateJobResponseData {
        job_id,
        status: JobStatusKind::Canceled,
        workflow: job.workflow.clone(),
        links: build_job_links(&job.job_id, &base_url),
        actions: build_job_actions(&job, &base_url, false, false, false),
    })))
}

fn load_job_or_404(state: &AppState, job_id: &str) -> Result<StoredJob, AppError> {
    state
        .db
        .get_job(job_id)
        .map_err(|_| AppError::not_found(format!("job not found: {job_id}")))
}

fn ensure_supported_job_layout(state: &AppState, job: &StoredJob) -> Result<(), AppError> {
    if job_uses_legacy_output_layout(job, &state.config.data_root)
        || job_uses_legacy_path_storage(job)
    {
        return Err(AppError::conflict(LEGACY_JOB_UNSUPPORTED_MESSAGE));
    }
    Ok(())
}

fn start_job_for_upload(
    state: &AppState,
    upload: &crate::models::UploadRecord,
    request: &CreateJobRequest,
) -> Result<StoredJob, AppError> {
    let request = request.clone();
    let job_id = request.resolved_job_id();
    let job_paths = build_job_paths(state, &job_id)?;
    let upload_path = PathBuf::from(&upload.stored_path);
    if !upload_path.exists() {
        return Err(AppError::not_found(format!(
            "uploaded file missing: {}",
            upload.stored_path
        )));
    }
    let command = build_command(state, &upload_path, &request, &job_paths);
    let mut job = StoredJob::new(job_id.clone(), request, command);
    attach_job_paths(&mut job, &job_paths);
    persist_job(state, &job)?;
    spawn_job(state.clone(), job_id);
    Ok(job)
}

fn validate_provider_credentials(request: &CreateJobRequest) -> Result<(), AppError> {
    match request.ocr_provider.trim().to_ascii_lowercase().as_str() {
        "paddle" => {
            let paddle_token = request.paddle_token.trim();
            if paddle_token.is_empty() {
                return Err(AppError::bad_request("paddle_token is required"));
            }
            if looks_like_url(paddle_token) {
                return Err(AppError::bad_request(
                    "paddle_token looks like a URL, not a Paddle API key; check whether frontend fields were mixed up",
                ));
            }
        }
        _ => {
            let mineru_token = request.mineru_token.trim();
            if mineru_token.is_empty() {
                return Err(AppError::bad_request("mineru_token is required"));
            }
            if looks_like_url(mineru_token) {
                return Err(AppError::bad_request(
                    "mineru_token looks like a URL, not a MinerU API key; check whether frontend fields were mixed up",
                ));
            }
        }
    }

    let base_url = request.base_url.trim();
    if base_url.is_empty() {
        return Err(AppError::bad_request("base_url is required"));
    }
    if !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
        return Err(AppError::bad_request(
            "base_url must start with http:// or https://",
        ));
    }

    let api_key = request.api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }
    if looks_like_url(api_key) {
        return Err(AppError::bad_request(
            "api_key looks like a URL, not a model API key; check whether frontend fields were mixed up",
        ));
    }
    if request.model.trim().is_empty() {
        return Err(AppError::bad_request("model is required"));
    }
    Ok(())
}

fn request_uses_mineru(request: &CreateJobRequest) -> bool {
    matches!(request.workflow, crate::models::WorkflowKind::Mineru)
        || request.ocr_provider.trim().eq_ignore_ascii_case("mineru")
}

fn validate_mineru_upload_limits(
    request: &CreateJobRequest,
    upload: &crate::models::UploadRecord,
) -> Result<(), AppError> {
    if !request_uses_mineru(request) {
        return Ok(());
    }
    if upload.bytes >= MINERU_MAX_BYTES {
        return Err(AppError::bad_request(format!(
            "MinerU API 限制：PDF 文件大小必须小于 200MB；当前文件为 {:.2}MB",
            upload.bytes as f64 / 1024.0 / 1024.0
        )));
    }
    if upload.page_count > MINERU_MAX_PAGES {
        return Err(AppError::bad_request(format!(
            "MinerU API 限制：PDF 页数必须不超过 600 页；当前文件为 {} 页",
            upload.page_count
        )));
    }
    Ok(())
}

fn looks_like_url(value: &str) -> bool {
    let value = value.trim().to_ascii_lowercase();
    value.starts_with("http://") || value.starts_with("https://")
}

async fn wait_for_terminal_job(
    state: &AppState,
    job_id: &str,
    timeout_seconds: i64,
) -> Result<StoredJob, AppError> {
    let timeout_seconds = if timeout_seconds > 0 {
        timeout_seconds as u64
    } else {
        1800
    };
    let started = Instant::now();
    loop {
        let job = load_job_or_404(state, job_id)?;
        match job.status {
            JobStatusKind::Succeeded => return Ok(job),
            JobStatusKind::Failed => {
                let detail = job
                    .error
                    .clone()
                    .or(job.stage_detail.clone())
                    .unwrap_or_else(|| "job failed".to_string());
                return Err(AppError::internal(format!("job failed: {detail}")));
            }
            JobStatusKind::Canceled => {
                let detail = job
                    .stage_detail
                    .clone()
                    .unwrap_or_else(|| "job was canceled".to_string());
                return Err(AppError::conflict(detail));
            }
            JobStatusKind::Queued | JobStatusKind::Running => {}
        }
        if started.elapsed() >= Duration::from_secs(timeout_seconds) {
            return Err(AppError::conflict(format!(
                "job did not finish within timeout: {}s (job_id={job_id})",
                timeout_seconds
            )));
        }
        tokio::time::sleep(Duration::from_millis(SYNC_BUNDLE_WAIT_INTERVAL_MS)).await;
    }
}

struct ParsedTranslateBundle {
    filename: String,
    file_bytes: Vec<u8>,
    developer_mode: bool,
    request: CreateJobRequest,
}

struct ParsedOcrJob {
    filename: Option<String>,
    file_bytes: Option<Vec<u8>>,
    developer_mode: bool,
    request: CreateJobRequest,
}

async fn parse_translate_bundle_multipart(
    multipart: &mut Multipart,
) -> Result<ParsedTranslateBundle, AppError> {
    let mut file_name: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut developer_mode = false;
    let mut request = CreateJobRequest::default();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().trim().to_string();
        if name.is_empty() {
            continue;
        }
        if name == "file" {
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.pdf".to_string());
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::bad_request(e.to_string()))?;
            file_name = Some(filename);
            file_bytes = Some(data.to_vec());
            continue;
        }

        let value = field
            .text()
            .await
            .map_err(|e| AppError::bad_request(e.to_string()))?;
        apply_multipart_request_field(&mut request, &mut developer_mode, &name, value.trim())?;
    }

    Ok(ParsedTranslateBundle {
        filename: file_name
            .ok_or_else(|| AppError::bad_request("missing multipart field: file"))?,
        file_bytes: file_bytes.ok_or_else(|| AppError::bad_request("empty upload"))?,
        developer_mode,
        request,
    })
}

async fn parse_ocr_job_multipart(multipart: &mut Multipart) -> Result<ParsedOcrJob, AppError> {
    let mut file_name: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut developer_mode = false;
    let mut request = CreateJobRequest::default();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().trim().to_string();
        if name.is_empty() {
            continue;
        }
        if name == "file" {
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.pdf".to_string());
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::bad_request(e.to_string()))?;
            file_name = Some(filename);
            file_bytes = Some(data.to_vec());
            continue;
        }
        let value = field
            .text()
            .await
            .map_err(|e| AppError::bad_request(e.to_string()))?;
        if name == "source_url" {
            request.source_url = value.trim().to_string();
            continue;
        }
        if name == "provider" {
            request.ocr_provider = value.trim().to_string();
            continue;
        }
        apply_multipart_request_field(&mut request, &mut developer_mode, &name, value.trim())?;
    }

    Ok(ParsedOcrJob {
        filename: file_name,
        file_bytes,
        developer_mode,
        request,
    })
}

fn apply_multipart_request_field(
    request: &mut CreateJobRequest,
    developer_mode: &mut bool,
    name: &str,
    value: &str,
) -> Result<(), AppError> {
    match name {
        "developer_mode" => *developer_mode = parse_bool_like(value),
        "workflow" => {}
        "upload_id" => request.upload_id = value.to_string(),
        "job_id" => request.job_id = value.to_string(),
        "mode" => request.mode = value.to_string(),
        "skip_title_translation" => request.skip_title_translation = parse_bool_like(value),
        "classify_batch_size" => request.classify_batch_size = parse_i64_like(name, value)?,
        "rule_profile_name" => request.rule_profile_name = value.to_string(),
        "custom_rules_text" => request.custom_rules_text = value.to_string(),
        "api_key" => request.api_key = value.to_string(),
        "model" => request.model = value.to_string(),
        "base_url" => request.base_url = value.to_string(),
        "render_mode" => request.render_mode = value.to_string(),
        "compile_workers" => request.compile_workers = parse_i64_like(name, value)?,
        "typst_font_family" => request.typst_font_family = value.to_string(),
        "pdf_compress_dpi" => request.pdf_compress_dpi = parse_i64_like(name, value)?,
        "start_page" => request.start_page = parse_i64_like(name, value)?,
        "end_page" => request.end_page = parse_i64_like(name, value)?,
        "batch_size" => request.batch_size = parse_i64_like(name, value)?,
        "workers" => request.workers = parse_i64_like(name, value)?,
        "translated_pdf_name" => request.translated_pdf_name = value.to_string(),
        "mineru_token" => request.mineru_token = value.to_string(),
        "model_version" => request.model_version = value.to_string(),
        "paddle_token" => request.paddle_token = value.to_string(),
        "paddle_api_url" => request.paddle_api_url = value.to_string(),
        "paddle_model" => request.paddle_model = value.to_string(),
        "is_ocr" => request.is_ocr = parse_bool_like(value),
        "disable_formula" => request.disable_formula = parse_bool_like(value),
        "disable_table" => request.disable_table = parse_bool_like(value),
        "language" => request.language = value.to_string(),
        "page_ranges" => request.page_ranges = value.to_string(),
        "data_id" => request.data_id = value.to_string(),
        "no_cache" => request.no_cache = parse_bool_like(value),
        "cache_tolerance" => request.cache_tolerance = parse_i64_like(name, value)?,
        "extra_formats" => request.extra_formats = value.to_string(),
        "poll_interval" => request.poll_interval = parse_i64_like(name, value)?,
        "poll_timeout" => request.poll_timeout = parse_i64_like(name, value)?,
        "timeout_seconds" => request.timeout_seconds = parse_i64_like(name, value)?,
        "body_font_size_factor" => request.body_font_size_factor = parse_f64_like(name, value)?,
        "body_leading_factor" => request.body_leading_factor = parse_f64_like(name, value)?,
        "inner_bbox_shrink_x" => request.inner_bbox_shrink_x = parse_f64_like(name, value)?,
        "inner_bbox_shrink_y" => request.inner_bbox_shrink_y = parse_f64_like(name, value)?,
        "inner_bbox_dense_shrink_x" => {
            request.inner_bbox_dense_shrink_x = parse_f64_like(name, value)?
        }
        "inner_bbox_dense_shrink_y" => {
            request.inner_bbox_dense_shrink_y = parse_f64_like(name, value)?
        }
        _ => {}
    }
    Ok(())
}

fn validate_ocr_provider_request(request: &CreateJobRequest) -> Result<(), AppError> {
    let provider = request.ocr_provider.trim();
    if provider.is_empty() {
        return Err(AppError::bad_request("provider is required"));
    }
    if let Err(err) = require_supported_provider(provider) {
        return Err(AppError::bad_request(err.to_string()));
    }
    match provider.to_ascii_lowercase().as_str() {
        "mineru" => {
            let mineru_token = request.mineru_token.trim();
            if mineru_token.is_empty() {
                return Err(AppError::bad_request("mineru_token is required"));
            }
            if looks_like_url(mineru_token) {
                return Err(AppError::bad_request(
                    "mineru_token looks like a URL, not a MinerU API key; check whether frontend fields were mixed up",
                ));
            }
        }
        "paddle" => {
            let paddle_token = request.paddle_token.trim();
            if paddle_token.is_empty() {
                return Err(AppError::bad_request("paddle_token is required"));
            }
            if looks_like_url(paddle_token) {
                return Err(AppError::bad_request(
                    "paddle_token looks like a URL, not a Paddle API key; check whether frontend fields were mixed up",
                ));
            }
        }
        _ => {}
    }
    if !request.source_url.trim().is_empty()
        && !(request.source_url.starts_with("http://")
            || request.source_url.starts_with("https://"))
    {
        return Err(AppError::bad_request(
            "source_url must start with http:// or https://",
        ));
    }
    if request.timeout_seconds <= 0 {
        return Err(AppError::bad_request(
            "timeout_seconds must be a positive integer",
        ));
    }
    Ok(())
}

fn build_trace_id(job_id: &str) -> String {
    format!("ocr-{job_id}")
}

fn parse_bool_like(value: &str) -> bool {
    matches!(
        value.trim(),
        "1" | "true" | "True" | "TRUE" | "yes" | "Yes" | "YES" | "on" | "ON"
    )
}

fn parse_i64_like(name: &str, value: &str) -> Result<i64, AppError> {
    value
        .parse::<i64>()
        .map_err(|_| AppError::bad_request(format!("{name} must be an integer")))
}

fn parse_f64_like(name: &str, value: &str) -> Result<f64, AppError> {
    value
        .parse::<f64>()
        .map_err(|_| AppError::bad_request(format!("{name} must be a number")))
}

fn readiness(job: &StoredJob, data_root: &Path) -> (bool, bool, bool) {
    let pdf_ready = resolve_output_pdf(job, data_root)
        .map(|p| p.exists())
        .unwrap_or(false);
    let markdown_ready = resolve_markdown_path(job, data_root)
        .map(|p| p.exists())
        .unwrap_or(false);
    let bundle_ready = matches!(job.status, JobStatusKind::Succeeded);
    (pdf_ready, markdown_ready, bundle_ready)
}

fn request_base_url(headers: &HeaderMap, state: &AppState) -> String {
    let scheme = forwarded_header(headers, "x-forwarded-proto")
        .or_else(|| forwarded_header(headers, "x-scheme"))
        .unwrap_or_else(|| "http".to_string());
    let mut host = forwarded_header(headers, "x-forwarded-host")
        .or_else(|| forwarded_header(headers, header::HOST.as_str()))
        .unwrap_or_else(|| format!("127.0.0.1:{}", state.config.port));
    let forwarded_port = forwarded_header(headers, "x-forwarded-port");
    if !host.contains(':') {
        if let Some(port) = forwarded_port.filter(|value| !value.is_empty()) {
            host = format!("{host}:{port}");
        }
    }
    format!("{scheme}://{host}")
}

fn forwarded_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string())
        .filter(|v| !v.is_empty())
}

fn build_zip(
    zip_path: &Path,
    pdf_path: Option<&Path>,
    markdown_path: Option<&Path>,
    markdown_images_dir: Option<&Path>,
) -> Result<(), AppError> {
    let file = std::fs::File::create(zip_path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    if let Some(pdf_path) = pdf_path {
        if pdf_path.exists() {
            add_file_to_zip(
                &mut zip,
                pdf_path,
                pdf_path.file_name().unwrap().to_string_lossy().as_ref(),
                options,
            )?;
        }
    }
    if let Some(markdown_path) = markdown_path {
        if markdown_path.exists() {
            add_file_to_zip(&mut zip, markdown_path, "markdown/full.md", options)?;
        }
    }
    if let Some(images_dir) = markdown_images_dir {
        if images_dir.exists() {
            for entry in WalkDir::new(images_dir).into_iter().filter_map(|e| e.ok()) {
                if !entry.file_type().is_file() {
                    continue;
                }
                let rel = entry
                    .path()
                    .strip_prefix(images_dir)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                add_file_to_zip(
                    &mut zip,
                    entry.path(),
                    &format!("markdown/images/{rel}"),
                    options,
                )?;
            }
        }
    }
    zip.finish()?;
    Ok(())
}

fn add_file_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    path: &Path,
    archive_name: &str,
    options: FileOptions,
) -> Result<(), AppError> {
    let bytes = std::fs::read(path)?;
    zip.start_file(archive_name, options)?;
    zip.write_all(&bytes)?;
    Ok(())
}

fn persist_bundle_copy(
    job: &StoredJob,
    zip_path: &Path,
    data_root: &Path,
) -> Result<Option<PathBuf>, AppError> {
    let Some(pdf_path) = resolve_output_pdf(job, data_root) else {
        return Ok(None);
    };
    let Some(translated_dir) = pdf_path.parent() else {
        return Ok(None);
    };
    std::fs::create_dir_all(translated_dir)?;
    let target_path = translated_dir.join(format!("{}.zip", job.job_id));
    if target_path != zip_path {
        std::fs::copy(zip_path, &target_path)?;
    }
    Ok(Some(target_path))
}

fn attach_job_id_header(response: &mut Response, job_id: &str) -> Result<(), AppError> {
    response.headers_mut().insert(
        "X-Job-Id",
        HeaderValue::from_str(job_id).map_err(|e| AppError::internal(e.to_string()))?,
    );
    Ok(())
}

async fn stream_file(
    path: PathBuf,
    content_type: &str,
    download_name: Option<String>,
) -> Result<Response, AppError> {
    if !path.exists() || !path.is_file() {
        return Err(AppError::not_found(format!(
            "file not found: {}",
            path.display()
        )));
    }
    let file = tokio::fs::File::open(&path).await?;
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);
    let mut response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .body(body)
        .map_err(|e| AppError::internal(e.to_string()))?;
    if let Some(name) = download_name {
        let value = format!("attachment; filename=\"{name}\"");
        response.headers_mut().insert(
            header::CONTENT_DISPOSITION,
            HeaderValue::from_str(&value).map_err(|e| AppError::internal(e.to_string()))?,
        );
    }
    Ok(response)
}
