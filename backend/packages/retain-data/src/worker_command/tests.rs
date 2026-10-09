use self::stage_specs::REVIEWER_API_KEY_ENV_NAME;
use self::stage_specs::TRANSLATION_API_KEY_ENV_NAME;
use super::*;
use crate::config::AppConfig;
use crate::models::domain::{OcrProviderKind, WorkflowKind};
use crate::models::request::{CreateJobInput, GlossaryEntryInput};
use crate::ocr_provider::provider_token_env_name;
use crate::storage_paths::JobPaths;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;

fn test_config() -> Arc<AppConfig> {
    let root =
        std::env::temp_dir().join(format!("rust-api-command-tests-{}", fastrand::u64(..)));
    let data_root = root.join("data");
    let output_root = data_root.join("jobs");
    let downloads_dir = data_root.join("downloads");
    let uploads_dir = data_root.join("uploads");
    let rust_api_root = root.join("rust_api");
    let scripts_dir = root.join("scripts");
    std::fs::create_dir_all(&output_root).expect("create output root");
    std::fs::create_dir_all(&downloads_dir).expect("create downloads dir");
    std::fs::create_dir_all(&uploads_dir).expect("create uploads dir");
    std::fs::create_dir_all(&rust_api_root).expect("create rust_api root");
    std::fs::create_dir_all(&scripts_dir).expect("create scripts dir");

    Arc::new(AppConfig {
        project_root: root.clone(),
        rust_api_root,
        data_root: data_root.clone(),
        scripts_dir: scripts_dir.clone(),
        uploads_dir,
        downloads_dir,
        jobs_db_path: data_root.join("db").join("jobs.db"),
        output_root,
        python_bin: "python".to_string(),
        pipeline_command: "retainpdf-pipeline".to_string(),
        bind_host: "127.0.0.1".to_string(),
        port: 41000,
        simple_port: 41001,
        upload_max_bytes: 0,
        upload_max_pages: 0,
        upload_processing: Default::default(),
        api_keys: HashSet::new(),
        max_running_jobs: 1,
        provider_limits: crate::config::ProviderLimitsConfig::default(),
        provider_runtime: crate::config::ProviderRuntimeConfig::default(),
        job_runner: crate::config::JobRunnerConfig::default(),
        ai_service: crate::config::AiServiceConfig::default(),
        jobs_service: crate::config::JobsServiceConfig::default(),
        asset: crate::config::AssetConfig::default(),
        cleanup: crate::config::CleanupConfig::default(),
        db: crate::config::DbConfig::default(),
        ai_proxy: crate::config::AiProxyConfig::default(),
        reader_llm: crate::config::ReaderLlmConfig::default(),
        rag: crate::config::RagConfig::default(),
    })
}

fn build_request(workflow: WorkflowKind) -> ResolvedJobSpec {
    let mut input = CreateJobInput::default();
    input.workflow = workflow;
    input.ocr.mineru_token = "mineru-token-test".to_string();
    input.translation.api_key = "sk-test".to_string();
    input.translation.model = "deepseek-flash".to_string();
    input.translation.base_url = "https://api.deepseek.com/v1".to_string();
    input.translation.workers = 3;
    input.render.render_mode = "typst".to_string();
    input.render.translated_pdf_name = "out.pdf".to_string();
    ResolvedJobSpec::from_input(input)
}

fn build_paths(config: &AppConfig) -> JobPaths {
    JobPaths::for_job(&config.output_root, "job-command-test")
}

fn contains(cmd: &[String], value: &str) -> bool {
    cmd.iter().any(|arg| arg == value)
}

fn arg_value<'a>(cmd: &'a [String], flag: &str) -> Option<&'a str> {
    cmd.windows(2)
        .find(|window| window[0] == flag)
        .map(|window| window[1].as_str())
}

fn read_spec_from_command(cmd: &[String]) -> serde_json::Value {
    let spec_path = arg_value(cmd, "--spec").expect("stage spec path");
    let spec_json = std::fs::read_to_string(spec_path).expect("stage spec should be written");
    serde_json::from_str(&spec_json).expect("valid stage spec json")
}

#[test]
fn stage_command_returns_error_when_spec_cannot_be_written() {
    let config = test_config();
    let request = build_request(WorkflowKind::Translate);
    let job_paths = build_paths(config.as_ref());
    std::fs::create_dir_all(&job_paths.root).expect("create job root");
    std::fs::write(&job_paths.specs_dir, b"not a directory").expect("create specs file");

    let result = build_worker_stage_command(
        &config.worker_command_runtime(),
        &request,
        &job_paths,
        WorkerStageCommand::Translate {
            source_json_path: Path::new("/tmp/document.v1.json"),
            source_pdf_path: Path::new("/tmp/source.pdf"),
            layout_json_path: None,
        },
    );

    let err = result.expect_err("spec write failure should be returned");
    assert!(
        err.to_string().contains("create specs dir"),
        "unexpected error: {err:#}"
    );
}

