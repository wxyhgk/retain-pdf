use super::extract_structured_failure;
use crate::job_failure::{classify_job_failure, STRUCTURED_FAILURE_LABEL};
use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::models::request::CreateJobInput;
use serde_json::json;

#[test]
fn classify_worker_failure_accepts_dual_protocol_fields_and_preserves_traceback() {
    let message = "name 'BBOX_TEXT_STRIP_PAGE_SKIP_NO_TEXT_OVERLAP' is not defined";
    let traceback = format!("Traceback (most recent call last):\nNameError: {message}");
    // Match the Python worker's emitted shape: canonical and legacy fields coexist.
    let payload = json!({
        "failed_stage": "render", "stage": "render",
        "failure_code": "python_unhandled_exception", "error_type": "python_unhandled_exception",
        "failure_category": "render", "detail": message,
        "summary": "任务失败，但暂未识别出明确根因",
        "retryable": true, "provider": "rendering",
        "raw_excerpt": message, "raw_exception_type": "NameError",
        "raw_exception_message": message, "traceback": traceback,
        "suggestion": "检查渲染输入、字体和编译环境。"
    });
    let mut job = JobSnapshot::new(
        "render-failure".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.error = Some(format!(
        "{traceback}\n{STRUCTURED_FAILURE_LABEL}: {payload}\n"
    ));

    let failure = classify_job_failure(&job).expect("structured failure");
    assert_eq!(
        failure.failure_code.as_deref(),
        Some("python_unhandled_exception")
    );
    assert_eq!(failure.failed_stage.as_deref(), Some("render"));
    assert_eq!(failure.failure_category.as_deref(), Some("render"));
    assert_eq!(failure.root_cause.as_deref(), Some(message));
    assert_eq!(failure.raw_excerpt.as_deref(), Some(message));
    let raw = failure.raw_diagnostic.expect("raw diagnostic");
    assert_eq!(raw.raw_exception_type.as_deref(), Some("NameError"));
    assert_eq!(raw.raw_exception_message.as_deref(), Some(message));
    assert_eq!(raw.traceback.as_deref(), Some(traceback.as_str()));
}

#[test]
fn structured_failure_prefers_canonical_fields_over_conflicting_legacy_fields() {
    let payload = json!({
        "failed_stage": "render", "stage": "translation",
        "failure_code": "python_unhandled_exception", "error_type": "old_error",
        "root_cause": "current cause", "detail": "legacy cause"
    });
    let parsed = extract_structured_failure(
        STRUCTURED_FAILURE_LABEL,
        &format!("{STRUCTURED_FAILURE_LABEL}: {payload}"),
    )
    .expect("dual-field payload");
    assert_eq!(parsed.failed_stage.as_deref(), Some("render"));
    assert_eq!(
        parsed.failure_code.as_deref(),
        Some("python_unhandled_exception")
    );
    assert_eq!(parsed.root_cause.as_deref(), Some("current cause"));
}

#[test]
fn structured_failure_falls_back_to_legacy_fields_when_canonical_fields_are_empty() {
    for empty in [json!(null), json!(""), json!("  ")] {
        let payload = json!({
            "failed_stage": empty, "stage": "render",
            "failure_code": empty, "error_type": "python_unhandled_exception",
            "root_cause": empty, "detail": "legacy cause"
        });
        let parsed = extract_structured_failure(
            STRUCTURED_FAILURE_LABEL,
            &format!("{STRUCTURED_FAILURE_LABEL}: {payload}"),
        )
        .expect("empty canonical fields");
        assert_eq!(parsed.failed_stage.as_deref(), Some("render"));
        assert_eq!(
            parsed.failure_code.as_deref(),
            Some("python_unhandled_exception")
        );
        assert_eq!(parsed.root_cause.as_deref(), Some("legacy cause"));
    }
}

#[test]
fn structured_failure_uses_latest_valid_payload_and_ignores_malformed_lines() {
    let log = format!(
        "{STRUCTURED_FAILURE_LABEL}: {{\"stage\":\"startup\"}}\n\
         {STRUCTURED_FAILURE_LABEL}: {{\"failed_stage\":\"render\",\"stage\":\"render\"}}\n\
         {STRUCTURED_FAILURE_LABEL}: {{invalid json\n"
    );
    let parsed =
        extract_structured_failure(STRUCTURED_FAILURE_LABEL, &log).expect("latest valid failure");
    assert_eq!(parsed.failed_stage.as_deref(), Some("render"));
}

fn failed_job(error: String, stage: &str) -> JobSnapshot {
    let mut job = JobSnapshot::new(
        "upstream-failure".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some(stage.to_string());
    job.error = Some(error);
    job
}

/// worker 写的 `upstream` 原样带到任务失败上（前端拿它查错误码目录）。
#[test]
fn structured_failure_carries_the_worker_upstream() {
    let payload = json!({
        "failed_stage": "provider", "failure_code": "upstream_quota_exhausted",
        "failure_category": "billing", "summary": "上游账户余额或额度不足（HTTP 429）",
        "retryable": false, "provider": "glm_ocr", "provider_code": "1113",
        "upstream": {"provider": "glm_ocr", "http_status": 429, "code": "1113"}
    });
    let job = failed_job(format!("{STRUCTURED_FAILURE_LABEL}: {payload}"), "failed");
    let failure = classify_job_failure(&job).expect("structured failure");
    let upstream = failure.upstream.expect("upstream");
    assert_eq!(upstream.provider.as_deref(), Some("glm_ocr"));
    assert_eq!(upstream.http_status, Some(429));
    assert_eq!(upstream.code.as_deref(), Some("1113"));
    assert_eq!(failure.provider.as_deref(), Some("glm_ocr"));
    assert_eq!(failure.failure_code.as_deref(), Some("upstream_quota_exhausted"));
}

/// 旧 worker 没有这个键、写成 null、写得不对（不是对象）都当没有，整行照样解析。
#[test]
fn missing_null_or_malformed_upstream_is_ignored() {
    for upstream in [None, Some(json!(null)), Some(json!("429")), Some(json!({"provider": "openai"}))] {
        let mut payload = json!({
            "failed_stage": "translation", "failure_code": "upstream_rate_limited",
            "summary": "外部服务请求被限流", "retryable": true, "provider": "translation"
        });
        if let Some(value) = upstream.clone() {
            payload["upstream"] = value;
        }
        let parsed = extract_structured_failure(
            STRUCTURED_FAILURE_LABEL,
            &format!("{STRUCTURED_FAILURE_LABEL}: {payload}"),
        )
        .unwrap_or_else(|| panic!("{upstream:?}: 整行应当照样解析"));
        assert!(parsed.upstream.is_none(), "{upstream:?}");
        assert_eq!(parsed.failure_code.as_deref(), Some("upstream_rate_limited"));
    }
}

/// 序列化：有上游信息时三个键都在（不知道的是 null）；没有时整个键不出现。
#[test]
fn upstream_serializes_three_keys_or_nothing() {
    let payload = json!({
        "failed_stage": "translation", "failure_code": "auth_failed", "summary": "鉴权失败",
        "retryable": false, "provider": "translation",
        "upstream": {"provider": "deepseek", "http_status": 401, "code": null}
    });
    let job = failed_job(format!("{STRUCTURED_FAILURE_LABEL}: {payload}"), "translation");
    let value = serde_json::to_value(classify_job_failure(&job).expect("failure")).unwrap();
    assert_eq!(
        value["upstream"],
        json!({"provider": "deepseek", "http_status": 401, "code": null})
    );

    let plain = failed_job("something totally unexpected".to_string(), "translation");
    let value = serde_json::to_value(classify_job_failure(&plain).expect("failure")).unwrap();
    assert!(value.get("upstream").is_none(), "{value}");
}
