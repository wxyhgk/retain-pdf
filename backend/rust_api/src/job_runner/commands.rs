use std::fs;
use std::path::{Path, PathBuf};

use crate::models::ResolvedJobSpec;
use crate::storage_paths::JobPaths;
use crate::AppState;
use anyhow::{Context, Result};
use serde_json::json;

struct CommandBuilder {
    parts: Vec<String>,
}

impl CommandBuilder {
    fn new(python_bin: &str, script_path: &Path, unbuffered: bool) -> Self {
        let mut parts = vec![python_bin.to_string()];
        if unbuffered {
            parts.push("-u".to_string());
        }
        parts.push(script_path.to_string_lossy().to_string());
        Self { parts }
    }

    fn flag(&mut self, name: &str, enabled: bool) {
        if enabled {
            self.parts.push(name.to_string());
        }
    }

    fn arg(&mut self, name: &str, value: impl ToString) {
        self.parts.push(name.to_string());
        self.parts.push(value.to_string());
    }

    fn path_arg(&mut self, name: &str, value: &Path) {
        self.arg(name, value.to_string_lossy());
    }

    fn finish(self) -> Vec<String> {
        self.parts
    }
}

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

const NORMALIZE_STAGE_SCHEMA_VERSION: &str = "normalize.stage.v1";
const TRANSLATE_STAGE_SCHEMA_VERSION: &str = "translate.stage.v1";
const RENDER_STAGE_SCHEMA_VERSION: &str = "render.stage.v1";
const MINERU_STAGE_SCHEMA_VERSION: &str = "mineru.stage.v1";
const TRANSLATION_API_KEY_ENV_NAME: &str = "RETAIN_TRANSLATION_API_KEY";
const MINERU_TOKEN_ENV_NAME: &str = "RETAIN_MINERU_API_TOKEN";

fn normalize_stage_spec_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join("normalize.spec.json")
}

fn translate_stage_spec_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join("translate.spec.json")
}

fn render_stage_spec_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join("render.spec.json")
}

fn mineru_stage_spec_path(job_paths: &JobPaths) -> PathBuf {
    job_paths.specs_dir.join("mineru.spec.json")
}

fn write_normalize_stage_spec(
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    provider_result_json_path: &Path,
    provider_zip_path: &Path,
    provider_raw_dir: &Path,
) -> Result<PathBuf> {
    fs::create_dir_all(&job_paths.specs_dir)
        .with_context(|| format!("create specs dir: {}", job_paths.specs_dir.display()))?;
    let spec_path = normalize_stage_spec_path(job_paths);
    let provider_version = if request.ocr.provider.trim().eq_ignore_ascii_case("paddle") {
        request.ocr.paddle_model.trim().to_string()
    } else {
        request.ocr.model_version.trim().to_string()
    };
    let payload = json!({
        "schema_version": NORMALIZE_STAGE_SCHEMA_VERSION,
        "stage": "normalize",
        "job": {
            "job_id": request.job_id,
            "job_root": job_paths.root,
            "workflow": request.workflow,
        },
        "inputs": {
            "provider": request.ocr.provider,
            "source_json": source_json_path,
            "source_pdf": source_pdf_path,
            "provider_version": provider_version,
            "provider_result_json": provider_result_json_path,
            "provider_zip": provider_zip_path,
            "provider_raw_dir": provider_raw_dir,
        },
        "params": {},
    });
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&spec_path, content)
        .with_context(|| format!("write normalize stage spec: {}", spec_path.display()))?;
    Ok(spec_path)
}

