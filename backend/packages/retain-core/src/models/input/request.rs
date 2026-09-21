use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{
    JobSourceInput, OcrInput, RenderInput, RuntimeInput, TranslationInput, WorkflowKind,
};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(deny_unknown_fields)]
pub struct CreateJobInput {
    #[serde(default)]
    pub workflow: WorkflowKind,
    #[serde(default)]
    pub source: JobSourceInput,
    #[serde(default)]
    pub ocr: OcrInput,
    #[serde(default)]
    pub translation: TranslationInput,
    #[serde(default)]
    pub render: RenderInput,
    #[serde(default)]
    pub runtime: RuntimeInput,
}

impl CreateJobInput {
    pub fn from_api_value(value: Value) -> serde_json::Result<Self> {
        serde_json::from_value(value)
    }
}

#[cfg(test)]
mod contract_tests {
    use super::*;

    use std::collections::BTreeSet;

    use serde::Serialize;

    use crate::model_connection::{Deadlines, ModelConnection, Provider, Thinking};
    use crate::models::{
        GlossaryEntryInput, SOURCE_CLEANUP_STRATEGIES, TRANSLATION_CONTEXT_MODES,
        TRANSLATION_GLOSSARY_MODES, TRANSLATION_MATH_MODES, TRANSLATION_MEMORY_MODES,
    };

    /// `create-job.v1.schema.json` 是**请求侧**的契约，前端的 payload 构造器按它生成
    /// TS 类型。在此之前请求侧根本没有 schema：前端只能手写字段名，写错了编译期什么
    /// 都发现不了，最早要等真提一次任务被 `deny_unknown_fields` 挡下才知道。
    ///
    /// 光有 schema 会漂，所以这里把它钉在 Rust 上。选 `include_str!` 而不是运行期
    /// `fs::read`（`job_view_contract.rs` 的做法）：那条链要造真任务、打真接口才能拿到
    /// 响应 JSON，而请求 DTO 根本没有"响应"可抓，唯一能抓的就是 serde 自己的字段集合；
    /// 而且 `include_str!` 是编译期的——契约文件被删或改名直接编译失败，不会退化成
    /// "文件读不到就跳过"。同目录的 `render.rs` / `translation.rs` 的契约测试也是这个写法。
    ///
    /// 读的是 `backend/contracts/` 这份镜像（与 `job_view_contract.rs` 一致），
    /// 它与根 `contracts/` 的逐字节一致由 `backend/contracts/check_parity.py` 保证。
    const CREATE_JOB_SCHEMA: &str =
        include_str!("../../../../../contracts/create-job.v1.schema.json");

    /// 六个顶层字段对应的五个段，外加两个被 translation 引用的嵌套结构。
    const PINNED_DEFINITIONS: &[&str] = &[
        "CreateJobInput",
        "JobSourceInput",
        "OcrInput",
        "TranslationInput",
        "RenderInput",
        "RuntimeInput",
        "GlossaryEntryInput",
        "ModelConnection",
    ];

    fn schema() -> Value {
        serde_json::from_str(CREATE_JOB_SCHEMA)
            .expect("create-job.v1.schema.json 解析失败 —— 契约文件不是合法 JSON")
    }

