//! 没有结构化失败时，Rust 兜底按文字认的几类：本机环境（内存、安装包、路径长度、权限）
//! 和 OCR 服务商的额度用完。和 Python `structured_errors.py` 的同名分类一一对应。
//!
//! 这几类以前不是落成 `unknown`「任务失败，但暂未识别出明确根因」，就是被认错：
//! #135 import 期崩溃因为 traceback 里有 typst 字样被认成渲染失败，#81 路径过长被认成鉴权失败，
//! Paddle 12001（当日页数额度用完，HTTP 403）被当成 Token 不对。判据只认异常类型名和系统错误码
//! 这类不会出现在上游返回里的写法，裸的「permission denied」「403」不算。

use crate::models::domain::{
    JobFailureInfo, JobRawDiagnostic, JobSnapshot, OcrErrorCategory, OcrProviderDiagnostics,
    OcrProviderKind,
};

use super::job_failure_support::{
    build_failure, extract_upstream_host, first_error_excerpt, provider_name,
    select_relevant_log_line,
};

/// Windows 的 MAX_PATH 是 260（含结尾的 NUL），建目录还要再留 12 个字符，248 个字符起就可能「找不到文件」。
const WINDOWS_LONG_PATH_CHARS: usize = 248;

const OUT_OF_MEMORY_MARKERS: &[&str] = &["MemoryError", "Cannot allocate memory"];
const RUNTIME_ENVIRONMENT_MARKERS: &[&str] = &[
    "ModuleNotFoundError",
    "ImportError:",
    "No module named",
    "undefined symbol",
    "DLL load failed",
    "Library not loaded",
];
const PATH_TOO_LONG_MARKERS: &[&str] = &[
    "WinError 206",
    "File name too long",
    "filename or extension is too long",
    "文件名或扩展名太长",
];
const PERMISSION_MARKERS: &[&str] = &[
    "PermissionError",
    "[Errno 13]",
    "os error 13",
    "WinError 32",
    "being used by another process",
    "另一个程序正在使用此文件",
];
const MISSING_FILE_MARKERS: &[&str] = &[
    "No such file or directory:",
    "The system cannot find the path specified:",
    "The system cannot find the file specified:",
];

/// 本机环境类失败：内存不足、运行环境不完整、路径过长、本机权限。按这个顺序认。
pub(super) fn classify_local_environment_failure(
    job: &JobSnapshot,
    error: &str,
    haystack: &str,
    failed_stage: &str,
    diagnostics: Option<&OcrProviderDiagnostics>,
    raw_diagnostic: Option<&JobRawDiagnostic>,
) -> Option<JobFailureInfo> {
    let missing_paths = missing_file_paths(haystack);
    let (code, summary, root_cause, suggestion, markers): (_, _, _, _, &[&str]) =
        if contains_any(haystack, OUT_OF_MEMORY_MARKERS) {
            (
                "out_of_memory",
                "内存不足，处理中断",
                "处理这份文档时内存不够用，Python 进程申请内存失败",
                "关掉其他占内存的程序后重试，或把 PDF 拆成页数更少的几份分别翻译",
                OUT_OF_MEMORY_MARKERS,
            )
        } else if contains_any(haystack, RUNTIME_ENVIRONMENT_MARKERS)
            || missing_paths.iter().any(|path| is_installed_file(path))
        {
            (
                "runtime_environment_broken",
                "运行环境不完整：缺少模块、依赖库或安装文件",
                "Python 模块导入失败、动态库加载失败，或安装包里的数据文件缺失；和文档内容无关",
                "安装包缺文件或依赖库加载失败，重试不会好转：请升级到最新版或重新安装（Docker 请拉取最新镜像）",
                RUNTIME_ENVIRONMENT_MARKERS,
            )
        } else if contains_any(haystack, PATH_TOO_LONG_MARKERS)
            || missing_paths.iter().any(|path| is_long_windows_path(path))
        {
            (
                "path_too_long",
                "文件路径过长，超出系统限制",
                "要读写的文件路径超过了系统允许的长度（Windows 默认约 260 个字符），系统报「找不到文件」",
                "把 PDF 改个短一点的文件名、或放到层级浅的目录后重新上传；Windows 上也可以开启长路径支持（LongPathsEnabled）",
                PATH_TOO_LONG_MARKERS,
            )
        } else if contains_any(haystack, PERMISSION_MARKERS) {
            (
                "local_permission_denied",
                "本机权限不足，文件或网络访问被拒绝",
                "本机拒绝了文件或网络访问：权限不足、文件被其他程序占用，或被杀毒、安全软件拦截",
                "检查杀毒或安全软件是否拦截了 RetainPDF（可加入白名单）、文件是否被其他程序占用、安装目录和数据目录是否可写；Windows 上可以试试以管理员身份运行",
                PERMISSION_MARKERS,
            )
        } else {
            return None;
        };
    Some(build_failure(
        failed_stage.to_string(),
        code,
        None,
        summary,
        Some(root_cause.to_string()),
        false,
        None,
        provider_name(diagnostics),
        Some(suggestion.to_string()),
        select_relevant_log_line(job, error, markers),
        first_error_excerpt(error, haystack),
        raw_diagnostic.cloned(),
    ))
}

