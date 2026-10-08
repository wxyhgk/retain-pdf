use crate::error::AppError;
use crate::models::request::CreateJobInput;

use super::parsing::{
    parse_bool_like, parse_f64_like, parse_glossary_entries_field, parse_i64_like,
    parse_json_object_field,
};

pub(super) fn apply_multipart_request_field(
    request: &mut CreateJobInput,
    developer_mode: &mut bool,
    name: &str,
    value: &str,
) -> Result<(), AppError> {
    match name {
        "developer_mode" => *developer_mode = parse_bool_like(value),
        "workflow" => {
            // 后端吸怪：显式接收 workflow，便于日志/校验与未来多工作流复用；未知值保持原值，由 job_builders 再强制为 Ocr
            let normalized = value.trim().to_lowercase();
            let parsed = match normalized.as_str() {
                "ocr" => Some(crate::models::domain::WorkflowKind::Ocr),
                "book" => Some(crate::models::domain::WorkflowKind::Book),
                "translate" => Some(crate::models::domain::WorkflowKind::Translate),
                "render" => Some(crate::models::domain::WorkflowKind::Render),
                _ => None,
            };
            if let Some(kind) = parsed {
                request.workflow = kind;
            }
        }
        "upload_id" => request.source.upload_id = value.to_string(),
        "source_url" => request.source.source_url = value.to_string(),
        "artifact_job_id" => request.source.artifact_job_id = value.to_string(),
        "job_id" => request.runtime.job_id = value.to_string(),
        "mode" => request.translation.mode = value.to_string(),
        "math_mode" => request.translation.math_mode = value.to_string(),
        "skip_title_translation" => {
            request.translation.skip_title_translation = parse_bool_like(value)
        }
        "classify_batch_size" => {
            request.translation.classify_batch_size = parse_i64_like(name, value)?
        }
        "rule_profile_name" => request.translation.rule_profile_name = value.to_string(),
        "custom_rules_text" => request.translation.custom_rules_text = value.to_string(),
        "glossary_id" => request.translation.glossary_id = value.to_string(),
        "glossary_json" | "glossary_entries" => {
            request.translation.glossary_entries = parse_glossary_entries_field(value)?
        }
        "context_mode" => request.translation.context_mode = value.to_string(),
        "glossary_mode" => request.translation.glossary_mode = value.to_string(),
        "memory_mode" => request.translation.memory_mode = value.to_string(),
        "preparation" => request.translation.preparation = value.to_string(),
        "refine" => request.translation.refine = value.to_string(),
        "refine_max_items" => {
            request.translation.refine_max_items = parse_i64_like(name, value)?
        }
        "refine_max_tokens" => {
            request.translation.refine_max_tokens = parse_i64_like(name, value)?
        }
        "reviewer_model" => request.translation.reviewer_model = value.to_string(),
        "reviewer_base_url" => request.translation.reviewer_base_url = value.to_string(),
        "reviewer_api_key" => request.translation.reviewer_api_key = value.to_string(),
        "reviewer_credential_ref" => {
            request.translation.reviewer_credential_ref = value.to_string()
        }
        "api_key" => request.translation.api_key = value.to_string(),
        "credential_ref" => request.translation.credential_ref = value.to_string(),
        "model" => request.translation.model = value.to_string(),
        "base_url" => request.translation.base_url = value.to_string(),
        "render_mode" => request.render.render_mode = value.to_string(),
        "compile_workers" => request.render.compile_workers = parse_i64_like(name, value)?,
        "typst_font_family" => request.render.typst_font_family = value.to_string(),
        "pdf_compress_dpi" => request.render.pdf_compress_dpi = parse_i64_like(name, value)?,
        "start_page" => request.translation.start_page = parse_i64_like(name, value)?,
        "end_page" => request.translation.end_page = parse_i64_like(name, value)?,
        "batch_size" => request.translation.batch_size = parse_i64_like(name, value)?,
        "workers" => request.translation.workers = parse_i64_like(name, value)?,
        "translated_pdf_name" => request.render.translated_pdf_name = value.to_string(),
        "provider" => request.ocr.provider = value.to_string(),
        "ocr_credential_ref" => request.ocr.credential_ref = value.to_string(),
        "mineru_token" => request.ocr.mineru_token = value.to_string(),
        "model_version" => request.ocr.model_version = value.to_string(),
        "paddle_token" => request.ocr.paddle_token = value.to_string(),
        "paddle_api_url" => request.ocr.paddle_api_url = value.to_string(),
        "paddle_model" => request.ocr.paddle_model = value.to_string(),
        "is_ocr" => request.ocr.is_ocr = parse_bool_like(value),
        "disable_formula" => request.ocr.disable_formula = parse_bool_like(value),
        "disable_table" => request.ocr.disable_table = parse_bool_like(value),
        "language" => request.ocr.language = value.to_string(),
        "page_ranges" => request.ocr.page_ranges = value.to_string(),
        "data_id" => request.ocr.data_id = value.to_string(),
        "no_cache" => request.ocr.no_cache = parse_bool_like(value),
        "cache_tolerance" => request.ocr.cache_tolerance = parse_i64_like(name, value)?,
        "extra_formats" => request.ocr.extra_formats = value.to_string(),
        "poll_interval" => request.ocr.poll_interval = parse_i64_like(name, value)?,
        "poll_timeout" => request.ocr.poll_timeout = parse_i64_like(name, value)?,
        "ocr_options" => request.ocr.options = parse_json_object_field(name, value)?,
        "timeout_seconds" => request.runtime.timeout_seconds = parse_i64_like(name, value)?,
        "no_output_timeout_seconds" => {
            request.runtime.no_output_timeout_seconds = parse_i64_like(name, value)?
        }
        "body_font_size_factor" => {
            request.render.body_font_size_factor = parse_f64_like(name, value)?
        }
        "body_leading_factor" => request.render.body_leading_factor = parse_f64_like(name, value)?,
        "inner_bbox_shrink_x" => request.render.inner_bbox_shrink_x = parse_f64_like(name, value)?,
        "inner_bbox_shrink_y" => request.render.inner_bbox_shrink_y = parse_f64_like(name, value)?,
        "inner_bbox_dense_shrink_x" => {
            request.render.inner_bbox_dense_shrink_x = parse_f64_like(name, value)?
        }
        "inner_bbox_dense_shrink_y" => {
            request.render.inner_bbox_dense_shrink_y = parse_f64_like(name, value)?
        }
        "font_unify_mode" => request.render.font_unify_mode = value.to_string(),
        "source_cleanup_strategy" => request.render.source_cleanup_strategy = value.to_string(),
        "engine" => request.render.engine = value.to_string(),
        // 这里曾经是 `_ => {}`,任何没命中的字段名被静默丢弃。
        //
        // JSON 那条路上 CreateJobInput 带 #[serde(deny_unknown_fields)],多一个键直接
        // 400;multipart 这条路是手写逐字段分发,于是同一个拼写错误(比如 camelCase 的
        // batchSize)在 JSON 上报错、在 multipart 上静默降级成默认值,而且没有任何日志。
        // 两条入口对同一份契约的严格程度不一样,比两条都宽松更难查。
        //
        // 文件 part 在 multipart.rs 的 `continue` 处就被取走了,走不到这里。
        unknown => {
            return Err(AppError::bad_request(format!(
                "unknown multipart field: {unknown}"
            )))
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests;
