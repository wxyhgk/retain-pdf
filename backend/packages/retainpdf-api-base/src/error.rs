use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use serde_json::{json, Value};
use thiserror::Error;

/// serde 报错里「不认识的字段」那一句（``unknown field `x`, expected one of ...``，只带字段名、不带值），
/// 去掉 serde_json 附在后面的行列号，补上 ` in the request body`。没有这一句返回 `None`。
pub fn unknown_field_detail(serde_message: &str) -> Option<String> {
    let start = serde_message.find("unknown field ")?;
    let detail = &serde_message[start..];
    let detail = detail.split(" at line ").next().unwrap_or(detail);
    Some(format!("{detail} in the request body"))
}

/// 「还没产出」的 `error.details.reason`（404）。见 `docs/api/00-约定/02-认证与错误.md`。
pub const NOT_READY: &str = "not_ready";

/// 请求体写错（400）的 `error.details.reason`，2026-11-24 起有。见 `docs/api/00-约定/02-认证与错误.md`
/// 「请求体写错（400）」。JSON 语法错、不是 JSON。
pub const INVALID_JSON: &str = "invalid_json";
/// 请求体里有接口不认识的字段（目标类型 `deny_unknown_fields`）。
pub const UNKNOWN_FIELD: &str = "unknown_field";
/// 请求体是合法 JSON，但和接口要的结构对不上：字段类型不对、缺必填字段、枚举值不认识。
/// 2026-11-24 以前 `ApiJson` 等提取器对这种情况回 422。
pub const SCHEMA_MISMATCH: &str = "schema_mismatch";

