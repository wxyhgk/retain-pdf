use crate::config::ProviderLimitsConfig;
use crate::error::AppError;
use axum::http::StatusCode;
use retain_data::credentials::{resolve_credential, CredentialResolveError};
use std::path::Path;

use crate::models::domain::{
    OcrProviderKind, UploadRecord, RENDER_ENGINES, SOURCE_CLEANUP_STRATEGIES, TRANSLATION_CONTEXT_MODES,
    TRANSLATION_GLOSSARY_MODES, TRANSLATION_MATH_MODES, TRANSLATION_MEMORY_MODES,
    TRANSLATION_PREPARATION_MODES, TRANSLATION_REFINE_MODES, TRANSLATION_API_PROTOCOLS,
    TRANSLATION_THINKING_LEVELS,
};
use crate::models::request::CreateJobInput;
use crate::ocr_provider::{
    is_configured_command_provider, parse_provider_kind, provider_display_name, provider_token,
    provider_token_field_name, require_supported_provider, PADDLE_OFFICIAL_CLI_TRANSPORT,
    PADDLE_OFFICIAL_HTTP_TRANSPORT,
};

const RENDER_MODES: &[&str] = &["auto", "overlay", "typst", "typst_visual", "dual"];
const FONT_UNIFY_MODES: &[&str] = &["role_min", "off"];

pub fn validate_provider_credentials(input: &CreateJobInput) -> Result<(), AppError> {
    let provider_kind = require_supported_provider(input.ocr.provider.trim())
        .map_err(|err| AppError::bad_request(err.to_string()))?;
    validate_paddle_transport(input, false)?;
    validate_provider_token(input, &provider_kind)?;
    validate_translation_credentials(input)
}

pub fn validate_translation_credentials(input: &CreateJobInput) -> Result<(), AppError> {
    if let Some(connection) = &input.translation.execution_connection {
        use crate::services::model_executor::ModelConnectionPolicy;
        connection
            .validate()
            .map_err(|_| AppError::bad_request("invalid translation.execution_connection"))?;
        if connection.model != input.translation.model
            || connection.base_url.trim_end_matches('/')
                != input.translation.base_url.trim_end_matches('/')
            || connection.credential_ref != input.translation.credential_ref
            || connection.concurrency as i64 != input.translation.workers
            || !input.translation.api_key.is_empty()
            || !input.translation.reviewer_api_key.is_empty()
        {
            return Err(AppError::bad_request("execution_connection must match translation model, endpoint, credential_ref and workers; inline API keys are not allowed"));
        }
    }
    let base_url = input.translation.base_url.trim();
    if base_url.is_empty() {
        return Err(AppError::bad_request("base_url is required"));
    }
    if !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
        return Err(AppError::bad_request(
            "base_url must start with http:// or https://",
        ));
    }

    let api_key = input.translation.api_key.trim();
    let credential_ref = input.translation.credential_ref.trim();
    if api_key.is_empty() && credential_ref.is_empty() {
        return Err(AppError::bad_request(
            "translation.api_key or translation.credential_ref is required",
        ));
    }
    if !api_key.is_empty() && !credential_ref.is_empty() {
        return Err(AppError::bad_request(
            "translation.api_key and translation.credential_ref are mutually exclusive",
        ));
    }
    if !api_key.is_empty() && looks_like_url(api_key) {
        return Err(AppError::bad_request(
            "api_key looks like a URL, not a model API key; check whether frontend fields were mixed up",
        ));
    }
    if input.translation.model.trim().is_empty() {
        return Err(AppError::bad_request("model is required"));
    }
    validate_reviewer_settings(input)
}

