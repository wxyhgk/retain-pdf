use crate::ocr_provider::types::{OcrProviderKind, OcrTaskHandle, OcrTaskState, OcrTaskStatus};

fn map_state(raw_state: &str) -> OcrTaskState {
    match raw_state.trim() {
        "pending" => OcrTaskState::Queued,
        "running" => OcrTaskState::Running,
        "done" => OcrTaskState::Succeeded,
        "failed" => OcrTaskState::Failed,
        _ => OcrTaskState::Unknown,
    }
}

fn stage_and_detail(raw_state: &str, state: &OcrTaskState) -> (&'static str, String) {
    match state {
        OcrTaskState::Queued => ("ocr_upload", "Paddle 已接收任务，等待排队".to_string()),
        OcrTaskState::Running => ("ocr_processing", "Paddle 正在解析文件".to_string()),
        OcrTaskState::Succeeded => (
            "ocr_result_ready",
            "Paddle 结果已就绪，准备标准化".to_string(),
        ),
        OcrTaskState::Failed => ("failed", "Paddle 处理失败".to_string()),
        OcrTaskState::WaitingUpload | OcrTaskState::Converting | OcrTaskState::Unknown => (
            "ocr_processing",
            format!("Paddle 状态: {}", raw_state.trim()),
        ),
    }
}

pub fn map_task_status(
    raw_state: &str,
    handle: OcrTaskHandle,
    provider_message: Option<String>,
    trace_id: Option<String>,
) -> OcrTaskStatus {
    let state = map_state(raw_state);
    let (stage, detail) = stage_and_detail(raw_state, &state);
    OcrTaskStatus {
        provider: OcrProviderKind::Paddle,
        handle,
        state,
        raw_state: Some(raw_state.trim().to_string()),
        stage: Some(stage.to_string()),
        detail: Some(detail),
        provider_message,
        trace_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn done_maps_to_succeeded_ocr_result_ready() {
        let mapped = map_task_status(
            "done",
            OcrTaskHandle::default(),
            Some("ok".to_string()),
            Some("trace-1".to_string()),
        );

        assert_eq!(mapped.state, OcrTaskState::Succeeded);
        assert_eq!(mapped.stage.as_deref(), Some("ocr_result_ready"));
        assert_eq!(mapped.trace_id.as_deref(), Some("trace-1"));
    }

    #[test]
    fn unknown_state_is_preserved() {
        let mapped = map_task_status("mystery", OcrTaskHandle::default(), None, None);

        assert_eq!(mapped.state, OcrTaskState::Unknown);
        assert_eq!(mapped.raw_state.as_deref(), Some("mystery"));
        assert!(mapped
            .detail
            .as_deref()
            .unwrap_or_default()
            .contains("mystery"));
    }
}
