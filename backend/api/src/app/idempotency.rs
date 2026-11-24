//! `Idempotency-Key` 请求头（2026-11-24）：会建要花钱的任务的接口，同一次点击的网络重试只建一个任务。
//!
//! 语义照 IETF 草案 draft-ietf-httpapi-idempotency-key-header，方案见
//! `docs/ops/planning/api-reorg/20261124-防重复提交.md`，对外说明在 `docs/api/00-约定/` 的「防重复提交」。
//! 哪些接口接受这个头写在接口登记表里（行尾 `[idempotent]`，见 `app/endpoints.rs`）；别的接口带了也不管。
//!
//! - 不带这个头：什么都不做，和以前完全一样。
//! - 带了：key 是 1–255 个可见 ASCII 字符（也接受草案里结构化字段的写法 `"..."`，引号去掉后算同一把 key），
//!   不合法 400。按（用户，方法 + 路由模板，key）记一条，带请求指纹（方法、实际路径含查询串、请求体的 sha256）。
//!   - 第一次：先占位（处理中），处理完 2xx 存下状态码和响应体；不是 2xx 删掉占位，可以带同一把 key 重试。
//!   - 同一把 key、同一个请求、已完成：不再执行，原样回存下的状态码和响应体，加 `Idempotent-Replayed: true`。
//!   - 同一把 key、还在处理：409 `idempotency_key_in_flight`。
//!   - 同一把 key、请求不一样：409 `idempotency_key_reused`。
//!   - 记录保留 24 小时；过期的在同一把 key 再来时删掉（当新请求），定期清理（`app/cleanup.rs`）也删。
//!
//! 处理函数放在单独的任务里跑：客户端断开（网络重试的典型情形）时这边照样跑完、把结果记下，
//! 重试才拿得到结果，而不是留下一个永远「处理中」的占位。
//!
//! 挂在认证和访问控制里层（`app/router.rs`），所以知道是哪个用户；单机模式下都是本机用户 `local`。

use std::collections::HashSet;
use std::sync::OnceLock;

use axum::body::Body;
use axum::extract::{MatchedPath, Request, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use sha2::{Digest, Sha256};

use crate::auth::Principal;
use crate::db::{
    IdempotencyClaim, IdempotencyFingerprint, IdempotencyScope, StoredIdempotentResponse,
};
use crate::error::AppError;
use crate::AppState;

/// 请求头名（HTTP 头名不分大小写）。
pub const IDEMPOTENCY_KEY_HEADER: &str = "idempotency-key";
/// 重放的响应带这个头，值是 `true`。
pub const IDEMPOTENT_REPLAYED_HEADER: &str = "idempotent-replayed";
/// 同一把 key 的请求还在处理：409 的 `error.details.reason`。
pub const KEY_IN_FLIGHT: &str = "idempotency_key_in_flight";
/// 同一把 key 用在了不一样的请求上：409 的 `error.details.reason`。
pub const KEY_REUSED: &str = "idempotency_key_reused";

/// 记录保留多久。
const RETENTION_HOURS: i64 = 24;
/// key 最长多少字符。
const MAX_KEY_LEN: usize = 255;
/// 算指纹要把请求体读进来；这几个接口都是小 JSON，比这大的不是正常请求。
const REQUEST_BODY_LIMIT: usize = 16 * 1024 * 1024;
/// 要存下来的响应体上限（提交结果是几 KB 的 JSON）。
const RESPONSE_BODY_LIMIT: usize = 8 * 1024 * 1024;

/// 登记表里标了 `[idempotent]` 的（方法，路由模板）。
fn idempotent_routes() -> &'static HashSet<(&'static str, &'static str)> {
    static ROUTES: OnceLock<HashSet<(&'static str, &'static str)>> = OnceLock::new();
    ROUTES.get_or_init(|| {
        crate::app::registered_endpoints()
            .into_iter()
            .filter(|endpoint| endpoint.idempotent)
            .map(|endpoint| (endpoint.method, endpoint.path))
            .collect()
    })
}

