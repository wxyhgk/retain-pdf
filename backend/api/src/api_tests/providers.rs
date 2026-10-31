use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

use crate::api_tests::job_view_contract::{
    assert_definition, assert_exact_object_keys, assert_object_keys_allowing_absent, contract,
};
use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;

const CONTRACT: &str = "ocr-providers.v1.schema.json";

#[tokio::test]
async fn list_ocr_providers_returns_public_contract() {
    let response = build_app(test_state("providers-ocr-contract"))
        .oneshot(
            Request::builder()
                .uri("/api/v1/providers/ocr")
                .header("x-api-key", "test-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::OK);
    let payload = read_json(response).await;
    let providers = payload["data"].as_array().expect("providers array");
    let paddle = providers
        .iter()
        .find(|item| item["key"] == "paddle")
        .expect("paddle provider");
    let local = providers
        .iter()
        .find(|item| item["key"] == "local")
        .expect("local provider");

    assert_eq!(paddle["display_name"], "PaddleOCR");
    assert_eq!(paddle["provider_kind"], "remote");
    assert_eq!(
        paddle["credential"]["credential_kind"],
        "ocr_provider_token"
    );
    assert_eq!(paddle["credential"]["reference_field"], "credential_ref");
    assert_eq!(paddle["credential"]["legacy_inline_field"], "paddle_token");
    assert_eq!(paddle["credential"]["field"], "paddle_token");
    assert_eq!(paddle["credential"]["env"], "RETAIN_PADDLE_API_TOKEN");
    assert_eq!(paddle["options"]["paddle_model"]["type"], "string");
    assert_eq!(
        paddle["options"]["paddle_model"]["default"],
        "PaddleOCR-VL-1.6"
    );
    assert_eq!(
        paddle["options"]["paddle_model"]["aliases"]["paddleocr-vl"],
        "PaddleOCR-VL-1.6"
    );
    assert_eq!(local["provider_kind"], "local_command");
    assert!(local["credential"].is_null());
    assert_eq!(
        local["options"]["command"]["env"],
        "RETAIN_LOCAL_OCR_COMMAND"
    );

    // 审计 A2（2026-10-22）：只能服务器定的选项标 client_settable=false，不给默认值。
    for key in ["command", "raw_provider"] {
        assert_eq!(local["options"][key]["client_settable"], false, "{key}");
        assert!(local["options"][key]["default"].is_null(), "{key}: {local}");
    }
    assert_eq!(paddle["options"]["transport"]["client_settable"], true);
    assert_eq!(paddle["options"]["transport"]["default"], "official_http");
}

/// 契约 `ocr-providers.v1` 的生产者锁：真实接口的返回逐项对类型和键集合（多一个、少一个都红）。
/// 选项里只有 `env` 可以不出现（配置里没写 env 时整个省掉）。
#[tokio::test]
async fn list_ocr_providers_matches_published_schema() {
    let response = build_app(test_state("providers-ocr-schema"))
        .oneshot(
            Request::builder()
                .uri("/api/v1/providers/ocr")
                .header("x-api-key", "test-key")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("response");
    assert_eq!(response.status(), StatusCode::OK);
    let data = read_json(response).await["data"].clone();
    let contract = contract(CONTRACT);
    assert_definition(&data, &contract, "OcrProviderListView", "providers");
    let providers = data.as_array().expect("providers array");
    let keys: Vec<&str> = providers.iter().map(|item| item["key"].as_str().unwrap()).collect();
    assert_eq!(keys, vec!["mineru", "paddle", "glm_ocr", "local"]);
    let mut saw_env = false;
    let mut saw_no_env = false;
    for (index, provider) in providers.iter().enumerate() {
        let path = format!("providers[{index}]");
        assert_exact_object_keys(provider, &contract, "OcrProviderPublicDefinition", &path);
        if !provider["credential"].is_null() {
            assert_exact_object_keys(
                &provider["credential"],
                &contract,
                "OcrProviderCredentialSpec",
                &format!("{path}.credential"),
            );
        }
        assert_exact_object_keys(
            &provider["capabilities"],
            &contract,
            "OcrProviderCapabilities",
            &format!("{path}.capabilities"),
        );
        assert_exact_object_keys(
            &provider["artifact_layout"],
            &contract,
            "OcrProviderArtifactLayout",
            &format!("{path}.artifact_layout"),
        );
        for (name, option) in provider["options"].as_object().expect("options") {
            let option_path = format!("{path}.options.{name}");
            assert_object_keys_allowing_absent(option, &contract, "OcrProviderOptionSpec", &option_path, &["env"]);
            if option.get("env").is_some() {
                saw_env = true;
            } else {
                saw_no_env = true;
            }
            if option["client_settable"] == false {
                assert!(option["default"].is_null(), "{option_path}: {option}");
            }
        }
    }
    assert!(saw_env && saw_no_env, "env 出现和省掉两种写法都要钉到");
}
