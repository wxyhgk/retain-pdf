use std::path::Path;

use crate::models::ResolvedJobSpec;
use crate::storage_paths::JobPaths;
use crate::AppState;
use anyhow::Result;

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

#[derive(Clone, Copy)]
enum TranslationArg {
    StartPage,
    EndPage,
    BatchSize,
    Workers,
    Mode,
    SkipTitleTranslation,
    ClassifyBatchSize,
    RuleProfileName,
    CustomRulesText,
    GlossaryId,
    GlossaryName,
    GlossaryResourceEntryCount,
    GlossaryInlineEntryCount,
    GlossaryOverriddenEntryCount,
    GlossaryJson,
    ApiKey,
    Model,
    BaseUrl,
}

#[derive(Clone, Copy)]
enum RenderArg {
    RenderMode,
    CompileWorkers,
    TypstFontFamily,
    PdfCompressDpi,
    TranslatedPdfName,
    BodyFontSizeFactor,
    BodyLeadingFactor,
    InnerBboxShrinkX,
    InnerBboxShrinkY,
    InnerBboxDenseShrinkX,
    InnerBboxDenseShrinkY,
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

const TRANSLATION_ARGS: &[(&str, TranslationArg)] = &[
    ("--start-page", TranslationArg::StartPage),
    ("--end-page", TranslationArg::EndPage),
    ("--batch-size", TranslationArg::BatchSize),
    ("--workers", TranslationArg::Workers),
    ("--mode", TranslationArg::Mode),
    (
        "--skip-title-translation",
        TranslationArg::SkipTitleTranslation,
    ),
    ("--classify-batch-size", TranslationArg::ClassifyBatchSize),
    ("--rule-profile-name", TranslationArg::RuleProfileName),
    ("--custom-rules-text", TranslationArg::CustomRulesText),
    ("--glossary-id", TranslationArg::GlossaryId),
    ("--glossary-name", TranslationArg::GlossaryName),
    (
        "--glossary-resource-entry-count",
        TranslationArg::GlossaryResourceEntryCount,
    ),
    (
        "--glossary-inline-entry-count",
        TranslationArg::GlossaryInlineEntryCount,
    ),
    (
        "--glossary-overridden-entry-count",
        TranslationArg::GlossaryOverriddenEntryCount,
    ),
    ("--glossary-json", TranslationArg::GlossaryJson),
    ("--api-key", TranslationArg::ApiKey),
    ("--model", TranslationArg::Model),
    ("--base-url", TranslationArg::BaseUrl),
];

fn glossary_entries_json(request: &ResolvedJobSpec) -> Result<String> {
    Ok(serde_json::to_string(
        &request.translation.glossary_entries,
    )?)
}

const RENDER_ARGS: &[(&str, RenderArg)] = &[
    ("--render-mode", RenderArg::RenderMode),
    ("--compile-workers", RenderArg::CompileWorkers),
    ("--typst-font-family", RenderArg::TypstFontFamily),
    ("--pdf-compress-dpi", RenderArg::PdfCompressDpi),
    ("--translated-pdf-name", RenderArg::TranslatedPdfName),
    ("--body-font-size-factor", RenderArg::BodyFontSizeFactor),
    ("--body-leading-factor", RenderArg::BodyLeadingFactor),
    ("--inner-bbox-shrink-x", RenderArg::InnerBboxShrinkX),
    ("--inner-bbox-shrink-y", RenderArg::InnerBboxShrinkY),
    (
        "--inner-bbox-dense-shrink-x",
        RenderArg::InnerBboxDenseShrinkX,
    ),
    (
        "--inner-bbox-dense-shrink-y",
        RenderArg::InnerBboxDenseShrinkY,
    ),
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

fn push_translation_args(cmd: &mut CommandBuilder, request: &ResolvedJobSpec) {
    for (name, arg) in TRANSLATION_ARGS {
        match arg {
            TranslationArg::StartPage => cmd.arg(name, request.translation.start_page),
            TranslationArg::EndPage => cmd.arg(name, request.translation.end_page),
            TranslationArg::BatchSize => cmd.arg(name, request.translation.batch_size),
            TranslationArg::Workers => cmd.arg(name, request.resolved_workers()),
            TranslationArg::Mode => cmd.arg(name, &request.translation.mode),
            TranslationArg::SkipTitleTranslation => {
                cmd.flag(name, request.translation.skip_title_translation)
            }
            TranslationArg::ClassifyBatchSize => {
                cmd.arg(name, request.translation.classify_batch_size)
            }
            TranslationArg::RuleProfileName => {
                cmd.arg(name, &request.translation.rule_profile_name)
            }
            TranslationArg::CustomRulesText => {
                cmd.arg(name, &request.translation.custom_rules_text)
            }
            TranslationArg::GlossaryId => {
                if !request.translation.glossary_id.trim().is_empty() {
                    cmd.arg(name, request.translation.glossary_id.trim());
                }
            }
            TranslationArg::GlossaryName => {
                if !request.translation.glossary_name.trim().is_empty() {
                    cmd.arg(name, request.translation.glossary_name.trim());
                }
            }
            TranslationArg::GlossaryResourceEntryCount => {
                cmd.arg(name, request.translation.glossary_resource_entry_count)
            }
            TranslationArg::GlossaryInlineEntryCount => {
                cmd.arg(name, request.translation.glossary_inline_entry_count)
            }
            TranslationArg::GlossaryOverriddenEntryCount => {
                cmd.arg(name, request.translation.glossary_overridden_entry_count)
            }
            TranslationArg::GlossaryJson => {
                if !request.translation.glossary_entries.is_empty() {
                    if let Ok(payload) = glossary_entries_json(request) {
                        cmd.arg(name, payload);
                    }
                }
            }
            TranslationArg::ApiKey => cmd.arg(name, &request.translation.api_key),
            TranslationArg::Model => cmd.arg(name, &request.translation.model),
            TranslationArg::BaseUrl => cmd.arg(name, &request.translation.base_url),
        }
    }
}

fn push_render_only_translation_args(cmd: &mut CommandBuilder, request: &ResolvedJobSpec) {
    cmd.arg("--start-page", request.translation.start_page);
    cmd.arg("--end-page", request.translation.end_page);
    cmd.arg("--api-key", &request.translation.api_key);
    cmd.arg("--model", &request.translation.model);
    cmd.arg("--base-url", &request.translation.base_url);
}

fn push_render_args(cmd: &mut CommandBuilder, request: &ResolvedJobSpec) {
    for (name, arg) in RENDER_ARGS {
        match arg {
            RenderArg::RenderMode => cmd.arg(name, &request.render.render_mode),
            RenderArg::CompileWorkers => cmd.arg(name, request.render.compile_workers),
            RenderArg::TypstFontFamily => cmd.arg(name, &request.render.typst_font_family),
            RenderArg::PdfCompressDpi => cmd.arg(name, request.render.pdf_compress_dpi),
            RenderArg::TranslatedPdfName => {
                if !request.render.translated_pdf_name.trim().is_empty() {
                    cmd.arg(name, request.render.translated_pdf_name.trim());
                }
            }
            RenderArg::BodyFontSizeFactor => cmd.arg(name, request.render.body_font_size_factor),
            RenderArg::BodyLeadingFactor => cmd.arg(name, request.render.body_leading_factor),
            RenderArg::InnerBboxShrinkX => cmd.arg(name, request.render.inner_bbox_shrink_x),
            RenderArg::InnerBboxShrinkY => cmd.arg(name, request.render.inner_bbox_shrink_y),
            RenderArg::InnerBboxDenseShrinkX => {
                cmd.arg(name, request.render.inner_bbox_dense_shrink_x)
            }
            RenderArg::InnerBboxDenseShrinkY => {
                cmd.arg(name, request.render.inner_bbox_dense_shrink_y)
            }
        }
    }
}

pub(crate) fn build_command(
    state: &AppState,
    upload_path: &Path,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_mineru_case_script,
        true,
    );
    cmd.path_arg("--file-path", upload_path);
    push_ocr_args(&mut cmd, request);
    push_job_path_args(&mut cmd, job_paths);
    push_translation_args(&mut cmd, request);
    push_render_args(&mut cmd, request);
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
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_translate_only_script,
        true,
    );
    cmd.path_arg("--source-json", source_json_path);
    cmd.path_arg("--source-pdf", source_pdf_path);
    push_job_path_args(&mut cmd, job_paths);
    if let Some(layout_json_path) = layout_json_path {
        cmd.path_arg("--layout-json", layout_json_path);
    }
    push_translation_args(&mut cmd, request);
    cmd.finish()
}