fn normalize_command(
    config: &AppConfig,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    provider_result_json_path: &Path,
    provider_zip_path: &Path,
    provider_raw_dir: &Path,
) -> Vec<String> {
    build_worker_stage_command(
        &config.worker_command_runtime(),
        request,
        job_paths,
        WorkerStageCommand::NormalizeOcr {
            source_json_path,
            source_pdf_path,
            provider_result_json_path,
            provider_zip_path,
            provider_raw_dir,
        },
    )
    .expect("build normalize command")
}

fn translate_command(
    config: &AppConfig,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Vec<String> {
    build_worker_stage_command(
        &config.worker_command_runtime(),
        request,
        job_paths,
        WorkerStageCommand::Translate {
            source_json_path,
            source_pdf_path,
            layout_json_path,
        },
    )
    .expect("build translate command")
}

fn render_command(
    config: &AppConfig,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
    translations_dir: &Path,
) -> Vec<String> {
    render_command_with_refine(
        config,
        request,
        job_paths,
        source_pdf_path,
        translations_dir,
        super::RenderRefine::Off,
    )
}

fn render_command_with_refine(
    config: &AppConfig,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
    translations_dir: &Path,
    refine: super::RenderRefine,
) -> Vec<String> {
    build_worker_stage_command(
        &config.worker_command_runtime(),
        request,
        job_paths,
        WorkerStageCommand::Render {
            source_pdf_path,
            translations_dir,
            refine,
        },
    )
    .expect("build render command")
}

fn assert_object_has_keys(value: &serde_json::Value, keys: &[&str]) {
    let object = value.as_object().expect("stage spec section is object");
    for key in keys {
        assert!(object.contains_key(*key), "missing stage spec key: {key}");
    }
}

/// translate spec 的 params key 集合以固化的黄金 fixture 为准。
///
/// 用 fixture 而不是测试里再抄一份列表，是为了把 Rust 和 Python 串成一条链：
/// Rust 改了 params，这条断言先红，逼着更新 fixture；fixture 一更新，
/// Python 侧 devtools/tests/test_stage_spec_contract.py 的
/// TranslateStageParams 字段比对接着红，逼着 loader 跟上。
/// 两边各自抄一份常量的话，谁也拦不住另一边漏改。
fn golden_translate_params_keys() -> Vec<String> {
    let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../tests/fixtures/golden-jobs/chem-6ada81-10p/specs/translate.spec.json");
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read golden translate spec {}: {e}", path.display()));
    let payload: serde_json::Value =
        serde_json::from_str(&raw).expect("golden translate spec is valid json");
    let mut keys: Vec<String> = payload["params"]
        .as_object()
        .expect("golden translate spec params is object")
        .keys()
        .cloned()
        .collect();
    keys.sort();
    keys
}

fn assert_object_keys_exactly(value: &serde_json::Value, keys: &[String]) {
    let object = value.as_object().expect("stage spec section is object");
    let mut actual: Vec<String> = object.keys().cloned().collect();
    actual.sort();
    let mut expected: Vec<String> = keys.to_vec();
    expected.sort();
    assert_eq!(
        actual, expected,
        "stage spec key set drifted from tests/fixtures/golden-jobs/chem-6ada81-10p; \
             refresh the fixture and the Python loader together"
    );
}

#[test]
fn translate_only_command_uses_translation_stage_command() {
    let config = test_config();
    let request = build_request(WorkflowKind::Translate);
    let job_paths = build_paths(config.as_ref());
    let cmd = translate_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/document.v1.json"),
        Path::new("/tmp/source.pdf"),
        Some(Path::new("/tmp/layout.json")),
    );

    assert_eq!(cmd.first().map(String::as_str), Some("python"));
    assert_eq!(cmd.get(1).map(String::as_str), Some("-m"));
    assert_eq!(
        cmd.get(2).map(String::as_str),
        Some("retainpdf_pipeline.translate")
    );
    assert!(contains(&cmd, "--spec"));
    assert!(!contains(&cmd, "--source-json"));
    assert!(!contains(&cmd, "--api-key"));
    assert!(!contains(&cmd, "--render-mode"));
    let spec_path = arg_value(&cmd, "--spec").expect("translate spec path");
    let spec_json =
        std::fs::read_to_string(spec_path).expect("translate stage spec should be written");
    let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");
    assert_eq!(payload["schema_version"], "translate.stage.v1");
    assert_eq!(payload["stage"], "translate");
    assert_eq!(payload["inputs"]["source_json"], "/tmp/document.v1.json");
    assert_eq!(
        payload["params"]["credential_ref"],
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    );
    // render prewarm 在阶段解耦时整体挪去了 render 阶段，translate spec 不
    // 应再带 render_prewarm_* ——Python 侧从 loader 到 stage 函数全程接住却
    // 一个都不用，是纯死字段。
    assert!(
        !spec_json.contains("render_prewarm"),
        "translate spec should no longer carry render_prewarm_* params"
    );
    assert!(!spec_json.contains("sk-test"));
}