/// OCR 服务商说额度用完（Paddle 12001 当日页数额度、MinerU -60018/-60019 当日解析额度）。
/// 以前只有鉴权两类被映射，这类落 `unknown`，日志里带 403 时还会被文字匹配说成鉴权失败。
pub(super) fn classify_provider_quota_failure(
    failed_stage: &str,
    diagnostics: Option<&OcrProviderDiagnostics>,
    job: &JobSnapshot,
    error: &str,
    haystack: &str,
    raw_diagnostic: Option<&JobRawDiagnostic>,
) -> Option<JobFailureInfo> {
    let diagnostics = diagnostics?;
    let last_error = diagnostics.last_error.as_ref()?;
    let provider_code = last_error.provider_code.as_deref().map(str::trim);
    let paddle_daily_quota =
        matches!(diagnostics.provider, OcrProviderKind::Paddle) && provider_code == Some("12001");
    let quota = matches!(
        last_error.category,
        OcrErrorCategory::QuotaExceeded | OcrErrorCategory::HtmlQuotaExceeded
    );
    if !quota && !paddle_daily_quota {
        return None;
    }
    let (summary, suggestion) = match diagnostics.provider {
        OcrProviderKind::Paddle => (
            "PaddleOCR 今日解析页数额度已用完",
            "PaddleOCR 每个账号每天有解析页数额度，次日恢复：明天再试，或换一个 Token、换用其他 OCR",
        ),
        OcrProviderKind::Mineru => (
            "MinerU 今日解析额度已用完",
            "MinerU 每天有解析额度，次日恢复：明天再试，或换一个 Token、换用其他 OCR",
        ),
        _ => (
            "OCR 服务额度已用完",
            "OCR 服务的额度已用完：等额度恢复后再试，或换一个 Token、换用其他 OCR",
        ),
    };
    let summary = match provider_code.filter(|code| !code.is_empty()) {
        Some(code) => format!("{summary}（{code}）"),
        None => summary.to_string(),
    };
    Some(build_failure(
        failed_stage.to_string(),
        "upstream_quota_exhausted",
        last_error.provider_code.clone(),
        &summary,
        last_error
            .provider_message
            .clone()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| Some("OCR 服务商拒绝了请求：额度已用完".to_string())),
        false,
        extract_upstream_host(haystack),
        provider_name(Some(diagnostics)),
        Some(suggestion.to_string()),
        select_relevant_log_line(job, error, &["12001", "-60018", "-60019", "额度", "quota"]),
        first_error_excerpt(error, haystack),
        raw_diagnostic.cloned(),
    ))
}

/// `auth_failed` 的建议按服务商出：以前写死「检查 MinerU Token…」，PaddleOCR 用户也看到 MinerU。
pub(super) fn auth_failure_suggestion(
    failed_stage: &str,
    diagnostics: Option<&OcrProviderDiagnostics>,
) -> String {
    if failed_stage.trim() == "translation" {
        return "检查翻译模型的 API Key 是否有效、有没有这个模型的权限".to_string();
    }
    match diagnostics.map(|diag| &diag.provider) {
        Some(OcrProviderKind::Paddle) => {
            "检查 PaddleOCR Token 是否有效、是否与接口地址匹配".to_string()
        }
        Some(OcrProviderKind::Mineru) => "检查 MinerU Token 是否有效或已过期".to_string(),
        _ => "检查 OCR 服务的 Token、翻译模型的 API Key 或后端 X-API-Key 配置".to_string(),
    }
}

/// 「找不到文件」类报错里的文件路径（异常文字是 repr：Windows 反斜杠成对，经 JSON 再翻倍）。
fn missing_file_paths(text: &str) -> Vec<String> {
    let mut paths = Vec::new();
    for marker in MISSING_FILE_MARKERS {
        for (start, _) in text.match_indices(marker) {
            let rest = text[start + marker.len()..].trim_start_matches([' ', '\t', '\r', '\n']);
            let Some(quote) = rest.chars().next().filter(|ch| *ch == '\'' || *ch == '"') else {
                continue;
            };
            let body = &rest[quote.len_utf8()..];
            if let Some(end) = body.find(quote) {
                paths.push(unescape_backslashes(&body[..end]));
            }
        }
    }
    paths
}

fn unescape_backslashes(raw: &str) -> String {
    let mut text = raw.trim().to_string();
    while text.contains("\\\\") {
        text = text.replace("\\\\", "\\");
    }
    text
}

/// 安装包里的文件：Python 第三方包目录，或者本项目 Python 包（retainpdf_*）自己的目录。
fn is_installed_file(path: &str) -> bool {
    let normalized = path.replace('\\', "/").to_lowercase();
    normalized.contains("/site-packages/")
        || normalized.contains("/dist-packages/")
        || normalized.contains("/retainpdf_pipeline/")
        || normalized.contains("/retainpdf_translation/")
}

fn is_long_windows_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    let drive = bytes.len() > 2
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && matches!(bytes[2], b'\\' | b'/');
    (drive || path.starts_with("\\\\")) && path.chars().count() >= WINDOWS_LONG_PATH_CHARS
}

fn contains_any(haystack: &str, markers: &[&str]) -> bool {
    markers.iter().any(|marker| haystack.contains(marker))
}

#[cfg(test)]
#[path = "job_failure_fallback_tests.rs"]
mod tests;
