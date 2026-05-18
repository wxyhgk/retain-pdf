#[path = "worker_command/command_builder.rs"]
mod command_builder;
#[path = "worker_command/entrypoints.rs"]
mod entrypoints;
#[path = "worker_command/stage_specs.rs"]
pub(crate) mod stage_specs;

use std::path::Path;

use crate::config::WorkerCommandRuntimeConfig;
use crate::models::ResolvedJobSpec;
use crate::storage_paths::JobPaths;

use self::command_builder::CommandBuilder;
use self::entrypoints::{
    normalize_ocr_command as build_normalize_entrypoint,
    provider_ocr_command as build_provider_ocr_entrypoint,
    render_only_command as build_render_only_entrypoint,
    translate_only_command as build_translate_only_entrypoint,
};
use self::stage_specs::{
    write_normalize_stage_spec, write_render_stage_spec, write_translate_stage_spec,
};

#[derive(Clone, Copy)]
enum JobPathArg {
    JobRoot,
    SourceDir,
    OcrDir,
    TranslatedDir,
    RenderedDir,
    ArtifactsDir,
    LogsDir,
}

#[derive(Clone, Copy)]
enum OcrArg {
    MineruToken,
    ModelVersion,
    IsOcr,
    DisableFormula,
    DisableTable,
    Language,
    PageRanges,
    DataId,
    NoCache,
    CacheTolerance,
    ExtraFormats,
    PollInterval,
    PollTimeout,
}

const JOB_PATH_ARGS: &[(&str, JobPathArg)] = &[
    ("--job-root", JobPathArg::JobRoot),
    ("--source-dir", JobPathArg::SourceDir),
    ("--ocr-dir", JobPathArg::OcrDir),
    ("--translated-dir", JobPathArg::TranslatedDir),
    ("--rendered-dir", JobPathArg::RenderedDir),
    ("--artifacts-dir", JobPathArg::ArtifactsDir),
    ("--logs-dir", JobPathArg::LogsDir),
];

const OCR_ARGS: &[(&str, OcrArg)] = &[
    ("--mineru-token", OcrArg::MineruToken),
    ("--model-version", OcrArg::ModelVersion),
    ("--is-ocr", OcrArg::IsOcr),
    ("--disable-formula", OcrArg::DisableFormula),
    ("--disable-table", OcrArg::DisableTable),
    ("--language", OcrArg::Language),
    ("--page-ranges", OcrArg::PageRanges),
    ("--data-id", OcrArg::DataId),
    ("--no-cache", OcrArg::NoCache),
    ("--cache-tolerance", OcrArg::CacheTolerance),
    ("--extra-formats", OcrArg::ExtraFormats),
    ("--poll-interval", OcrArg::PollInterval),
    ("--poll-timeout", OcrArg::PollTimeout),
];

fn push_job_path_args(cmd: &mut CommandBuilder, job_paths: &JobPaths) {
    for (name, arg) in JOB_PATH_ARGS {
        match arg {
            JobPathArg::JobRoot => cmd.path_arg(name, &job_paths.root),
            JobPathArg::SourceDir => cmd.path_arg(name, &job_paths.source_dir),
            JobPathArg::OcrDir => cmd.path_arg(name, &job_paths.ocr_dir),
            JobPathArg::TranslatedDir => cmd.path_arg(name, &job_paths.translated_dir),
            JobPathArg::RenderedDir => cmd.path_arg(name, &job_paths.rendered_dir),
            JobPathArg::ArtifactsDir => cmd.path_arg(name, &job_paths.artifacts_dir),
            JobPathArg::LogsDir => cmd.path_arg(name, &job_paths.logs_dir),
        }
    }
}

fn push_ocr_args(cmd: &mut CommandBuilder, request: &ResolvedJobSpec) {
    for (name, arg) in OCR_ARGS {
        match arg {
            OcrArg::MineruToken => cmd.arg(name, &request.ocr.mineru_token),
            OcrArg::ModelVersion => cmd.arg(name, &request.ocr.model_version),
            OcrArg::IsOcr => cmd.flag(name, request.ocr.is_ocr),
            OcrArg::DisableFormula => cmd.flag(name, request.ocr.disable_formula),
            OcrArg::DisableTable => cmd.flag(name, request.ocr.disable_table),
            OcrArg::Language => cmd.arg(name, &request.ocr.language),
            OcrArg::PageRanges => cmd.arg(name, &request.ocr.page_ranges),
            OcrArg::DataId => cmd.arg(name, &request.ocr.data_id),
            OcrArg::NoCache => cmd.flag(name, request.ocr.no_cache),
            OcrArg::CacheTolerance => cmd.arg(name, request.ocr.cache_tolerance),
            OcrArg::ExtraFormats => cmd.arg(name, &request.ocr.extra_formats),
            OcrArg::PollInterval => cmd.arg(name, request.ocr.poll_interval),
            OcrArg::PollTimeout => cmd.arg(name, request.ocr.poll_timeout),
        }
    }
}