fn write_translate_stage_spec(
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Result<PathBuf> {
    fs::create_dir_all(&job_paths.specs_dir)
        .with_context(|| format!("create specs dir: {}", job_paths.specs_dir.display()))?;
    let spec_path = translate_stage_spec_path(job_paths);
    let credential_ref = if request.translation.api_key.trim().is_empty() {
        String::new()
    } else {
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    };
    let payload = json!({
        "schema_version": TRANSLATE_STAGE_SCHEMA_VERSION,
        "stage": "translate",
        "job": {
            "job_id": request.job_id,
            "job_root": job_paths.root,
            "workflow": request.workflow,
        },
        "inputs": {
            "source_json": source_json_path,
            "source_pdf": source_pdf_path,
            "layout_json": layout_json_path,
        },
        "params": {
            "start_page": request.translation.start_page,
            "end_page": request.translation.end_page,
            "batch_size": request.translation.batch_size,
            "workers": request.resolved_workers(),
            "mode": request.translation.mode,
            "math_mode": request.translation.math_mode,
            "skip_title_translation": request.translation.skip_title_translation,
            "classify_batch_size": request.translation.classify_batch_size,
            "rule_profile_name": request.translation.rule_profile_name,
            "custom_rules_text": request.translation.custom_rules_text,
            "glossary_id": request.translation.glossary_id,
            "glossary_name": request.translation.glossary_name,
            "glossary_resource_entry_count": request.translation.glossary_resource_entry_count,
            "glossary_inline_entry_count": request.translation.glossary_inline_entry_count,
            "glossary_overridden_entry_count": request.translation.glossary_overridden_entry_count,
            "glossary_entries": request.translation.glossary_entries,
            "model": request.translation.model,
            "base_url": request.translation.base_url,
            "credential_ref": credential_ref,
        },
    });
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&spec_path, content)
        .with_context(|| format!("write translate stage spec: {}", spec_path.display()))?;
    Ok(spec_path)
}

fn write_render_stage_spec(
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
    translations_dir: &Path,
) -> Result<PathBuf> {
    fs::create_dir_all(&job_paths.specs_dir)
        .with_context(|| format!("create specs dir: {}", job_paths.specs_dir.display()))?;
    let spec_path = render_stage_spec_path(job_paths);
    let credential_ref = if request.translation.api_key.trim().is_empty() {
        String::new()
    } else {
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    };
    let payload = json!({
        "schema_version": RENDER_STAGE_SCHEMA_VERSION,
        "stage": "render",
        "job": {
            "job_id": request.job_id,
            "job_root": job_paths.root,
            "workflow": request.workflow,
        },
        "inputs": {
            "source_pdf": source_pdf_path,
            "translations_dir": translations_dir,
            "translation_manifest": translations_dir.join("translation-manifest.json"),
        },
        "params": {
            "start_page": request.translation.start_page,
            "end_page": request.translation.end_page,
            "render_mode": request.render.render_mode,
            "compile_workers": request.render.compile_workers,
            "typst_font_family": request.render.typst_font_family,
            "pdf_compress_dpi": request.render.pdf_compress_dpi,
            "translated_pdf_name": request.render.translated_pdf_name,
            "body_font_size_factor": request.render.body_font_size_factor,
            "body_leading_factor": request.render.body_leading_factor,
            "inner_bbox_shrink_x": request.render.inner_bbox_shrink_x,
            "inner_bbox_shrink_y": request.render.inner_bbox_shrink_y,
            "inner_bbox_dense_shrink_x": request.render.inner_bbox_dense_shrink_x,
            "inner_bbox_dense_shrink_y": request.render.inner_bbox_dense_shrink_y,
            "model": request.translation.model,
            "base_url": request.translation.base_url,
            "credential_ref": credential_ref,
        },
    });
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&spec_path, content)
        .with_context(|| format!("write render stage spec: {}", spec_path.display()))?;
    Ok(spec_path)
}