#[derive(Clone, Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    PayloadTooLarge(String),
    #[error("{0}")]
    UnsupportedMediaType(String),
    #[error("{0}")]
    UnprocessableEntity(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    MethodNotAllowed(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    EventCursorExpired(String),
    #[error("{0}")]
    TooManyRequests(String),
    #[error("{0}")]
    BadGateway(String),
    #[error("{0}")]
    ServiceUnavailable(String),
    #[error("{0}")]
    Internal(String),
    #[error("{message}")]
    OcrArtifactReuse {
        status: StatusCode,
        code: &'static str,
        message: String,
        reason: &'static str,
        can_fallback_to_ocr: bool,
    },
    #[error("{message}")]
    CredentialReference {
        status: StatusCode,
        code: &'static str,
        message: String,
    },
    #[error("{message}")]
    LiveTranslation {
        status: StatusCode,
        code: &'static str,
        message: String,
    },
    /// 书的元数据建议接口的错误。顶层 `code` 是建议接口一直在用的字符串码；
    /// `error.code` 一般和它相同，`error.details.reason` 是小写的稳定原因（见 [`document_metadata_codes`]）。
    #[error("{message}")]
    DocumentMetadata {
        status: StatusCode,
        code: &'static str,
        message: String,
        error_code: &'static str,
        reason: Option<&'static str>,
    },
    /// 单块译文修订写回被拒(422 校验不过 / 409 任务在跑、generation 过期……)。
    ///
    /// 结构化:客户端(尤其是 agent)要按 `details.reason` 决定下一步——校验不过就
    /// 照着 `details.validation.issues` 改了再提交,generation 过期就重读再改,
    /// 任务在跑就等它结束。从人类可读消息里猜这些不可靠。
    #[error("{message}")]
    TranslationRevision {
        status: StatusCode,
        code: &'static str,
        message: String,
        details: Value,
    },
    /// 带稳定机器可读原因的 404 / 409（任务状态不允许、产物没产出……）。
    ///
    /// 信封和同状态码的普通错误完全一样（顶层数字 `code`、`error.code`、`message`），
    /// 只是 `error.details` 多一个 `reason`，客户端按它分支，不必解析 `message`。
    /// 用 [`AppError::conflict_because`] / [`AppError::not_found_because`] 构造。
    #[error("{message}")]
    Reasoned {
        status: StatusCode,
        message: String,
        reason: &'static str,
        /// 和 `reason` 并列放进 `error.details` 的其它字段（JSON 对象；没有就是 `Null`），
        /// 例如 `derived_job_active` 带的 `active_job_id`。用 [`AppError::conflict_because_with`] 构造。
        extra: Value,
    },
    /// 账号、登录、会话的错误（INVALID_CREDENTIALS、ACCOUNT_DISABLED、TOO_MANY_ATTEMPTS……）。
    #[error("{message}")]
    Account {
        status: StatusCode,
        code: &'static str,
        message: String,
        details: Value,
    },
}

#[derive(Serialize)]
struct ErrorBody {
    code: i32,
    message: String,
    error: StructuredError,
}

#[derive(Serialize)]
struct OcrArtifactReuseErrorBody {
    code: &'static str,
    message: String,
    reason: &'static str,
    can_fallback_to_ocr: bool,
    error: StructuredError,
}

#[derive(Serialize)]
struct CredentialReferenceErrorBody {
    code: &'static str,
    message: String,
    error: StructuredError,
}

#[derive(Serialize)]
struct LiveTranslationErrorBody {
    code: &'static str,
    message: String,
    error: StructuredError,
}

#[derive(Serialize)]
struct DocumentMetadataErrorBody {
    code: &'static str,
    message: String,
    error: StructuredError,
}

/// 带 `details` 的结构化错误（账号、译文修订）。
#[derive(Serialize)]
struct DetailedErrorBody {
    code: &'static str,
    message: String,
    error: StructuredError,
}

#[derive(Serialize)]
struct StructuredError {
    code: &'static str,
    http_status: u16,
    details: Value,
}

impl StructuredError {
    fn empty(code: &'static str, status: StatusCode) -> Self {
        Self {
            code,
            http_status: status.as_u16(),
            details: json!({}),
        }
    }

    fn with_details(code: &'static str, status: StatusCode, details: Value) -> Self {
        Self {
            code,
            http_status: status.as_u16(),
            details,
        }
    }

    fn ocr_artifact_reuse(
        code: &'static str,
        status: StatusCode,
        reason: &'static str,
        can_fallback_to_ocr: bool,
    ) -> Self {
        Self {
            code,
            http_status: status.as_u16(),
            details: json!({
                "reason": reason,
                "can_fallback_to_ocr": can_fallback_to_ocr,
            }),
        }
    }
}

impl AppError {
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }

    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::Forbidden(msg.into())
    }

    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }

    pub fn payload_too_large(msg: impl Into<String>) -> Self {
        Self::PayloadTooLarge(msg.into())
    }

    pub fn unsupported_media_type(msg: impl Into<String>) -> Self {
        Self::UnsupportedMediaType(msg.into())
    }

    /// 422。请求体类型、字段写错不要用它：那是 400（[`AppError::request_body_data_error`]）。
    pub fn unprocessable_entity(msg: impl Into<String>) -> Self {
        Self::UnprocessableEntity(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    pub fn method_not_allowed(msg: impl Into<String>) -> Self {
        Self::MethodNotAllowed(msg.into())
    }

    /// 不带 reason 的 409，只留给本文件的测试。409 一律带稳定原因：用 [`AppError::conflict_because`] /
    /// [`AppError::conflict_because_with`]（2026-11-25 起，最后几处补完后收起来，新代码写不出没有 reason 的 409）。
    #[cfg(test)]
    pub(crate) fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }

    /// 400,`error.details.reason` 写稳定原因(请求本身写错了,如请求体对不上结构 `schema_mismatch`)。
    pub fn bad_request_because(reason: &'static str, msg: impl Into<String>) -> Self {
        Self::Reasoned {
            status: StatusCode::BAD_REQUEST,
            message: msg.into(),
            reason,
            extra: Value::Null,
        }
    }

    /// 请求体不是合法 JSON：400 + [`INVALID_JSON`]。`prefix` 是接口自己的前缀（如 `invalid job payload`），
    /// 有就拼成 `<prefix>: invalid JSON request body`。
    pub fn request_body_syntax_error(prefix: Option<&str>) -> Self {
        Self::bad_request_because(INVALID_JSON, with_prefix(prefix, "invalid JSON request body"))
    }

    /// 请求体是 JSON、但按类型解析失败（serde 的 Data 类错误）：一律 400（2026-11-24 起，以前提取器回 422）。
    /// 不认识的字段回字段名（``unknown field `x`, expected one of ... in the request body``，serde 这句只有名字、
    /// 不带值），reason 是 [`UNKNOWN_FIELD`]；其余（类型不对、缺字段、枚举值不认识）回 `schema_message`
    /// 这句固定文案，reason 是 [`SCHEMA_MISMATCH`]——serde 原文里带着用户提交的值，不回给调用方。
    pub fn request_body_data_error(
        prefix: Option<&str>,
        serde_message: &str,
        schema_message: &str,
    ) -> Self {
        match unknown_field_detail(serde_message) {
            Some(detail) => Self::bad_request_because(UNKNOWN_FIELD, with_prefix(prefix, &detail)),
            None => Self::bad_request_because(SCHEMA_MISMATCH, with_prefix(prefix, schema_message)),
        }
    }

    /// 409,`error.details.reason` 写稳定原因(当前状态不允许这个操作)。
    pub fn conflict_because(reason: &'static str, msg: impl Into<String>) -> Self {
        Self::Reasoned {
            status: StatusCode::CONFLICT,
            message: msg.into(),
            reason,
            extra: Value::Null,
        }
    }

    /// 409,`error.details` 除了 `reason` 还带 `extra` 里的字段(`extra` 是 JSON 对象,和 `reason` 重名的键不要用)。
    /// 例如续跑被拒时带上在跑的派生任务编号 `active_job_id`。
    pub fn conflict_because_with(reason: &'static str, msg: impl Into<String>, extra: Value) -> Self {
        Self::Reasoned {
            status: StatusCode::CONFLICT,
            message: msg.into(),
            reason,
            extra,
        }
    }

    /// 503,`error.details.reason` 写稳定原因(服务这会儿干不了,如磁盘快满了 `insufficient_storage`)。
    pub fn service_unavailable_because(reason: &'static str, msg: impl Into<String>) -> Self {
        Self::Reasoned {
            status: StatusCode::SERVICE_UNAVAILABLE,
            message: msg.into(),
            reason,
            extra: Value::Null,
        }
    }

    /// 404,`error.details.reason` 写稳定原因(记录在,但要的东西还没产出,如 `not_ready`)。
    pub fn not_found_because(reason: &'static str, msg: impl Into<String>) -> Self {
        Self::Reasoned {
            status: StatusCode::NOT_FOUND,
            message: msg.into(),
            reason,
            extra: Value::Null,
        }
    }

    /// 任务（或书）在，要的原始文件、报告还没产出：404，`reason` 是 [`NOT_READY`]，
    /// 文案统一成 `<名字> not ready`（`what` 是文件名或报告名，如 `translated.pdf`、`refine report`）。
    /// 任务本身不存在仍用普通的 [`AppError::not_found`]，不带 reason。
    pub fn not_ready(what: &str) -> Self {
        Self::not_found_because(NOT_READY, format!("{what} not ready"))
    }

    /// 是不是 [`AppError::not_ready`]（列表类接口拿它退回空列表）。
    pub fn is_not_ready(&self) -> bool {
        matches!(self, Self::Reasoned { status, reason, .. } if *status == StatusCode::NOT_FOUND && *reason == NOT_READY)
    }

    pub fn event_cursor_expired(msg: impl Into<String>) -> Self {
        Self::EventCursorExpired(msg.into())
    }

    pub fn too_many_requests(msg: impl Into<String>) -> Self {
        Self::TooManyRequests(msg.into())
    }

    /// 429,`error.details.reason` 写稳定原因(太多了,过一会再来,如排队满了 `queue_full`)。
    pub fn too_many_requests_because(reason: &'static str, msg: impl Into<String>) -> Self {
        Self::Reasoned {
            status: StatusCode::TOO_MANY_REQUESTS,
            message: msg.into(),
            reason,
            extra: Value::Null,
        }
    }

    pub fn bad_gateway(msg: impl Into<String>) -> Self {
        Self::BadGateway(msg.into())
    }

    pub fn service_unavailable(msg: impl Into<String>) -> Self {
        Self::ServiceUnavailable(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    /// 数据库里「没有这条记录」。`Db::get_job` 等按编号取一条的方法用 `QueryReturnedNoRows`
    /// 报这件事（原样保留在错误链里），其余错误（库被锁、行解码失败……）都不是。
    pub fn is_record_missing(error: &anyhow::Error) -> bool {
        matches!(
            error.downcast_ref::<rusqlite::Error>(),
            Some(rusqlite::Error::QueryReturnedNoRows)
        )
    }

    /// 先收成 JSON（`Value` 或原始字节）再按类型解析的接口，解析失败时回 400，`message` 是 `<context>: <说明>`。
    /// 说明和 reason 跟 `ApiJson` 提取器同一套（[`AppError::request_body_data_error`]、
    /// [`AppError::request_body_syntax_error`]），不回 serde 原文——那里面带着用户提交的值。
    pub fn invalid_json_body(context: &str, error: &serde_json::Error) -> Self {
        match error.classify() {
            serde_json::error::Category::Data => Self::request_body_data_error(
                Some(context),
                &error.to_string(),
                "request body does not match the expected schema",
            ),
            _ => Self::request_body_syntax_error(Some(context)),
        }
    }

    /// 按编号取一条记录失败时翻成接口错误：没有这条记录是 404（消息用 `not_found_msg`），
    /// 其余是 500，原因只进日志。不要再写 `map_err(|_| not_found(..))`：把「有记录但读不出来」
    /// 报成 not found，会让人去查错地方。
    pub fn from_lookup(error: anyhow::Error, not_found_msg: impl Into<String>) -> Self {
        if Self::is_record_missing(&error) {
            Self::NotFound(not_found_msg.into())
        } else {
            Self::from(error)
        }
    }

    pub fn ocr_artifact_reuse(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
        reason: &'static str,
    ) -> Self {
        Self::OcrArtifactReuse {
            status,
            code,
            message: message.into(),
            reason,
            can_fallback_to_ocr: true,
        }
    }

    pub fn account(status: StatusCode, code: &'static str, message: impl Into<String>, details: Value) -> Self {
        Self::Account { status, code, message: message.into(), details }
    }

    pub fn credential_reference(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::CredentialReference {
            status,
            code,
            message: message.into(),
        }
    }

    pub fn live_translation(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        Self::LiveTranslation {
            status,
            code,
            message: message.into(),
        }
    }

    /// 修订被拒。`reason` 是稳定的机器可读原因,其余字段并进 `details`。
    pub fn translation_revision(
        status: StatusCode,
        reason: &str,
        message: impl Into<String>,
        extra: Value,
    ) -> Self {
        // 409 是状态冲突；新译文内容没过检查是 400（2026-11-25 起，以前 422），`error.code` 照旧分两种。
        let code = if status == StatusCode::CONFLICT {
            "TRANSLATION_REVISION_CONFLICT"
        } else {
            "TRANSLATION_REVISION_REJECTED"
        };
        let mut details = json!({ "reason": reason });
        if let (Some(target), Value::Object(extra)) = (details.as_object_mut(), extra) {
            target.extend(extra);
        }
        Self::TranslationRevision {
            status,
            code,
            message: message.into(),
            details,
        }
    }

    /// 元数据建议接口的错误。`reason` 和 `error.code` 由 `code` 定（[`document_metadata_codes`]），
    /// 调用处只写顶层码。
    pub fn document_metadata(
        status: StatusCode,
        code: &'static str,
        message: impl Into<String>,
    ) -> Self {
        let (error_code, reason) = document_metadata_codes(code);
        Self::DocumentMetadata {
            status,
            code,
            message: message.into(),
            error_code,
            reason,
        }
    }
}

fn with_prefix(prefix: Option<&str>, detail: &str) -> String {
    match prefix {
        Some(prefix) => format!("{prefix}: {detail}"),
        None => detail.to_string(),
    }
}

/// 元数据建议接口的顶层码 → (`error.code`, `error.details.reason`)。取值写在
/// `docs/api/00-约定/02-认证与错误.md`「书的元数据建议」和 `docs/api/13-书库/03-元数据建议.md`，只增不改。
///
/// `OCR_JOB_NOT_FOUND` 和建任务复用 OCR 的同名码撞车（那边还带 `can_fallback_to_ocr`），所以顶层
/// `code` 照旧、`error.code` 换成 `DOCUMENT_METADATA_JOB_NOT_FOUND`，两边的 `reason` 都是 `job_not_found`。
fn document_metadata_codes(code: &'static str) -> (&'static str, Option<&'static str>) {
    let reason = match code {
        "DOCUMENT_METADATA_FIELD_UNSUPPORTED" => "field_unsupported",
        "OCR_JOB_NOT_FOUND" => return ("DOCUMENT_METADATA_JOB_NOT_FOUND", Some("job_not_found")),
        "DOCUMENT_METADATA_JOB_MISMATCH" => "job_mismatch",
        "DOCUMENT_METADATA_SOURCE_NOT_READY" => "source_not_ready",
        "DOCUMENT_METADATA_SOURCE_TOO_LARGE" => "source_too_large",
        "DOCUMENT_METADATA_SOURCE_INVALID" => "source_invalid",
        "DOCUMENT_TITLE_CANDIDATE_NOT_FOUND" => "title_candidate_not_found",
        "DOCUMENT_METADATA_SUGGESTION_NOT_FOUND" => "suggestion_not_found",
        "DOCUMENT_TITLE_CHANGED" => "title_changed",
        "DOCUMENT_REVISION_CONFLICT" => "revision_conflict",
        _ => return (code, None),
    };
    (code, Some(reason))
}

/// 凭据接口 409 的 `error.details.reason`（2026-10-22 起有，以前 `details` 是 `{}`）。顶层 `code`、`error.code`
/// 照旧是大写码。取值写在 `docs/api/00-约定/02-认证与错误.md`「凭据的 409 原因」，只增不改；其余凭据错误不带 reason。
fn credential_reference_reason(code: &str) -> Option<&'static str> {
    match code {
        "CREDENTIAL_IN_USE" => Some("credential_in_use"),
        "CREDENTIAL_REVISION_CONFLICT" => Some("credential_revision_conflict"),
        "CREDENTIAL_VAULT_REVISION_CONFLICT" => Some("credential_vault_revision_conflict"),
        _ => None,
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        if let AppError::OcrArtifactReuse {
            status,
            code,
            message,
            reason,
            can_fallback_to_ocr,
        } = &self
        {
            return (
                *status,
                Json(OcrArtifactReuseErrorBody {
                    code,
                    message: message.clone(),
                    reason,
                    can_fallback_to_ocr: *can_fallback_to_ocr,
                    error: StructuredError::ocr_artifact_reuse(
                        code,
                        *status,
                        reason,
                        *can_fallback_to_ocr,
                    ),
                }),
            )
                .into_response();
        }
        if let AppError::CredentialReference {
            status,
            code,
            message,
        } = &self
        {
            let details = credential_reference_reason(code)
                .map_or_else(|| json!({}), |reason| json!({ "reason": reason }));
            return (
                *status,
                Json(CredentialReferenceErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::with_details(code, *status, details),
                }),
            )
                .into_response();
        }
        if let AppError::LiveTranslation {
            status,
            code,
            message,
        } = &self
        {
            return (
                *status,
                Json(LiveTranslationErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::empty(code, *status),
                }),
            )
                .into_response();
        }
        if let AppError::DocumentMetadata {
            status,
            code,
            message,
            error_code,
            reason,
        } = &self
        {
            let details = reason.map_or_else(|| json!({}), |reason| json!({ "reason": reason }));
            return (
                *status,
                Json(DocumentMetadataErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::with_details(error_code, *status, details),
                }),
            )
                .into_response();
        }
        if let AppError::Account { status, code, message, details } = &self {
            return (
                *status,
                Json(DetailedErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::with_details(code, *status, details.clone()),
                }),
            )
                .into_response();
        }
        if let AppError::TranslationRevision {
            status,
            code,
            message,
            details,
        } = &self
        {
            return (
                *status,
                Json(DetailedErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::with_details(code, *status, details.clone()),
                }),
            )
                .into_response();
        }
        if let AppError::Reasoned { status, message, reason, extra } = &self {
            // 只有 400 / 404 / 409 / 429 / 503 有构造方法,信封与对应的普通错误一致。
            let (code, stable_code) = if *status == StatusCode::BAD_REQUEST {
                (40000, "BAD_REQUEST")
            } else if *status == StatusCode::NOT_FOUND {
                (40400, "NOT_FOUND")
            } else if *status == StatusCode::SERVICE_UNAVAILABLE {
                (50300, "SERVICE_UNAVAILABLE")
            } else if *status == StatusCode::TOO_MANY_REQUESTS {
                (42900, "TOO_MANY_REQUESTS")
            } else {
                (40900, "CONFLICT")
            };
            return (
                *status,
                Json(ErrorBody {
                    code,
                    message: message.clone(),
                    error: StructuredError::with_details(stable_code, *status, {
                        let mut details = json!({ "reason": reason });
                        if let (Some(target), Value::Object(extra)) = (details.as_object_mut(), extra) {
                            for (key, value) in extra {
                                target.entry(key.clone()).or_insert_with(|| value.clone());
                            }
                        }
                        details
                    }),
                }),
            )
                .into_response();
        }
        let (status, code, stable_code) = match &self {
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, 40100, "UNAUTHORIZED"),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, 40300, "FORBIDDEN"),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, 40000, "BAD_REQUEST"),
            AppError::PayloadTooLarge(_) => {
                (StatusCode::PAYLOAD_TOO_LARGE, 41300, "PAYLOAD_TOO_LARGE")
            }
            AppError::UnsupportedMediaType(_) => (
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                41500,
                "UNSUPPORTED_MEDIA_TYPE",
            ),
            AppError::UnprocessableEntity(_) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                42200,
                "UNPROCESSABLE_ENTITY",
            ),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, 40400, "NOT_FOUND"),
            AppError::MethodNotAllowed(_) => {
                (StatusCode::METHOD_NOT_ALLOWED, 40500, "METHOD_NOT_ALLOWED")
            }
            AppError::Conflict(_) => (StatusCode::CONFLICT, 40900, "CONFLICT"),
            AppError::EventCursorExpired(_) => (StatusCode::GONE, 41000, "EVENT_CURSOR_EXPIRED"),
            AppError::TooManyRequests(_) => {
                (StatusCode::TOO_MANY_REQUESTS, 42900, "TOO_MANY_REQUESTS")
            }
            AppError::BadGateway(_) => (StatusCode::BAD_GATEWAY, 50200, "BAD_GATEWAY"),
            AppError::ServiceUnavailable(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                50300,
                "SERVICE_UNAVAILABLE",
            ),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, 50000, "INTERNAL"),
            AppError::OcrArtifactReuse { .. } => unreachable!("handled above"),
            AppError::CredentialReference { .. } => unreachable!("handled above"),
            AppError::LiveTranslation { .. } => unreachable!("handled above"),
            AppError::DocumentMetadata { .. } => unreachable!("handled above"),
            AppError::TranslationRevision { .. } => unreachable!("handled above"),
            AppError::Account { .. } => unreachable!("handled above"),
            AppError::Reasoned { .. } => unreachable!("handled above"),
        };
        let body = match &self {
            AppError::Internal(detail) => {
                let error_id = log_internal_error(detail);
                ErrorBody {
                    code,
                    message: format!("internal server error (ref {error_id})"),
                    error: StructuredError::with_details(stable_code, status, json!({ "error_id": error_id })),
                }
            }
            _ => ErrorBody {
                code,
                message: self.to_string(),
                error: StructuredError::empty(stable_code, status),
            },
        };
        (status, Json(body)).into_response()
    }
}

