#[path = "worker_command/command_builder.rs"]
mod command_builder;
#[path = "worker_command/entrypoints.rs"]
mod entrypoints;
#[path = "worker_command/legacy_ocr.rs"]
mod legacy_ocr;
#[path = "worker_command/stage_commands.rs"]
mod stage_commands;
#[path = "worker_command/stage_specs.rs"]
pub(crate) mod stage_specs;

#[cfg(test)]
use crate::config::WorkerCommandRuntimeConfig;
#[cfg(test)]
use crate::models::domain::ResolvedJobSpec;
#[cfg(test)]
use crate::storage_paths::JobPaths;
#[cfg(test)]
use std::path::Path;

pub use self::legacy_ocr::build_ocr_command;
pub use self::stage_commands::{build_worker_stage_command, WorkerStageCommand};

#[cfg(test)]
fn build_legacy_provider_case_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    upload_path: &Path,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Vec<String> {
    use self::entrypoints::provider_case_command as build_provider_case_entrypoint;
    use self::stage_specs::write_provider_stage_spec;

    let spec_path = write_provider_stage_spec(request, job_paths, Some(upload_path))
        .expect("write provider stage spec");
    build_provider_case_entrypoint(config, &spec_path)
}

#[cfg(test)]
mod tests {
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
        build_worker_stage_command(
            &config.worker_command_runtime(),
            request,
            job_paths,
            WorkerStageCommand::Render {
                source_pdf_path,
                translations_dir,
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
                "model",
                "base_url",
                "credential_ref",
            ],
        );
    }
}