fn write_mineru_stage_spec(
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    upload_path: &Path,
) -> Result<PathBuf> {
    fs::create_dir_all(&job_paths.specs_dir)
        .with_context(|| format!("create specs dir: {}", job_paths.specs_dir.display()))?;
    let spec_path = mineru_stage_spec_path(job_paths);
    let mineru_credential_ref = if request.ocr.mineru_token.trim().is_empty() {
        String::new()
    } else {
        format!("env:{MINERU_TOKEN_ENV_NAME}")
    };
    let translation_credential_ref = if request.translation.api_key.trim().is_empty() {
        String::new()
    } else {
        format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
    };
    let payload = json!({
        "schema_version": MINERU_STAGE_SCHEMA_VERSION,
        "stage": "mineru",
        "job": {
            "job_id": request.job_id,
            "job_root": job_paths.root,
            "workflow": request.workflow,
        },
        "source": {
            "file_url": request.source.source_url,
            "file_path": upload_path,
        },
        "ocr": {
            "credential_ref": mineru_credential_ref,
            "model_version": request.ocr.model_version,
            "is_ocr": request.ocr.is_ocr,
            "disable_formula": request.ocr.disable_formula,
            "disable_table": request.ocr.disable_table,
            "language": request.ocr.language,
            "page_ranges": request.ocr.page_ranges,
            "data_id": request.ocr.data_id,
            "no_cache": request.ocr.no_cache,
            "cache_tolerance": request.ocr.cache_tolerance,
            "extra_formats": request.ocr.extra_formats,
            "poll_interval": request.ocr.poll_interval,
            "poll_timeout": request.ocr.poll_timeout,
        },
        "translation": {
            "start_page": request.translation.start_page,
            "end_page": request.translation.end_page,
            "batch_size": request.translation.batch_size,
            "workers": request.resolved_workers(),
            "mode": request.translation.mode,
            "math_mode": request.translation.math_mode,
            "skip_title_translation": request.translation.skip_title_translation,
            "classify_batch_size": request.translation.classify_batch_size,
            "rule_profile_name": request.translation.rule_profile_name,
            "custom_rules_text": request.translation.custom_rules_text,
            "glossary_id": request.translation.glossary_id,
            "glossary_name": request.translation.glossary_name,
            "glossary_resource_entry_count": request.translation.glossary_resource_entry_count,
            "glossary_inline_entry_count": request.translation.glossary_inline_entry_count,
            "glossary_overridden_entry_count": request.translation.glossary_overridden_entry_count,
            "glossary_entries": request.translation.glossary_entries,
            "model": request.translation.model,
            "base_url": request.translation.base_url,
            "credential_ref": translation_credential_ref,
        },
        "render": {
            "render_mode": request.render.render_mode,
            "compile_workers": request.render.compile_workers,
            "typst_font_family": request.render.typst_font_family,
            "pdf_compress_dpi": request.render.pdf_compress_dpi,
            "translated_pdf_name": request.render.translated_pdf_name,
            "body_font_size_factor": request.render.body_font_size_factor,
            "body_leading_factor": request.render.body_leading_factor,
            "inner_bbox_shrink_x": request.render.inner_bbox_shrink_x,
            "inner_bbox_shrink_y": request.render.inner_bbox_shrink_y,
            "inner_bbox_dense_shrink_x": request.render.inner_bbox_dense_shrink_x,
            "inner_bbox_dense_shrink_y": request.render.inner_bbox_dense_shrink_y,
        },
    });
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&spec_path, content)
        .with_context(|| format!("write mineru stage spec: {}", spec_path.display()))?;
    Ok(spec_path)
}

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

pub(crate) fn build_command(
    state: &AppState,
    upload_path: &Path,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Vec<String> {
    let spec_path = write_mineru_stage_spec(request, job_paths, upload_path)
        .expect("write mineru stage spec");
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_mineru_case_script,
        true,
    );
    cmd.path_arg("--spec", &spec_path);
    cmd.finish()
}

