//! 服务商错误码目录（2026-11-23）：接口 `GET /api/v1/providers/error-codes`、数据文件、生成的文档。
//!
//! - 接口的返回、每个数据文件（`backend/packages/retainpdf-providers/error-codes/`）都按契约
//!   `provider-error-codes.v1` 校验，多一个键、少一个键都红；
//! - 文档 `docs/reference/error-codes/`（索引、每家一个文件、RetainPDF 失败码）从同一份数据生成，过期就红。
//!   改了数据重新生成：`UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes`。

use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::Value;
use tower::ServiceExt;

use crate::api_tests::job_view_contract::{assert_definition, assert_exact_object_keys, contract};
use crate::api_tests::jobs_common::{read_json, test_state};
use crate::app::build_app;
use crate::services::providers::{
    provider_error_catalogue, HandlingAction, HandlingStatus, ProviderErrorCatalogueView, ProviderErrorCategory,
    ProviderErrorCodesQuery, ProviderErrorEntry, ProviderErrorVendor, ProviderKind, RetainpdfFailureCodeView,
};

const CONTRACT: &str = "provider-error-codes.v1.schema.json";
const DOCS_DIR: &str = "docs/reference/error-codes";
const DATA_DIR: &str = "backend/packages/retainpdf-providers/error-codes";
const VENDOR_IDS: [&str; 9] = ["paddle", "mineru", "glm_ocr", "openai", "anthropic", "deepseek", "zhipu", "qwen", "opencode"];

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

async fn get(uri: &str) -> (StatusCode, Value) {
    let response = build_app(test_state("provider-error-codes"))
        .oneshot(Request::builder().uri(uri).header("x-api-key", "test-key").body(Body::empty()).unwrap())
        .await
        .expect("response");
    let status = response.status();
    (status, read_json(response).await)
}

fn vendor_ids(data: &Value) -> Vec<String> {
    data["vendors"].as_array().unwrap().iter().map(|vendor| vendor["id"].as_str().unwrap().to_string()).collect()
}

/// 不带筛选：全部 9 家，先 OCR 后翻译模型；返回逐项按契约校验。
#[tokio::test]
async fn catalogue_returns_every_vendor_and_matches_schema() {
    let (status, payload) = get("/api/v1/providers/error-codes").await;
    assert_eq!(status, StatusCode::OK);
    let data = &payload["data"];
    let contract = contract(CONTRACT);
    assert_definition(data, &contract, "ProviderErrorCatalogueView", "catalogue");
    assert_exact_object_keys(data, &contract, "ProviderErrorCatalogueView", "catalogue");
    assert_eq!(data["schema"], "provider-error-codes.v1");
    assert_eq!(vendor_ids(data), VENDOR_IDS);
    assert_eq!(data["categories"].as_array().unwrap().len(), 16);
    for (index, vendor) in data["vendors"].as_array().unwrap().iter().enumerate() {
        assert_exact_object_keys(vendor, &contract, "ProviderErrorVendor", &format!("vendors[{index}]"));
        for (entry_index, entry) in vendor["entries"].as_array().unwrap().iter().enumerate() {
            let path = format!("vendors[{index}].entries[{entry_index}]");
            assert_exact_object_keys(entry, &contract, "ProviderErrorEntry", &path);
            assert_exact_object_keys(&entry["retainpdf_handling"], &contract, "RetainpdfHandling", &path);
        }
    }
    for (index, code) in data["failure_codes"].as_array().unwrap().iter().enumerate() {
        assert_exact_object_keys(code, &contract, "RetainpdfFailureCodeView", &format!("failure_codes[{index}]"));
    }
    // 失败码带着恢复目录里的续跑方式
    let render = data["failure_codes"].as_array().unwrap().iter().find(|code| code["failure_code"] == "render_failed").unwrap();
    assert_eq!(render["resume_from"], "render");
}