    fn definition<'a>(schema: &'a Value, name: &str) -> &'a Value {
        schema["definitions"].get(name).unwrap_or_else(|| {
            panic!("schema 里没有 definitions.{name} —— 契约文件的结构变了，这条测试已经失效")
        })
    }

    /// schema 侧的字段集合。解析不出 properties、或解析出空集合，都直接报错，
    /// 不能静默变成"两个空集合相等"的空操作。
    fn schema_field_names(schema: &Value, name: &str) -> BTreeSet<String> {
        let properties = definition(schema, name)["properties"]
            .as_object()
            .unwrap_or_else(|| panic!("definitions.{name} 没有 properties 对象 —— 解析写法已失效"));
        let names: BTreeSet<String> = properties.keys().cloned().collect();
        assert!(
            !names.is_empty(),
            "definitions.{name}.properties 解析出来是空集 —— 解析写法已失效"
        );
        names
    }

    /// Rust 侧的字段集合：直接问 serde，不另抄一份字段名清单
    /// （抄出来的清单会和结构体一起漂，等于没钉）。
    fn serde_field_names<T: Serialize>(value: &T, name: &str) -> BTreeSet<String> {
        let json = serde_json::to_value(value)
            .unwrap_or_else(|error| panic!("{name} 序列化失败: {error}"));
        let object = json
            .as_object()
            .unwrap_or_else(|| panic!("{name} 序列化出来不是 JSON 对象 —— 解析写法已失效"));
        let names: BTreeSet<String> = object.keys().cloned().collect();
        assert!(!names.is_empty(), "{name} 序列化出来是空对象 —— 解析写法已失效");
        names
    }

    fn model_connection_fixture() -> ModelConnection {
        ModelConnection {
            id: "conn-contract-fixture".to_string(),
            revision: 1,
            provider: Provider::Qwen,
            base_url: "https://example.invalid".to_string(),
            model: "contract-fixture".to_string(),
            credential_ref: "cred_contract_fixture".to_string(),
            concurrency: 1,
            thinking: Thinking::Auto,
            stream: None,
            allow_private_endpoint: false,
            deadlines: Deadlines::default(),
        }
    }

    fn glossary_entry_fixture() -> GlossaryEntryInput {
        GlossaryEntryInput {
            source: String::new(),
            target: String::new(),
            note: String::new(),
            level: String::new(),
            match_mode: String::new(),
            context: String::new(),
        }
    }

    /// `execution_connection` 带 `skip_serializing_if = "Option::is_none"`：留 `None`
    /// 它就不出现在序列化结果里，字段集合比对会**悄悄漏掉它**。所以显式填上。
    fn create_job_fixture() -> CreateJobInput {
        let mut input = CreateJobInput::default();
        input.translation.execution_connection = Some(model_connection_fixture());
        input
    }

    /// 双向：Rust 多一个字段、schema 多一个字段，两边都会红。
    #[test]
    fn create_job_input_field_sets_match_the_published_schema() {
        let schema = schema();
        let input = create_job_fixture();

        for (name, actual) in [
            ("CreateJobInput", serde_field_names(&input, "CreateJobInput")),
            (
                "JobSourceInput",
                serde_field_names(&input.source, "JobSourceInput"),
            ),
            ("OcrInput", serde_field_names(&input.ocr, "OcrInput")),
            (
                "TranslationInput",
                serde_field_names(&input.translation, "TranslationInput"),
            ),
            (
                "RenderInput",
                serde_field_names(&input.render, "RenderInput"),
            ),
            (
                "RuntimeInput",
                serde_field_names(&input.runtime, "RuntimeInput"),
            ),
            (
                "GlossaryEntryInput",
                serde_field_names(&glossary_entry_fixture(), "GlossaryEntryInput"),
            ),
            (
                "ModelConnection",
                serde_field_names(&model_connection_fixture(), "ModelConnection"),
            ),
        ] {
            assert_eq!(
                actual,
                schema_field_names(&schema, name),
                "{name} 的 Rust 字段集合与 create-job.v1.schema.json 对不上 \
                 —— 左边是 Rust(serde)，右边是 schema。加字段要两边一起加。"
            );
        }
    }

    /// `skip_serializing_if` 的字段一旦从 fixture 里漏掉，上面那条会退化成"少比一个
    /// 字段"而不报错。单独钉住。
    #[test]
    fn the_optional_execution_connection_is_covered_by_the_fixture() {
        let input = create_job_fixture();
        assert!(
            serde_field_names(&input.translation, "TranslationInput")
                .contains("execution_connection"),
            "fixture 没让 translation.execution_connection 出现在序列化结果里 —— \
             字段集合比对会漏掉它"
        );
    }

    /// 这是整份契约存在的理由：后端每个段都是 `#[serde(deny_unknown_fields)]`，
    /// schema 放宽成默认允许额外字段，就等于对外撒谎。
    #[test]
    fn every_pinned_definition_forbids_unknown_fields() {
        let schema = schema();
        for name in PINNED_DEFINITIONS {
            assert_eq!(
                definition(&schema, name)["additionalProperties"],
                Value::Bool(false),
                "definitions.{name} 少了 additionalProperties: false —— \
                 Rust 侧是 deny_unknown_fields"
            );
        }
    }

    /// 六个顶层字段和五个段的每个字段都带 `#[serde(default)]`，所以请求可以只带要
    /// 覆盖的字段。schema 里一旦冒出 required，前端就会被迫填一堆后端不要求的字段。
    /// `ModelConnection` 例外：它那七个字段没有 default，确实是必填。
    #[test]
    fn request_sections_declare_no_required_fields() {
        let schema = schema();
        for name in PINNED_DEFINITIONS
            .iter()
            .filter(|name| **name != "ModelConnection")
        {
            assert!(
                definition(&schema, name).get("required").is_none(),
                "definitions.{name} 声明了 required，但 Rust 侧每个字段都是 #[serde(default)]"
            );
        }
        assert_eq!(
            definition(&schema, "ModelConnection")["required"]
                .as_array()
                .expect("ModelConnection.required 必须是数组")
                .len(),
            7,
            "ModelConnection 的必填字段数变了"
        );
    }

    fn schema_enum(schema: &Value, name: &str, field: &str) -> Vec<String> {
        let values = definition(schema, name)["properties"][field]["enum"]
            .as_array()
            .unwrap_or_else(|| panic!("{name}.{field} 没有 enum 数组 —— 解析写法已失效"));
        let list: Vec<String> = values
            .iter()
            .map(|value| {
                value
                    .as_str()
                    .unwrap_or_else(|| panic!("{name}.{field} 的 enum 里有非字符串项"))
                    .to_string()
            })
            .collect();
        assert!(!list.is_empty(), "{name}.{field} 的 enum 解析出来是空集");
        list
    }

    /// schema 里凡是写了 enum 的字段，允许值必须来自 Rust 的那份常量（它自己又由
    /// `translation.rs` 的测试与 Python 的 `_normalize_*` 对齐）。
    ///
    /// 只有这几个字段写了 enum，是因为只有它们的权威常量在 retain-core 里导出；
    /// `render.render_mode` / `render.font_unify_mode` 的常量私有在 api crate 内，
    /// 这里钉不住，所以 schema 刻意留成 `type: string` 而不是抄一份会漂的副本。
    #[test]
    fn schema_enums_match_the_rust_allowlists() {
        let schema = schema();
        for (name, field, rust_values) in [
            ("TranslationInput", "math_mode", TRANSLATION_MATH_MODES),
            (
                "TranslationInput",
                "context_mode",
                TRANSLATION_CONTEXT_MODES,
            ),
            (
                "TranslationInput",
                "glossary_mode",
                TRANSLATION_GLOSSARY_MODES,
            ),
            ("TranslationInput", "memory_mode", TRANSLATION_MEMORY_MODES),
        ] {
            assert_eq!(
                schema_enum(&schema, name, field),
                rust_values
                    .iter()
                    .map(|value| value.to_string())
                    .collect::<Vec<_>>(),
                "{name}.{field} 的 schema enum 与 Rust 允许值对不上"
            );
        }

        // SOURCE_CLEANUP_STRATEGIES 首项是 DEFAULT_ 常量的别名，与第二项重复，所以比集合。
        assert_eq!(
            schema_enum(&schema, "RenderInput", "source_cleanup_strategy")
                .into_iter()
                .collect::<BTreeSet<_>>(),
            SOURCE_CLEANUP_STRATEGIES
                .iter()
                .map(|value| value.to_string())
                .collect::<BTreeSet<_>>(),
            "render.source_cleanup_strategy 的 schema enum 与 Rust 允许值对不上"
        );
    }

    /// 自保：契约文件解析不出来 / 定义缺失，必须直接报错，
    /// 不能让上面几条退化成"什么都没比"的空操作。
    #[test]
    fn the_schema_is_still_parseable() {
        let schema = schema();
        assert_eq!(
            schema["$id"], "retainpdf/contracts/create-job/v1",
            "契约文件的 $id 变了 —— include_str! 指到了别的文件"
        );
        let definitions = schema["definitions"]
            .as_object()
            .expect("schema 没有 definitions 对象 —— 契约文件的结构变了");
        assert!(
            !definitions.is_empty(),
            "schema.definitions 是空的 —— 上面几条已经挡不住漂移"
        );
        for name in PINNED_DEFINITIONS {
            assert!(
                definitions.contains_key(*name),
                "schema 里缺少 definitions.{name}"
            );
            schema_field_names(&schema, name);
        }
    }
}