/// 中间层本身：见模块说明。
pub async fn guard(
    State(state): State<AppState>,
    matched: Option<MatchedPath>,
    request: Request,
    next: Next,
) -> Response {
    let Some(template) = matched.as_ref().map(MatchedPath::as_str) else {
        return next.run(request).await;
    };
    let method = request.method().as_str().to_string();
    if !idempotent_routes().contains(&(method.as_str(), template)) {
        return next.run(request).await;
    }
    let key = match idempotency_key(&request) {
        Ok(Some(key)) => key,
        Ok(None) => return next.run(request).await,
        Err(error) => return error.into_response(),
    };
    let owner_user_id = request
        .extensions()
        .get::<Principal>()
        .map(|principal| principal.user_id.clone())
        .unwrap_or_else(|| Principal::local().user_id);
    let record = KeyRecord {
        owner_user_id,
        route: format!("{method} {template}"),
        key,
    };
    let path = request
        .uri()
        .path_and_query()
        .map(|value| value.as_str().to_string())
        .unwrap_or_else(|| request.uri().path().to_string());
    let (parts, body) = request.into_parts();
    let bytes = match axum::body::to_bytes(body, REQUEST_BODY_LIMIT).await {
        Ok(bytes) => bytes,
        Err(_) => return AppError::payload_too_large("request body too large").into_response(),
    };
    let body_sha256 = sha256_hex(&bytes);
    let request = Request::from_parts(parts, Body::from(bytes));

    let claim = {
        let db = state.db.clone();
        let record = record.clone();
        tokio::task::spawn_blocking(move || {
            db.claim_idempotency_key(
                record.scope(),
                IdempotencyFingerprint {
                    method: &method,
                    path: &path,
                    body_sha256: &body_sha256,
                },
                chrono::Utc::now(),
                chrono::Duration::hours(RETENTION_HOURS),
            )
        })
        .await
    };
    let claim = match claim {
        Ok(Ok(claim)) => claim,
        Ok(Err(error)) => return AppError::from(error).into_response(),
        Err(_) => return AppError::internal("idempotency key lookup failed").into_response(),
    };
    match claim {
        IdempotencyClaim::Claimed => run_and_record(state, record, request, next).await,
        IdempotencyClaim::InFlight => AppError::conflict_because(
            KEY_IN_FLIGHT,
            "a request with this Idempotency-Key is still being processed; retry after it finishes",
        )
        .into_response(),
        IdempotencyClaim::Mismatch => AppError::conflict_because(
            KEY_REUSED,
            "this Idempotency-Key was already used for a different request (method, path or body differ); use a new key",
        )
        .into_response(),
        IdempotencyClaim::Completed(stored) => replay(stored),
    }
}

/// 这把 key 归谁、用在哪个接口上（拥有所有权，好带进别的任务里）。
#[derive(Clone)]
struct KeyRecord {
    owner_user_id: String,
    route: String,
    key: String,
}

impl KeyRecord {
    fn scope(&self) -> IdempotencyScope<'_> {
        IdempotencyScope {
            owner_user_id: &self.owner_user_id,
            route: &self.route,
            key: &self.key,
        }
    }
}

/// 读 `Idempotency-Key`：没带 `Ok(None)`；带了不合法 400。
fn idempotency_key(request: &Request) -> Result<Option<String>, AppError> {
    let mut values = request.headers().get_all(IDEMPOTENCY_KEY_HEADER).iter();
    let Some(value) = values.next() else {
        return Ok(None);
    };
    if values.next().is_some() {
        return Err(AppError::bad_request(
            "send the Idempotency-Key header only once",
        ));
    }
    parse_key(value).map(Some)
}