#[test]
fn render_only_command_uses_render_stage_command_and_artifacts() {
    let config = test_config();
    let request = build_request(WorkflowKind::Render);
    let job_paths = build_paths(config.as_ref());
    let cmd = render_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/source.pdf"),
        Path::new("/tmp/translated"),
    );

    assert_eq!(cmd.first().map(String::as_str), Some("python"));
    assert_eq!(cmd.get(1).map(String::as_str), Some("-m"));
    assert_eq!(
        cmd.get(2).map(String::as_str),
        Some("retainpdf_pipeline.render")
    );
    assert!(contains(&cmd, "--spec"));
    assert!(!contains(&cmd, "--mode"));
    assert!(!contains(&cmd, "--batch-size"));
    assert!(!contains(&cmd, "--classify-batch-size"));
    assert!(!contains(&cmd, "--glossary-json"));
    assert!(!contains(&cmd, "--api-key"));
    assert!(!contains(&cmd, "--render-mode"));
    let spec_path = arg_value(&cmd, "--spec").expect("render spec path");
    let spec_json =
        std::fs::read_to_string(spec_path).expect("render stage spec should be written");
    let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");
    assert_eq!(payload["schema_version"], "render.stage.v1");
    assert_eq!(payload["stage"], "render");
    assert_eq!(payload["inputs"]["source_pdf"], "/tmp/source.pdf");
    assert_eq!(payload["inputs"]["translations_dir"], "/tmp/translated");
    assert_eq!(payload["params"]["render_mode"], "typst");
    assert_eq!(
        payload["params"]["credential_ref"],
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    );
    assert!(!spec_json.contains("sk-test"));
}

#[test]
fn normalize_command_writes_stage_spec_and_uses_spec_flag() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Ocr);
    request.job_id = "job-command-test".to_string();
    request.ocr.provider = "mineru".to_string();
    request.ocr.model_version = "v1".to_string();
    let job_paths = build_paths(config.as_ref());
    let cmd = normalize_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/layout.json"),
        Path::new("/tmp/source.pdf"),
        Path::new("/tmp/provider-result.json"),
        Path::new("/tmp/provider.zip"),
        Path::new("/tmp/provider-raw"),
    );

    assert_eq!(cmd.first().map(String::as_str), Some("python"));
    assert_eq!(cmd.get(1).map(String::as_str), Some("-m"));
    assert_eq!(
        cmd.get(2).map(String::as_str),
        Some("retainpdf_pipeline.ocr")
    );
    assert_eq!(cmd.get(3).map(String::as_str), Some("normalize-ocr"));
    assert!(contains(&cmd, "--spec"));
    assert!(!contains(&cmd, "--provider"));
    let spec_path = arg_value(&cmd, "--spec").expect("spec path");
    assert!(spec_path.ends_with("/specs/normalize.spec.json"));
    let spec_json =
        std::fs::read_to_string(spec_path).expect("normalize stage spec should be written");
    let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");
    assert_eq!(payload["schema_version"], "normalize.stage.v1");
    assert_eq!(payload["stage"], "normalize");
    assert_eq!(payload["job"]["job_id"], "job-command-test");
    assert_eq!(payload["inputs"]["provider"], "mineru");
    assert_eq!(payload["inputs"]["source_json"], "/tmp/layout.json");
}

#[test]
fn entrypoint_uses_stage_module_commands() {
    let config = test_config();
    let request = build_request(WorkflowKind::Render);
    let job_paths = build_paths(config.as_ref());
    let cmd = render_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/source.pdf"),
        Path::new("/tmp/translated"),
    );

    assert_eq!(cmd.first().map(String::as_str), Some("python"));
    assert_eq!(cmd.get(1).map(String::as_str), Some("-m"));
    assert_eq!(
        cmd.get(2).map(String::as_str),
        Some("retainpdf_pipeline.render")
    );
    assert!(contains(&cmd, "--spec"));
}

#[test]
fn legacy_provider_case_command_writes_provider_stage_spec_and_hides_secrets() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Book);
    request.job_id = "job-command-test".to_string();
    let job_paths = build_paths(config.as_ref());
    let cmd = build_legacy_provider_case_command(
        &config.worker_command_runtime(),
        Path::new("/tmp/source/job.pdf"),
        &request,
        &job_paths,
    );

    assert_eq!(cmd.first().map(String::as_str), Some("python"));
    assert_eq!(cmd.get(1).map(String::as_str), Some("-m"));
    assert_eq!(
        cmd.get(2).map(String::as_str),
        Some("retainpdf_pipeline.ocr")
    );
    assert_eq!(cmd.get(3).map(String::as_str), Some("provider-case"));
    assert!(contains(&cmd, "--spec"));
    let spec_path = arg_value(&cmd, "--spec").expect("provider spec path");
    let spec_json =
        std::fs::read_to_string(spec_path).expect("provider stage spec should be written");
    let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");
    assert_eq!(payload["schema_version"], "provider.stage.v1");
    assert_eq!(
        payload["ocr"]["credential_ref"],
        format!(
            "env:{}",
            provider_token_env_name(&OcrProviderKind::Mineru).expect("mineru token env")
        )
    );
    assert_eq!(
        payload["translation"]["credential_ref"],
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    );
    assert!(!spec_json.contains("mineru-token-test"));
    assert!(!spec_json.contains("sk-test"));
}