#[tokio::test]
async fn catalogue_filters_by_kind_provider_code_and_status() {
    let (status, payload) = get("/api/v1/providers/error-codes?kind=ocr").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(vendor_ids(&payload["data"]), ["paddle", "mineru", "glm_ocr"]);

    let (_, payload) = get("/api/v1/providers/error-codes?kind=llm").await;
    assert_eq!(vendor_ids(&payload["data"]), ["openai", "anthropic", "deepseek", "zhipu", "qwen", "opencode"]);

    // 任务失败里的 provider + provider_code 直接查到一条
    let (_, payload) = get("/api/v1/providers/error-codes?provider=glm_ocr&code=1113").await;
    let entries = payload["data"]["vendors"][0]["entries"].as_array().unwrap().clone();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0]["category"], "billing");
    assert_eq!(entries[0]["retainpdf_handling"]["failure_code"], "upstream_quota_exhausted");
    assert_eq!(payload["data"]["categories"].as_array().unwrap().len(), 16, "大类总是全量");

    // 只按码查：同一个码在几家都有
    let (_, payload) = get("/api/v1/providers/error-codes?code=1302").await;
    assert_eq!(vendor_ids(&payload["data"]), ["glm_ocr", "zhipu"]);

    // 没有业务码的厂商按 HTTP 状态查
    let (_, payload) = get("/api/v1/providers/error-codes?provider=deepseek&http_status=402").await;
    assert_eq!(payload["data"]["vendors"][0]["entries"][0]["id"], "http_402");

    // 不认识的厂商：200，vendors 为空
    let (status, payload) = get("/api/v1/providers/error-codes?provider=nobody").await;
    assert_eq!(status, StatusCode::OK);
    assert!(payload["data"]["vendors"].as_array().unwrap().is_empty());

    // 查不到的码：厂商不返回
    let (_, payload) = get("/api/v1/providers/error-codes?provider=paddle&code=nope").await;
    assert!(payload["data"]["vendors"].as_array().unwrap().is_empty());

    // kind 只能是 ocr / llm；不认识的参数 400
    let (status, _) = get("/api/v1/providers/error-codes?kind=video").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _) = get("/api/v1/providers/error-codes?vendor=paddle").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

/// 每个数据文件按契约校验：厂商文件是 ProviderErrorVendor，categories.json、failure-codes.json 是对应定义的数组。
#[test]
fn data_files_match_schema() {
    let contract = contract(CONTRACT);
    let root = repo_root().join(DATA_DIR);
    let read = |path: &Path| -> Value { serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap() };
    let mut vendor_files = 0;
    for kind in ["ocr", "llm"] {
        for entry in std::fs::read_dir(root.join(kind)).unwrap() {
            let path = entry.unwrap().path();
            let value = read(&path);
            let name = path.display().to_string();
            assert_definition(&value, &contract, "ProviderErrorVendor", &name);
            assert_exact_object_keys(&value, &contract, "ProviderErrorVendor", &name);
            assert_eq!(value["kind"], kind, "{name}");
            assert_eq!(path.file_stem().unwrap().to_string_lossy(), value["id"].as_str().unwrap(), "{name}");
            for (index, item) in value["entries"].as_array().unwrap().iter().enumerate() {
                assert_exact_object_keys(item, &contract, "ProviderErrorEntry", &format!("{name} entries[{index}]"));
            }
            vendor_files += 1;
        }
    }
    assert_eq!(vendor_files, VENDOR_IDS.len());
    let categories = read(&root.join("categories.json"));
    for (index, item) in categories.as_array().unwrap().iter().enumerate() {
        assert_definition(item, &contract, "ProviderErrorCategory", &format!("categories[{index}]"));
        assert_exact_object_keys(item, &contract, "ProviderErrorCategory", &format!("categories[{index}]"));
    }
    let failure_codes = read(&root.join("failure-codes.json"));
    for (index, item) in failure_codes.as_array().unwrap().iter().enumerate() {
        assert_definition(item, &contract, "RetainpdfFailureCodeRecord", &format!("failure_codes[{index}]"));
        assert_exact_object_keys(item, &contract, "RetainpdfFailureCodeRecord", &format!("failure_codes[{index}]"));
    }
    // 契约里的大类取值和 categories.json 一致
    let enum_values: Vec<&str> = contract["definitions"]["ProviderErrorCategoryId"]["enum"]
        .as_array()
        .unwrap()
        .iter()
        .map(|value| value.as_str().unwrap())
        .collect();
    let listed: Vec<&str> = categories.as_array().unwrap().iter().map(|item| item["id"].as_str().unwrap()).collect();
    assert_eq!(enum_values, listed);
}

