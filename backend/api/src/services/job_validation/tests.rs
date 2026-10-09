use super::*;
use crate::models::domain::{now_iso, DEFAULT_SOURCE_CLEANUP_STRATEGY};
use crate::services::credentials::api::{create_credential, CreateCredentialInput};

fn default_limits() -> ProviderLimitsConfig {
    ProviderLimitsConfig::from_env()
}

fn paddle_input() -> CreateJobInput {
    let mut input = CreateJobInput::default();
    input.ocr.provider = "paddle".to_string();
    input
}

fn local_input() -> CreateJobInput {
    let mut input = CreateJobInput::default();
    input.ocr.provider = "local".to_string();
    input
}

fn create_test_credential(root: &Path, kind: &str, provider: &str) -> String {
    create_credential(
        root,
        CreateCredentialInput {
            kind: kind.to_string(),
            provider: provider.to_string(),
            label: "OCR validation test".to_string(),
            secret: "provider-secret".to_string(),
            expected_revision: Some(0),
        },
    )
    .expect("create test credential")
    .credential
    .credential_ref
}

fn upload_with_pages(page_count: u32) -> UploadRecord {
    UploadRecord {
        upload_id: "upload-test".to_string(),
        filename: "paper.pdf".to_string(),
        stored_path: "/tmp/paper.pdf".to_string(),
        bytes: 1,
        page_count,
        uploaded_at: now_iso(),
        developer_mode: false,
        content_hash: String::new(),
    }
}

#[test]
fn paddle_upload_limit_allows_533_pages() {
    assert!(validate_mineru_upload_limits(
        &paddle_input(),
        &upload_with_pages(533),
        &default_limits()
    )
    .is_ok());
}

#[test]
fn paddle_upload_limit_rejects_pages_above_999() {
    let err = validate_mineru_upload_limits(
        &paddle_input(),
        &upload_with_pages(1000),
        &default_limits(),
    )
    .expect_err("1000 pages should exceed Paddle limit");
    assert!(err.to_string().contains("不超过 999 页"));
}

#[test]
fn local_provider_does_not_require_remote_provider_token() {
    assert!(validate_ocr_provider_request(&local_input()).is_ok());
}

#[test]
fn local_provider_does_not_apply_remote_upload_limits() {
    assert!(validate_mineru_upload_limits(
        &local_input(),
        &upload_with_pages(5000),
        &default_limits()
    )
    .is_ok());
}

#[test]
fn paddle_cli_transport_is_allowed_for_ocr_only_requests() {
    let mut input = paddle_input();
    input.ocr.paddle_token = "paddle-secret".to_string();
    input.ocr.options.insert(
        "transport".to_string(),
        serde_json::Value::String("official_cli".to_string()),
    );
    assert!(validate_ocr_provider_request(&input).is_ok());
}

#[test]
fn paddle_cli_transport_is_rejected_for_translation_pipeline() {
    let mut input = paddle_input();
    input.ocr.paddle_token = "paddle-secret".to_string();
    input.translation.api_key = "sk-test".to_string();
    input.ocr.options.insert(
        "transport".to_string(),
        serde_json::Value::String("official_cli".to_string()),
    );
    let err = validate_provider_credentials(&input)
        .expect_err("CLI transport must not feed translation/render");
    assert!(err.to_string().contains("only supported for workflow=ocr"));
}

#[test]
fn ocr_credentials_accept_reference_and_reject_inline_secret_at_same_time() {
    let mut input = paddle_input();
    input.ocr.credential_ref = "cred_ocr_primary".to_string();
    assert!(validate_ocr_provider_request(&input).is_ok());

    input.ocr.paddle_token = "paddle-inline-secret".to_string();
    let error = validate_ocr_provider_request(&input)
        .expect_err("inline token and OCR credential_ref must be exclusive");
    assert!(error.to_string().contains("mutually exclusive"));
}

#[test]
fn configured_provider_option_credential_is_exclusive_with_reference() {
    let mut input = local_input();
    input.ocr.credential_ref = "cred_local_ocr".to_string();
    input.ocr.options.insert(
        "credential".to_string(),
        serde_json::Value::String("configured-inline-secret".to_string()),
    );

    let error = validate_ocr_provider_request(&input)
        .expect_err("configured provider inline secret and reference must be exclusive");
    assert!(error.to_string().contains("mutually exclusive"));
}