/// 1–255 个可见 ASCII 字符（0x21–0x7E）。草案把它定义成结构化字段的字符串（`"..."`），两种写法都收，
/// 外面一对引号去掉后是同一把 key。
fn parse_key(value: &HeaderValue) -> Result<String, AppError> {
    let invalid = || {
        AppError::bad_request(format!(
            "Idempotency-Key must be 1-{MAX_KEY_LEN} visible ASCII characters (a UUID is fine)"
        ))
    };
    let raw = value.to_str().map_err(|_| invalid())?.trim();
    let key = raw
        .strip_prefix('"')
        .and_then(|rest| rest.strip_suffix('"'))
        .unwrap_or(raw);
    let visible = key.bytes().all(|byte| (0x21..=0x7e).contains(&byte));
    if key.is_empty() || key.len() > MAX_KEY_LEN || !visible {
        return Err(invalid());
    }
    Ok(key.to_string())
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// 跑处理函数，成功存下响应、失败删掉占位。处理函数和记结果都在单独的任务里：客户端断开、这边的
/// future 被丢掉时也照样跑完、记下来。
async fn run_and_record(
    state: AppState,
    record: KeyRecord,
    request: Request,
    next: Next,
) -> Response {
    let db = state.db.clone();
    let task = tokio::spawn(async move {
        let response = match tokio::spawn(next.run(request)).await {
            Ok(response) => response,
            Err(error) => {
                tracing::error!(route = %record.route, "request handler with an Idempotency-Key failed: {error}");
                release(&db, &record).await;
                return AppError::internal("request handler failed").into_response();
            }
        };
        if !response.status().is_success() {
            release(&db, &record).await;
            return response;
        }
        let (parts, body) = response.into_parts();
        let bytes = match axum::body::to_bytes(body, RESPONSE_BODY_LIMIT).await {
            Ok(bytes) => bytes,
            Err(error) => {
                tracing::error!(route = %record.route, "could not buffer the response to store it: {error}");
                release(&db, &record).await;
                return AppError::internal("could not store the response for this Idempotency-Key")
                    .into_response();
            }
        };
        let stored = StoredIdempotentResponse {
            status: parts.status.as_u16(),
            content_type: parts
                .headers
                .get(header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_string),
            body: bytes.to_vec(),
        };
        let completed = {
            let db = db.clone();
            let record = record.clone();
            tokio::task::spawn_blocking(move || {
                db.complete_idempotency_key(record.scope(), &stored, chrono::Utc::now())
            })
            .await
        };
        // 记不下来：请求本身已经成功了，照样回；这把 key 留在「处理中」直到过期（宁可让重试 409，也不再建一次）。
        match completed {
            Ok(Ok(true)) => {}
            Ok(Ok(false)) => {
                tracing::warn!(route = %record.route, "Idempotency-Key placeholder vanished before completion")
            }
            Ok(Err(error)) => {
                tracing::warn!(route = %record.route, "could not store the Idempotency-Key response: {error:#}")
            }
            Err(error) => {
                tracing::warn!(route = %record.route, "could not store the Idempotency-Key response: {error}")
            }
        }
        Response::from_parts(parts, Body::from(bytes))
    });
    match task.await {
        Ok(response) => response,
        Err(_) => AppError::internal("request handler failed").into_response(),
    }
}

/// 删掉占位，客户端可以带同一把 key 重试。删不掉只记日志（占位会在 24 小时后过期）。
async fn release(db: &std::sync::Arc<crate::db::Db>, record: &KeyRecord) {
    let db = db.clone();
    let record = record.clone();
    let route = record.route.clone();
    match tokio::task::spawn_blocking(move || db.release_idempotency_key(record.scope())).await {
        Ok(Ok(())) => {}
        Ok(Err(error)) => {
            tracing::warn!(%route, "could not release an Idempotency-Key placeholder: {error:#}")
        }
        Err(error) => {
            tracing::warn!(%route, "could not release an Idempotency-Key placeholder: {error}")
        }
    }
}

/// 照存下的状态码和响应体回，加 `Idempotent-Replayed: true`。
fn replay(stored: StoredIdempotentResponse) -> Response {
    let status = StatusCode::from_u16(stored.status).unwrap_or(StatusCode::OK);
    let mut response = Response::new(Body::from(stored.body));
    *response.status_mut() = status;
    if let Some(value) = stored
        .content_type
        .as_deref()
        .and_then(|value| HeaderValue::from_str(value).ok())
    {
        response.headers_mut().insert(header::CONTENT_TYPE, value);
    }
    response
        .headers_mut()
        .insert(IDEMPOTENT_REPLAYED_HEADER, HeaderValue::from_static("true"));
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_are_visible_ascii_and_may_be_quoted() {
        let parse = |raw: &str| parse_key(&HeaderValue::from_str(raw).unwrap());
        assert_eq!(
            parse("8e03978e-40d5-43e8-bc93-6894a57f9324").unwrap(),
            "8e03978e-40d5-43e8-bc93-6894a57f9324"
        );
        assert_eq!(parse("\"abc\"").unwrap(), "abc");
        assert_eq!(parse(&"k".repeat(255)).unwrap().len(), 255);
        assert!(parse(&"k".repeat(256)).is_err());
        assert!(parse("").is_err());
        assert!(parse("\"\"").is_err());
        assert!(parse("has space").is_err());
        assert!(parse_key(&HeaderValue::from_bytes("中文".as_bytes()).unwrap()).is_err());
    }

    #[test]
    fn only_job_creating_endpoints_take_the_header() {
        let mut routes: Vec<_> = idempotent_routes()
            .iter()
            .map(|(method, path)| format!("{method} {path}"))
            .collect();
        routes.sort();
        assert_eq!(
            routes,
            [
                "POST /api/v1/documents/:document_id/ocr",
                "POST /api/v1/documents/:document_id/translate",
                "POST /api/v1/jobs",
                "POST /api/v1/jobs/:job_id/actions/rerun",
                "POST /api/v1/jobs/:job_id/actions/resolve-ocr-ambiguity",
                "POST /api/v1/jobs/:job_id/actions/resume",
                "POST /api/v1/jobs/:job_id/actions/retry-stage",
            ]
        );
    }
}