// ---------------------------------------------------------------------------------------------
// 生成文档
// ---------------------------------------------------------------------------------------------

const GENERATED_NOTE: [&str; 2] = [
    "<!-- 由 backend/api/src/api_tests/provider_error_codes.rs 从 backend/packages/retainpdf-providers/error-codes/ 生成，不要手改：",
    "     UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes -->",
];

/// 正文里的 `<`（例如 `Bearer <token>`）会被当成 HTML 标签吞掉，转义掉。
fn prose(text: &str) -> String {
    text.replace('<', "&lt;")
}

fn cell(text: &str) -> String {
    prose(text).replace('|', "\\|").replace('\n', " ")
}

fn issue_link(number: u32) -> String {
    format!("[#{number}](https://github.com/wxyhgk/retain-pdf/issues/{number})")
}

fn kind_label(kind: ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Ocr => "OCR 服务商",
        ProviderKind::Llm => "翻译模型服务商",
    }
}

fn action_label(action: HandlingAction) -> &'static str {
    match action {
        HandlingAction::Retry => "退避重试",
        HandlingAction::FailFast => "不重试，任务失败",
        HandlingAction::StopTranslation => "整份翻译停下",
        HandlingAction::AutoAdjust => "自动改请求重发",
        HandlingAction::FailBlock => "只这一块失败",
        HandlingAction::NotApplicable => "碰不到",
    }
}

fn priority_label(entry: &ProviderErrorEntry) -> &'static str {
    match entry.retainpdf_handling.priority.map(|priority| priority.as_str()) {
        Some("high") => "高",
        Some("medium") => "中",
        Some(_) => "低",
        None => "",
    }
}

fn status_cell(entry: &ProviderErrorEntry) -> String {
    let handling = &entry.retainpdf_handling;
    match handling.status {
        HandlingStatus::Ok => "对得上".to_string(),
        HandlingStatus::NotApplicable => "—".to_string(),
        HandlingStatus::Gap | HandlingStatus::Fixing => {
            let label = if handling.status == HandlingStatus::Fixing { "修复中" } else { "缺口" };
            format!("**{label}·{}**：{}", priority_label(entry), cell(handling.gap_zh.as_deref().unwrap_or("")))
        }
    }
}

fn code_cell(entry: &ProviderErrorEntry) -> String {
    let mut text = match &entry.code {
        Some(code) => format!("`{}`", cell(code)),
        None => format!("（{}）", cell(&entry.id)),
    };
    for alias in &entry.aliases {
        let _ = write!(text, " / `{}`", cell(alias));
    }
    text
}

fn http_cell(entry: &ProviderErrorEntry) -> String {
    if entry.http_status.is_empty() {
        return "—".to_string();
    }
    entry.http_status.iter().map(|status| status.to_string()).collect::<Vec<_>>().join("、")
}

fn handling_cell(entry: &ProviderErrorEntry) -> String {
    let handling = &entry.retainpdf_handling;
    let mut text = format!("{}", action_label(handling.action));
    if let Some(code) = &handling.failure_code {
        let _ = write!(text, " → `{code}`");
    }
    let _ = write!(text, "：{}", cell(&handling.summary_zh));
    if !handling.issues.is_empty() {
        let links: Vec<String> = handling.issues.iter().map(|number| issue_link(*number)).collect();
        let _ = write!(text, "（{}）", links.join(" "));
    }
    text
}