#[test]
fn ocr_credential_reference_requires_matching_kind_and_provider() {
    let matching_root = std::env::temp_dir().join(format!(
        "rust-api-ocr-credential-match-{:016x}",
        fastrand::u64(..)
    ));
    let credential_ref =
        create_test_credential(&matching_root, "ocr_provider_token", " Paddle ");
    let mut input = paddle_input();
    input.ocr.credential_ref = credential_ref;
    validate_ocr_credential_reference(&input, &matching_root)
        .expect("provider matching is trimmed and case insensitive");
    let _ = std::fs::remove_dir_all(matching_root);

    let wrong_provider_root = std::env::temp_dir().join(format!(
        "rust-api-ocr-credential-provider-{:016x}",
        fastrand::u64(..)
    ));
    input.ocr.credential_ref =
        create_test_credential(&wrong_provider_root, "ocr_provider_token", "mineru");
    let error = validate_ocr_credential_reference(&input, &wrong_provider_root)
        .expect_err("credential provider mismatch must fail");
    assert!(matches!(
        error,
        AppError::CredentialReference {
            status: StatusCode::BAD_REQUEST,
            code: "CREDENTIAL_PROVIDER_MISMATCH",
            ..
        }
    ));
    let _ = std::fs::remove_dir_all(wrong_provider_root);

    let wrong_kind_root = std::env::temp_dir().join(format!(
        "rust-api-ocr-credential-kind-{:016x}",
        fastrand::u64(..)
    ));
    input.ocr.credential_ref =
        create_test_credential(&wrong_kind_root, "translation_api_key", "paddle");
    let error = validate_ocr_credential_reference(&input, &wrong_kind_root)
        .expect_err("credential kind mismatch must fail");
    assert!(matches!(
        error,
        AppError::CredentialReference {
            status: StatusCode::BAD_REQUEST,
            code: "CREDENTIAL_KIND_MISMATCH",
            ..
        }
    ));
    let _ = std::fs::remove_dir_all(wrong_kind_root);
}

#[test]
fn missing_ocr_credential_reference_is_a_diagnostic_not_found() {
    let root = std::env::temp_dir().join(format!(
        "rust-api-missing-ocr-credential-{:016x}",
        fastrand::u64(..)
    ));
    let mut input = paddle_input();
    input.ocr.credential_ref = "cred_missing".to_string();

    let error = validate_ocr_credential_reference(&input, &root)
        .expect_err("missing OCR credential must fail");
    assert!(matches!(
        error,
        AppError::CredentialReference {
            status: StatusCode::NOT_FOUND,
            code: "CREDENTIAL_REF_NOT_FOUND",
            ..
        }
    ));
}

#[test]
fn paddle_transport_rejects_unknown_or_non_string_values() {
    let mut input = paddle_input();
    input.ocr.paddle_token = "paddle-secret".to_string();
    input.ocr.options.insert(
        "transport".to_string(),
        serde_json::Value::String("local_model".to_string()),
    );
    assert!(validate_ocr_provider_request(&input)
        .expect_err("unknown transport should fail")
        .to_string()
        .contains("must be one of"));

    input
        .ocr
        .options
        .insert("transport".to_string(), serde_json::Value::Bool(true));
    assert!(validate_ocr_provider_request(&input)
        .expect_err("non-string transport should fail")
        .to_string()
        .contains("must be a string"));
}

#[test]
fn translation_credentials_accept_exactly_one_secret_source() {
    let mut input = CreateJobInput::default();
    input.translation.base_url = "https://api.deepseek.com/v1".to_string();
    input.translation.model = "deepseek-chat".to_string();
    input.translation.credential_ref = "cred_translation_primary".to_string();
    assert!(validate_translation_credentials(&input).is_ok());

    input.translation.api_key = "sk-inline".to_string();
    let error = validate_translation_credentials(&input)
        .expect_err("inline key and credential_ref must be exclusive");
    assert!(error.to_string().contains("mutually exclusive"));
}

#[test]
fn translation_credential_reference_reports_structured_not_found() {
    let root = std::env::temp_dir().join(format!(
        "rust-api-missing-credential-{:016x}",
        fastrand::u64(..)
    ));
    let mut input = CreateJobInput::default();
    input.translation.credential_ref = "cred_missing".to_string();

    let error = validate_translation_credential_reference(&input, &root)
        .expect_err("missing credential must fail");
    assert!(matches!(
        error,
        AppError::CredentialReference {
            status: StatusCode::NOT_FOUND,
            code: "CREDENTIAL_REF_NOT_FOUND",
            ..
        }
    ));
}

