use std::collections::VecDeque;
use std::convert::Infallible;
use std::time::Duration;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Json;
use futures_util::stream::{self, Stream};

use crate::app::build_jobs_facade_from_state;
use crate::error::AppError;
use crate::models::api::{
    ApiResponse, LiveTranslationCommitEventView, LiveTranslationEventsQuery,
    LiveTranslationLayoutView, LiveTranslationPageView,
};
use crate::routes::common::{ok_json, ApiPath, ApiQuery};
use crate::AppState;

const EVENT_BATCH_LIMIT: u32 = 128;

pub async fn get_live_translation_layout(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<LiveTranslationLayoutView>>, AppError> {
    Ok(ok_json(
        build_jobs_facade_from_state(&state).live_translation_layout(&job_id)?,
    ))
}

pub async fn get_live_translation_page(
    State(state): State<AppState>,
    ApiPath((job_id, page_idx)): ApiPath<(String, u32)>,
) -> Result<Json<ApiResponse<LiveTranslationPageView>>, AppError> {
    Ok(ok_json(
        build_jobs_facade_from_state(&state).live_translation_page(&job_id, page_idx)?,
    ))
}

pub async fn get_live_translation_events(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<LiveTranslationEventsQuery>,
    headers: HeaderMap,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    let last_event_id = headers
        .get("last-event-id")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(0);
    let cursor = query.after_seq.max(last_event_id).max(0);
    let initial = build_jobs_facade_from_state(&state).live_translation_events_after(
        &job_id,
        cursor,
        EVENT_BATCH_LIMIT,
    )?;
    let stream = stream::unfold(
        LiveEventStreamState {
            app: state,
            job_id,
            cursor,
            pending: initial.into(),
        },
        next_live_event,
    );
    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
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
        match build_jobs_facade_from_state(&state.app).live_translation_events_after(
            &state.job_id,
            state.cursor,
            EVENT_BATCH_LIMIT,
        ) {
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