fn category_label<'a>(categories: &'a [ProviderErrorCategory], entry: &ProviderErrorEntry) -> &'a str {
    categories.iter().find(|category| category.id == entry.category).map(|category| category.label_zh.as_str()).unwrap_or("")
}

/// 文件在 docs/reference/error-codes/<sub>/ 下时，到仓库根的相对前缀。
fn to_root(depth: usize) -> String {
    "../".repeat(depth)
}

struct GapCount {
    high: usize,
    medium: usize,
    low: usize,
}

fn gap_count(vendor: &ProviderErrorVendor) -> GapCount {
    let mut count = GapCount { high: 0, medium: 0, low: 0 };
    for entry in &vendor.entries {
        if matches!(entry.retainpdf_handling.status, HandlingStatus::Gap | HandlingStatus::Fixing) {
            match priority_label(entry) {
                "高" => count.high += 1,
                "中" => count.medium += 1,
                _ => count.low += 1,
            }
        }
    }
    count
}

fn vendor_doc(vendor: &ProviderErrorVendor, categories: &[ProviderErrorCategory]) -> String {
    let root = to_root(4);
    let mut out = String::new();
    for line in GENERATED_NOTE {
        let _ = writeln!(out, "{line}");
    }
    let _ = writeln!(out, "\n# {} 错误码\n", vendor.label);
    let kind = vendor.kind.as_str();
    let _ = writeln!(
        out,
        "{}。接口主机：{}。数据：[`{DATA_DIR}/{kind}/{}.json`]({root}{DATA_DIR}/{kind}/{}.json)；\
         接口 `GET /api/v1/providers/error-codes?provider={}`。回到[错误码索引](../README.md)。\n",
        kind_label(vendor.kind),
        vendor.hosts.iter().map(|host| format!("`{host}`")).collect::<Vec<_>>().join("、"),
        vendor.id,
        vendor.id,
        vendor.id,
    );
    let _ = writeln!(out, "含义、提示都是转述，原文看每条的出处。\n");
    let _ = writeln!(out, "## 错误长什么样\n\n{}\n", prose(&vendor.error_shape_zh));
    let _ = writeln!(out, "## 同一个状态有几种意思时怎么分\n");
    for rule in &vendor.how_to_distinguish_zh {
        let _ = writeln!(out, "- {}", prose(rule));
    }
    let _ = writeln!(out, "\n## RetainPDF 怎么处理\n\n{}\n", prose(&vendor.handling_summary_zh));
    let gaps = gap_count(vendor);
    let _ = writeln!(
        out,
        "共 {} 条：有缺口 {} 条（高 {}、中 {}、低 {}），碰不到 {} 条。缺口按用户影响排的总表见[索引](../README.md#缺口汇总)。\n",
        vendor.entries.len(),
        gaps.high + gaps.medium + gaps.low,
        gaps.high,
        gaps.medium,
        gaps.low,
        vendor.entries.iter().filter(|entry| entry.retainpdf_handling.status == HandlingStatus::NotApplicable).count(),
    );
    let _ = writeln!(out, "## 错误码\n");
    let _ = writeln!(out, "码一栏是服务商返回的码；服务商没有码的，括号里是我们起的编号（接口里的 `id`）。\n");
    let _ = writeln!(out, "| 码 | HTTP | 大类 | 可重试 | 含义 | 给用户的提示 | 我们怎么处理 | 对不对得上 | 出处 |");
    let _ = writeln!(out, "|---|---|---|---|---|---|---|---|---|");
    for entry in &vendor.entries {
        let _ = writeln!(
            out,
            "| {} | {} | {}（`{}`） | {} | {} | {} | {} | {} | [文档]({}) |",
            code_cell(entry),
            http_cell(entry),
            category_label(categories, entry),
            entry.category.as_str(),
            if entry.retryable { "是" } else { "否" },
            cell(&entry.meaning_zh),
            cell(&entry.user_hint_zh),
            handling_cell(entry),
            status_cell(entry),
            entry.source_url,
        );
    }
    let mut paths: Vec<&str> = vendor
        .entries
        .iter()
        .flat_map(|entry| entry.retainpdf_handling.code_paths.iter().map(String::as_str))
        .collect();
    paths.sort();
    paths.dedup();
    if !paths.is_empty() {
        let _ = writeln!(out, "\n## 相关代码\n");
        for path in paths {
            let _ = writeln!(out, "- [`{path}`]({root}{path})");
        }
    }
    if !vendor.notes_zh.is_empty() {
        let _ = writeln!(out, "\n## 备注\n");
        for note in &vendor.notes_zh {
            let _ = writeln!(out, "- {}", prose(note));
        }
    }
    let _ = writeln!(out, "\n## 出处\n");
    for source in &vendor.sources {
        let _ = writeln!(out, "- [{}]({})（抓取 {}）", source.title, source.url, source.fetched_at);
    }
    if !vendor.issues.is_empty() {
        let _ = writeln!(out, "\n## issue 里见过\n");
        for issue in &vendor.issues {
            let _ = writeln!(out, "- {}：{}", issue_link(issue.number), issue.summary_zh);
        }
    }
    if !vendor.related_docs.is_empty() {
        let _ = writeln!(out, "\n## 相关文档\n");
        for doc in &vendor.related_docs {
            let _ = writeln!(out, "- [`{doc}`]({root}{doc})");
        }
    }
    out
}

