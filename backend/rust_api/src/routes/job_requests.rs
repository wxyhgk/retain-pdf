use crate::error::AppError;
use crate::models::{CreateJobInput, GlossaryEntryInput};
use axum::extract::Multipart;

pub struct ParsedTranslateBundle {
    pub filename: String,
    pub file_bytes: Vec<u8>,
    pub developer_mode: bool,
    pub request: CreateJobInput,
}

pub struct ParsedOcrJob {
    pub filename: Option<String>,
    pub file_bytes: Option<Vec<u8>>,
    pub developer_mode: bool,
    pub request: CreateJobInput,
}

pub async fn parse_translate_bundle_request(
    multipart: &mut Multipart,
) -> Result<ParsedTranslateBundle, AppError> {
    let mut file_name: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut developer_mode = false;
    let mut request = CreateJobInput::default();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().trim().to_string();
        if name.is_empty() {
            continue;
        }
        if name == "file" {
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.pdf".to_string());
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::bad_request(e.to_string()))?;
            file_name = Some(filename);
            file_bytes = Some(data.to_vec());
            continue;
        }

        let value = field
            .text()
            .await
            .map_err(|e| AppError::bad_request(e.to_string()))?;
        apply_multipart_request_field(&mut request, &mut developer_mode, &name, value.trim())?;
    }

    Ok(ParsedTranslateBundle {
        filename: file_name
            .ok_or_else(|| AppError::bad_request("missing multipart field: file"))?,
        file_bytes: file_bytes.ok_or_else(|| AppError::bad_request("empty upload"))?,
        developer_mode,
        request,
    })
}

pub async fn parse_ocr_job_request(multipart: &mut Multipart) -> Result<ParsedOcrJob, AppError> {
    let mut file_name: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut developer_mode = false;
    let mut request = CreateJobInput::default();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::bad_request(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().trim().to_string();
        if name.is_empty() {
            continue;
        }
        if name == "file" {
            let filename = field
                .file_name()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "upload.pdf".to_string());
            let data = field
                .bytes()
                .await
                .map_err(|e| AppError::bad_request(e.to_string()))?;
            file_name = Some(filename);
            file_bytes = Some(data.to_vec());
            continue;
        }
        let value = field
            .text()
            .await
            .map_err(|e| AppError::bad_request(e.to_string()))?;
        if name == "source_url" {
            request.source.source_url = value.trim().to_string();
            continue;
        }
        if name == "provider" {
            request.ocr.provider = value.trim().to_string();
            continue;
        }
        apply_multipart_request_field(&mut request, &mut developer_mode, &name, value.trim())?;
    }

    Ok(ParsedOcrJob {
        filename: file_name,
        file_bytes,
        developer_mode,
        request,
    })
}

fn apply_multipart_request_field(
    request: &mut CreateJobInput,
    developer_mode: &mut bool,
    name: &str,
    value: &str,
) -> Result<(), AppError> {
    match name {
        "developer_mode" => *developer_mode = parse_bool_like(value),
        "workflow" => {}
        "upload_id" => request.source.upload_id = value.to_string(),
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
        "api_key" => request.translation.api_key = value.to_string(),
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
        "timeout_seconds" => request.runtime.timeout_seconds = parse_i64_like(name, value)?,
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
        _ => {}
    }
    Ok(())
}

fn parse_glossary_entries_field(value: &str) -> Result<Vec<GlossaryEntryInput>, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<Vec<GlossaryEntryInput>>(trimmed)
        .map_err(|err| AppError::bad_request(format!("glossary_json must be a JSON array: {err}")))
}

fn parse_bool_like(value: &str) -> bool {
    matches!(
        value.trim(),
        "1" | "true" | "True" | "TRUE" | "yes" | "Yes" | "YES" | "on" | "ON"
    )
}

fn parse_i64_like(name: &str, value: &str) -> Result<i64, AppError> {
    value
        .parse::<i64>()
        .map_err(|_| AppError::bad_request(format!("{name} must be an integer")))
}

fn parse_f64_like(name: &str, value: &str) -> Result<f64, AppError> {
    value
        .parse::<f64>()
        .map_err(|_| AppError::bad_request(format!("{name} must be a number")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_multipart_request_field_maps_flat_fields_into_grouped_input() {
        let mut request = CreateJobInput::default();
        let mut developer_mode = false;

        apply_multipart_request_field(&mut request, &mut developer_mode, "upload_id", "upload-1")
            .expect("upload_id");
        apply_multipart_request_field(&mut request, &mut developer_mode, "mineru_token", "mineru")
            .expect("mineru_token");
        apply_multipart_request_field(
            &mut request,
            &mut developer_mode,
            "base_url",
            "https://api.deepseek.com/v1",
        )
        .expect("base_url");
        apply_multipart_request_field(&mut request, &mut developer_mode, "api_key", "sk-test")
            .expect("api_key");
        apply_multipart_request_field(&mut request, &mut developer_mode, "render_mode", "auto")
            .expect("render_mode");
        apply_multipart_request_field(&mut request, &mut developer_mode, "timeout_seconds", "600")
            .expect("timeout_seconds");

        assert!(!developer_mode);
        assert_eq!(request.source.upload_id, "upload-1");
        assert_eq!(request.ocr.mineru_token, "mineru");
        assert_eq!(request.translation.base_url, "https://api.deepseek.com/v1");
        assert_eq!(request.translation.api_key, "sk-test");
        assert_eq!(request.render.render_mode, "auto");
        assert_eq!(request.runtime.timeout_seconds, 600);
    }

    #[test]
    fn apply_multipart_request_field_parses_glossary_fields() {
        let mut request = CreateJobInput::default();
        let mut developer_mode = false;

        apply_multipart_request_field(
            &mut request,
            &mut developer_mode,
            "glossary_id",
            "glossary-123",
        )
        .expect("glossary_id");
        apply_multipart_request_field(
            &mut request,
            &mut developer_mode,
            "glossary_json",
            r#"[{"source":"band gap","target":"带隙","note":"materials"}]"#,
        )
        .expect("glossary_json");

        assert_eq!(request.translation.glossary_id, "glossary-123");
        assert_eq!(request.translation.glossary_entries.len(), 1);
        assert_eq!(request.translation.glossary_entries[0].source, "band gap");
        assert_eq!(request.translation.glossary_entries[0].target, "带隙");
        assert_eq!(request.translation.glossary_entries[0].note, "materials");
    }

    #[test]
    fn parse_glossary_entries_field_rejects_non_array_payload() {
        let err = parse_glossary_entries_field(r#"{"source":"band gap"}"#)
            .expect_err("should reject non-array glossary payload");
        assert!(err
            .to_string()
            .contains("glossary_json must be a JSON array"));
    }
}