#[test]
fn translation_modes_accept_the_defaults_and_every_allowed_value() {
    let mut input = CreateJobInput::default();
    validate_translation_modes(&input).expect("默认值必须能过自己的校验");
    for value in TRANSLATION_CONTEXT_MODES {
        input.translation.context_mode = value.to_string();
        validate_translation_modes(&input)
            .unwrap_or_else(|err| panic!("context_mode={value} 应当合法: {err:?}"));
    }
    input.translation.context_mode = "needed".to_string();
    for value in TRANSLATION_MEMORY_MODES {
        input.translation.memory_mode = value.to_string();
        validate_translation_modes(&input)
            .unwrap_or_else(|err| panic!("memory_mode={value} 应当合法: {err:?}"));
    }
    input.translation.memory_mode = "matched".to_string();
    assert_eq!(input.translation.preparation, "off", "preparation 默认必须是 off");
    for value in TRANSLATION_PREPARATION_MODES {
        input.translation.preparation = value.to_string();
        validate_translation_modes(&input)
            .unwrap_or_else(|err| panic!("preparation={value} 应当合法: {err:?}"));
    }
    input.translation.preparation = "off".to_string();
    assert_eq!(input.translation.refine, "off", "refine 默认必须是 off");
    assert_eq!(input.translation.refine_max_items, 300);
    assert_eq!(input.translation.refine_max_tokens, 400_000);
    for value in TRANSLATION_REFINE_MODES {
        input.translation.refine = value.to_string();
        validate_translation_modes(&input)
            .unwrap_or_else(|err| panic!("refine={value} 应当合法: {err:?}"));
    }
    // 0 = 不限，合法。
    input.translation.refine_max_items = 0;
    input.translation.refine_max_tokens = 0;
    validate_translation_modes(&input).expect("refine 上限为 0 表示不限");
}

#[test]
fn refine_limits_reject_negative_values() {
    for field in ["refine_max_items", "refine_max_tokens"] {
        let mut input = CreateJobInput::default();
        match field {
            "refine_max_items" => input.translation.refine_max_items = -1,
            _ => input.translation.refine_max_tokens = -1,
        }
        let err = validate_translation_modes(&input)
            .expect_err(&format!("translation.{field}=-1 应当被拒绝"));
        assert!(format!("{err:?}").contains(field));
    }
}

#[test]
fn reviewer_settings_follow_the_translation_key_rules() {
    let mut input = CreateJobInput::default();
    input.translation.base_url = "https://api.deepseek.com/v1".to_string();
    input.translation.model = "deepseek-chat".to_string();
    input.translation.credential_ref = "cred_translation_primary".to_string();
    // 全部留空 = 回退到翻译模型，合法。
    assert!(validate_translation_credentials(&input).is_ok());

    input.translation.reviewer_model = "reviewer".to_string();
    input.translation.reviewer_credential_ref = "cred_reviewer".to_string();
    assert!(validate_translation_credentials(&input).is_ok());

    input.translation.reviewer_api_key = "sk-reviewer".to_string();
    let error = validate_translation_credentials(&input)
        .expect_err("reviewer inline key and reference must be exclusive");
    assert!(error.to_string().contains("mutually exclusive"));

    input.translation.reviewer_credential_ref.clear();
    input.translation.reviewer_api_key = "https://api.example.com/v1".to_string();
    assert!(validate_translation_credentials(&input).is_err());

    input.translation.reviewer_api_key = "sk-reviewer".to_string();
    input.translation.reviewer_base_url = "api.example.com/v1".to_string();
    assert!(validate_translation_credentials(&input).is_err());
}

#[test]
fn reviewer_credential_reference_must_exist() {
    let root = std::env::temp_dir().join(format!(
        "rust-api-missing-reviewer-credential-{:016x}",
        fastrand::u64(..)
    ));
    let mut input = CreateJobInput::default();
    input.translation.reviewer_credential_ref = "cred_missing_reviewer".to_string();
    assert!(validate_translation_credential_reference(&input, &root).is_err());
}

