//! 图书馆数据层的最小 API:documents / 全文检索。
//!
//! All handlers go through library_api (PR2–PR4).

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::Value;

use crate::auth::Principal;
use crate::error::AppError;
use crate::models::api::{
    ApiResponse, JobFilesQuery, ApplyDocumentMetadataSuggestionInput, CreateDocumentMetadataSuggestionInput,
    DocumentDeleteResultView, DocumentJobListView, DocumentJobRequest, DocumentListView,
    DocumentMetadataSuggestionApplyView, DocumentMetadataSuggestionListView,
    DeleteDocumentQuery, DocumentMetadataSuggestionView, DocumentRecord, JobSubmissionView,
    ListDocumentJobsQuery, ListDocumentMetadataSuggestionsQuery, ListDocumentsQuery,
    PatchDocumentInput, SearchQuery, SearchResultView,
    DocumentReadingQuery, PatchTranslationVersionInput, SetCurrentTranslationVersionInput,
    TranslationVersionsQuery, TranslationVersionsView,
};
use crate::routes::common::{
    build_jobs_route_deps, build_library_route_deps, jobs_facade, ok_json, request_base_url,
    run_job_query_once, run_library_blocking, run_state_blocking, ApiJson, ApiPath, ApiQuery,
};
use crate::routes::download_response::file_download_response;
use crate::services::library::{
    apply_document_metadata_suggestion_view, create_document_metadata_suggestion_view,
    delete_document_view, document_delete_job_ids_view, document_files, document_reading,
    document_translation_coverage, document_translation_versions, patch_document_translation_version,
    set_document_translation_version,
    get_document, list_document_metadata_suggestions_view, list_documents, ocr_document_view,
    open_document_file, patch_document, search_blocks_view, translate_document_view, Disposition,
    DocumentFile, DocumentReadingView, TranslationCoverageView,
};
use crate::AppState;

// --- documents ---

pub async fn list_documents_route(
    State(state): State<AppState>,
    principal: Principal,
    headers: HeaderMap,
    ApiQuery(query): ApiQuery<ListDocumentsQuery>,
) -> Result<Json<ApiResponse<DocumentListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let owner = principal.owner_filter().map(str::to_string);
    Ok(ok_json(
        run_library_blocking(&state, move |library| {
            list_documents(library, &query, &base_url, owner.as_deref())
        })
        .await?,
    ))
}

pub async fn get_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
) -> Result<Json<ApiResponse<DocumentRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        run_library_blocking(&state, move |library| get_document(library, &document_id, &base_url)).await?,
    ))
}

/// GET /api/v1/documents/:id/reading —— 阅读器该打开哪个任务。
///
/// 一个任务就覆盖了整本：返回它。多次范围翻译（或单个只覆盖一部分的任务）：按需生成
/// 合并目录，返回它的虚拟任务 id。生成要跑子进程，放进阻塞线程。
pub async fn get_document_reading_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<DocumentReadingQuery>,
) -> Result<Json<ApiResponse<DocumentReadingView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(document_reading(&deps.library, &document_id, query.version).await?))
}

/// GET /api/v1/documents/:id/translation-versions —— 这本书的译文版本和当前版本（读输出 PDF 页数，放进阻塞线程）。
pub async fn list_document_translation_versions_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<TranslationVersionsQuery>,
) -> Result<Json<ApiResponse<TranslationVersionsView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(document_translation_versions(&deps.library, &document_id, query).await?))
}

/// PUT /api/v1/documents/:id/translation-version —— 切换当前版本；`version_id: null` 回到自动。
pub async fn set_document_translation_version_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(payload): ApiJson<SetCurrentTranslationVersionInput>,
) -> Result<Json<ApiResponse<TranslationVersionsView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(set_document_translation_version(&deps.library, &document_id, payload).await?))
}

/// PATCH /api/v1/documents/:id/translation-versions/:version_id —— 改名、隐藏或恢复一个版本。
pub async fn patch_document_translation_version_route(
    State(state): State<AppState>,
    ApiPath((document_id, version_id)): ApiPath<(String, String)>,
    ApiJson(payload): ApiJson<PatchTranslationVersionInput>,
) -> Result<Json<ApiResponse<TranslationVersionsView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(patch_document_translation_version(&deps.library, &document_id, &version_id, payload).await?))
}

/// GET /api/v1/documents/:id/translation-coverage —— 翻译覆盖和任务记录（书籍详情「进度」）。
///
/// 只计算合并计划、不生成合并目录；读每个输出 PDF 的页数，放进阻塞线程。
pub async fn get_document_translation_coverage_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
) -> Result<Json<ApiResponse<TranslationCoverageView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(document_translation_coverage(&deps.library, &document_id).await?))
}

async fn document_file(
    state: &AppState,
    headers: &HeaderMap,
    document_id: &str,
    file: DocumentFile,
    disposition: Disposition,
) -> Result<Response, AppError> {
    let deps = build_library_route_deps(state);
    let download =
        open_document_file(&deps.library, &state.download_generation, document_id, file, disposition)
            .await?;
    file_download_response(download, headers).await
}

/// GET /api/v1/documents/:id/files —— 书本身有哪些文件（原文、封面、缩略图、原文页预览）。
pub async fn list_document_files_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
) -> Result<Response, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view =
        run_library_blocking(&state, move |library| document_files(library, &document_id, &base_url)).await?;
    Ok(ok_json(view).into_response())
}

/// GET /api/v1/documents/:id/files/:name —— 默认在浏览器里打开，`?download=1` 直接下载。
pub async fn document_file_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath((document_id, name)): ApiPath<(String, String)>,
    ApiQuery(query): ApiQuery<JobFilesQuery>,
) -> Result<Response, AppError> {
    let disposition = if query.wants_download() { Disposition::Attachment } else { Disposition::Inline };
    document_file(&state, &headers, &document_id, DocumentFile::named(&name)?, disposition).await
}

