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
/// 译前准备（全书术语预扫 + 风格指南；editorial 再加术语专员审定）开关。权威来源是 Python 的
/// `_normalize_preparation_mode`。默认 `off`：不生成产物、prompt 与缓存 key 不变。
pub const TRANSLATION_PREPARATION_MODES: &[&str] = &["off", "artifacts_only", "terms", "terms+style", "editorial"];
/// 精修（挑错 + 定点修改）开关。在渲染阶段、真正渲染之前运行：
/// `review_only` 只挑错出报告，`review_and_fix` 再对 critical/major 做定点修改，
/// `editorial` 是编辑部模式（主编分流、局部改或整块重写、多轮、台账，见 workflow/editorial.py）。
/// 默认 `off`：渲染阶段的行为与没有这个字段时完全一致。
pub const TRANSLATION_REFINE_MODES: &[&str] = &["off", "review_only", "review_and_fix", "editorial"];
/// 模型接口协议。权威来源是 Python 的 `model_wire.PROTOCOLS`。
/// `openai`：`/chat/completions` + Bearer；`anthropic`：`/messages` + x-api-key。
pub const TRANSLATION_API_PROTOCOLS: &[&str] = &["openai", "anthropic"];
/// 思考深度。权威来源是 Python 的 `model_wire.THINKING_LEVELS`。`auto` 保持以前的行为。
pub const TRANSLATION_THINKING_LEVELS: &[&str] = &["auto", "off", "low", "medium", "high", "max"];
/// 精修的成本上限默认值（0 = 不限）。Python 侧读 render.spec.json 的 `params.refine`。
///
/// 默认审全书、不设上限：选了「精翻」就该整本精修，只审开头几百块等于没说清楚就打了折。
/// 调用方要控制花费时自己给上限；碰到上限时报告里写明停在哪一页，可以从那一页接着精修。
pub const DEFAULT_TRANSLATION_REFINE_MAX_ITEMS: i64 = 0;
pub const DEFAULT_TRANSLATION_REFINE_MAX_TOKENS: i64 = 0;

/// 把任意字符串归一成 [`TRANSLATION_REFINE_MODES`] 之一，未知值 → `off`。
/// 入口校验已经拒绝非法值；这里是写 stage spec 时的兜底（老任务、手改的快照）。
pub fn normalize_translation_refine_mode(value: &str) -> &'static str {
    let normalized = value.trim().to_ascii_lowercase();
    TRANSLATION_REFINE_MODES
        .iter()
        .copied()
        .find(|mode| *mode == normalized)
        .unwrap_or("off")
}

/// `retry-stage stage=refine` 的一次性精修覆盖：只对紧接着的那一次原地渲染生效，
/// **不**写进任务的 `translation.refine`（否则之后每次普通重渲染都会再精修、再花钱）。
///
/// 它落在任务目录的 `specs/refine-override.json`（见 retain-data
/// `worker_command::refine_override`），由 Render workflow 写 render.spec.json 时读取，
/// workflow 结束（成功 / 失败 / 取消）后删除；任务运行时重启、任务被恢复续跑时文件还在，
/// 续跑的渲染仍然带这次精修。页码 1-based、闭区间，`None` = 全书。
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct RefineOverride {
    pub mode: String,
    #[serde(default)]
    pub start_page: Option<i64>,
    #[serde(default)]
    pub end_page: Option<i64>,
    /// 这次手动精修的上限；不给 = 不限（审全书）。手动精修不沿用任务里
    /// 存的上限（老任务存的是以前的默认 300 块）。
    #[serde(default)]
    pub max_items: Option<i64>,
    #[serde(default)]
    pub max_tokens: Option<i64>,
    #[serde(default)]
    pub requested_at: String,
}

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
    #[serde(default = "default_translation_preparation_mode")]
    pub preparation: String,
    #[serde(default = "default_translation_refine_mode")]
    pub refine: String,
    /// 最多挑错多少块；0 = 不限。
    #[serde(default = "default_translation_refine_max_items")]
    pub refine_max_items: i64,
    /// 挑错 + 修改的总 token 上限；0 = 不限。
    #[serde(default = "default_translation_refine_max_tokens")]
    pub refine_max_tokens: i64,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub credential_ref: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    /// 审校（挑错）模型的配置位，本期只透传不使用。空值表示回退到翻译模型。
    #[serde(default)]
    pub reviewer_model: String,
    #[serde(default)]
    pub reviewer_base_url: String,
    /// 内联审校 key：处理方式与 `api_key` 完全一致，创建任务时导入 vault
    /// 变成 `reviewer_credential_ref` 并清空，不明文落库。
    #[serde(default)]
    pub reviewer_api_key: String,
    #[serde(default)]
    pub reviewer_credential_ref: String,
    /// 翻译模型接口的协议，见 [`TRANSLATION_API_PROTOCOLS`]。
    #[serde(default = "default_translation_api_protocol")]
    pub api_protocol: String,
    /// 翻译模型的思考深度，见 [`TRANSLATION_THINKING_LEVELS`]。
    #[serde(default = "default_translation_thinking")]
    pub thinking: String,
    /// 审校模型的协议；空 = 沿用 `api_protocol`。
    #[serde(default)]
    pub reviewer_api_protocol: String,
    /// 审校模型的思考深度；空 = 沿用 `thinking`。
    #[serde(default)]
    pub reviewer_thinking: String,
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
            preparation: default_translation_preparation_mode(),
            refine: default_translation_refine_mode(),
            refine_max_items: default_translation_refine_max_items(),
            refine_max_tokens: default_translation_refine_max_tokens(),
            api_key: String::new(),
            credential_ref: String::new(),
            model: String::new(),
            base_url: String::new(),
            reviewer_model: String::new(),
            reviewer_base_url: String::new(),
            reviewer_api_key: String::new(),
            reviewer_credential_ref: String::new(),
            api_protocol: default_translation_api_protocol(),
            thinking: default_translation_thinking(),
            reviewer_api_protocol: String::new(),
            reviewer_thinking: String::new(),
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