/// 审校（挑错）模型的配置位。本期只透传，不发请求；全部留空表示回退到翻译模型。
/// key 的两种来源与翻译 key 同一套规则：内联与引用互斥，内联值不能像 URL。
fn validate_reviewer_settings(input: &CreateJobInput) -> Result<(), AppError> {
    let reviewer_base_url = input.translation.reviewer_base_url.trim();
    if !reviewer_base_url.is_empty()
        && !(reviewer_base_url.starts_with("http://") || reviewer_base_url.starts_with("https://"))
    {
        return Err(AppError::bad_request(
            "reviewer_base_url must start with http:// or https://",
        ));
    }
    let reviewer_api_key = input.translation.reviewer_api_key.trim();
    let reviewer_credential_ref = input.translation.reviewer_credential_ref.trim();
    if !reviewer_api_key.is_empty() && !reviewer_credential_ref.is_empty() {
        return Err(AppError::bad_request(
            "translation.reviewer_api_key and translation.reviewer_credential_ref are mutually exclusive",
        ));
    }
    if !reviewer_api_key.is_empty() && looks_like_url(reviewer_api_key) {
        return Err(AppError::bad_request(
            "reviewer_api_key looks like a URL, not a model API key; check whether frontend fields were mixed up",
        ));
    }
    Ok(())
}

pub fn validate_translation_credential_reference(
    input: &CreateJobInput,
    data_root: &Path,
) -> Result<(), AppError> {
    for credential_ref in [
        input.translation.credential_ref.trim(),
        input.translation.reviewer_credential_ref.trim(),
    ] {
        if credential_ref.is_empty() {
            continue;
        }
        resolve_credential(data_root, credential_ref, "translation_api_key")
            .map(|_| ())
            .map_err(map_credential_reference_error)?;
    }
    Ok(())
}

pub fn validate_ocr_credential_reference(
    input: &CreateJobInput,
    data_root: &Path,
) -> Result<(), AppError> {
    let credential_ref = input.ocr.credential_ref.trim();
    if credential_ref.is_empty() {
        return Ok(());
    }
    let resolved = resolve_credential(data_root, credential_ref, "ocr_provider_token")
        .map_err(map_credential_reference_error)?;
    let expected_provider = input.ocr.provider.trim().to_ascii_lowercase();
    let actual_provider = resolved.provider.trim().to_ascii_lowercase();
    if actual_provider != expected_provider {
        return Err(AppError::credential_reference(
            StatusCode::BAD_REQUEST,
            "CREDENTIAL_PROVIDER_MISMATCH",
            format!(
                "OCR credential provider does not match requested provider: expected {expected_provider}, got {actual_provider}"
            ),
        ));
    }
    Ok(())
}

pub(crate) fn map_credential_reference_error(error: CredentialResolveError) -> AppError {
    match error {
        CredentialResolveError::InvalidReference => AppError::credential_reference(
            StatusCode::BAD_REQUEST,
            "CREDENTIAL_REF_INVALID",
            error.to_string(),
        ),
        CredentialResolveError::NotFound => AppError::credential_reference(
            StatusCode::NOT_FOUND,
            "CREDENTIAL_REF_NOT_FOUND",
            error.to_string(),
        ),
        CredentialResolveError::KindMismatch { .. } => AppError::credential_reference(
            StatusCode::BAD_REQUEST,
            "CREDENTIAL_KIND_MISMATCH",
            error.to_string(),
        ),
        CredentialResolveError::VaultUnreadable
        | CredentialResolveError::VaultUnsafe
        | CredentialResolveError::VaultInvalid => AppError::credential_reference(
            StatusCode::INTERNAL_SERVER_ERROR,
            "CREDENTIAL_VAULT_UNAVAILABLE",
            error.to_string(),
        ),
    }
}