#[cfg(test)]
fn build_legacy_provider_case_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    upload_path: &Path,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Vec<String> {
    use self::entrypoints::provider_case_command as build_provider_case_entrypoint;
    use self::stage_specs::write_provider_stage_spec;

    let spec_path = write_provider_stage_spec(request, job_paths, upload_path)
        .expect("write provider stage spec");
    build_provider_case_entrypoint(config, &spec_path)
}

pub(crate) fn build_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    upload_path: Option<&Path>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Vec<String> {
    build_provider_ocr_entrypoint(
        config,
        upload_path,
        &request.source.source_url,
        |cmd| push_ocr_args(cmd, request),
        |cmd| push_job_path_args(cmd, job_paths),
    )
}

pub(crate) fn build_translate_only_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Vec<String> {
    let spec_path = write_translate_stage_spec(
        request,
        job_paths,
        source_json_path,
        source_pdf_path,
        layout_json_path,
    )
    .expect("write translate stage spec");
    build_translate_only_entrypoint(config, &spec_path)
}

pub(crate) fn build_render_only_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
    translations_dir: &Path,
) -> Vec<String> {
    let spec_path = write_render_stage_spec(request, job_paths, source_pdf_path, translations_dir)
        .expect("write render stage spec");
    build_render_only_entrypoint(config, &spec_path)
}

pub(crate) fn build_normalize_ocr_command(
    config: &WorkerCommandRuntimeConfig<'_>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    provider_result_json_path: &Path,
    provider_zip_path: &Path,
    provider_raw_dir: &Path,
) -> Vec<String> {
    let spec_path = write_normalize_stage_spec(
        request,
        job_paths,
        source_json_path,
        source_pdf_path,
        provider_result_json_path,
        provider_zip_path,
        provider_raw_dir,
    )
    .expect("write normalize stage spec");
    build_normalize_entrypoint(config, &spec_path)
}

