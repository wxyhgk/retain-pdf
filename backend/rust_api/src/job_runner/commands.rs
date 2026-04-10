use std::path::Path;

use anyhow::Result;
use crate::models::ResolvedJobSpec;
use crate::storage_paths::JobPaths;
use crate::AppState;

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
    ("--glossary-json", TranslationArg::GlossaryJson),
    ("--api-key", TranslationArg::ApiKey),
    ("--model", TranslationArg::Model),
    ("--base-url", TranslationArg::BaseUrl),
];

fn glossary_entries_json(request: &ResolvedJobSpec) -> Result<String> {
    Ok(serde_json::to_string(&request.translation.glossary_entries)?)
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

pub(crate) fn build_translate_from_ocr_command(
    state: &AppState,
    request: &ResolvedJobSpec,
    job_paths: &JobPaths,
    source_json_path: &Path,
    source_pdf_path: &Path,
    layout_json_path: Option<&Path>,
) -> Vec<String> {
    let mut cmd = CommandBuilder::new(
        &state.config.python_bin,
        &state.config.run_translate_from_ocr_script,
        true,
    );
    cmd.path_arg("--source-json", source_json_path);
    cmd.path_arg("--source-pdf", source_pdf_path);
    push_job_path_args(&mut cmd, job_paths);
    if let Some(layout_json_path) = layout_json_path {
        cmd.path_arg("--layout-json", layout_json_path);
    }
    push_translation_args(&mut cmd, request);
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