/// 校验 translation 里那几个枚举型字段。
///
/// 在此之前 Rust 侧一个都不校验,填错的值会一路走到 Python 被**静默归一化**成默认值：
/// `context_mode="alll"` 静默变 `needed`、`memory_mode="broad_"` 静默变 `matched`。
/// 用户以为开了某个开关,实际从没生效,而且没有任何提示 —— 比直接报错难查得多。
///
/// 只校验值域封闭的那四个。`mode` 和 `rule_profile_name` 见
/// `TRANSLATION_MATH_MODES` 上面那段注释。
pub fn validate_translation_modes(input: &CreateJobInput) -> Result<(), AppError> {
    validate_allowed_value(
        "translation.math_mode",
        &input.translation.math_mode,
        TRANSLATION_MATH_MODES,
    )?;
    validate_allowed_value(
        "translation.context_mode",
        &input.translation.context_mode,
        TRANSLATION_CONTEXT_MODES,
    )?;
    validate_allowed_value(
        "translation.glossary_mode",
        &input.translation.glossary_mode,
        TRANSLATION_GLOSSARY_MODES,
    )?;
    validate_allowed_value(
        "translation.memory_mode",
        &input.translation.memory_mode,
        TRANSLATION_MEMORY_MODES,
    )?;
    validate_allowed_value(
        "translation.preparation",
        &input.translation.preparation,
        TRANSLATION_PREPARATION_MODES,
    )?;
    validate_allowed_value(
        "translation.refine",
        &input.translation.refine,
        TRANSLATION_REFINE_MODES,
    )?;
    validate_allowed_value(
        "translation.api_protocol",
        &input.translation.api_protocol,
        TRANSLATION_API_PROTOCOLS,
    )?;
    validate_allowed_value(
        "translation.thinking",
        &input.translation.thinking,
        TRANSLATION_THINKING_LEVELS,
    )?;
    // 审校的两项留空表示沿用翻译模型的设置。
    if !input.translation.reviewer_api_protocol.is_empty() {
        validate_allowed_value(
            "translation.reviewer_api_protocol",
            &input.translation.reviewer_api_protocol,
            TRANSLATION_API_PROTOCOLS,
        )?;
    }
    if !input.translation.reviewer_thinking.is_empty() {
        validate_allowed_value(
            "translation.reviewer_thinking",
            &input.translation.reviewer_thinking,
            TRANSLATION_THINKING_LEVELS,
        )?;
    }
    for (field, value) in [
        ("translation.refine_max_items", input.translation.refine_max_items),
        ("translation.refine_max_tokens", input.translation.refine_max_tokens),
    ] {
        if value < 0 {
            return Err(AppError::bad_request(format!(
                "{field} must be >= 0 (0 means unlimited)"
            )));
        }
    }
    Ok(())
}

pub fn validate_render_options(input: &CreateJobInput) -> Result<(), AppError> {
    validate_optional_output_filename(
        "render.translated_pdf_name",
        &input.render.translated_pdf_name,
    )?;
    validate_allowed_value(
        "render.render_mode",
        &input.render.render_mode,
        RENDER_MODES,
    )?;
    validate_allowed_value(
        "render.font_unify_mode",
        &input.render.font_unify_mode,
        FONT_UNIFY_MODES,
    )?;
    validate_allowed_value(
        "render.source_cleanup_strategy",
        &input.render.source_cleanup_strategy,
        SOURCE_CLEANUP_STRATEGIES,
    )?;
    validate_allowed_value("render.engine", &input.render.engine, RENDER_ENGINES)?;
    if input.render.compile_workers < 0 {
        return Err(AppError::bad_request(
            "render.compile_workers must be greater than or equal to 0",
        ));
    }
    if input.render.pdf_compress_dpi < 0 {
        return Err(AppError::bad_request(
            "render.pdf_compress_dpi must be greater than or equal to 0",
        ));
    }
    validate_positive_finite(
        "render.body_font_size_factor",
        input.render.body_font_size_factor,
    )?;
    validate_positive_finite(
        "render.body_leading_factor",
        input.render.body_leading_factor,
    )?;
    validate_non_negative_finite(
        "render.inner_bbox_shrink_x",
        input.render.inner_bbox_shrink_x,
    )?;
    validate_non_negative_finite(
        "render.inner_bbox_shrink_y",
        input.render.inner_bbox_shrink_y,
    )?;
    validate_non_negative_finite(
        "render.inner_bbox_dense_shrink_x",
        input.render.inner_bbox_dense_shrink_x,
    )?;
    validate_non_negative_finite(
        "render.inner_bbox_dense_shrink_y",
        input.render.inner_bbox_dense_shrink_y,
    )?;
    Ok(())
}