#[test]
fn legacy_provider_case_command_writes_paddle_provider_stage_spec_and_hides_paddle_secret() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Book);
    request.job_id = "job-command-test".to_string();
    request.ocr.provider = "paddle".to_string();
    request.ocr.paddle_token = "paddle-secret".to_string();
    request.ocr.paddle_api_url = "https://paddle.example/api".to_string();
    request.ocr.paddle_model = "paddleocr-vl".to_string();
    let job_paths = build_paths(config.as_ref());
    let cmd = build_legacy_provider_case_command(
        &config.worker_command_runtime(),
        Path::new("/tmp/source/job.pdf"),
        &request,
        &job_paths,
    );

    assert_eq!(cmd.first().map(String::as_str), Some("python"));
    assert_eq!(cmd.get(1).map(String::as_str), Some("-m"));
    assert_eq!(
        cmd.get(2).map(String::as_str),
        Some("retainpdf_pipeline.ocr")
    );
    assert_eq!(cmd.get(3).map(String::as_str), Some("provider-case"));
    let spec_path = arg_value(&cmd, "--spec").expect("provider spec path");
    let spec_json =
        std::fs::read_to_string(spec_path).expect("provider stage spec should be written");
    let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");
    assert_eq!(payload["ocr"]["provider"], "paddle");
    assert_eq!(
        payload["ocr"]["credential_ref"],
        format!(
            "env:{}",
            provider_token_env_name(&OcrProviderKind::Paddle).expect("paddle token env")
        )
    );
    assert_eq!(
        payload["ocr"]["paddle_api_url"],
        "https://paddle.example/api"
    );
    assert_eq!(payload["ocr"]["paddle_model"], "paddleocr-vl");
    assert_eq!(
        payload["ocr"]["options"]["paddle_model"],
        "PaddleOCR-VL-1.6"
    );
    assert!(!spec_json.contains("paddle-secret"));
}

#[test]
fn legacy_provider_case_command_writes_ocr_options_overrides() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Book);
    request.job_id = "job-command-test".to_string();
    request.ocr.provider = "paddle".to_string();
    request.ocr.options.insert(
        "paddle_model".to_string(),
        serde_json::Value::String("PaddleOCR-VL-1.5".to_string()),
    );
    request.ocr.options.insert(
        "custom_option".to_string(),
        serde_json::Value::String("custom-value".to_string()),
    );
    let job_paths = build_paths(config.as_ref());
    let cmd = build_legacy_provider_case_command(
        &config.worker_command_runtime(),
        Path::new("/tmp/source/job.pdf"),
        &request,
        &job_paths,
    );
    let spec_path = arg_value(&cmd, "--spec").expect("provider spec path");
    let spec_json =
        std::fs::read_to_string(spec_path).expect("provider stage spec should be written");
    let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");

    assert_eq!(
        payload["ocr"]["options"]["paddle_model"],
        "PaddleOCR-VL-1.5"
    );
    assert_eq!(payload["ocr"]["options"]["custom_option"], "custom-value");
}

#[test]
fn provider_stage_defaults_paddle_transport_to_official_http() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Ocr);
    request.job_id = "job-paddle-http-default".to_string();
    request.ocr.provider = "paddle".to_string();
    let job_paths = build_paths(config.as_ref());
    let cmd = build_ocr_command(
        &config.worker_command_runtime(),
        Some(Path::new("/tmp/source.pdf")),
        &request,
        &job_paths,
    )
    .expect("build OCR command");
    let payload = read_spec_from_command(&cmd);

    assert_eq!(payload["ocr"]["options"]["transport"], "official_http");
}

#[test]
fn provider_stage_preserves_paddle_cli_transport_override() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Ocr);
    request.job_id = "job-paddle-cli-override".to_string();
    request.ocr.provider = "paddle".to_string();
    request.ocr.options.insert(
        "transport".to_string(),
        serde_json::Value::String("official_cli".to_string()),
    );
    let job_paths = build_paths(config.as_ref());
    let cmd = build_ocr_command(
        &config.worker_command_runtime(),
        Some(Path::new("/tmp/source.pdf")),
        &request,
        &job_paths,
    )
    .expect("build OCR command");
    let payload = read_spec_from_command(&cmd);

    assert_eq!(payload["ocr"]["options"]["transport"], "official_cli");
}

