//! 客户端（桌面版的后端）调的接口：邀请码激活设备、查额度、开单、结算、取消。都要设备令牌（激活除外）。

use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;

use crate::billing::Mode;
use crate::proxy::error;
use crate::store::{Activation, CloseOrder, Device, OpenOrder, MAX_ORDER_PAGES};
use crate::AppState;

fn internal(failure: anyhow::Error) -> Response {
    tracing::error!("relay store error: {failure:#}");
    error(StatusCode::INTERNAL_SERVER_ERROR, "relay_error", "relay internal error")
}

fn device(state: &AppState, headers: &HeaderMap) -> Result<Device, Response> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| error(StatusCode::UNAUTHORIZED, "authentication_error", "missing device token"))?;
    state
        .store
        .authenticate_device(token, Utc::now())
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::UNAUTHORIZED, "authentication_error", "invalid or revoked device token"))
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActivateInput {
    pub invite_code: String,
    #[serde(default)]
    pub device_name: String,
}

pub async fn activate(State(state): State<AppState>, Json(input): Json<ActivateInput>) -> Response {
    match state.store.activate(input.invite_code.trim(), &input.device_name, Utc::now()) {
        Ok(Activation::Activated { device_token }) => Json(json!({ "device_token": device_token })).into_response(),
        Ok(Activation::InvalidInvite) => error(StatusCode::UNAUTHORIZED, "invalid_invite", "invite code is invalid or disabled"),
        Ok(Activation::AlreadyBound) => {
            error(StatusCode::CONFLICT, "invite_already_bound", "this invite code is already bound to another device")
        }
        Err(failure) => internal(failure),
    }
}

pub async fn me(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let device = match device(&state, &headers) {
        Ok(device) => device,
        Err(response) => return response,
    };
    match state.store.me(&device.account_id, Utc::now()) {
        Ok(me) => Json(me).into_response(),
        Err(failure) => internal(failure),
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OpenOrderInput {
    pub mode: String,
    pub pages: i64,
    #[serde(default)]
    pub job_ref: String,
}

pub async fn open_order(State(state): State<AppState>, headers: HeaderMap, Json(input): Json<OpenOrderInput>) -> Response {
    let device = match device(&state, &headers) {
        Ok(device) => device,
        Err(response) => return response,
    };
    let Some(mode) = Mode::parse(input.mode.trim()) else {
        return error(StatusCode::BAD_REQUEST, "invalid_request_error", "mode must be classic or agent");
    };
    if !(1..=MAX_ORDER_PAGES).contains(&input.pages) {
        return error(StatusCode::BAD_REQUEST, "invalid_request_error", &format!("pages must be 1-{MAX_ORDER_PAGES}"));
    }
    let job_ref: String = input.job_ref.chars().filter(|c| !c.is_control()).take(120).collect();
    match state.store.open_order(&device, mode, input.pages, &job_ref, Utc::now()) {
        Ok(OpenOrder::Opened(opened)) => {
            let base = state.public_url.trim_end_matches('/');
            let translation = match opened.protocol.as_str() {
                "anthropic" => format!("{base}/relay/anthropic/v1"),
                _ => format!("{base}/relay/openai/v1"),
            };
            let mut body = serde_json::to_value(&opened).unwrap_or_default();
            body["endpoints"] = json!({
                "translation": { "protocol": opened.protocol, "base_url": translation },
                "ocr": { "url": format!("{base}/relay/glm/api/paas/v4/layout_parsing") },
            });
            Json(body).into_response()
        }
        Ok(OpenOrder::Insufficient { needed, left }) => error(
            StatusCode::PAYMENT_REQUIRED,
            "insufficient_credits",
            &format!("this order needs {needed} page credits, {left} left in this period"),
        ),
        Ok(OpenOrder::NoPeriod) => error(StatusCode::PAYMENT_REQUIRED, "no_subscription", "no active subscription period"),
        Ok(OpenOrder::TooManyOpen) => error(StatusCode::TOO_MANY_REQUESTS, "too_many_open_orders", "too many unfinished orders"),
        Ok(OpenOrder::NotConfigured) => error(StatusCode::SERVICE_UNAVAILABLE, "relay_not_configured", "this tier is not configured"),
        Err(failure) => internal(failure),
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SettleInput {
    pub translated_pages: i64,
}

fn closed(result: anyhow::Result<CloseOrder>) -> Response {
    match result {
        Ok(CloseOrder::Closed(settled)) => Json(json!({
            "credits_charged": settled.charged,
            "credits_refunded": settled.refunded,
            "billed_pages": settled.billed_pages,
        }))
        .into_response(),
        Ok(CloseOrder::NotFound) => error(StatusCode::NOT_FOUND, "not_found", "order not found"),
        Ok(CloseOrder::NotOpen) => error(StatusCode::CONFLICT, "order_closed", "order is already closed"),
        Err(failure) => internal(failure),
    }
}

pub async fn settle_order(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(order_id): Path<String>,
    Json(input): Json<SettleInput>,
) -> Response {
    let device = match device(&state, &headers) {
        Ok(device) => device,
        Err(response) => return response,
    };
    closed(state.store.settle_order(&device.account_id, &order_id, input.translated_pages, Utc::now()))
}

pub async fn cancel_order(State(state): State<AppState>, headers: HeaderMap, Path(order_id): Path<String>) -> Response {
    let device = match device(&state, &headers) {
        Ok(device) => device,
        Err(response) => return response,
    };
    closed(state.store.cancel_order(&device.account_id, &order_id, Utc::now()))
}
