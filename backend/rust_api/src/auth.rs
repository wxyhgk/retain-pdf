use axum::body::Body;
use axum::http::{Method, Request};
use axum::middleware::Next;
use axum::response::Response;

use crate::error::AppError;
use crate::AppState;

pub async fn require_api_key(
    axum::extract::State(state): axum::extract::State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    if request.method() == Method::OPTIONS {
        return Ok(next.run(request).await);
    }

    let is_valid = request
        .headers()
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|key| state.config.api_keys.contains(key))
        .unwrap_or(false);

    if !is_valid {
        return Err(AppError::unauthorized("missing or invalid X-API-Key"));
    }

    Ok(next.run(request).await)
}