pub(crate) fn build_ocr_command(
    state: &AppState,
    upload_path: Option<&Path>,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_ocr_job_script,
        true,
    );
    if let Some(upload_path) = upload_path {
        cmd.path_arg("--file-path", upload_path);
    } else {
        cmd.arg("--file-url", &request.source.source_url);
    }
    push_ocr_args(&mut cmd, request);
    push_job_path_args(&mut cmd, job_paths);
    cmd.finish()
}

pub(crate) fn build_translate_only_command(
    state: &AppState,
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
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_translate_only_script,
        true,
    );
    cmd.path_arg("--spec", &spec_path);
    cmd.finish()
}

pub(crate) fn build_render_only_command(
    state: &AppState,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
    translations_dir: &Path,
) -> Vec<String> {
    let spec_path = write_render_stage_spec(
        request,
        job_paths,
        source_pdf_path,
        translations_dir,
    )
    .expect("write render stage spec");
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_render_only_script,
        true,
    );
    cmd.path_arg("--spec", &spec_path);
    cmd.finish()
}

pub(crate) fn build_normalize_ocr_command(
    state: &AppState,
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
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_normalize_ocr_script,
        false,
    );
    cmd.path_arg("--spec", &spec_path);
    cmd.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AppConfig;
    use crate::db::Db;
    use crate::models::{CreateJobInput, WorkflowKind};
    use std::collections::HashSet;
    use std::sync::Arc;
    use tokio::sync::{Mutex, RwLock, Semaphore};

    fn test_state() -> AppState {
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

        let config = Arc::new(AppConfig {
            project_root: root.clone(),
            rust_api_root,
            data_root: data_root.clone(),
            scripts_dir: scripts_dir.clone(),
            run_mineru_case_script: scripts_dir.join("run_mineru_case.py"),
            run_ocr_job_script: scripts_dir.join("run_ocr_job.py"),
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
        });

        AppState {
            config: config.clone(),
            db: Arc::new(Db::new(
                config.jobs_db_path.clone(),
                config.data_root.clone(),
            )),
            downloads_lock: Arc::new(Mutex::new(())),
            canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
            job_slots: Arc::new(Semaphore::new(1)),
        }
    }

    fn build_request(workflow: WorkflowKind) -> ResolvedJobSpec {
        let mut input = CreateJobInput::default();
        input.workflow = workflow;
        input.ocr.mineru_token = "mineru-token-test".to_string();
        input.translation.api_key = "sk-test".to_string();
        input.translation.model = "deepseek-chat".to_string();
        input.translation.base_url = "https://api.deepseek.com/v1".to_string();
        input.translation.workers = 3;
        input.render.render_mode = "auto".to_string();
        input.render.translated_pdf_name = "out.pdf".to_string();
        ResolvedJobSpec::from_input(input)
    }

    fn build_paths(state: &AppState) -> JobPaths {
        JobPaths::for_job(&state.config.output_root, "job-command-test")
    }

    fn contains(cmd: &[String], value: &str) -> bool {
        cmd.iter().any(|arg| arg == value)
    }

    fn arg_value<'a>(cmd: &'a [String], flag: &str) -> Option<&'a str> {
        cmd.windows(2)
            .find(|window| window[0] == flag)
            .map(|window| window[1].as_str())
    }

    #[test]
    fn translate_only_command_uses_translation_stage_script() {
        let state = test_state();
        let request = build_request(WorkflowKind::Translate);
        let job_paths = build_paths(&state);
        let cmd = build_translate_only_command(
            &state,
            &request,
            &job_paths,
            Path::new("/tmp/document.v1.json"),
            Path::new("/tmp/source.pdf"),
            Some(Path::new("/tmp/layout.json")),
        );

        assert!(contains(
            &cmd,
            &state
                .config
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
        let state = test_state();
        let request = build_request(WorkflowKind::Render);
        let job_paths = build_paths(&state);
        let cmd = build_render_only_command(
            &state,
            &request,
            &job_paths,
            Path::new("/tmp/source.pdf"),
            Path::new("/tmp/translated"),
        );

        assert!(contains(
            &cmd,
            &state
                .config
                .run_render_only_script
                .to_string_lossy()
                .to_string()
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
        let state = test_state();
        let mut request = build_request(WorkflowKind::Ocr);
        request.job_id = "job-command-test".to_string();
        request.ocr.provider = "mineru".to_string();
        request.ocr.model_version = "v1".to_string();
        let job_paths = build_paths(&state);
        let cmd = build_normalize_ocr_command(
            &state,
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
            &state
                .config
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
    fn build_command_writes_mineru_stage_spec_and_hides_secrets() {
        let state = test_state();
        let mut request = build_request(WorkflowKind::Mineru);
        request.job_id = "job-command-test".to_string();
        let job_paths = build_paths(&state);
        let cmd = build_command(
            &state,
            Path::new("/tmp/source/job.pdf"),
            &request,
            &job_paths,
        );

        assert!(contains(
            &cmd,
            &state
                .config
                .run_mineru_case_script
                .to_string_lossy()
                .to_string()
        ));
        assert!(contains(&cmd, "--spec"));
        assert!(!contains(&cmd, "--file-path"));
        assert!(!contains(&cmd, "--api-key"));
        assert!(!contains(&cmd, "--mineru-token"));
        let spec_path = arg_value(&cmd, "--spec").expect("mineru spec path");
        let spec_json =
            std::fs::read_to_string(spec_path).expect("mineru stage spec should be written");
        let payload: serde_json::Value = serde_json::from_str(&spec_json).expect("valid json");
        assert_eq!(payload["schema_version"], "mineru.stage.v1");
        assert_eq!(payload["stage"], "mineru");
        assert_eq!(payload["source"]["file_path"], "/tmp/source/job.pdf");
        assert_eq!(
            payload["ocr"]["credential_ref"],
            format!("env:{MINERU_TOKEN_ENV_NAME}")
        );
        assert_eq!(
            payload["translation"]["credential_ref"],
            format!("env:{TRANSLATION_API_KEY_ENV_NAME}")
        );
        assert!(!spec_json.contains("sk-test"));
        assert!(!spec_json.contains("mineru-token-test"));
    }

    #[test]
    fn translate_only_command_includes_glossary_metadata_and_payload() {
        let state = test_state();
        let mut request = build_request(WorkflowKind::Translate);
        request.translation.glossary_id = "glossary-123".to_string();
        request.translation.glossary_name = "semiconductor".to_string();
        request.translation.glossary_resource_entry_count = 2;
        request.translation.glossary_inline_entry_count = 1;
        request.translation.glossary_overridden_entry_count = 1;
        request.translation.glossary_entries = vec![
            crate::models::GlossaryEntryInput {
                source: "band gap".to_string(),
                target: "带隙".to_string(),
                note: String::new(),
                level: "canonical".to_string(),
                match_mode: "exact".to_string(),
                context: String::new(),
            },
            crate::models::GlossaryEntryInput {
                source: "DOS".to_string(),
                target: "态密度".to_string(),
                note: "physics".to_string(),
                level: "preferred".to_string(),
                match_mode: "case_insensitive".to_string(),
                context: "materials".to_string(),
            },
        ];
        let job_paths = build_paths(&state);
        let cmd = build_translate_only_command(
            &state,
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
        assert_eq!(payload["params"]["glossary_id"], "glossary-123");
        assert_eq!(payload["params"]["glossary_name"], "semiconductor");
        assert_eq!(payload["params"]["glossary_resource_entry_count"], 2);
        assert_eq!(payload["params"]["glossary_inline_entry_count"], 1);
        assert_eq!(payload["params"]["glossary_overridden_entry_count"], 1);
        assert!(payload["params"]["glossary_entries"].to_string().contains("band gap"));
        assert!(payload["params"]["glossary_entries"].to_string().contains("态密度"));
    }
}