/// 500 的原因只写日志、不回给调用方：底层报错里常带服务器上的路径、SQL、上游的返回……
/// 回给调用方一个编号，凭它在日志里找到原因。
fn log_internal_error(detail: &str) -> String {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|elapsed| elapsed.as_millis()).unwrap_or(0);
    let error_id = format!("{millis:x}-{:04x}", NEXT.fetch_add(1, Ordering::Relaxed) & 0xffff);
    tracing::error!(error_id = %error_id, "internal error: {detail}");
    error_id
}

impl From<anyhow::Error> for AppError {
    fn from(value: anyhow::Error) -> Self {
        // 带上整条原因链：只进日志，不回给调用方。
        Self::Internal(format!("{value:#}"))
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Internal(value.to_string())
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(value: zip::result::ZipError) -> Self {
        Self::Internal(value.to_string())
    }
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;
    use serde_json::Value;

    use super::*;

    async fn response_json(error: AppError) -> (StatusCode, Value) {
        let response = error.into_response();
        let status = response.status();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read error response body");
        let payload = serde_json::from_slice(&body).expect("parse error response JSON");
        (status, payload)
    }

    #[tokio::test]
    async fn generic_errors_keep_legacy_fields_and_add_stable_error_object() {
        let cases = [
            (
                AppError::unauthorized("unauthorized"),
                StatusCode::UNAUTHORIZED,
                40100,
                "UNAUTHORIZED",
            ),
            (
                AppError::forbidden("forbidden"),
                StatusCode::FORBIDDEN,
                40300,
                "FORBIDDEN",
            ),
            (
                AppError::bad_request("bad request"),
                StatusCode::BAD_REQUEST,
                40000,
                "BAD_REQUEST",
            ),
            (
                AppError::payload_too_large("payload too large"),
                StatusCode::PAYLOAD_TOO_LARGE,
                41300,
                "PAYLOAD_TOO_LARGE",
            ),
            (
                AppError::unsupported_media_type("unsupported media type"),
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                41500,
                "UNSUPPORTED_MEDIA_TYPE",
            ),
            (
                AppError::unprocessable_entity("unprocessable entity"),
                StatusCode::UNPROCESSABLE_ENTITY,
                42200,
                "UNPROCESSABLE_ENTITY",
            ),
            (
                AppError::not_found("not found"),
                StatusCode::NOT_FOUND,
                40400,
                "NOT_FOUND",
            ),
            (
                AppError::method_not_allowed("method not allowed"),
                StatusCode::METHOD_NOT_ALLOWED,
                40500,
                "METHOD_NOT_ALLOWED",
            ),
            (
                AppError::conflict("conflict"),
                StatusCode::CONFLICT,
                40900,
                "CONFLICT",
            ),
            (
                AppError::event_cursor_expired("event cursor expired"),
                StatusCode::GONE,
                41000,
                "EVENT_CURSOR_EXPIRED",
            ),
            (
                AppError::too_many_requests("too many requests"),
                StatusCode::TOO_MANY_REQUESTS,
                42900,
                "TOO_MANY_REQUESTS",
            ),
            (
                AppError::bad_gateway("bad gateway"),
                StatusCode::BAD_GATEWAY,
                50200,
                "BAD_GATEWAY",
            ),
            (
                AppError::service_unavailable("service unavailable"),
                StatusCode::SERVICE_UNAVAILABLE,
                50300,
                "SERVICE_UNAVAILABLE",
            ),
        ];

        for (error, expected_status, expected_legacy_code, expected_stable_code) in cases {
            let expected_message = error.to_string();
            let (status, payload) = response_json(error).await;
            assert_eq!(status, expected_status);
            assert_eq!(payload["code"], expected_legacy_code);
            assert_eq!(payload["message"], expected_message);
            assert_eq!(payload["error"]["code"], expected_stable_code);
            assert_eq!(payload["error"]["http_status"], status.as_u16());
            assert_eq!(payload["error"]["details"], serde_json::json!({}));
        }
    }

    #[tokio::test]
    async fn internal_error_hides_detail_behind_reference() {
        let (status, payload) =
            response_json(AppError::internal("open /srv/data/jobs/j1/secret.pdf: permission denied")).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(payload["code"], 50000);
        assert_eq!(payload["error"]["code"], "INTERNAL");
        let error_id = payload["error"]["details"]["error_id"].as_str().unwrap().to_string();
        assert!(!error_id.is_empty());
        assert_eq!(payload["message"], format!("internal server error (ref {error_id})"));
        assert!(!payload.to_string().contains("/srv/data"));

        let (_, again) = response_json(AppError::internal("other")).await;
        assert_ne!(again["error"]["details"]["error_id"], payload["error"]["details"]["error_id"]);
    }

    #[tokio::test]
    async fn domain_errors_keep_legacy_shape_and_reuse_domain_code() {
        let (status, ocr) = response_json(AppError::ocr_artifact_reuse(
            StatusCode::CONFLICT,
            "OCR_ARTIFACT_NOT_REUSABLE",
            "OCR artifact is not reusable",
            "missing_layout_data",
        ))
        .await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(ocr["code"], "OCR_ARTIFACT_NOT_REUSABLE");
        assert_eq!(ocr["message"], "OCR artifact is not reusable");
        assert_eq!(ocr["reason"], "missing_layout_data");
        assert_eq!(ocr["can_fallback_to_ocr"], true);
        assert_eq!(ocr["error"]["code"], ocr["code"]);
        assert_eq!(ocr["error"]["http_status"], 409);
        assert_eq!(
            ocr["error"]["details"],
            serde_json::json!({
                "reason": "missing_layout_data",
                "can_fallback_to_ocr": true,
            })
        );

        for (error, code, expected_status) in [
            (
                AppError::credential_reference(
                    StatusCode::NOT_FOUND,
                    "CREDENTIAL_NOT_FOUND",
                    "credential not found",
                ),
                "CREDENTIAL_NOT_FOUND",
                StatusCode::NOT_FOUND,
            ),
            (
                AppError::live_translation(
                    StatusCode::CONFLICT,
                    "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
                    "page not committed",
                ),
                "LIVE_TRANSLATION_PAGE_NOT_COMMITTED",
                StatusCode::CONFLICT,
            ),
        ] {
            let (status, payload) = response_json(error).await;
            assert_eq!(status, expected_status);
            assert_eq!(payload["code"], code);
            assert_eq!(payload["error"]["code"], code);
            assert_eq!(payload["error"]["http_status"], status.as_u16());
            assert_eq!(payload["error"]["details"], serde_json::json!({}));
        }
    }

    #[tokio::test]
    async fn credential_conflicts_carry_a_lowercase_reason() {
        for (code, reason) in [
            ("CREDENTIAL_IN_USE", "credential_in_use"),
            ("CREDENTIAL_REVISION_CONFLICT", "credential_revision_conflict"),
            ("CREDENTIAL_VAULT_REVISION_CONFLICT", "credential_vault_revision_conflict"),
        ] {
            let (status, payload) =
                response_json(AppError::credential_reference(StatusCode::CONFLICT, code, "x")).await;
            assert_eq!(status, StatusCode::CONFLICT);
            assert_eq!(payload["code"], code, "顶层码照旧");
            assert_eq!(payload["error"]["code"], code);
            assert_eq!(payload["error"]["details"], serde_json::json!({ "reason": reason }));
        }
    }

    #[tokio::test]
    async fn reasoned_errors_keep_plain_envelope_and_put_reason_in_details() {
        for (error, plain, expected_status) in [
            (
                AppError::conflict_because("job_active", "job is queued or running"),
                AppError::conflict("job is queued or running"),
                StatusCode::CONFLICT,
            ),
            (
                AppError::not_found_because("not_ready", "report not ready"),
                AppError::not_found("report not ready"),
                StatusCode::NOT_FOUND,
            ),
            (
                AppError::service_unavailable_because("insufficient_storage", "not enough free disk space"),
                AppError::service_unavailable("not enough free disk space"),
                StatusCode::SERVICE_UNAVAILABLE,
            ),
            (
                AppError::too_many_requests_because("queue_full", "too many queued jobs"),
                AppError::too_many_requests("too many queued jobs"),
                StatusCode::TOO_MANY_REQUESTS,
            ),
        ] {
            let reason = match &error {
                AppError::Reasoned { reason, .. } => *reason,
                _ => unreachable!(),
            };
            let (status, mut payload) = response_json(error).await;
            let (plain_status, plain_payload) = response_json(plain).await;
            assert_eq!(status, expected_status);
            assert_eq!(status, plain_status);
            // 除 error.details 外,和普通错误逐字段一致。
            assert_eq!(payload["error"]["details"], serde_json::json!({ "reason": reason }));
            payload["error"]["details"] = serde_json::json!({});
            assert_eq!(payload, plain_payload);
        }
    }

    #[tokio::test]
    async fn not_ready_is_a_404_with_reason_and_uniform_message() {
        let error = AppError::not_ready("all.zip");
        assert!(error.is_not_ready());
        assert!(!AppError::not_found("job not found: x").is_not_ready());
        assert!(!AppError::conflict_because(NOT_READY, "x").is_not_ready());
        let (status, payload) = response_json(error).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(payload["code"], 40400);
        assert_eq!(payload["message"], "all.zip not ready");
        assert_eq!(payload["error"]["code"], "NOT_FOUND");
        assert_eq!(payload["error"]["details"], serde_json::json!({ "reason": "not_ready" }));
    }

    #[tokio::test]
    async fn reasoned_conflict_exposes_numeric_code_stable_code_and_reason() {
        let (status, payload) =
            response_json(AppError::conflict_because("ambiguous_request", "needs confirmation")).await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(payload["code"], 40900);
        assert_eq!(payload["message"], "needs confirmation");
        assert_eq!(payload["error"]["code"], "CONFLICT");
        assert_eq!(payload["error"]["http_status"], 409);
        assert_eq!(payload["error"]["details"]["reason"], "ambiguous_request");
    }

    #[test]
    fn invalid_json_body_names_unknown_fields_but_never_echoes_values() {
        #[derive(Debug, serde::Deserialize)]
        #[serde(deny_unknown_fields)]
        #[allow(dead_code)]
        struct Body {
            count: u32,
            mode: Mode,
        }
        #[derive(Debug, serde::Deserialize)]
        #[serde(rename_all = "snake_case")]
        enum Mode {
            Fast,
        }
        let message = |raw: &str| {
            let error = serde_json::from_str::<Body>(raw).unwrap_err();
            let error = AppError::invalid_json_body("invalid job payload", &error);
            assert!(
                matches!(&error, AppError::Reasoned { status, .. } if *status == StatusCode::BAD_REQUEST),
                "状态码是 400: {error:?}"
            );
            error.to_string()
        };
        assert_eq!(
            message(r#"{"count":1,"mode":"fast","extra":"secret-value"}"#),
            "invalid job payload: unknown field `extra`, expected `count` or `mode` in the request body"
        );
        for raw in [r#"{"count":"secret-value","mode":"fast"}"#, r#"{"count":1,"mode":"secret-value"}"#] {
            assert_eq!(message(raw), "invalid job payload: request body does not match the expected schema");
        }
        assert_eq!(message(r#"{"count": secret-value"#), "invalid job payload: invalid JSON request body");
        let from_value = serde_json::from_value::<Body>(serde_json::json!({"count": 1, "mode": "fast", "x": 1}))
            .unwrap_err();
        assert!(AppError::invalid_json_body("ctx", &from_value).to_string().starts_with("ctx: unknown field `x`"));
    }

    /// 第 13 条（2026-11-24）：请求体写错一律 400 + `BAD_REQUEST`，`error.details.reason` 区分三种情况；
    /// 顶层 `code` 是数字 40000。
    #[tokio::test]
    async fn request_body_errors_are_400_with_reason() {
        #[derive(Debug, serde::Deserialize)]
        #[serde(deny_unknown_fields)]
        #[allow(dead_code)]
        struct Body {
            count: u32,
        }
        let parse = |raw: &str| {
            let error = serde_json::from_str::<Body>(raw).unwrap_err();
            AppError::invalid_json_body("invalid job payload", &error)
        };
        for (raw, reason) in [
            (r#"{"count":"secret-value"}"#, SCHEMA_MISMATCH),
            (r#"{}"#, SCHEMA_MISMATCH),
            (r#"{"count":1,"extra":true}"#, UNKNOWN_FIELD),
            (r#"{"count": secret-value"#, INVALID_JSON),
        ] {
            let (status, payload) = response_json(parse(raw)).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "{raw}");
            assert_eq!(payload["code"], 40000, "{raw}");
            assert_eq!(payload["error"]["code"], "BAD_REQUEST", "{raw}");
            assert_eq!(payload["error"]["http_status"], 400, "{raw}");
            assert_eq!(payload["error"]["details"], serde_json::json!({ "reason": reason }), "{raw}");
            assert!(!payload.to_string().contains("secret-value"), "{payload}");
        }
    }
}
