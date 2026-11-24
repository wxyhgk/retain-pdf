//! 服务端的应用版本和提交号（2026-11-24）：`/health` 的 `version`、`build`，所有回应的 `X-RetainPDF-Version` 头。
//!
//! Rust 包自己的版本（`CARGO_PKG_VERSION`，现在是 0.1.0）不是应用版本。应用版本和前端 `APP_VERSION`、
//! 桌面包、Docker 镜像同一个来源：构建时注入的 `RETAIN_PDF_VERSION`（`.github/scripts/resolve_declared_version.py`）。
//! 提交号是 `RETAIN_PDF_BUILD`。两个都按这个顺序找：
//!
//! 1. 运行时的环境变量（Docker 应用镜像在最后一层 `ENV` 写进去，不让 Rust 编译层因为换提交号失效）；
//! 2. 编译时的环境变量（`option_env!`；桌面包的 Rust 构建步骤注入）；
//! 3. 都没有：版本是 [`UNKNOWN_VERSION`]（和前端没注入时的写法一样），提交号是 `None`。
//!
//! 不是 1～64 个可见 ASCII 字符的值当没给（要能放进回应头）。

use std::sync::OnceLock;

/// 没注入版本时的值，和前端 `generate-app-version.mjs` 的兜底一样。
pub const UNKNOWN_VERSION: &str = "0.0.0+unknown";

const VERSION_ENV: &str = "RETAIN_PDF_VERSION";
const BUILD_ENV: &str = "RETAIN_PDF_BUILD";
const MAX_LEN: usize = 64;

/// 应用版本，例如 `2026.11.23`；没注入是 `0.0.0+unknown`。
pub fn app_version() -> &'static str {
    static VERSION: OnceLock<String> = OnceLock::new();
    VERSION
        .get_or_init(|| {
            resolve(std::env::var(VERSION_ENV).ok(), option_env!("RETAIN_PDF_VERSION"))
                .unwrap_or_else(|| UNKNOWN_VERSION.to_string())
        })
        .as_str()
}

/// 构建的提交号；没注入是 `None`。
pub fn app_build() -> Option<&'static str> {
    static BUILD: OnceLock<Option<String>> = OnceLock::new();
    BUILD
        .get_or_init(|| resolve(std::env::var(BUILD_ENV).ok(), option_env!("RETAIN_PDF_BUILD")))
        .as_deref()
}

fn resolve(runtime: Option<String>, compiled: Option<&str>) -> Option<String> {
    runtime
        .as_deref()
        .and_then(usable)
        .or_else(|| compiled.and_then(usable))
        .map(str::to_owned)
}

fn usable(value: &str) -> Option<&str> {
    let value = value.trim();
    ((1..=MAX_LEN).contains(&value.len()) && value.bytes().all(|byte| byte.is_ascii_graphic())).then_some(value)
}

#[cfg(test)]
mod tests {
    use super::resolve;

    #[test]
    fn runtime_value_wins_then_compiled_then_nothing() {
        assert_eq!(resolve(Some(" 2026.11.24 ".into()), Some("2026.11.23")).as_deref(), Some("2026.11.24"));
        assert_eq!(resolve(Some(String::new()), Some("2026.11.23")).as_deref(), Some("2026.11.23"));
        assert_eq!(resolve(None, Some("2026.11.23")).as_deref(), Some("2026.11.23"));
        assert_eq!(resolve(None, None), None);
    }

    #[test]
    fn values_that_cannot_go_into_a_header_are_ignored() {
        assert_eq!(resolve(Some("2026 11 24".into()), None), None);
        assert_eq!(resolve(Some("版本".into()), Some("2026.11.23")).as_deref(), Some("2026.11.23"));
        assert_eq!(resolve(Some("x".repeat(65)), None), None);
    }
}