#[test]
fn ocr_command_uses_provider_ocr_command() {
    let config = test_config();
    let request = build_request(WorkflowKind::Ocr);
    let job_paths = build_paths(config.as_ref());
    let cmd = build_ocr_command(
        &config.worker_command_runtime(),
        Some(Path::new("/tmp/source.pdf")),
        &request,
        &job_paths,
    )
    .expect("build OCR command");

    assert_eq!(cmd.first().map(String::as_str), Some("python"));
    assert_eq!(cmd.get(1).map(String::as_str), Some("-m"));
    assert_eq!(
        cmd.get(2).map(String::as_str),
        Some("retainpdf_pipeline.ocr")
    );
    assert_eq!(cmd.get(3).map(String::as_str), Some("provider-ocr"));
    assert!(contains(&cmd, "--spec"));
    let spec_path = arg_value(&cmd, "--spec").expect("provider spec path");
    let spec_json =
        std::fs::read_to_string(spec_path).expect("provider stage spec should be written");
    let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");
    assert_eq!(payload["schema_version"], "provider.stage.v1");
    assert_eq!(payload["source"]["file_path"], "/tmp/source.pdf");
    assert_eq!(
        payload["ocr"]["credential_ref"],
        format!(
            "env:{}",
            provider_token_env_name(&OcrProviderKind::Mineru).expect("mineru token env")
        )
    );
    assert!(!spec_json.contains("mineru-token-test"));
}

#[test]
fn translate_only_command_includes_glossary_metadata_and_payload() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Translate);
    request.translation.glossary_id = "gls-123".to_string();
    request.translation.glossary_name = "chemistry".to_string();
    request.translation.glossary_resource_entry_count = 2;
    request.translation.glossary_inline_entry_count = 1;
    request.translation.glossary_overridden_entry_count = 1;
    request.translation.context_mode = "all".to_string();
    request.translation.glossary_mode = "all".to_string();
    request.translation.memory_mode = "broad".to_string();
    request.translation.glossary_entries = vec![GlossaryEntryInput {
        source: "bond".to_string(),
        target: "键".to_string(),
        note: String::new(),
        level: String::new(),
        match_mode: String::new(),
        context: String::new(),
    }];
    let job_paths = build_paths(config.as_ref());
    let cmd = translate_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/document.v1.json"),
        Path::new("/tmp/source.pdf"),
        None,
    );

    let spec_path = arg_value(&cmd, "--spec").expect("translate spec path");
    let spec_json =
        std::fs::read_to_string(spec_path).expect("translate stage spec should be written");
    let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");
    assert_eq!(payload["params"]["glossary_id"], "gls-123");
    assert_eq!(payload["params"]["glossary_name"], "chemistry");
    assert_eq!(payload["params"]["glossary_resource_entry_count"], 2);
    assert_eq!(payload["params"]["glossary_inline_entry_count"], 1);
    assert_eq!(payload["params"]["glossary_overridden_entry_count"], 1);
    assert_eq!(payload["params"]["glossary_entries"][0]["source"], "bond");
    assert_eq!(payload["params"]["context_mode"], "all");
    assert_eq!(payload["params"]["glossary_mode"], "all");
    assert_eq!(payload["params"]["memory_mode"], "broad");
}

#[test]
fn translate_spec_defaults_preparation_off_and_reviewer_empty() {
    let config = test_config();
    let request = build_request(WorkflowKind::Translate);
    let job_paths = build_paths(config.as_ref());
    let cmd = translate_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/document.v1.json"),
        Path::new("/tmp/source.pdf"),
        None,
    );
    let payload = read_spec_from_command(&cmd);
    assert_eq!(payload["params"]["preparation"], "off");
    assert_eq!(payload["params"]["reviewer_model"], "");
    assert_eq!(payload["params"]["reviewer_base_url"], "");
    assert_eq!(payload["params"]["reviewer_credential_ref"], "");
}

#[test]
fn translate_and_provider_specs_pass_preparation_and_reviewer_as_env_reference() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Book);
    request.job_id = "job-reviewer-test".to_string();
    request.ocr.provider = "paddle".to_string();
    request.ocr.paddle_token = "paddle-secret".to_string();
    request.translation.preparation = "terms+style".to_string();
    request.translation.reviewer_model = "reviewer-model".to_string();
    request.translation.reviewer_base_url = "https://reviewer.example/v1".to_string();
    request.translation.reviewer_api_key = "sk-reviewer-secret".to_string();
    let job_paths = build_paths(config.as_ref());

    let translate = read_spec_from_command(&translate_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/document.v1.json"),
        Path::new("/tmp/source.pdf"),
        None,
    ));
    let provider = read_spec_from_command(&build_legacy_provider_case_command(
        &config.worker_command_runtime(),
        Path::new("/tmp/source/job.pdf"),
        &request,
        &job_paths,
    ));
    for section in [&translate["params"], &provider["translation"]] {
        assert_eq!(section["preparation"], "terms+style");
        assert_eq!(section["reviewer_model"], "reviewer-model");
        assert_eq!(section["reviewer_base_url"], "https://reviewer.example/v1");
        assert_eq!(
            section["reviewer_credential_ref"],
            format!("env:{REVIEWER_API_KEY_ENV_NAME}")
        );
    }
    assert!(!translate.to_string().contains("sk-reviewer-secret"));
    assert!(!provider.to_string().contains("sk-reviewer-secret"));

    // 只给引用、不给内联 key 时同样只写 env 引用。
    request.translation.reviewer_api_key.clear();
    request.translation.reviewer_credential_ref = "cred_reviewer".to_string();
    let translate = read_spec_from_command(&translate_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/document.v1.json"),
        Path::new("/tmp/source.pdf"),
        None,
    ));
    assert_eq!(
        translate["params"]["reviewer_credential_ref"],
        format!("env:{REVIEWER_API_KEY_ENV_NAME}")
    );
    assert!(!translate.to_string().contains("cred_reviewer"));
}