fn categories_for(failure_code: &str, categories: &[ProviderErrorCategory]) -> String {
    let ids: Vec<String> = categories
        .iter()
        .filter(|category| category.failure_codes.iter().any(|code| code == failure_code))
        .map(|category| format!("`{}`", category.id.as_str()))
        .collect();
    if ids.is_empty() {
        "—".to_string()
    } else {
        ids.join("、")
    }
}

fn failure_codes_doc(failure_codes: &[RetainpdfFailureCodeView], categories: &[ProviderErrorCategory]) -> String {
    let root = to_root(4);
    let mut out = String::new();
    for line in GENERATED_NOTE {
        let _ = writeln!(out, "{line}");
    }
    let _ = writeln!(out, "\n# RetainPDF 失败码\n");
    let _ = writeln!(
        out,
        "任务失败时 `failure`（`GET /api/v1/jobs/{{job_id}}/reports/failure`，任务详情里也有）的 `failure_code` 取下面这些值。\
         回到[错误码索引](../README.md)；失败结构的字段见[失败结构](../../../api/08-调试诊断/01-失败结构.md)。\n"
    );
    let _ = writeln!(out, "分类有两个产生方：\n");
    let _ = writeln!(
        out,
        "1. **Python 流水线**：[`structured_errors.py`]({root}backend/pipeline/retainpdf_pipeline/foundation/shared/structured_errors.py) 的 \
         `classify_exception`。worker 把异常归类后打一行 `structured failure json: {{...}}`，Rust 解析到就直接用。\
         只有包在 `run_with_structured_failure` 里的代码才会出这一行，import 期崩溃没有结构化失败。"
    );
    let _ = writeln!(
        out,
        "2. **Rust 兜底**：[`job_failure.rs`]({root}backend/packages/retainpdf-core/src/job_failure.rs) 的 `classify_job_failure_inner`，\
         没有结构化失败时按错误文字和日志尾巴匹配；OCR 服务商的分类（`OcrErrorCategory`）只有鉴权两类会被用上\
         （[`job_failure_structured.rs`]({root}backend/packages/retainpdf-core/src/job_failure_structured.rs)）。\n"
    );
    let _ = writeln!(
        out,
        "「续跑起点」「恢复提示」来自恢复目录 [`job_failure_catalogue.rs`]({root}backend/packages/retainpdf-core/src/job_failure_catalogue.rs)\
         （`auth_failed` 在翻译阶段失败时从翻译续跑，见目录里的 `STAGE_OVERRIDES`）；前端只渲染后端给的 `summary`、`recovery_hint`。\
         「上游大类」是[服务商错误码](../README.md#大类)里对照到这个码的大类。\n"
    );
    let _ = writeln!(out, "| `failure_code` | 产生方 | 用户看到的 `summary` | 可重试 | 续跑起点 | 恢复提示 | 上游大类 | issue 里见过 | 备注 |");
    let _ = writeln!(out, "|---|---|---|---|---|---|---|---|---|");
    for code in failure_codes {
        let record = &code.record;
        let producer = match record.producer {
            crate::services::providers::FailureProducer::Python => "Python",
            crate::services::providers::FailureProducer::Rust => "Rust",
            crate::services::providers::FailureProducer::Both => "两边",
        };
        let resume = match code.resume_from {
            Some("translation") => "翻译",
            Some("render") => "渲染",
            Some(_) => "?",
            None => "整个重跑",
        };
        let issues: Vec<String> = record.issues.iter().map(|number| issue_link(*number)).collect();
        let _ = writeln!(
            out,
            "| `{}` | {} | {} | {} | {} | {} | {} | {} | {} |",
            record.failure_code,
            producer,
            cell(&record.summary_zh),
            if record.retryable { "是" } else { "否" },
            resume,
            cell(code.recovery_hint),
            categories_for(&record.failure_code, categories),
            if issues.is_empty() { "—".to_string() } else { issues.join(" ") },
            cell(record.note_zh.as_deref().unwrap_or("")),
        );
    }
    out
}

