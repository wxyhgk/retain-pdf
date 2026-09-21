use anyhow::Result;

use crate::models::domain::{now_iso, JobRuntimeState};
use crate::ocr_provider::OcrTaskStatus;

use crate::job_runner::{job_artifacts_mut, ocr_provider_diagnostics_mut, ProcessRuntimeDeps};

use super::save_ocr_job;

pub(super) async fn update_ocr_job_from_status(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    status: OcrTaskStatus,
    current: Option<i64>,
    total: Option<i64>,
    parent_job_id: Option<&str>,
) -> Result<()> {
    ocr_provider_diagnostics_mut(job).last_status = Some(status.clone());
    if let Some(stage) = status.stage.clone() {
        job.stage = Some(stage);
    }
    job.stage_detail = ocr_stage_detail_with_progress(
        status.detail.clone().or(status.provider_message.clone()),
        current,
        total,
    );
    job.progress_current = current;
    job.progress_total = total;
    record_provider_trace(job, status.trace_id.clone());
    job.updated_at = now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;
    Ok(())
}

/// 在 provider 自己给的那句文案后面补页码，而不是另起一句。
///
/// `fallback` 来自各 provider 的 `stage_and_detail`（mineru/status.rs、
/// paddle/status.rs），它已经写明了是哪一家。这里原本一拿到页码就无条件拼
/// "Paddle 正在解析文件，第 x/y 页" 并把 fallback 丢掉 —— 于是用 MinerU 跑的任务
/// 在界面上一路显示 "Paddle 正在解析"，看日志的人会以为选错了 provider。
fn ocr_stage_detail_with_progress(
    fallback: Option<String>,
    current: Option<i64>,
    total: Option<i64>,
) -> Option<String> {
    let base = fallback
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .unwrap_or("OCR 正在解析文件");
    match (current, total) {
        (Some(current), Some(total)) if total > 0 => {
            Some(format!("{base}，第 {}/{} 页", current.max(0), total))
        }
        (None, Some(total)) if total > 0 => Some(format!("{base}，共 {total} 页")),
        _ => fallback,
    }
}

pub(super) fn record_provider_trace(job: &mut JobRuntimeState, trace_id: Option<String>) {
    if let Some(trace_id) = trace_id.filter(|item| !item.trim().is_empty()) {
        job_artifacts_mut(job).provider_trace_id = Some(trace_id);
    }
}

#[cfg(test)]
mod tests {
    use super::ocr_stage_detail_with_progress;

    /// 页码要拼在 provider 自己那句后面,不能另起一句把它丢掉。
    ///
    /// 这条曾经写死 "Paddle":于是 spec 里配 mineru 的任务,界面上一路显示
    /// "Paddle 正在解析文件,第 x/y 页",看的人会以为 provider 选错了。
    #[test]
    fn ocr_stage_detail_keeps_the_provider_name_from_the_fallback() {
        for (fallback, expected) in [
            ("MinerU 正在解析文件", "MinerU 正在解析文件，第 12/34 页"),
            ("Paddle 正在解析文件", "Paddle 正在解析文件，第 12/34 页"),
            ("MinerU 正在转换文件", "MinerU 正在转换文件，第 12/34 页"),
        ] {
            assert_eq!(
                ocr_stage_detail_with_progress(Some(fallback.to_string()), Some(12), Some(34))
                    .as_deref(),
                Some(expected),
                "fallback={fallback} 的 provider 名被覆盖了"
            );
        }
    }

    #[test]
    fn ocr_stage_detail_falls_back_when_the_provider_said_nothing() {
        // 没有 fallback 时才用中性文案,而不是替某一家 provider 冒名。
        assert_eq!(
            ocr_stage_detail_with_progress(None, Some(12), Some(34)).as_deref(),
            Some("OCR 正在解析文件，第 12/34 页")
        );
        assert_eq!(
            ocr_stage_detail_with_progress(None, None, Some(34)).as_deref(),
            Some("OCR 正在解析文件，共 34 页")
        );
        assert_eq!(
            ocr_stage_detail_with_progress(Some("   ".to_string()), Some(1), Some(2)).as_deref(),
            Some("OCR 正在解析文件，第 1/2 页"),
            "空白 fallback 不该拼成「　，第 1/2 页」"
        );
    }

    #[test]
    fn ocr_stage_detail_keeps_the_fallback_untouched_without_page_numbers() {
        assert_eq!(
            ocr_stage_detail_with_progress(Some("MinerU 已接收任务，等待排队".to_string()), None, None)
                .as_deref(),
            Some("MinerU 已接收任务，等待排队")
        );
    }
}