#[test]
fn stage_specs_keep_python_loader_contract_keys() {
    let config = test_config();
    let mut request = build_request(WorkflowKind::Book);
    request.job_id = "job-command-test".to_string();
    request.ocr.provider = "paddle".to_string();
    request.ocr.paddle_token = "paddle-secret".to_string();
    let job_paths = build_paths(config.as_ref());

    let provider = read_spec_from_command(&build_legacy_provider_case_command(
        &config.worker_command_runtime(),
        Path::new("/tmp/source/job.pdf"),
        &request,
        &job_paths,
    ));
    assert_object_has_keys(
        &provider,
        &[
            "schema_version",
            "stage",
            "job",
            "source",
            "ocr",
            "translation",
            "render",
        ],
    );
    assert_object_has_keys(&provider["job"], &["job_id", "job_root", "workflow"]);
    assert_object_has_keys(&provider["source"], &["file_url", "file_path"]);
    assert_object_has_keys(
        &provider["ocr"],
        &[
            "provider",
            "credential_ref",
            "model_version",
            "paddle_api_url",
            "paddle_model",
            "is_ocr",
            "disable_formula",
            "disable_table",
            "language",
            "page_ranges",
            "data_id",
            "no_cache",
            "cache_tolerance",
            "extra_formats",
            "poll_interval",
            "poll_timeout",
        ],
    );
    assert_object_has_keys(
        &provider["translation"],
        &[
            "start_page",
            "end_page",
            "batch_size",
            "workers",
            "mode",
            "math_mode",
            "skip_title_translation",
            "classify_batch_size",
            "rule_profile_name",
            "custom_rules_text",
            "glossary_id",
            "glossary_name",
            "glossary_resource_entry_count",
            "glossary_inline_entry_count",
            "glossary_overridden_entry_count",
            "glossary_entries",
            "context_mode",
            "glossary_mode",
            "memory_mode",
            "model",
            "base_url",
            "credential_ref",
            "preparation",
            "reviewer_model",
            "reviewer_base_url",
            "reviewer_credential_ref",
        ],
    );
    assert_object_has_keys(
        &provider["render"],
        &[
            "render_mode",
            "compile_workers",
            "typst_font_family",
            "pdf_compress_dpi",
            "translated_pdf_name",
            "body_font_size_factor",
            "body_leading_factor",
            "inner_bbox_shrink_x",
            "inner_bbox_shrink_y",
            "inner_bbox_dense_shrink_x",
            "inner_bbox_dense_shrink_y",
            "font_unify_mode",
            "source_cleanup_strategy",
            "engine",
        ],
    );

    let normalize = read_spec_from_command(&normalize_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/layout.json"),
        Path::new("/tmp/source.pdf"),
        Path::new("/tmp/provider-result.json"),
        Path::new("/tmp/provider.zip"),
        Path::new("/tmp/provider-raw"),
    ));
    assert_object_has_keys(
        &normalize,
        &["schema_version", "stage", "job", "inputs", "params"],
    );
    assert_object_has_keys(
        &normalize["inputs"],
        &[
            "provider",
            "source_json",
            "source_pdf",
            "provider_version",
            "provider_result_json",
            "provider_zip",
            "provider_raw_dir",
        ],
    );

    let translate = read_spec_from_command(&translate_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/document.v1.json"),
        Path::new("/tmp/source.pdf"),
        Some(Path::new("/tmp/layout.json")),
    ));
    assert_object_has_keys(
        &translate,
        &["schema_version", "stage", "job", "inputs", "params"],
    );
    assert_object_has_keys(
        &translate["inputs"],
        &["source_json", "source_pdf", "layout_json"],
    );
    assert_object_keys_exactly(&translate["params"], &golden_translate_params_keys());

    let render = read_spec_from_command(&render_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/source.pdf"),
        Path::new("/tmp/translated"),
    ));
    assert_object_has_keys(
        &render,
        &["schema_version", "stage", "job", "inputs", "params"],
    );
    assert_object_has_keys(
        &render["inputs"],
        &["source_pdf", "translations_dir", "translation_manifest"],
    );
    assert_object_has_keys(
        &render["params"],
        &[
            "start_page",
            "end_page",
            "render_mode",
            "compile_workers",
            "typst_font_family",
            "pdf_compress_dpi",
            "translated_pdf_name",
            "body_font_size_factor",
            "body_leading_factor",
            "inner_bbox_shrink_x",
            "inner_bbox_shrink_y",
            "inner_bbox_dense_shrink_x",
            "inner_bbox_dense_shrink_y",
            "font_unify_mode",
            "source_cleanup_strategy",
            "engine",
            "model",
            "base_url",
            "credential_ref",
        ],
    );
}