#[cfg(test)]
mod tests {
    use self::stage_specs::TRANSLATION_API_KEY_ENV_NAME;
    use super::*;
    use crate::config::AppConfig;
    use crate::models::{CreateJobInput, GlossaryEntryInput, OcrProviderKind, WorkflowKind};
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
            run_provider_case_script: scripts_dir.join("run_provider_case.py"),
            run_provider_ocr_script: scripts_dir.join("run_provider_ocr.py"),
            run_normalize_ocr_script: scripts_dir.join("run_normalize_ocr.py"),
            run_translate_from_ocr_script: scripts_dir.join("run_translate_from_ocr.py"),
            run_translate_only_script: scripts_dir.join("run_translate_only.py"),
            run_render_only_script: scripts_dir.join("run_render_only.py"),
            run_failure_ai_diagnosis_script: scripts_dir.join("diagnose_failure_with_ai.py"),
            uploads_dir,
            downloads_dir,
            jobs_db_path: data_root.join("db").join("jobs.db"),
            output_root,
            python_bin: "python".to_string(),
            bind_host: "127.0.0.1".to_string(),
            port: 41000,
            simple_port: 41001,
            upload_max_bytes: 0,
            upload_max_pages: 0,
            api_keys: HashSet::new(),
            max_running_jobs: 1,
            provider_limits: crate::config::ProviderLimitsConfig::default(),
            provider_runtime: crate::config::ProviderRuntimeConfig::default(),
            job_runner: crate::config::JobRunnerConfig::default(),
        })
    }

    fn build_request(workflow: WorkflowKind) -> ResolvedJobSpec {
        let mut input = CreateJobInput::default();
        input.workflow = workflow;
        input.ocr.mineru_token = "mineru-token-test".to_string();
        input.translation.api_key = "sk-test".to_string();
        input.translation.model = "deepseek-v4-flash".to_string();
        input.translation.base_url = "https://api.deepseek.com/v1".to_string();
        input.translation.workers = 3;
        input.render.render_mode = "auto".to_string();
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

    fn assert_object_has_keys(value: &serde_json::Value, keys: &[&str]) {
        let object = value.as_object().expect("stage spec section is object");
        for key in keys {
            assert!(object.contains_key(*key), "missing stage spec key: {key}");
        }
    }

    #[test]
    fn translate_only_command_uses_translation_stage_script() {
        let config = test_config();
        let request = build_request(WorkflowKind::Translate);
        let job_paths = build_paths(config.as_ref());
        let cmd = build_translate_only_command(
            &config.worker_command_runtime(),
            &request,
            &job_paths,
            Path::new("/tmp/document.v1.json"),
            Path::new("/tmp/source.pdf"),
            Some(Path::new("/tmp/layout.json")),
        );

        assert!(contains(
            &cmd,
            &config
                .run_translate_only_script
                .to_string_lossy()
                .to_string()
        ));
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
        assert!(!spec_json.contains("sk-test"));
    }

    #[test]
    fn render_only_command_uses_render_stage_script_and_artifacts() {
        let config = test_config();
        let request = build_request(WorkflowKind::Render);
        let job_paths = build_paths(config.as_ref());
        let cmd = build_render_only_command(
            &config.worker_command_runtime(),
            &request,
            &job_paths,
            Path::new("/tmp/source.pdf"),
            Path::new("/tmp/translated"),
        );

        assert!(contains(
            &cmd,
            &config.run_render_only_script.to_string_lossy().to_string()
        ));
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
        assert_eq!(payload["params"]["render_mode"], "auto");
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
        let cmd = build_normalize_ocr_command(
            &config.worker_command_runtime(),
            &request,
            &job_paths,
            Path::new("/tmp/layout.json"),
            Path::new("/tmp/source.pdf"),
            Path::new("/tmp/provider-result.json"),
            Path::new("/tmp/provider.zip"),
            Path::new("/tmp/provider-raw"),
        );

        assert!(contains(
            &cmd,
            &config
                .run_normalize_ocr_script
                .to_string_lossy()
                .to_string()
        ));
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

        assert!(contains(
            &cmd,
            &config
                .run_provider_case_script
                .to_string_lossy()
                .to_string()
        ));
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

        assert!(contains(
            &cmd,
            &config
                .run_provider_case_script
                .to_string_lossy()
                .to_string()
        ));
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
        assert!(!spec_json.contains("paddle-secret"));
    }

    #[test]
    fn ocr_command_uses_provider_ocr_script() {
        let config = test_config();
        let request = build_request(WorkflowKind::Ocr);
        let job_paths = build_paths(config.as_ref());
        let cmd = build_ocr_command(
            &config.worker_command_runtime(),
            Some(Path::new("/tmp/source.pdf")),
            &request,
            &job_paths,
        );

        assert!(contains(
            &cmd,
            &config.run_provider_ocr_script.to_string_lossy().to_string()
        ));
        assert!(contains(&cmd, "--file-path"));
        assert_eq!(arg_value(&cmd, "--file-path"), Some("/tmp/source.pdf"));
        assert_eq!(arg_value(&cmd, "--mineru-token"), Some("mineru-token-test"));
        assert_eq!(
            arg_value(&cmd, "--job-root"),
            Some(job_paths.root.to_string_lossy().as_ref())
        );
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
        request.translation.glossary_entries = vec![GlossaryEntryInput {
            source: "bond".to_string(),
            target: "键".to_string(),
            note: String::new(),
            level: String::new(),
            match_mode: String::new(),
            context: String::new(),
        }];
        let job_paths = build_paths(config.as_ref());
        let cmd = build_translate_only_command(
            &config.worker_command_runtime(),
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

        let normalize = read_spec_from_command(&build_normalize_ocr_command(
            &config.worker_command_runtime(),
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

        let translate = read_spec_from_command(&build_translate_only_command(
            &config.worker_command_runtime(),
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
        assert_object_has_keys(
            &translate["params"],
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
                "model",
                "base_url",
                "credential_ref",
                "render_prewarm_output_pdf_path",
                "render_prewarm_mode",
                "render_prewarm_pdf_compress_dpi",
                "render_prewarm_source_cleanup_strategy",
            ],
        );

        let render = read_spec_from_command(&build_render_only_command(
            &config.worker_command_runtime(),
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