#[test]
fn translation_modes_reject_typos_instead_of_silently_normalizing() {
    // 这是这条校验存在的全部理由:在此之前 "alll" 会一路走到 Python 被静默
    // 归一化成 "needed",用户以为开了某个开关、实际从没生效,且没有任何提示。
    for (field, value) in [
        ("context_mode", "alll"),
        ("glossary_mode", "match"),
        ("memory_mode", "broad_"),
        ("math_mode", "typst"),
        ("preparation", "terms_style"),
        ("refine", "review"),
    ] {
        let mut input = CreateJobInput::default();
        match field {
            "context_mode" => input.translation.context_mode = value.to_string(),
            "glossary_mode" => input.translation.glossary_mode = value.to_string(),
            "memory_mode" => input.translation.memory_mode = value.to_string(),
            "preparation" => input.translation.preparation = value.to_string(),
            "refine" => input.translation.refine = value.to_string(),
            _ => input.translation.math_mode = value.to_string(),
        }
        let err = validate_translation_modes(&input)
            .expect_err(&format!("translation.{field}={value} 应当被拒绝"));
        let text = format!("{err:?}");
        assert!(
            text.contains(field),
            "报错要指出是哪个字段,实际是: {text}"
        );
    }
}

/// `mode` 和 `rule_profile_name` 刻意不校验,别哪天顺手加上去。
#[test]
fn open_valued_translation_fields_stay_unvalidated() {
    let mut input = CreateJobInput::default();
    input.translation.mode = "whatever".to_string();
    input.translation.rule_profile_name = "a_saved_profile".to_string();
    validate_translation_modes(&input).expect(
        "mode 的取值域是开的(Python 只判 == \"sci\");rule_profile_name 有 saved 扩展分支",
    );
}

    #[test]
fn render_options_accept_current_defaults() {
    let input = CreateJobInput::default();
    assert_eq!(
        input.render.source_cleanup_strategy,
        DEFAULT_SOURCE_CLEANUP_STRATEGY
    );
    assert!(SOURCE_CLEANUP_STRATEGIES.contains(&DEFAULT_SOURCE_CLEANUP_STRATEGY));
    assert!(validate_render_options(&input).is_ok());
}

#[test]
fn render_options_accept_pikepdf_text_strip_cleanup_strategy() {
    let mut input = CreateJobInput::default();
    input.render.source_cleanup_strategy = "pikepdf_text_strip".to_string();
    assert!(validate_render_options(&input).is_ok());
}

#[test]
fn render_options_reject_unknown_cleanup_strategy() {
    let mut input = CreateJobInput::default();
    input.render.source_cleanup_strategy = "delete_everything".to_string();
    let err = validate_render_options(&input).expect_err("unknown strategy should fail");
    assert!(err
        .to_string()
        .contains("render.source_cleanup_strategy must be one of"));
}

#[test]
fn render_engine_defaults_to_typst_and_accepts_rpr() {
    let mut input = CreateJobInput::default();
    assert_eq!(input.render.engine, "typst");
    assert!(validate_render_options(&input).is_ok());
    input.render.engine = "rpr".to_string();
    assert!(validate_render_options(&input).is_ok());
    input.render.engine = "rpr_fit".to_string();
    assert!(validate_render_options(&input).is_ok());
}

#[test]
fn render_options_reject_unknown_engine() {
    let mut input = CreateJobInput::default();
    input.render.engine = "latex".to_string();
    let err = validate_render_options(&input).expect_err("unknown engine should fail");
    assert!(err.to_string().contains("render.engine must be one of"));
}

#[test]
fn render_options_reject_negative_compress_dpi() {
    let mut input = CreateJobInput::default();
    input.render.pdf_compress_dpi = -1;
    let err = validate_render_options(&input).expect_err("negative dpi should fail");
    assert!(err
        .to_string()
        .contains("render.pdf_compress_dpi must be greater than or equal to 0"));
}

#[test]
fn render_options_reject_translated_pdf_name_path_escape() {
    let mut input = CreateJobInput::default();
    input.render.translated_pdf_name = "../outside.pdf".to_string();
    let err = validate_render_options(&input).expect_err("path output should fail");
    assert!(err
        .to_string()
        .contains("render.translated_pdf_name must be a file name"));
}

#[test]
fn render_options_reject_translated_pdf_name_path_separator() {
    let mut input = CreateJobInput::default();
    input.render.translated_pdf_name = "nested/out.pdf".to_string();
    let err = validate_render_options(&input).expect_err("nested output should fail");
    assert!(err
        .to_string()
        .contains("render.translated_pdf_name must be a file name"));
}