fn render_spec_with_refine(
    request: &ResolvedJobSpec,
    refine: super::RenderRefine,
) -> serde_json::Value {
    let config = test_config();
    let job_paths = build_paths(config.as_ref());
    read_spec_from_command(&render_command_with_refine(
        config.as_ref(),
        request,
        &job_paths,
        Path::new("/tmp/source.pdf"),
        Path::new("/tmp/translated"),
        refine,
    ))
}

const REFINE_PARAM_KEYS: &[&str] = &[
    "mode",
    "trigger",
    "start_page",
    "end_page",
    "max_items",
    "max_tokens",
    "reviewer_model",
    "reviewer_base_url",
    "reviewer_credential_ref",
];

/// 普通重渲染：即使任务配了 refine，也一律 off —— 不会每次重渲染都重新精修花钱。
#[test]
fn render_spec_refine_is_off_for_plain_render_even_if_job_enables_it() {
    let mut request = build_request(WorkflowKind::Render);
    request.translation.refine = "review_and_fix".to_string();
    let payload = render_spec_with_refine(&request, super::RenderRefine::Off);
    let refine = &payload["params"]["refine"];
    assert_object_keys_exactly(
        refine,
        &REFINE_PARAM_KEYS.iter().map(|key| key.to_string()).collect::<Vec<_>>(),
    );
    assert_eq!(refine["mode"], "off");
    assert_eq!(refine["trigger"], "auto");
    assert!(refine["start_page"].is_null());
    assert!(refine["end_page"].is_null());
    assert_eq!(refine["max_items"], 0, "默认审全书");
    assert_eq!(refine["max_tokens"], 0);
    assert_eq!(refine["reviewer_credential_ref"], "");
}

/// 紧跟翻译的那次渲染：用任务的 translation.refine，trigger=auto；默认 off。
#[test]
fn render_spec_refine_after_translation_follows_job_setting() {
    let mut request = build_request(WorkflowKind::Book);
    let payload = render_spec_with_refine(&request, super::RenderRefine::AfterTranslation);
    assert_eq!(payload["params"]["refine"]["mode"], "off", "默认 off");

    request.translation.refine = " Review_Only ".to_string();
    request.translation.refine_max_items = 0;
    request.translation.refine_max_tokens = 1234;
    request.translation.reviewer_model = "reviewer-model".to_string();
    request.translation.reviewer_base_url = "https://reviewer.example/v1".to_string();
    request.translation.reviewer_credential_ref = "cred_reviewer".to_string();
    let payload = render_spec_with_refine(&request, super::RenderRefine::AfterTranslation);
    let refine = &payload["params"]["refine"];
    assert_eq!(refine["mode"], "review_only");
    assert_eq!(refine["trigger"], "auto");
    assert_eq!(refine["max_items"], 0);
    assert_eq!(refine["max_tokens"], 1234);
    assert_eq!(refine["reviewer_model"], "reviewer-model");
    assert_eq!(refine["reviewer_base_url"], "https://reviewer.example/v1");
    assert_eq!(
        refine["reviewer_credential_ref"],
        format!("env:{REVIEWER_API_KEY_ENV_NAME}")
    );
    assert!(!payload.to_string().contains("cred_reviewer"));

    request.translation.refine = "bogus".to_string();
    let payload = render_spec_with_refine(&request, super::RenderRefine::AfterTranslation);
    assert_eq!(payload["params"]["refine"]["mode"], "off", "非法值兜底成 off");
}

/// retry refine 的一次性覆盖：覆盖值 + trigger=manual，与任务自己的 translation.refine 无关。
#[test]
fn render_spec_refine_manual_override_uses_override_values() {
    let mut request = build_request(WorkflowKind::Render);
    request.translation.refine = "off".to_string();
    request.translation.api_key = "sk-translation-secret".to_string();
    // 老任务里存的是以前的默认上限:手动精修不沿用它。
    request.translation.refine_max_items = 300;
    request.translation.refine_max_tokens = 400_000;
    let payload = render_spec_with_refine(
        &request,
        super::RenderRefine::Manual(crate::models::domain::RefineOverride {
            mode: "review_and_fix".to_string(),
            start_page: Some(3),
            end_page: Some(5),
            max_items: None,
            max_tokens: None,
            requested_at: "2026-10-08T00:00:00Z".to_string(),
        }),
    );
    let refine = &payload["params"]["refine"];
    assert_eq!(refine["mode"], "review_and_fix");
    assert_eq!(refine["trigger"], "manual");
    assert_eq!(refine["start_page"], 3);
    assert_eq!(refine["end_page"], 5);
    assert_eq!(refine["max_items"], 0);
    assert_eq!(refine["max_tokens"], 0);
    // 这次请求自己给了上限:用它。
    let payload = render_spec_with_refine(
        &request,
        super::RenderRefine::Manual(crate::models::domain::RefineOverride {
            mode: "review_only".to_string(),
            start_page: None,
            end_page: None,
            max_items: Some(50),
            max_tokens: Some(1000),
            requested_at: "2026-10-08T00:00:00Z".to_string(),
        }),
    );
    assert_eq!(payload["params"]["refine"]["max_items"], 50);
    assert_eq!(payload["params"]["refine"]["max_tokens"], 1000);
    assert_eq!(
        payload["params"]["credential_ref"],
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    );
    assert!(!payload.to_string().contains("sk-translation-secret"));
}

