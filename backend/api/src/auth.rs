use axum::body::Body;
use axum::http::{Method, Request};
use axum::middleware::Next;
use axum::response::Response;

use crate::error::AppError;
use crate::routes::common::{build_auth_route_deps, AuthRouteDeps};
use crate::AppState;

fn has_valid_api_key(deps: AuthRouteDeps<'_>, request: &Request<Body>) -> bool {
    request
        .headers()
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|key| deps.api_keys.contains(key))
        .unwrap_or(false)
}

pub async fn require_api_key(
    axum::extract::State(state): axum::extract::State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    if request.method() == Method::OPTIONS {
        return Ok(next.run(request).await);
    }

    if has_valid_api_key(build_auth_route_deps(&state), &request) {
        return Ok(next.run(request).await);
    }

    let capability = request
        .headers()
        .get("x-retainpdf-agent-capability")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::unauthorized("missing or invalid X-API-Key"))?;
    let claims = state.agent_capabilities.authenticate_request(
        capability,
        request.method().as_str(),
        request.uri().path(),
    )?;
    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}