fn readme(view: &ProviderErrorCatalogueView) -> String {
    let root = to_root(3);
    let mut out = String::new();
    for line in GENERATED_NOTE {
        let _ = writeln!(out, "{line}");
    }
    let _ = writeln!(out, "\n# 服务商错误码\n");
    let _ = writeln!(
        out,
        "各家 OCR 服务商、翻译模型服务商官方文档里的错误码（2026-11-23 抓取），每条带含义、给用户的提示、RetainPDF 现在怎么处理、\
         和官方说法对不对得上。用途：任务失败时，前端按失败里的厂商和码查到对应条目，给出比「任务失败，但暂未识别出明确根因」更具体的提示。\n"
    );
    let _ = writeln!(out, "- 数据（唯一来源）：[`{DATA_DIR}/`]({root}{DATA_DIR}/)，每家一个文件，分 `ocr/`、`llm/`；形状由契约 [`provider-error-codes.v1`]({root}contracts/provider-error-codes.v1.schema.json) 钉住。");
    let _ = writeln!(out, "- 接口：`GET /api/v1/providers/error-codes`（见[服务商错误码接口](../../api/08-调试诊断/03-服务商错误码.md)），可按 `kind`、`provider`、`code`、`http_status` 筛。");
    let _ = writeln!(out, "- 本目录全部从数据生成：`UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes`。");
    let _ = writeln!(out, "- 含义、提示都是转述，不是原文；原文看每条的出处链接。");
    let _ = writeln!(out, "- 整理过程和 issue 逐条核对见[错误码汇总（2026-11-23）](../../ops/planning/error-codes/20261123-错误码汇总.md)。\n");

    let _ = writeln!(out, "## 怎么查一条提示\n");
    let _ = writeln!(out, "任务失败（`GET /api/v1/jobs/{{job_id}}/reports/failure`，字段见[失败结构](../../api/08-调试诊断/01-失败结构.md)）里有 `failure_code`、`failed_stage`、`provider`、`provider_code`、`upstream_host`：\n");
    let _ = writeln!(out, "1. **OCR 阶段**：厂商编号用任务详情的 `request_payload.ocr.provider`（`paddle`、`mineru`、`glm_ocr`）——失败里的 `provider` 只有 Rust 认出的 Paddle、MinerU 失败才是厂商名，Python worker 报的是 `ocr`；`provider_code` 是服务商的业务码 → `GET /api/v1/providers/error-codes?provider=<厂商>&code=<provider_code>`，拿条目的 `user_hint_zh`。");
    let _ = writeln!(out, "2. **翻译阶段**：现在失败里的 `provider` 是 `translation`，多数不带业务码和 HTTP 状态；`upstream_host` 有值时可以对各家的 `hosts` 找到厂商（`open.bigmodel.cn` 在 OCR 阶段是 `glm_ocr`，翻译阶段是 `zhipu`）。");
    let _ = writeln!(out, "3. **查不到条目**：用 `failure_code` 在 `failure_codes` 里找 `recovery_hint`，或者用条目、失败码对应的大类的 `user_hint_zh` 当通用提示。");
    let _ = writeln!(out, "4. 条目的 `retainpdf_handling.status` 为 `gap` 时，说明我们现在的分类和官方说法不一致（例如额度用完被说成限流），提示以条目为准。\n");

    let _ = writeln!(out, "## 大类\n");
    let _ = writeln!(out, "每条错误码归到一个固定的大类（`category`）。大类对照到 RetainPDF 的失败码（[失败码表](./retainpdf/失败码.md)），第一个是主名，后面是同义的另一种拼法；现在实际落到哪个码看各条的「我们怎么处理」。\n");
    let _ = writeln!(out, "| 大类 | 名称 | 说明 | 一般可重试 | 对照的失败码 | 通用提示 | 备注 |");
    let _ = writeln!(out, "|---|---|---|---|---|---|---|");
    for category in &view.categories {
        let _ = writeln!(
            out,
            "| `{}` | {} | {} | {} | {} | {} | {} |",
            category.id.as_str(),
            category.label_zh,
            cell(&category.description_zh),
            if category.retryable { "是" } else { "否" },
            category.failure_codes.iter().map(|code| format!("`{code}`")).collect::<Vec<_>>().join("、"),
            cell(&category.user_hint_zh),
            cell(category.note_zh.as_deref().unwrap_or("")),
        );
    }

    let _ = writeln!(out, "\n## 厂商\n");
    let _ = writeln!(out, "| 厂商 | 编号 | 种类 | 条目 | 缺口（高 / 中 / 低） | 文档 |");
    let _ = writeln!(out, "|---|---|---|---|---|---|");
    for vendor in &view.vendors {
        let gaps = gap_count(vendor);
        let kind = vendor.kind.as_str();
        let _ = writeln!(
            out,
            "| {} | `{}` | {} | {} | {} / {} / {} | [{kind}/{}.md](./{kind}/{}.md) |",
            vendor.label,
            vendor.id,
            kind_label(vendor.kind),
            vendor.entries.len(),
            gaps.high,
            gaps.medium,
            gaps.low,
            vendor.id,
            vendor.id,
        );
    }
    let _ = writeln!(out, "\n另外两份手写的资料：[PaddleOCR 错误码](../ocr/PaddleOCR/错误码.md)、[DeepSeek 错误码](../LLM_api/DeepSeek/错误码.md)。\n");

    let _ = writeln!(out, "## 缺口汇总\n");
    let _ = writeln!(out, "数据里标了缺口（`retainpdf_handling.status = gap`）的高、中优先级条目，按优先级、厂商排。低优先级的只在各家文件里列。这里只记录，不改行为；修复各走各的分支，改完代码再改数据。\n");
    let _ = writeln!(out, "| 优先级 | 厂商 | 码 | 现在 | 应该 |");
    let _ = writeln!(out, "|---|---|---|---|---|");
    for wanted in ["高", "中"] {
        for vendor in &view.vendors {
            // 同一段缺口说明在一家里出现多次时合并成一行
            let mut grouped: BTreeMap<(String, String), Vec<String>> = BTreeMap::new();
            let mut order: Vec<(String, String)> = Vec::new();
            for entry in &vendor.entries {
                if entry.retainpdf_handling.status != HandlingStatus::Gap || priority_label(entry) != wanted {
                    continue;
                }
                let key = (entry.retainpdf_handling.summary_zh.clone(), entry.retainpdf_handling.gap_zh.clone().unwrap_or_default());
                if !grouped.contains_key(&key) {
                    order.push(key.clone());
                }
                grouped.entry(key).or_default().push(code_cell(entry));
            }
            for key in order {
                let codes = &grouped[&key];
                let _ = writeln!(
                    out,
                    "| {wanted} | [{}](./{}/{}.md) | {} | {} | {} |",
                    vendor.label,
                    vendor.kind.as_str(),
                    vendor.id,
                    codes.join("、"),
                    cell(&key.0),
                    cell(&key.1),
                );
            }
        }
    }
    let _ = writeln!(out, "\n## 我们自己的失败码\n");
    let _ = writeln!(out, "见 [RetainPDF 失败码](./retainpdf/失败码.md)：每个 `failure_code` 的产生方、用户看到的 `summary`、可不可重试、从哪个阶段续跑，以及哪些上游大类落到它。");
    out
}