/// render.engine：缺省写默认路线 rpr_fit；任务配 rpr 时 render spec 与 provider spec 都原样带上，
/// 普通重渲染 / 精修覆盖都不改它。
#[test]
fn render_spec_carries_render_engine() {
    let mut request = build_request(WorkflowKind::Render);
    let payload = render_spec_with_refine(&request, super::RenderRefine::Off);
    assert_eq!(payload["params"]["engine"], "rpr_fit");

    request.render.engine = "rpr".to_string();
    for refine in [
        super::RenderRefine::Off,
        super::RenderRefine::AfterTranslation,
        super::RenderRefine::Manual(crate::models::domain::RefineOverride {
            mode: "review_and_fix".to_string(),
            start_page: None,
            end_page: None,
            max_items: None,
            max_tokens: None,
            requested_at: "2026-10-08T00:00:00Z".to_string(),
        }),
    ] {
        let payload = render_spec_with_refine(&request, refine);
        assert_eq!(payload["params"]["engine"], "rpr");
    }

    request.render.engine = "rpr_fit".to_string();
    let payload = render_spec_with_refine(&request, super::RenderRefine::Off);
    assert_eq!(payload["params"]["engine"], "rpr_fit");
}

#[test]
fn refine_override_file_round_trips_and_clears() {
    use super::refine_override::{
        clear_refine_override, load_refine_override, refine_override_path,
        write_refine_override,
    };
    let config = test_config();
    let job_paths = build_paths(config.as_ref());
    clear_refine_override(&job_paths).expect("clear missing override is a no-op");
    assert!(load_refine_override(&job_paths).expect("load").is_none());

    let value = crate::models::domain::RefineOverride {
        mode: "review_only".to_string(),
        start_page: None,
        end_page: Some(7),
        max_items: Some(120),
        max_tokens: None,
        requested_at: "2026-10-08T00:00:00Z".to_string(),
    };
    let path = write_refine_override(&job_paths, &value).expect("write override");
    assert_eq!(path, refine_override_path(&job_paths));
    assert_eq!(load_refine_override(&job_paths).expect("load"), Some(value));

    clear_refine_override(&job_paths).expect("clear override");
    assert!(!path.exists());
    assert!(load_refine_override(&job_paths).expect("load").is_none());

    std::fs::write(&path, b"{not json").expect("write corrupt override");
    assert!(load_refine_override(&job_paths).is_err(), "损坏的覆盖要报出来，由调用方决定降级");
}

#[test]
fn render_prepare_command_writes_spec_shared_with_the_render_stage() {
    let config = test_config();
    let request = build_request(WorkflowKind::Book);
    let job_paths = build_paths(config.as_ref());
    let cmd = build_worker_stage_command(
        &config.worker_command_runtime(),
        &request,
        &job_paths,
        WorkerStageCommand::RenderPrepare {
            source_json_path: Path::new("/tmp/document.v1.json"),
            source_pdf_path: Path::new("/tmp/source.pdf"),
            translations_dir: &job_paths.translated_dir,
        },
    )
    .expect("build render prepare command");

    assert_eq!(cmd.get(1).map(String::as_str), Some("-m"));
    assert_eq!(
        cmd.get(2).map(String::as_str),
        Some("retainpdf_pipeline.render.workflow.prepare_stage")
    );
    assert!(arg_value(&cmd, "--spec")
        .expect("spec flag")
        .ends_with("render-prepare.spec.json"));
    let spec = read_spec_from_command(&cmd);
    assert_eq!(spec["schema_version"], "render_prepare.stage.v1");
    assert_eq!(spec["stage"], "render_prepare");
    assert_eq!(spec["inputs"]["source_json"], "/tmp/document.v1.json");

    // 渲染阶段用指纹核对提前做的准备，两边的参数必须同源。
    let render = read_spec_from_command(&render_command(
        config.as_ref(),
        &request,
        &job_paths,
        Path::new("/tmp/source.pdf"),
        &job_paths.translated_dir,
    ));
    for key in ["start_page", "end_page", "render_mode", "engine"] {
        assert_eq!(spec["params"][key], render["params"][key], "param {key}");
    }
    assert_eq!(spec["inputs"]["source_pdf"], render["inputs"]["source_pdf"]);
    assert_eq!(spec["inputs"]["translations_dir"], render["inputs"]["translations_dir"]);
    let raw = serde_json::to_string(&spec).expect("spec json");
    assert!(!raw.contains("credential"), "render prepare spec must carry no credentials");
}