fn validate_optional_output_filename(field: &str, value: &str) -> Result<(), AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    let path = Path::new(trimmed);
    if path.is_absolute()
        || path.components().count() != 1
        || trimmed.contains('/')
        || trimmed.contains('\\')
    {
        return Err(AppError::bad_request(format!(
            "{field} must be a file name, not a path"
        )));
    }
    Ok(())
}

/// 所有工作流共用的 runtime 参数校验。
///
/// `timeout_seconds` 原先只在 `validate_ocr_provider_request` 里查，而那个函数
/// 只被 OCR-only 的创建路径调用。另外三条（full pipeline / translate-only /
/// render-only）从不校验，multipart 的 `parse_i64_like` 也没有范围检查——于是
/// `timeout_seconds=0` 能一路打到 runner，在
/// `job_runner/process_runner/execution.rs` 落进 `timeout_secs > 0` 的 else 分支，
/// 走裸 `child.wait().await?`，**完全没有超时**，进程可以永远挂着。
///
/// 所以这条校验必须挂在所有创建路径的公共入口上，而不是某一条路径里。
pub fn validate_runtime_limits(input: &CreateJobInput) -> Result<(), AppError> {
    if input.runtime.timeout_seconds <= 0 {
        return Err(AppError::bad_request(
            "timeout_seconds must be a positive integer",
        ));
    }
    // 与 timeout_seconds 不同,这个允许 0——那是"关闭空闲检测"的意思,也是默认值。
    // 但负数没有任何解释,只能是调用方算错了。
    if input.runtime.no_output_timeout_seconds < 0 {
        return Err(AppError::bad_request(
            "no_output_timeout_seconds must be zero (disabled) or a positive integer",
        ));
    }
    Ok(())
}

pub fn validate_ocr_provider_request(input: &CreateJobInput) -> Result<(), AppError> {
    let provider = input.ocr.provider.trim();
    if provider.is_empty() {
        return Err(AppError::bad_request("provider is required"));
    }
    let provider_kind = require_supported_provider(provider)
        .map_err(|err| AppError::bad_request(err.to_string()))?;
    validate_paddle_transport(input, true)?;
    validate_provider_token(input, &provider_kind)?;
    if !input.source.source_url.trim().is_empty()
        && !(input.source.source_url.starts_with("http://")
            || input.source.source_url.starts_with("https://"))
    {
        return Err(AppError::bad_request(
            "source_url must start with http:// or https://",
        ));
    }
    Ok(())
}

fn validate_paddle_transport(
    input: &CreateJobInput,
    allow_official_cli: bool,
) -> Result<(), AppError> {
    if !matches!(
        parse_provider_kind(&input.ocr.provider),
        OcrProviderKind::Paddle
    ) {
        return Ok(());
    }
    let Some(raw_transport) = input.ocr.options.get("transport") else {
        return Ok(());
    };
    let Some(transport) = raw_transport.as_str().map(str::trim) else {
        return Err(AppError::bad_request(
            "ocr.options.transport must be a string",
        ));
    };
    if transport.is_empty() || transport.eq_ignore_ascii_case(PADDLE_OFFICIAL_HTTP_TRANSPORT) {
        return Ok(());
    }
    if transport.eq_ignore_ascii_case(PADDLE_OFFICIAL_CLI_TRANSPORT) {
        if allow_official_cli {
            return Ok(());
        }
        return Err(AppError::bad_request(
            "ocr.options.transport=official_cli is only supported for workflow=ocr because the CLI result does not provide the bbox/prunedResult contract required by translation and render",
        ));
    }
    Err(AppError::bad_request(format!(
        "ocr.options.transport must be one of: {PADDLE_OFFICIAL_HTTP_TRANSPORT}, {PADDLE_OFFICIAL_CLI_TRANSPORT}"
    )))
}