pub fn default_translation_preparation_mode() -> String {
    "off".to_string()
}

pub fn default_translation_api_protocol() -> String {
    "openai".to_string()
}

pub fn default_translation_thinking() -> String {
    "auto".to_string()
}

pub fn default_translation_refine_mode() -> String {
    "off".to_string()
}

pub fn default_translation_refine_max_items() -> i64 {
    DEFAULT_TRANSLATION_REFINE_MAX_ITEMS
}

pub fn default_translation_refine_max_tokens() -> i64 {
    DEFAULT_TRANSLATION_REFINE_MAX_TOKENS
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
            (
                "_normalize_preparation_mode",
                TRANSLATION_PREPARATION_MODES,
                "preparation",
            ),
        ] {
            assert_eq!(
                rust_set(rust_values),
                python_normalizer_set(fn_name),
                "translation.{field} 的允许值和 Python 的 {fn_name} 对不上"
            );
        }
    }

    const MODEL_WIRE_PY: &str =
        include_str!("../../../../../pipeline/retainpdf_pipeline/translate/llm/shared/model_wire.py");

    /// 从 `NAME = ("a", "b")` 抠出元组里的字符串。
    fn python_tuple(name: &str) -> BTreeSet<String> {
        let start = MODEL_WIRE_PY
            .find(&format!("\n{name} = ("))
            .unwrap_or_else(|| panic!("model_wire.py 里找不到 {name} = (...) —— 写法变了"));
        let body = &MODEL_WIRE_PY[start + name.len() + 5..];
        let close = body.find(')').expect("元组没闭合");
        let set: BTreeSet<String> = body[..close]
            .split(',')
            .map(|item| item.trim().trim_matches('"').to_string())
            .filter(|item| !item.is_empty())
            .collect();
        assert!(!set.is_empty(), "{name} 解析出来是空集");
        set
    }

    #[test]
    fn protocol_and_thinking_match_python_model_wire() {
        assert_eq!(rust_set(TRANSLATION_API_PROTOCOLS), python_tuple("PROTOCOLS"));
        assert_eq!(rust_set(TRANSLATION_THINKING_LEVELS), python_tuple("THINKING_LEVELS"));
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
            (
                &input.preparation,
                TRANSLATION_PREPARATION_MODES,
                "preparation",
            ),
            (&input.refine, TRANSLATION_REFINE_MODES, "refine"),
            (&input.api_protocol, TRANSLATION_API_PROTOCOLS, "api_protocol"),
            (&input.thinking, TRANSLATION_THINKING_LEVELS, "thinking"),
        ] {
            assert!(
                allowed.contains(&value.as_str()),
                "translation.{field} 的默认值 {value:?} 不在允许值 {allowed:?} 里"
            );
        }
    }
}
