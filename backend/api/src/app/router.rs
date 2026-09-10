use axum::middleware;
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::app::AppState;
use crate::auth;
use crate::routes::common::{method_not_allowed, unknown_route};

mod ai;
mod collections;
mod credentials;
mod documents;
mod fonts;
mod glossaries;
mod ingestion;
mod internal_agent;
mod jobs;
mod library;
mod providers;
mod public;
mod simple;

pub fn build_app(state: AppState) -> Router {
    public::routes()
        .merge(authenticated_api_routes(&state))
        .merge(crate::routes::model_requests::worker_routes())
        .fallback(unknown_route)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub fn build_simple_app(state: AppState) -> Router {
    public::routes()
        .merge(authenticated_simple_routes(&state))
        .fallback(unknown_route)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

fn authenticated_api_routes(state: &AppState) -> Router<AppState> {
    Router::new()
        .merge(credentials::routes())
        .merge(ingestion::routes())
        .merge(glossaries::routes())
        .merge(documents::routes())
        .merge(ai::routes())
        .merge(collections::routes())
        .merge(internal_agent::routes())
        .merge(library::routes())
        .merge(jobs::routes())
        .merge(providers::routes())
        .merge(fonts::routes())
        .merge(crate::routes::model_requests::launcher_routes())
        .method_not_allowed_fallback(method_not_allowed)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ))
}

fn authenticated_simple_routes(state: &AppState) -> Router<AppState> {
    simple::routes()
        .method_not_allowed_fallback(method_not_allowed)
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ))
}