pub fn validate_mineru_upload_limits(
    input: &CreateJobInput,
    upload: &UploadRecord,
    limits: &ProviderLimitsConfig,
) -> Result<(), AppError> {
    match parse_provider_kind(&input.ocr.provider) {
        OcrProviderKind::Mineru => {
            validate_upload_limit(
                upload,
                "MinerU",
                limits.mineru_max_bytes,
                limits.mineru_max_pages,
                false,
            )?;
        }
        OcrProviderKind::Paddle => {
            validate_upload_limit(
                upload,
                "PaddleOCR",
                limits.paddle_max_bytes,
                limits.paddle_max_pages,
                true,
            )?;
        }
        OcrProviderKind::Local => {}
        OcrProviderKind::Unknown => {}
    }
    Ok(())
}

fn validate_upload_limit(
    upload: &UploadRecord,
    provider_name: &str,
    max_bytes: u64,
    max_pages: u32,
    bytes_inclusive: bool,
) -> Result<(), AppError> {
    let too_large = if bytes_inclusive {
        upload.bytes > max_bytes
    } else {
        upload.bytes >= max_bytes
    };
    if too_large {
        let relation = if bytes_inclusive {
            "不超过"
        } else {
            "小于"
        };
        return Err(AppError::bad_request(format!(
            "{provider_name} API 限制：PDF 文件大小必须{relation} {:.0}MB；当前文件为 {:.2}MB",
            max_bytes as f64 / 1024.0 / 1024.0,
            upload.bytes as f64 / 1024.0 / 1024.0
        )));
    }
    if upload.page_count > max_pages {
        return Err(AppError::bad_request(format!(
            "{provider_name} API 限制：PDF 页数必须不超过 {max_pages} 页；当前文件为 {} 页",
            upload.page_count
        )));
    }
    Ok(())
}

fn looks_like_url(value: &str) -> bool {
    let value = value.trim().to_ascii_lowercase();
    value.starts_with("http://") || value.starts_with("https://")
}

fn validate_allowed_value(field: &str, value: &str, allowed: &[&str]) -> Result<(), AppError> {
    let normalized = value.trim().to_ascii_lowercase();
    if allowed.iter().any(|candidate| *candidate == normalized) {
        return Ok(());
    }
    Err(AppError::bad_request(format!(
        "{field} must be one of: {}",
        allowed.join(", ")
    )))
}

fn validate_positive_finite(field: &str, value: f64) -> Result<(), AppError> {
    if value.is_finite() && value > 0.0 {
        return Ok(());
    }
    Err(AppError::bad_request(format!(
        "{field} must be a positive finite number"
    )))
}

fn validate_non_negative_finite(field: &str, value: f64) -> Result<(), AppError> {
    if value.is_finite() && value >= 0.0 {
        return Ok(());
    }
    Err(AppError::bad_request(format!(
        "{field} must be a non-negative finite number"
    )))
}

fn validate_provider_token(
    input: &CreateJobInput,
    provider_kind: &OcrProviderKind,
) -> Result<(), AppError> {
    let is_configured = is_configured_command_provider(&input.ocr.provider);
    let configured_token = configured_provider_inline_token(input);
    let token = if is_configured {
        configured_token
    } else {
        provider_token(provider_kind, &input.ocr)
    };
    let credential_ref = input.ocr.credential_ref.trim();
    if !token.is_empty() && !credential_ref.is_empty() {
        return Err(AppError::bad_request(
            "OCR inline credential and ocr.credential_ref are mutually exclusive",
        ));
    }
    if !credential_ref.is_empty() {
        return Ok(());
    }
    if matches!(provider_kind, OcrProviderKind::Local) {
        return Ok(());
    }
    let field_name = provider_token_field_name(provider_kind).unwrap_or("provider_token");
    let display_name = provider_display_name(provider_kind).unwrap_or("Provider");
    if token.is_empty() {
        return Err(AppError::bad_request(format!("{field_name} is required")));
    }
    if looks_like_url(token) {
        return Err(AppError::bad_request(format!(
            "{field_name} looks like a URL, not a {display_name} API key; check whether frontend fields were mixed up",
        )));
    }
    Ok(())
}

fn configured_provider_inline_token(input: &CreateJobInput) -> &str {
    ["credential", "token", "api_key"]
        .into_iter()
        .find_map(|key| {
            input
                .ocr
                .options
                .get(key)
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or("")
}

#[cfg(test)]
mod tests;