fn generated_docs() -> Vec<(String, String)> {
    let view = provider_error_catalogue(&ProviderErrorCodesQuery::default()).expect("catalogue");
    let mut files = vec![(format!("{DOCS_DIR}/README.md"), readme(&view))];
    for vendor in &view.vendors {
        files.push((format!("{DOCS_DIR}/{}/{}.md", vendor.kind.as_str(), vendor.id), vendor_doc(vendor, &view.categories)));
    }
    files.push((format!("{DOCS_DIR}/retainpdf/失败码.md"), failure_codes_doc(&view.failure_codes, &view.categories)));
    files
}

#[test]
fn provider_error_code_docs_match_data() {
    let repo = repo_root();
    let current = generated_docs();
    let generated: std::collections::BTreeSet<&str> = current.iter().map(|(path, _)| path.as_str()).collect();
    let mut existing = Vec::new();
    for sub in ["", "/ocr", "/llm", "/retainpdf"] {
        let dir = repo.join(format!("{DOCS_DIR}{sub}"));
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.filter_map(Result::ok) {
                if entry.path().is_file() {
                    existing.push(format!("{DOCS_DIR}{sub}/{}", entry.file_name().to_string_lossy()));
                }
            }
        }
    }
    if std::env::var_os("UPDATE_ERROR_CODES").is_some() {
        for stale in existing.iter().filter(|path| !generated.contains(path.as_str())) {
            std::fs::remove_file(repo.join(stale)).unwrap();
        }
        for (path, content) in &current {
            let target = repo.join(path);
            std::fs::create_dir_all(target.parent().unwrap()).unwrap();
            std::fs::write(target, content).unwrap();
        }
        return;
    }
    let stale: Vec<&String> = existing.iter().filter(|path| !generated.contains(path.as_str())).collect();
    let outdated: Vec<&String> = current
        .iter()
        .filter(|(path, content)| std::fs::read_to_string(repo.join(path)).unwrap_or_default() != *content)
        .map(|(path, _)| path)
        .collect();
    assert!(
        stale.is_empty() && outdated.is_empty(),
        "错误码文档和数据对不上（过期 {outdated:?}，多出来的 {stale:?}）。重新生成：UPDATE_ERROR_CODES=1 cargo test -p retainpdf-api --lib provider_error_codes"
    );
}
