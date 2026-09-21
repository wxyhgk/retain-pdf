use serde::{Deserialize, Serialize};

use crate::models::defaults::*;

/// 这四个字段的允许值。**权威来源是 Python 的 `_normalize_*` 函数**
/// （`translate/llm/shared/control_context.py`）和 `workflow-config.ts` 的
/// `normalizeMathMode`；Rust 只是把同一份集合提前到入口校验。
///
/// 在此之前 Rust 侧完全不校验，填错的值会一路走到 Python 被**静默归一化**成默认值：
/// `context_mode="alll"` 静默变 `needed`、`memory_mode="broad_"` 静默变 `matched`，
/// 用户以为开了某个开关，实际从没生效，且没有任何提示。
///
/// `translation.mode` 和 `translation.rule_profile_name` 刻意不在这里：
/// 前者 Python 只判 `== "sci"`，其余一律走 not-sci 分支，取值域是开的；
/// 后者 `build_rule_profile_context` 有一条 `load_saved_rule_profile_text` 的
/// 扩展分支（目前是空桩），上白名单等于把那个口子焊死。
pub const TRANSLATION_MATH_MODES: &[&str] = &["direct_typst", "placeholder"];
pub const TRANSLATION_CONTEXT_MODES: &[&str] = &["needed", "all", "off"];
pub const TRANSLATION_GLOSSARY_MODES: &[&str] = &["matched", "all", "off"];
pub const TRANSLATION_MEMORY_MODES: &[&str] = &["matched", "broad", "off"];

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct GlossaryEntryInput {
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub target: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub level: String,
    #[serde(default)]
    pub match_mode: String,
    #[serde(default)]
    pub context: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct TranslationInput {
    /// Full immutable snapshot, not a pointer to mutable frontend settings.
    /// Omitted for legacy jobs; it never contains an inline model API key.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_connection: Option<crate::model_connection::ModelConnection>,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default = "default_math_mode")]
    pub math_mode: String,
    #[serde(default)]
    pub skip_title_translation: bool,
    #[serde(default = "default_classify_batch_size")]
    pub classify_batch_size: i64,
    #[serde(default = "default_rule_profile_name")]
    pub rule_profile_name: String,
    #[serde(default)]
    pub custom_rules_text: String,
    #[serde(default)]
    pub glossary_id: String,
    #[serde(default)]
    pub glossary_name: String,
    #[serde(default)]
    pub glossary_resource_entry_count: i64,
    #[serde(default)]
    pub glossary_inline_entry_count: i64,
    #[serde(default)]
    pub glossary_overridden_entry_count: i64,
    #[serde(default)]
    pub glossary_entries: Vec<GlossaryEntryInput>,
    #[serde(default = "default_translation_context_mode")]
    pub context_mode: String,
    #[serde(default = "default_translation_glossary_mode")]
    pub glossary_mode: String,
    #[serde(default = "default_translation_memory_mode")]
    pub memory_mode: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub credential_ref: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub start_page: i64,
    #[serde(default = "default_end_page")]
    pub end_page: i64,
    /// Optional explicit, one-based document page numbers. An empty list keeps
    /// the legacy start_page/end_page selection semantics.
    #[serde(default)]
    pub page_ranges: Vec<u32>,
    #[serde(default = "default_batch_size")]
    pub batch_size: i64,
    #[serde(default)]
    pub workers: i64,
    #[serde(default)]
    pub accepted_ambiguous_request_risk: bool,
}

impl Default for TranslationInput {
    fn default() -> Self {
        Self {
            execution_connection: None,
            mode: default_mode(),
            math_mode: default_math_mode(),
            skip_title_translation: false,
            classify_batch_size: default_classify_batch_size(),
            rule_profile_name: default_rule_profile_name(),
            custom_rules_text: String::new(),
            glossary_id: String::new(),
            glossary_name: String::new(),
            glossary_resource_entry_count: 0,
            glossary_inline_entry_count: 0,
            glossary_overridden_entry_count: 0,
            glossary_entries: Vec::new(),
            context_mode: default_translation_context_mode(),
            glossary_mode: default_translation_glossary_mode(),
            memory_mode: default_translation_memory_mode(),
            api_key: String::new(),
            credential_ref: String::new(),
            model: String::new(),
            base_url: String::new(),
            start_page: 0,
            end_page: default_end_page(),
            page_ranges: Vec::new(),
            batch_size: default_batch_size(),
            workers: 0,
            accepted_ambiguous_request_risk: false,
        }
    }
}

pub fn default_translation_context_mode() -> String {
    "needed".to_string()
}

pub fn default_translation_glossary_mode() -> String {
    "matched".to_string()
}

pub fn default_translation_memory_mode() -> String {
    "matched".to_string()
}

#[cfg(test)]
mod allowed_value_tests {
    use super::*;
    use std::collections::BTreeSet;

    /// 这四个集合的权威来源在 Python:`_normalize_*` 里那个 `if normalized in {...}`。
    /// Rust 只是把同一份集合提前到入口校验,两边漂了就等于「Rust 放行 / Python 静默改写」
    /// 或者反过来「Rust 拒绝一个 Python 明明支持的值」。所以直接读 Python 源码比对。
    const CONTROL_CONTEXT_PY: &str =
        include_str!("../../../../../pipeline/retainpdf_pipeline/translate/llm/shared/control_context.py");

    /// 从 `def _normalize_xxx(...)` 的函数体里抠出 `in {"a", "b"}` 的集合。
    fn python_normalizer_set(fn_name: &str) -> BTreeSet<String> {
        let start = CONTROL_CONTEXT_PY
            .find(&format!("def {fn_name}("))
            .unwrap_or_else(|| panic!("control_context.py 里找不到 {fn_name} —— 函数改名了,这条测试已经失效"));
        let body = &CONTROL_CONTEXT_PY[start..];
        let open = body
            .find(" in {")
            .unwrap_or_else(|| panic!("{fn_name} 里找不到 `in {{...}}` 集合字面量 —— 写法变了"));
        let close = body[open..]
            .find('}')
            .unwrap_or_else(|| panic!("{fn_name} 的集合字面量没闭合"));
        let set: BTreeSet<String> = body[open + 5..open + close]
            .split(',')
            .map(|item| item.trim().trim_matches('"').to_string())
            .filter(|item| !item.is_empty())
            .collect();
        assert!(!set.is_empty(), "{fn_name} 解析出来是空集 —— 解析写法已失效");
        set
    }

    fn rust_set(values: &[&str]) -> BTreeSet<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn mode_allowlists_match_the_python_normalizers() {
        for (fn_name, rust_values, field) in [
            ("_normalize_context_mode", TRANSLATION_CONTEXT_MODES, "context_mode"),
            ("_normalize_glossary_mode", TRANSLATION_GLOSSARY_MODES, "glossary_mode"),
            ("_normalize_memory_mode", TRANSLATION_MEMORY_MODES, "memory_mode"),
        ] {
            assert_eq!(
                rust_set(rust_values),
                python_normalizer_set(fn_name),
                "translation.{field} 的允许值和 Python 的 {fn_name} 对不上"
            );
        }
    }

    /// 每个字段的默认值必须在自己的允许值里,否则「什么都不填」会被自己的校验拒掉。
    #[test]
    fn every_default_is_an_allowed_value() {
        let input = TranslationInput::default();
        for (value, allowed, field) in [
            (&input.math_mode, TRANSLATION_MATH_MODES, "math_mode"),
            (&input.context_mode, TRANSLATION_CONTEXT_MODES, "context_mode"),
            (&input.glossary_mode, TRANSLATION_GLOSSARY_MODES, "glossary_mode"),
            (&input.memory_mode, TRANSLATION_MEMORY_MODES, "memory_mode"),
        ] {
            assert!(
                allowed.contains(&value.as_str()),
                "translation.{field} 的默认值 {value:?} 不在允许值 {allowed:?} 里"
            );
        }
    }
}
