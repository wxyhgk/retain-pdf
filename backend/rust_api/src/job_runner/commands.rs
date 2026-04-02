use std::path::Path;

use super::JobPaths;
use crate::models::CreateJobRequest;
use crate::AppState;

fn append_job_paths_args(cmd: &mut Vec<String>, job_paths: &JobPaths) {
    cmd.extend([
        "--job-root".to_string(),
        job_paths.root.to_string_lossy().to_string(),
        "--source-dir".to_string(),
        job_paths.source_dir.to_string_lossy().to_string(),
        "--ocr-dir".to_string(),
        job_paths.ocr_dir.to_string_lossy().to_string(),
        "--translated-dir".to_string(),
        job_paths.translated_dir.to_string_lossy().to_string(),
        "--rendered-dir".to_string(),
        job_paths.rendered_dir.to_string_lossy().to_string(),
        "--artifacts-dir".to_string(),
        job_paths.artifacts_dir.to_string_lossy().to_string(),
        "--logs-dir".to_string(),
        job_paths.logs_dir.to_string_lossy().to_string(),
    ]);
}

pub(crate) fn build_command(
    state: &AppState,
    upload_path: &Path,
    request: &CreateJobRequest,
    job_paths: &JobPaths,
) -> Vec<String> {
    let mut cmd = vec![
        state.config.python_bin.clone(),
        state
            .config
            .run_mineru_case_script
            .to_string_lossy()
            .to_string(),
        "--file-path".to_string(),
        upload_path.to_string_lossy().to_string(),
        "--mineru-token".to_string(),
        request.mineru_token.clone(),
        "--model-version".to_string(),
        request.model_version.clone(),
    ];
    if request.is_ocr {
        cmd.push("--is-ocr".to_string());
    }
    if request.disable_formula {
        cmd.push("--disable-formula".to_string());
    }
    if request.disable_table {
        cmd.push("--disable-table".to_string());
    }
    cmd.extend([
        "--language".to_string(),
        request.language.clone(),
        "--page-ranges".to_string(),
        request.page_ranges.clone(),
        "--data-id".to_string(),
        request.data_id.clone(),
    ]);
    if request.no_cache {
        cmd.push("--no-cache".to_string());
    }
    cmd.extend([
        "--cache-tolerance".to_string(),
        request.cache_tolerance.to_string(),
        "--extra-formats".to_string(),
        request.extra_formats.clone(),
        "--poll-interval".to_string(),
        request.poll_interval.to_string(),
        "--poll-timeout".to_string(),
        request.poll_timeout.to_string(),
    ]);
    append_job_paths_args(&mut cmd, job_paths);
    if !request.translated_pdf_name.trim().is_empty() {
        cmd.extend([
            "--translated-pdf-name".to_string(),
            request.translated_pdf_name.trim().to_string(),
        ]);
    }
    cmd.extend([
        "--start-page".to_string(),
        request.start_page.to_string(),
        "--end-page".to_string(),
        request.end_page.to_string(),
        "--batch-size".to_string(),
        request.batch_size.to_string(),
        "--workers".to_string(),
        request.resolved_workers().to_string(),
        "--mode".to_string(),
        request.mode.clone(),
    ]);
    if request.skip_title_translation {
        cmd.push("--skip-title-translation".to_string());
    }
    cmd.extend([
        "--classify-batch-size".to_string(),
        request.classify_batch_size.to_string(),
        "--rule-profile-name".to_string(),
        request.rule_profile_name.clone(),
        "--custom-rules-text".to_string(),
        request.custom_rules_text.clone(),
        "--api-key".to_string(),
        request.api_key.clone(),
        "--model".to_string(),
        request.model.clone(),
        "--base-url".to_string(),
        request.base_url.clone(),
        "--render-mode".to_string(),
        request.render_mode.clone(),
        "--compile-workers".to_string(),
        request.compile_workers.to_string(),
        "--typst-font-family".to_string(),
        request.typst_font_family.clone(),
        "--pdf-compress-dpi".to_string(),
        request.pdf_compress_dpi.to_string(),
        "--body-font-size-factor".to_string(),
        request.body_font_size_factor.to_string(),
        "--body-leading-factor".to_string(),
        request.body_leading_factor.to_string(),
        "--inner-bbox-shrink-x".to_string(),
        request.inner_bbox_shrink_x.to_string(),
        "--inner-bbox-shrink-y".to_string(),
        request.inner_bbox_shrink_y.to_string(),
        "--inner-bbox-dense-shrink-x".to_string(),
        request.inner_bbox_dense_shrink_x.to_string(),
        "--inner-bbox-dense-shrink-y".to_string(),
        request.inner_bbox_dense_shrink_y.to_string(),
    ]);
    cmd
}

