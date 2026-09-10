pub(crate) fn default_mode() -> String {
    "sci".to_string()
}
pub(crate) fn default_math_mode() -> String {
    "direct_typst".to_string()
}
pub(crate) fn default_ocr_provider() -> String {
    "mineru".to_string()
}
pub(crate) fn default_classify_batch_size() -> i64 {
    12
}
pub(crate) fn default_rule_profile_name() -> String {
    "general_sci".to_string()
}
pub(crate) fn default_render_mode() -> String {
    "typst".to_string()
}
pub(crate) fn default_typst_font_family() -> String {
    std::env::var("RETAIN_PDF_TYPST_FONT_FAMILY")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Source Han Serif SC".to_string())
}
pub(crate) fn default_pdf_compress_dpi() -> i64 {
    0
}
pub(crate) fn default_end_page() -> i64 {
    -1
}
pub(crate) fn default_batch_size() -> i64 {
    // 与 Python 引擎默认(TranslationExecutionRequest.batch_size=8)对齐;
    // 1 会禁用批翻译队列,使每个文本块独立发起请求。
    8
}
pub(crate) fn default_model_version() -> String {
    "vlm".to_string()
}
pub(crate) fn default_paddle_model() -> String {
    crate::config::provider_config::paddle_default_model()
}
pub(crate) fn default_language() -> String {
    "ch".to_string()
}
pub(crate) fn default_cache_tolerance() -> i64 {
    900
}
pub(crate) fn default_poll_interval() -> i64 {
    5
}
pub(crate) fn default_poll_timeout() -> i64 {
    1800
}
pub(crate) fn default_timeout_seconds() -> i64 {
    1800
}
pub(crate) fn default_body_font_size_factor() -> f64 {
    0.95
}
pub(crate) fn default_body_leading_factor() -> f64 {
    1.08
}
pub(crate) fn default_font_unify_mode() -> String {
    "role_min".to_string()
}
pub(crate) fn default_source_cleanup_strategy() -> String {
    super::DEFAULT_SOURCE_CLEANUP_STRATEGY.to_string()
}
pub(crate) fn default_inner_bbox_shrink_x() -> f64 {
    0.0
}
pub(crate) fn default_inner_bbox_shrink_y() -> f64 {
    0.0
}
pub(crate) fn default_inner_bbox_dense_shrink_x() -> f64 {
    0.0
}
pub(crate) fn default_inner_bbox_dense_shrink_y() -> f64 {
    0.0
}
pub(crate) fn default_limit() -> u32 {
    crate::config::limits::DEFAULT_LIST_LIMIT
}
pub(crate) fn default_event_limit() -> u32 {
    100
}

// ---- Pagination max limits (centralized) ----
// Single source of truth is `crate::config::limits`; re-export here for
// `models`-local callers and to satisfy contract-first centralization.
pub use crate::config::limits::{
    DEFAULT_LIST_LIMIT, MAX_CONVERSATION_LIMIT, MAX_DOCUMENT_LIMIT, MAX_JOB_EVENT_LIMIT,
    MAX_JOB_LIMIT, MAX_LIST_LIMIT, MAX_SEARCH_LIMIT,
};
