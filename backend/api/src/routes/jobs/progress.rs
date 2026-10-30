//! 进度：跑到哪了（`/jobs/:id/progress/…`）。事件列表、实时推送，边翻边看的版面和单页。

use std::collections::VecDeque;
use std::convert::Infallible;
use std::time::Duration;

use axum::extract::State;
use axum::http::{HeaderMap, HeaderName, HeaderValue};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::Json;
use futures_util::stream;

use crate::app::build_jobs_facade_from_state;
use crate::error::AppError;
use crate::models::api::{
    ApiResponse, EditorialEventListView, EditorialEventsQuery, JobEventListView, ListJobEventsQuery, LiveTranslationCommitEventView,
    LiveTranslationEventsQuery, LiveTranslationLayoutView, LiveTranslationPageView,
};
use crate::routes::common::{
    build_jobs_query_route_deps, ok_json, run_job_query, run_job_query_once, run_state_blocking,
    ApiPath, ApiQuery,
};
use crate::AppState;

const EVENT_BATCH_LIMIT: u32 = 128;

pub async fn get_job_events(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    let key = format!(
        "events:all:{job_id}:{:?}:{}:{:?}",
        query.start, query.limit, query.cursor
    );
    Ok(ok_json(
        run_job_query(&state, key, move |jobs| {
            jobs.job_events_view(&job_id, &query)
        })
        .await?,
    ))
}

pub async fn get_live_translation_layout(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<LiveTranslationLayoutView>>, AppError> {
    run_state_blocking(&state, "live translation layout", move |state| {
        Ok(ok_json(
            build_jobs_facade_from_state(state).live_translation_layout(&job_id)?,
        ))
    })
    .await
}

pub async fn get_live_translation_page(
    State(state): State<AppState>,
    ApiPath((job_id, page_idx)): ApiPath<(String, u32)>,
) -> Result<Json<ApiResponse<LiveTranslationPageView>>, AppError> {
    run_state_blocking(&state, "live translation page", move |state| {
        Ok(ok_json(
            build_jobs_facade_from_state(state).live_translation_page(&job_id, page_idx)?,
        ))
    })
    .await
}

pub async fn get_editorial_events(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<EditorialEventsQuery>,
) -> Result<Json<ApiResponse<EditorialEventListView>>, AppError> {
    let key = format!("jobs:editorial:{job_id}:{}:{:?}", query.after, query.limit);
    Ok(ok_json(
        run_job_query_once(&state, key, move |jobs| jobs.editorial_events(&job_id, &query)).await?,
    ))
}

pub async fn get_live_translation_events(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<LiveTranslationEventsQuery>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, AppError> {
    let last_event_id = headers
        .get("last-event-id")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(0);
    let cursor = query.after_seq.max(last_event_id).max(0);
    let initial = read_commit_events(&state, &job_id, cursor).await?;
    let stream = stream::unfold(
        LiveEventStreamState {
            app: state,
            job_id,
            cursor,
            pending: initial.into(),
        },
        next_live_event,
    );
    let sse = Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    );
    // 告诉 nginx 这类反向代理不要缓冲：15 秒一次的保活和新译文要马上到浏览器，不能攒着。
    // 带在响应里，就不依赖代理配置给这个地址单独关缓冲。
    Ok((
        [(HeaderName::from_static("x-accel-buffering"), HeaderValue::from_static("no"))],
        sse,
    ))
}

struct LiveEventStreamState {
    app: AppState,
    job_id: String,
    cursor: i64,
    pending: VecDeque<LiveTranslationCommitEventView>,
}

async fn next_live_event(
    mut state: LiveEventStreamState,
) -> Option<(Result<Event, Infallible>, LiveEventStreamState)> {
    loop {
        if let Some(view) = state.pending.pop_front() {
            state.cursor = view.seq;
            let event = Event::default()
                .id(view.seq.to_string())
                .event(view.event)
                .json_data(&view)
                .expect("live translation event is serializable");
            return Some((Ok(event), state));
        }
        match read_commit_events(&state.app, &state.job_id, state.cursor).await {
            Ok(events) if events.is_empty() => {
                tokio::time::sleep(Duration::from_millis(750)).await;
            }
            Ok(events) => state.pending.extend(events),
            Err(error) => {
                tracing::warn!(
                    job_id = %state.job_id,
                    error = %error,
                    "closing live translation event stream after backend query failure"
                );
                return None;
            }
        }
    }
}

/// 边翻边看的流每 750ms 查一次新提交的页。不走 `run_job_query` 的有界执行器：那里只有 2 个槽、所有普通读请求共用，
/// 开着几个边翻边看的页签时任务列表、详情要排在这些轮询后面（服务端工程审查 M8）。轮询放进阻塞线程池，各查各的。
async fn read_commit_events(
    state: &AppState,
    job_id: &str,
    after: i64,
) -> Result<Vec<LiveTranslationCommitEventView>, AppError> {
    let job_id = job_id.to_owned();
    run_state_blocking(state, "live translation events", move |state| {
        build_jobs_query_route_deps(state)
            .jobs
            .live_translation_events_after(&job_id, after, EVENT_BATCH_LIMIT)
    })
    .await
}