/// GET /api/v1/documents/:id/files/pages/:page —— 原文那一页的预览图（`3.jpg`）。
pub async fn document_page_file_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath((document_id, page)): ApiPath<(String, String)>,
    ApiQuery(query): ApiQuery<JobFilesQuery>,
) -> Result<Response, AppError> {
    let file = DocumentFile::page(&page, &query)?;
    document_file(&state, &headers, &document_id, file, Disposition::Inline).await
}

pub async fn patch_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(payload): ApiJson<PatchDocumentInput>,
) -> Result<Json<ApiResponse<DocumentRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        run_library_blocking(&state, move |library| {
            patch_document(library, &document_id, &payload, &base_url)
        })
        .await?,
    ))
}

/// 读原文 PDF、规范化文档的那段在阻塞线程里跑（前端每个 OCR / 翻译任务成功后都会调一次）。
pub async fn create_document_metadata_suggestion_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(input): ApiJson<CreateDocumentMetadataSuggestionInput>,
) -> Result<Json<ApiResponse<DocumentMetadataSuggestionView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(
        create_document_metadata_suggestion_view(&deps.library, &document_id, &input).await?,
    ))
}

pub async fn list_document_metadata_suggestions_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListDocumentMetadataSuggestionsQuery>,
) -> Result<Json<ApiResponse<DocumentMetadataSuggestionListView>>, AppError> {
    run_state_blocking(&state, "document metadata suggestions", move |state| {
        let deps = build_library_route_deps(state);
        Ok(ok_json(list_document_metadata_suggestions_view(
            &deps.library,
            &document_id,
            &query,
        )?))
    })
    .await
}

pub async fn apply_document_metadata_suggestion_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath((document_id, suggestion_id)): ApiPath<(String, String)>,
    ApiJson(input): ApiJson<ApplyDocumentMetadataSuggestionInput>,
) -> Result<Json<ApiResponse<DocumentMetadataSuggestionApplyView>>, AppError> {
    run_state_blocking(&state, "document metadata suggestion", move |state| {
        let deps = build_library_route_deps(state);
        let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
        Ok(ok_json(apply_document_metadata_suggestion_view(
            &deps.library,
            &document_id,
            &suggestion_id,
            &input,
            &base_url,
        )?))
    })
    .await
}

/// DELETE /api/v1/documents/:id —— 彻底删除文档(行 + jobs + uploads + 文件)。
/// 运行中 job 需 ?force=true;不认识的查询参数 400(拼错的 force 不会当成不强删)。
pub async fn delete_document_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<DeleteDocumentQuery>,
) -> Result<Json<ApiResponse<DocumentDeleteResultView>>, AppError> {
    if query.force {
        // 强删文档：名下运行中的任务先走取消的同一条路径（登记取消 + 终止 worker），再删。
        let id = document_id.clone();
        let job_ids =
            run_library_blocking(&state, move |library| document_delete_job_ids_view(library, &id)).await?;
        jobs_facade(build_jobs_route_deps(&state))
            .cancel_before_delete(&job_ids)
            .await;
    }
    // 删库行、删任务目录都是同步活（几百 MB 的书要好几秒），放进阻塞线程。
    let force = query.force;
    Ok(ok_json(
        run_library_blocking(&state, move |library| delete_document_view(library, &document_id, force))
            .await?,
    ))
}

// --- translate ---

/// POST /api/v1/documents/:id/translate
/// 复用馆藏文档已存的源 PDF 发起 book 翻译流水线，完成后 lifecycle 会回填 active_job_id。
/// 请求体和 `POST /jobs` 一样先收成 JSON 再解析（同样的 `invalid job payload: …` 提示）。
pub async fn translate_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(payload): ApiJson<Value>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let request = DocumentJobRequest::from_api_value(payload)?;
    run_state_blocking(&state, "document translation", move |state| {
        let deps = build_library_route_deps(state);
        let jobs = build_jobs_route_deps(state).jobs;
        let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
        Ok(ok_json(translate_document_view(
            &deps.library,
            &jobs,
            &document_id,
            request,
            &base_url,
        )?))
    })
    .await
}

/// POST /api/v1/documents/:id/ocr
/// Reuse the document's stored source PDF and create an OCR-only job.
/// 要分清客户端写没写 `workflow`，所以先收成 JSON。
pub async fn ocr_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(payload): ApiJson<Value>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let request = DocumentJobRequest::from_api_value(payload)?;
    let deps = build_library_route_deps(&state);
    let jobs = build_jobs_route_deps(&state).jobs;
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        ocr_document_view(&deps.library, &jobs, &document_id, request, &base_url).await?,
    ))
}

/// GET /api/v1/documents/:id/jobs
/// Return all OCR/translation runs associated with the document, newest first.
pub async fn list_document_jobs_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListDocumentJobsQuery>,
) -> Result<Json<ApiResponse<DocumentJobListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query_once(
        &state,
        format!("documents:jobs:{document_id}"),
        move |jobs| jobs.document_jobs_view(&base_url, &document_id, &query),
    )
    .await?;
    Ok(ok_json(view))
}

// --- search ---

pub async fn search_blocks_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiQuery(query): ApiQuery<SearchQuery>,
) -> Result<Json<ApiResponse<SearchResultView>>, AppError> {
    let owner = principal.owner_filter().map(str::to_string);
    Ok(ok_json(
        run_library_blocking(&state, move |library| {
            search_blocks_view(library, &query, owner.as_deref())
        })
        .await?,
    ))
}