pub(crate) fn build_ocr_command(
    state: &AppState,
    upload_path: Option<&Path>,
    request: &CreateJobRequest,
    job_paths: &JobPaths,
) -> Vec<String> {
    let mut cmd = vec![
        state.config.python_bin.clone(),
        state
            .config
            .run_ocr_job_script
            .to_string_lossy()
            .to_string(),
    ];
    if let Some(upload_path) = upload_path {
        cmd.extend([
            "--file-path".to_string(),
            upload_path.to_string_lossy().to_string(),
        ]);
    } else {
        cmd.extend(["--file-url".to_string(), request.source_url.clone()]);
    }
    cmd.extend([
        "--mineru-token".to_string(),
        request.mineru_token.clone(),
        "--model-version".to_string(),
        request.model_version.clone(),
    ]);
    if request.is_ocr {
        cmd.push("--is-ocr".to_string());
    }
    if request.disable_formula {
        cmd.push("--disable-formula".to_string());
    }
    if request.disable_table {
        cmd.push("--disable-table".to_string());
    }
    cmd.extend([
        "--language".to_string(),
        request.language.clone(),
        "--page-ranges".to_string(),
        request.page_ranges.clone(),
        "--data-id".to_string(),
        request.data_id.clone(),
    ]);
    if request.no_cache {
        cmd.push("--no-cache".to_string());
    }
    cmd.extend([
        "--cache-tolerance".to_string(),
        request.cache_tolerance.to_string(),
        "--extra-formats".to_string(),
        request.extra_formats.clone(),
        "--poll-interval".to_string(),
        request.poll_interval.to_string(),
        "--poll-timeout".to_string(),
        request.poll_timeout.to_string(),
    ]);
    append_job_paths_args(&mut cmd, job_paths);
    cmd
}

pub(crate) fn build_translate_from_ocr_command(
    state: &AppState,
    request: &CreateJobRequest,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Vec<String> {
    let mut cmd = vec![
        state.config.python_bin.clone(),
        state
            .config
            .run_translate_from_ocr_script
            .to_string_lossy()
            .to_string(),
        "--source-json".to_string(),
        source_json_path.to_string_lossy().to_string(),
        "--source-pdf".to_string(),
        source_pdf_path.to_string_lossy().to_string(),
    ];
    append_job_paths_args(&mut cmd, job_paths);
    if let Some(layout_json_path) = layout_json_path {
        cmd.extend([
            "--layout-json".to_string(),
            layout_json_path.to_string_lossy().to_string(),
        ]);
    }
    cmd.extend([
        "--start-page".to_string(),
        request.start_page.to_string(),
        "--end-page".to_string(),
        request.end_page.to_string(),
        "--batch-size".to_string(),
        request.batch_size.to_string(),
        "--workers".to_string(),
        request.resolved_workers().to_string(),
        "--mode".to_string(),
        request.mode.clone(),
    ]);
    if request.skip_title_translation {
        cmd.push("--skip-title-translation".to_string());
    }
    cmd.extend([
        "--classify-batch-size".to_string(),
        request.classify_batch_size.to_string(),
        "--rule-profile-name".to_string(),
        request.rule_profile_name.clone(),
        "--custom-rules-text".to_string(),
        request.custom_rules_text.clone(),
        "--api-key".to_string(),
        request.api_key.clone(),
        "--model".to_string(),
        request.model.clone(),
        "--base-url".to_string(),
        request.base_url.clone(),
        "--render-mode".to_string(),
        request.render_mode.clone(),
        "--compile-workers".to_string(),
        request.compile_workers.to_string(),
        "--typst-font-family".to_string(),
        request.typst_font_family.clone(),
        "--pdf-compress-dpi".to_string(),
        request.pdf_compress_dpi.to_string(),
        "--translated-pdf-name".to_string(),
        request.translated_pdf_name.clone(),
        "--body-font-size-factor".to_string(),
        request.body_font_size_factor.to_string(),
        "--body-leading-factor".to_string(),
        request.body_leading_factor.to_string(),
        "--inner-bbox-shrink-x".to_string(),
        request.inner_bbox_shrink_x.to_string(),
        "--inner-bbox-shrink-y".to_string(),
        request.inner_bbox_shrink_y.to_string(),
        "--inner-bbox-dense-shrink-x".to_string(),
        request.inner_bbox_dense_shrink_x.to_string(),
        "--inner-bbox-dense-shrink-y".to_string(),
        request.inner_bbox_dense_shrink_y.to_string(),
    ]);
    cmd
}

pub(crate) fn build_normalize_ocr_command(
    state: &AppState,
    request: &CreateJobRequest,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    provider_result_json_path: &Path,
    provider_zip_path: &Path,
    provider_raw_dir: &Path,
) -> Vec<String> {
    let mut cmd = vec![
        state.config.python_bin.clone(),
        state
            .config
            .run_normalize_ocr_script
            .to_string_lossy()
            .to_string(),
        "--provider".to_string(),
        request.ocr_provider.clone(),
        "--source-json".to_string(),
        source_json_path.to_string_lossy().to_string(),
        "--source-pdf".to_string(),
        source_pdf_path.to_string_lossy().to_string(),
        "--provider-version".to_string(),
        if request.ocr_provider.trim().eq_ignore_ascii_case("paddle") {
            request.paddle_model.clone()
        } else {
            request.model_version.clone()
        },
        "--provider-result-json".to_string(),
        provider_result_json_path.to_string_lossy().to_string(),
        "--provider-zip".to_string(),
        provider_zip_path.to_string_lossy().to_string(),
        "--provider-raw-dir".to_string(),
        provider_raw_dir.to_string_lossy().to_string(),
    ];
    append_job_paths_args(&mut cmd, job_paths);
    cmd
}