pub(crate) fn build_render_only_command(
    state: &AppState,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_pdf_path: &Path,
    translations_dir: &Path,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_render_only_script,
        true,
    );
    cmd.path_arg("--source-pdf", source_pdf_path);
    cmd.path_arg("--translations-dir", translations_dir);
    push_job_path_args(&mut cmd, job_paths);
    push_render_only_translation_args(&mut cmd, request);
    push_render_args(&mut cmd, request);
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
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_normalize_ocr_script,
        false,
    );
    cmd.arg("--provider", &request.ocr.provider);
    cmd.path_arg("--source-json", source_json_path);
    cmd.path_arg("--source-pdf", source_pdf_path);
    cmd.arg(
        "--provider-version",
        if request.ocr.provider.trim().eq_ignore_ascii_case("paddle") {
            request.ocr.paddle_model.clone()
        } else {
            request.ocr.model_version.clone()
        },
    );
    cmd.path_arg("--provider-result-json", provider_result_json_path);
    cmd.path_arg("--provider-zip", provider_zip_path);
    cmd.path_arg("--provider-raw-dir", provider_raw_dir);
    push_job_path_args(&mut cmd, job_paths);
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
        assert!(contains(&cmd, "--source-json"));
        assert!(contains(&cmd, "/tmp/document.v1.json"));
        assert!(contains(&cmd, "--layout-json"));
        assert!(contains(&cmd, "--api-key"));
        assert!(!contains(&cmd, "--render-mode"));
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
        assert!(contains(&cmd, "--source-pdf"));
        assert!(contains(&cmd, "/tmp/source.pdf"));
        assert!(contains(&cmd, "--translations-dir"));
        assert!(contains(&cmd, "/tmp/translated"));
        assert!(contains(&cmd, "--render-mode"));
        assert!(contains(&cmd, "auto"));
        assert!(contains(&cmd, "--translated-pdf-name"));
        assert!(contains(&cmd, "out.pdf"));
        assert!(contains(&cmd, "--api-key"));
        assert!(contains(&cmd, "--model"));
        assert!(contains(&cmd, "--base-url"));
        assert!(!contains(&cmd, "--mode"));
        assert!(!contains(&cmd, "--batch-size"));
        assert!(!contains(&cmd, "--classify-batch-size"));
        assert!(!contains(&cmd, "--glossary-json"));
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

        assert_eq!(arg_value(&cmd, "--glossary-id"), Some("glossary-123"));
        assert_eq!(arg_value(&cmd, "--glossary-name"), Some("semiconductor"));
        assert_eq!(
            arg_value(&cmd, "--glossary-resource-entry-count"),
            Some("2")
        );
        assert_eq!(arg_value(&cmd, "--glossary-inline-entry-count"), Some("1"));
        assert_eq!(
            arg_value(&cmd, "--glossary-overridden-entry-count"),
            Some("1")
        );
        let glossary_json =
            arg_value(&cmd, "--glossary-json").expect("glossary json argument present");
        assert!(glossary_json.contains("\"source\":\"band gap\""));
        assert!(glossary_json.contains("\"target\":\"态密度\""));
    }
}
