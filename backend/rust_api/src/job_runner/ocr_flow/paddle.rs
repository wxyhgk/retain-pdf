use anyhow::Result;
use serde_json::json;
use std::path::Path;

use crate::models::{now_iso, JobRuntimeState};
use crate::ocr_provider::paddle::{
    map_task_status as map_paddle_task_status, normalize_model_name, PaddleClient,
    PaddleProviderError,
};
use crate::ocr_provider::OcrTaskHandle;
use crate::ocr_provider::{OcrErrorCategory, OcrProviderErrorInfo};

use super::artifacts::persist_provider_result;
use super::paddle_markdown::materialize_paddle_markdown_artifacts;
use super::polling::{should_stop_polling, wait_next_poll_or_timeout};
use super::status::{record_provider_trace, update_ocr_job_from_status};
use crate::job_runner::{job_artifacts_mut, ocr_provider_diagnostics_mut, ProcessRuntimeDeps};

use super::save_ocr_job;

pub(super) async fn run_local_ocr_transport_paddle(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &PaddleClient,
    upload_path: &Path,
    provider_result_json_path: &Path,
    job_root: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    log_paddle_unsupported_options(job);
    let model_name = normalize_model_name(&job.request_payload.ocr.paddle_model);
    job.request_payload.ocr.paddle_model = model_name.clone();
    let created = client
        .submit_local_file(
            upload_path,
            &model_name,
            &build_paddle_optional_payload(&model_name, deps.paddle_runtime().max_input_images),
        )
        .await
        .map_err(|err| attach_paddle_runtime_error(job, err, "submit"))?;
    run_paddle_poll_loop(
        deps,
        job,
        client,
        created.data,
        created.trace_id,
        provider_result_json_path,
        job_root,
        parent_job_id,
    )
    .await
}

pub(super) async fn run_remote_ocr_transport_paddle(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &PaddleClient,
    provider_result_json_path: &Path,
    job_root: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    log_paddle_unsupported_options(job);
    let model_name = normalize_model_name(&job.request_payload.ocr.paddle_model);
    job.request_payload.ocr.paddle_model = model_name.clone();
    let created = client
        .submit_remote_url(
            &job.request_payload.source.source_url,
            &model_name,
            &build_paddle_optional_payload(&model_name, deps.paddle_runtime().max_input_images),
        )
        .await
        .map_err(|err| attach_paddle_runtime_error(job, err, "submit"))?;
    run_paddle_poll_loop(
        deps,
        job,
        client,
        created.data,
        created.trace_id,
        provider_result_json_path,
        job_root,
        parent_job_id,
    )
    .await
}

async fn run_paddle_poll_loop(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &PaddleClient,
    job_id: String,
    trace_id: Option<String>,
    provider_result_json_path: &Path,
    job_root: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    record_provider_trace(job, trace_id);
    ocr_provider_diagnostics_mut(job).handle.task_id = Some(job_id.clone());
    job.append_log(&format!("task_id: {}", job_id));
    job.stage = Some("ocr_processing".to_string());
    job.stage_detail = Some("Paddle 任务已提交，等待解析".to_string());
    job.updated_at = now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;

    let poll_interval = std::cmp::max(job.request_payload.ocr.poll_interval, 1) as u64;
    let timeout_secs = std::cmp::max(job.request_payload.ocr.poll_timeout, 1) as u64;

    let started = std::time::Instant::now();
    loop {
        if should_stop_polling(&deps.canceled_jobs, &job.job_id).await {
            return Ok(());
        }
        let task = client
            .query_job(&job_id)
            .await
            .map_err(|err| attach_paddle_runtime_error(job, err, "poll"))?;
        record_provider_trace(job, task.trace_id.clone());
        let item = task.data;
        job.append_log(&format!("paddle task {}: state={}", job_id, item.state));
        update_ocr_job_from_status(
            deps,
            job,
            map_paddle_task_status(
                &item.state,
                OcrTaskHandle {
                    batch_id: None,
                    task_id: Some(job_id.clone()),
                    file_name: None,
                },
                Some(item.error_msg.clone()),
                task.trace_id.clone(),
            ),
            item.extract_progress
                .as_ref()
                .and_then(|progress| progress.extracted_pages),
            item.extract_progress
                .as_ref()
                .and_then(|progress| progress.total_pages),
            parent_job_id,
        )
        .await?;

        if item.state == "done" {
            let jsonl_url = item
                .result_url
                .as_ref()
                .map(|v| v.json_url.trim().to_string())
                .filter(|v| !v.is_empty())
                .ok_or_else(|| {
                    anyhow::Error::new(PaddleProviderError::invalid_response(
                        "poll",
                        "Paddle task finished but resultUrl.jsonUrl is missing",
                        task.trace_id.as_deref(),
                    ))
                })
                .map_err(|err| attach_paddle_runtime_error(job, err, "poll"))?;
            let result = client
                .download_jsonl_result(&jsonl_url)
                .await
                .map_err(|err| attach_paddle_runtime_error(job, err, "download"))?;
            ocr_provider_diagnostics_mut(job).artifacts.full_zip_url = Some(jsonl_url.clone());
            let mut payload = result.payload;
            if let Some(meta) = payload.get_mut("_meta").and_then(|v| v.as_object_mut()) {
                meta.insert("provider".to_string(), json!("paddle"));
                meta.insert("taskId".to_string(), json!(job_id));
                meta.insert("jsonlUrl".to_string(), json!(jsonl_url));
                meta.insert(
                    "traceId".to_string(),
                    json!(task.trace_id.clone().unwrap_or_default()),
                );
            }
            persist_provider_result(job, provider_result_json_path, &payload).await?;
            if let Some(markdown_path) =
                materialize_paddle_markdown_artifacts(&payload, job_root).await?
            {
                job.append_log(&format!("published markdown: {}", markdown_path.display()));
            }
            return Ok(());
        }
        if item.state == "failed" {
            let err = anyhow::Error::new(PaddleProviderError::provider_failed(
                item.error_msg.trim(),
                task.trace_id.as_deref(),
            ));
            return Err(attach_paddle_runtime_error(job, err, "poll"));
        }
        wait_next_poll_or_timeout(started, timeout_secs, poll_interval, || {
            format!("Timed out waiting for Paddle task {}", job_id)
        })
        .await
        .map_err(|_err| {
            let err = anyhow::Error::new(PaddleProviderError::poll_timeout(&job_id));
            attach_paddle_runtime_error(job, err, "poll")
        })?;
    }
}

fn log_paddle_unsupported_options(job: &mut JobRuntimeState) {
    if job.request_payload.ocr.disable_formula {
        job.append_log("paddle provider note: disable_formula is not supported by rust_api transport and will be ignored");
    }
    if job.request_payload.ocr.disable_table {
        job.append_log("paddle provider note: disable_table is not supported by rust_api transport and will be ignored");
    }
    if !job.request_payload.ocr.extra_formats.trim().is_empty() {
        job.append_log("paddle provider note: extra_formats is not supported and will be ignored");
    }
}

fn attach_paddle_runtime_error(
    job: &mut JobRuntimeState,
    err: anyhow::Error,
    stage: &str,
) -> anyhow::Error {
    if let Some(provider_err) = err.downcast_ref::<PaddleProviderError>() {
        apply_paddle_error(
            job,
            provider_err.info().clone(),
            provider_err.stage_detail(),
        );
        return err;
    }
    let info = OcrProviderErrorInfo {
        category: match stage {
            "download" => OcrErrorCategory::ResultDownloadFailed,
            "poll" => OcrErrorCategory::ProviderFailed,
            _ => OcrErrorCategory::Unknown,
        },
        provider_code: None,
        provider_message: Some(err.to_string()),
        operator_hint: Some("请结合 job 日志和 Paddle 任务状态继续排查".to_string()),
        trace_id: job_artifacts_mut(job).provider_trace_id.clone(),
        http_status: None,
    };
    apply_paddle_error(job, info, format!("Paddle {stage} 失败: {}", err));
    err
}

fn apply_paddle_error(job: &mut JobRuntimeState, info: OcrProviderErrorInfo, stage_detail: String) {
    if let Some(trace_id) = info.trace_id.clone() {
        job_artifacts_mut(job).provider_trace_id = Some(trace_id);
    }
    ocr_provider_diagnostics_mut(job).last_error = Some(info);
    if !stage_detail.trim().is_empty() {
        job.stage_detail = Some(stage_detail);
    }
}

fn build_paddle_optional_payload(model: &str, max_input_images: u16) -> serde_json::Value {
    let normalized = model.trim().to_ascii_lowercase();
    if normalized.contains("pp-structurev3") {
        return json!({
            "max_num_input_imgs": max_input_images,
            "markdownIgnoreLabels": [
                "header",
                "header_image",
                "footer",
                "footer_image",
                "number",
                "footnote",
                "aside_text"
            ],
            "useChartRecognition": false,
            "useRegionDetection": true,
            "useDocOrientationClassify": false,
            "useDocUnwarping": false,
            "useTextlineOrientation": false,
            "useSealRecognition": true,
            "useFormulaRecognition": true,
            "useTableRecognition": true,
            "layoutThreshold": 0.5,
            "layoutNms": true,
            "layoutUnclipRatio": 1,
            "textDetLimitType": "min",
            "textDetLimitSideLen": 64,
            "textDetThresh": 0.3,
            "textDetBoxThresh": 0.6,
            "textDetUnclipRatio": 1.5,
            "textRecScoreThresh": 0,
            "sealDetLimitType": "min",
            "sealDetLimitSideLen": 736,
            "sealDetThresh": 0.2,
            "sealDetBoxThresh": 0.6,
            "sealDetUnclipRatio": 0.5,
            "sealRecScoreThresh": 0,
            "useTableOrientationClassify": true,
            "useOcrResultsWithTableCells": true,
            "useE2eWiredTableRecModel": false,
            "useE2eWirelessTableRecModel": false,
            "useWiredTableCellsTransToHtml": false,
            "useWirelessTableCellsTransToHtml": false,
            "parseLanguage": "default",
            "visualize": false
        });
    }

    json!({
        "max_num_input_imgs": max_input_images,
        "mergeLayoutBlocks": false,
        "markdownIgnoreLabels": [
            "header",
            "header_image",
            "footer",
            "footer_image",
            "number",
            "footnote",
            "aside_text"
        ],
        "useDocOrientationClassify": false,
        "useDocUnwarping": false,
        "useLayoutDetection": true,
        "useChartRecognition": false,
        "useSealRecognition": true,
        "useOcrForImageBlock": false,
        "mergeTables": true,
        "relevelTitles": true,
        "layoutShapeMode": "auto",
        "promptLabel": "ocr",
        "repetitionPenalty": 1,
        "temperature": 0,
        "topP": 1,
        "minPixels": 147384,
        "maxPixels": 2822400,
        "layoutNms": true,
        "restructurePages": true,
        "visualize": false
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paddle_optional_payload_sets_page_limit() {
        let payload = build_paddle_optional_payload("PaddleOCR-VL-1.5", 888);
        assert_eq!(payload["max_num_input_imgs"], 888);

        let structure_payload = build_paddle_optional_payload("PP-StructureV3", 777);
        assert_eq!(structure_payload["max_num_input_imgs"], 777);
    }
}
