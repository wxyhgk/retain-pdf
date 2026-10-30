//! 书库契约 `library-documents.v1` 的生产者锁（审计 A9、B5，2026-10-22）。
//!
//! 返回：打真实接口，拿 serde 实际写出来的 JSON，对着 backend-root/contracts 里的定义核对类型和键集合
//! （多一个键、少一个键都红）。请求：每个请求类型都是 `deny_unknown_fields`，拿一个不认识的键去试，
//! serde 的报错里列着它认的全部字段，和契约的 `properties` 比；契约里的字段全填上也得能解析。

use std::collections::BTreeSet;

use axum::http::StatusCode;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

use super::job_view_contract::{
    assert_definition, assert_exact_object_keys, assert_object_keys_allowing_absent, contract,
    definition, object_keys, schema_keys,
};
use super::jobs_common::test_state;
use super::library_paging::{seed_document, send};
use crate::models::api::{
    AddCollectionDocumentsInput, ApplyDocumentMetadataSuggestionInput, CreateCollectionInput,
    CreateDocumentMetadataSuggestionInput, DeleteDocumentQuery, FtsBlockRow,
    ListDocumentMetadataSuggestionsQuery, ListDocumentsQuery, PatchCollectionInput,
    ListDocumentJobsQuery, PatchDocumentInput, SearchQuery,
};
use crate::models::CreateJobInput;

const CONTRACT: &str = "library-documents.v1.schema.json";

async fn ok_data(state: &crate::AppState, method: &str, uri: &str, body: Option<Value>) -> Value {
    let (status, payload) = send(state, method, uri, body).await;
    assert_eq!(status, StatusCode::OK, "{method} {uri}: {payload}");
    payload["data"].clone()
}

/// 类型对、键集合正好等于契约的全部属性。
fn assert_exact(value: &Value, contract: &Value, name: &str, path: &str) {
    assert_definition(value, contract, name, path);
    assert_exact_object_keys(value, contract, name, path);
}

#[tokio::test]
async fn book_collection_search_and_delete_views_match_published_schema() {
    let state = test_state("library-documents-contract");
    let contract = contract(CONTRACT);
    let book = seed_document(&state, b"library-documents-contract-a");
    let versioned = seed_document(&state, b"library-documents-contract-b");
    // `active_version_id` 没有时整个键不出现；给第二本书填上，键集合就该正好是契约的全部属性。
    let conn = rusqlite::Connection::open(state.config.jobs_db_path.clone()).unwrap();
    conn.execute(
        "UPDATE documents SET active_version_id = 'ver-contract' WHERE document_id = ?1",
        rusqlite::params![versioned],
    )
    .unwrap();

    // 书列表、一本书。
    let list = ok_data(&state, "GET", "/api/v1/documents", None).await;
    assert_exact(&list, &contract, "DocumentListView", "documents");
    let documents = list["documents"].as_array().expect("documents");
    assert_eq!(documents.len(), 2);
    for (index, item) in documents.iter().enumerate() {
        let path = format!("documents.documents[{index}]");
        assert_definition(item, &contract, "DocumentRecord", &path);
        assert_object_keys_allowing_absent(item, &contract, "DocumentRecord", &path, &["active_version_id"]);
    }
    let plain = ok_data(&state, "GET", &format!("/api/v1/documents/{book}"), None).await;
    assert_definition(&plain, &contract, "DocumentRecord", "document");
    assert!(plain.get("active_version_id").is_none(), "没有版本时键不出现，不是 null：{plain}");
    let mut required: BTreeSet<String> = definition(&contract, "DocumentRecord")["required"]
        .as_array()
        .unwrap()
        .iter()
        .map(|key| key.as_str().unwrap().to_string())
        .collect();
    assert_eq!(object_keys(&plain, "document"), required, "没有版本的书正好是 required 那些键");
    let with_version = ok_data(&state, "GET", &format!("/api/v1/documents/{versioned}"), None).await;
    assert_exact(&with_version, &contract, "DocumentRecord", "document (versioned)");
    required.insert("active_version_id".to_string());
    assert_eq!(required, schema_keys(&contract, "DocumentRecord"), "只有 active_version_id 可以不出现");
    // 契约里写着「未使用，恒为空」的四个键，实际的空值就是这些。
    assert_eq!(plain["authors_json"], "[]");
    assert!(plain["year"].is_null());
    assert_eq!(plain["doi"], "");
    assert!(plain["last_opened_at"].is_null());
    assert!(plain["active_job_id"].is_null());
    assert_eq!(plain["title_source"], "filename");
    assert_eq!(plain["reading_status"], "unread");
    for key in ["source_pdf_url", "cover_url", "thumbnail_url"] {
        assert!(plain[key].as_str().is_some_and(|url| url.contains(&book)), "{key}: {plain}");
    }

    // 书的文件清单、阅读入口、翻译覆盖（还没有译文的书）。
    let files = ok_data(&state, "GET", &format!("/api/v1/documents/{book}/files"), None).await;
    assert_exact(&files, &contract, "DocumentFilesView", "files");
    assert_exact_object_keys(&files["pages"], &contract, "DocumentPagesView", "files.pages");
    let entries = files["files"].as_array().expect("files.files");
    assert_eq!(entries.len(), 3);
    for (index, entry) in entries.iter().enumerate() {
        assert_exact_object_keys(entry, &contract, "DocumentFileEntryView", &format!("files.files[{index}]"));
    }
    let reading = ok_data(&state, "GET", &format!("/api/v1/documents/{book}/reading"), None).await;
    assert_exact(&reading, &contract, "DocumentReadingView", "reading");
    assert!(reading["job_id"].is_null());
    let coverage =
        ok_data(&state, "GET", &format!("/api/v1/documents/{book}/translation-coverage"), None).await;
    assert_exact(&coverage, &contract, "TranslationCoverageView", "coverage");

    // 元数据建议：一条字段填满（有 source_job_id、证据五个键都有），一条只有必填项。
    let full_candidates = json!([{
        "value": "A Full Title",
        "source": "ocr_structure",
        "confidence": 0.99,
        "evidence": [{
            "source": "normalized_document",
            "page_idx": 0,
            "block_id": "p001-b0001",
            "structure_role": "title",
            "layout_role": "title",
        }],
    }]);
    let minimal_candidates =
        json!([{ "value": "A Title", "source": "pdf_metadata", "confidence": 0.5, "evidence": [{ "source": "pdf_info_title" }] }]);
    state
        .db
        .insert_document_metadata_suggestion(
            "dms-contract-minimal",
            &book,
            None,
            "sha-minimal",
            r#"["title"]"#,
            &minimal_candidates.to_string(),
            "A Title",
            "pdf_metadata",
            false,
        )
        .unwrap();
    state
        .db
        .insert_document_metadata_suggestion(
            "dms-contract-full",
            &book,
            Some("job-contract-ocr"),
            "sha-full",
            r#"["title"]"#,
            &full_candidates.to_string(),
            "A Full Title",
            "ocr_structure",
            true,
        )
        .unwrap();
    let suggestions =
        ok_data(&state, "GET", &format!("/api/v1/documents/{book}/metadata-suggestions"), None).await;
    assert_exact(&suggestions, &contract, "DocumentMetadataSuggestionListView", "suggestions");
    let by_id = |id: &str| -> Value {
        suggestions["suggestions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["suggestion_id"] == id)
            .unwrap_or_else(|| panic!("{id} missing: {suggestions}"))
            .clone()
    };
    let full = by_id("dms-contract-full");
    assert_exact(&full, &contract, "DocumentMetadataSuggestionView", "suggestion (full)");
    assert_exact_object_keys(&full["title_candidates"][0], &contract, "DocumentTitleCandidateView", "candidate");
    assert_exact_object_keys(
        &full["title_candidates"][0]["evidence"][0],
        &contract,
        "DocumentMetadataEvidenceView",
        "evidence (full)",
    );
    let minimal = by_id("dms-contract-minimal");
    assert_definition(&minimal, &contract, "DocumentMetadataSuggestionView", "suggestion (minimal)");
    assert_object_keys_allowing_absent(
        &minimal,
        &contract,
        "DocumentMetadataSuggestionView",
        "suggestion (minimal)",
        &["source_job_id"],
    );
    assert!(minimal.get("source_job_id").is_none(), "{minimal}");
    assert_eq!(
        object_keys(&minimal["title_candidates"][0]["evidence"][0], "evidence (minimal)"),
        BTreeSet::from(["source".to_string()]),
        "证据只有 source 时别的键整个不出现"
    );
    let applied = ok_data(
        &state,
        "POST",
        &format!("/api/v1/documents/{book}/metadata-suggestions/dms-contract-full/apply"),
        Some(json!({})),
    )
    .await;
    assert_exact(&applied, &contract, "DocumentMetadataSuggestionApplyView", "apply");
    assert_exact_object_keys(&applied["suggestion"], &contract, "DocumentMetadataSuggestionView", "apply.suggestion");
    assert_object_keys_allowing_absent(
        &applied["document"],
        &contract,
        "DocumentRecord",
        "apply.document",
        &["active_version_id"],
    );
    assert_eq!(applied["document"]["title_source"], "ocr");

    // 改书名。
    let patched = ok_data(
        &state,
        "PATCH",
        &format!("/api/v1/documents/{book}"),
        Some(json!({ "title": "契约里的书", "reading_status": "reading" })),
    )
    .await;
    assert_definition(&patched, &contract, "DocumentRecord", "patched");
    assert_object_keys_allowing_absent(&patched, &contract, "DocumentRecord", "patched", &["active_version_id"]);
    assert_eq!(patched["title_source"], "user");
    assert_eq!(patched["title_locked"], true);

    // 全文检索。
    let rows = vec![FtsBlockRow {
        page_idx: 0,
        block_id: "p001-b0001".to_string(),
        source_text: "halogen lithium exchange".to_string(),
        translated_text: "卤素锂交换".to_string(),
    }];
    state.db.replace_document_fts(&book, "job-contract-search", &rows).unwrap();
    let search = ok_data(&state, "GET", "/api/v1/search?q=halogen", None).await;
    assert_exact(&search, &contract, "SearchResultView", "search");
    assert_eq!(search["hits"].as_array().unwrap().len(), 1, "{search}");
    assert_exact_object_keys(&search["hits"][0], &contract, "BlockSearchHit", "search.hits[0]");

    // 合集：建、加书、改、列表、拿掉一本书、删。
    let created = ok_data(&state, "POST", "/api/v1/collections", Some(json!({ "name": "物理" }))).await;
    assert_exact(&created, &contract, "CollectionRecord", "collection (created)");
    assert!(created["parent_id"].is_null());
    let collection_id = created["collection_id"].as_str().unwrap().to_string();
    let added = ok_data(
        &state,
        "POST",
        &format!("/api/v1/collections/{collection_id}/documents"),
        Some(json!({ "document_ids": [book, versioned] })),
    )
    .await;
    assert_exact(&added, &contract, "CollectionRecord", "collection (added)");
    assert_eq!(added["document_count"], 2, "单条也现算书数");
    let renamed = ok_data(
        &state,
        "PATCH",
        &format!("/api/v1/collections/{collection_id}"),
        Some(json!({ "name": "化学", "sort_order": 5 })),
    )
    .await;
    assert_exact(&renamed, &contract, "CollectionRecord", "collection (patched)");
    let collections = ok_data(&state, "GET", "/api/v1/collections", None).await;
    assert_exact(&collections, &contract, "CollectionListView", "collections");
    assert_exact_object_keys(&collections["collections"][0], &contract, "CollectionRecord", "collections[0]");
    let removed = ok_data(
        &state,
        "DELETE",
        &format!("/api/v1/collections/{collection_id}/documents/{versioned}"),
        None,
    )
    .await;
    assert_exact(&removed, &contract, "CollectionDocumentRemoveResultView", "collection remove");
    let deleted = ok_data(&state, "DELETE", &format!("/api/v1/collections/{collection_id}"), None).await;
    assert_exact(&deleted, &contract, "CollectionDeleteResultView", "collection delete");

    // 删书。
    let deleted = ok_data(&state, "DELETE", &format!("/api/v1/documents/{versioned}"), None).await;
    assert_exact(&deleted, &contract, "DocumentDeleteResultView", "document delete");
    assert_eq!(deleted["document_id"], versioned.as_str());
}

/// 有译文的书：阅读入口给出那个任务，翻译覆盖里的段和任务记录对着契约核对。
#[tokio::test]
async fn reading_and_coverage_of_a_translated_book_match_published_schema() {
    use super::merged_reading::{seed_document, seed_range_job, state_with_real_pipeline};

    let state = state_with_real_pipeline("library-documents-contract-coverage");
    let contract = contract(CONTRACT);
    let document_id = seed_document(&state, &["SRC 1", "SRC 2"]);
    seed_range_job(&state, &document_id, "job-contract-whole", "2026-10-01T00:00:00", &[1, 2], &["ZH 1", "ZH 2"]);

    let reading = ok_data(&state, "GET", &format!("/api/v1/documents/{document_id}/reading"), None).await;
    assert_exact(&reading, &contract, "DocumentReadingView", "reading");
    assert_eq!(reading["job_id"], "job-contract-whole");

    let coverage =
        ok_data(&state, "GET", &format!("/api/v1/documents/{document_id}/translation-coverage"), None).await;
    assert_exact(&coverage, &contract, "TranslationCoverageView", "coverage");
    assert_exact_object_keys(&coverage["segments"][0], &contract, "CoverageSegment", "coverage.segments[0]");
    let jobs = coverage["jobs"].as_array().expect("coverage.jobs");
    assert_eq!(jobs.len(), 1, "{coverage}");
    // CoverageJobView 的键总在，空值是 null，不省略。
    assert_exact_object_keys(&jobs[0], &contract, "CoverageJobView", "coverage.jobs[0]");
    assert!(jobs[0]["failure_summary"].is_null() && jobs[0]["error_head"].is_null(), "{}", jobs[0]);
    assert!(jobs[0]["engine"] == "legacy" && jobs[0]["has_editorial_events"] == false, "{}", jobs[0]);
}

/// 第 1b 期（2026-10-22）：书的任务列表、翻译这本书、给这本书做 OCR。
///
/// OCR 是单个任务（`sibling_job_ids` 整个不出现）；翻译复用 OCR、页不连续时拆成两个任务，回包里
/// `sibling_job_ids` 出现，键集合正好是 `JobSubmissionView` 的全部属性。任务列表的条目和 `GET /jobs` 是同一个
/// `JobListItemView`（契约里抄了一份，由 contracts/tests/library-documents-shared-definitions.test.mjs 锁成一致）。
#[tokio::test]
async fn document_jobs_translate_and_ocr_views_match_published_schema() {
    use super::library_data::{seed_document, seed_reusable_ocr_job};

    let state = test_state("library-documents-contract-jobs");
    let contract = contract(CONTRACT);
    let document_id = seed_document(&state, b"library-documents-contract-jobs");

    let ocr = ok_data(
        &state,
        "POST",
        &format!("/api/v1/documents/{document_id}/ocr"),
        Some(json!({
            "ocr": {
                "provider": "paddle",
                "paddle_token": "paddle-test-token",
                "paddle_api_url": "https://paddle.example.com",
                "page_ranges": "2-4"
            }
        })),
    )
    .await;
    assert_submission(&ocr, &contract, "ocr");
    assert!(ocr.get("sibling_job_ids").is_none(), "单个任务时 sibling_job_ids 整个不出现：{ocr}");
    assert_eq!(ocr["workflow"], "ocr");

    let source_job_id = seed_reusable_ocr_job(&state, &document_id, "ocr-contract-whole-book");
    let translated = ok_data(
        &state,
        "POST",
        &format!("/api/v1/documents/{document_id}/translate"),
        Some(json!({
            "workflow": "translate",
            "source": { "artifact_job_id": source_job_id },
            "translation": {
                "page_ranges": [1, 2, 7],
                "api_key": "sk-test",
                "model": "m",
                "base_url": "https://api.example.com/v1"
            }
        })),
    )
    .await;
    assert_submission(&translated, &contract, "translate (split)");
    assert_exact_object_keys(&translated, &contract, "JobSubmissionView", "translate (split)");
    assert_eq!(translated["sibling_job_ids"].as_array().map(Vec::len), Some(1), "{translated}");

    let jobs = ok_data(&state, "GET", &format!("/api/v1/documents/{document_id}/jobs?limit=2"), None).await;
    assert_exact(&jobs, &contract, "DocumentJobListView", "jobs");
    assert_exact_object_keys(&jobs["invocation_summary"], &contract, "JobListInvocationSummaryView", "jobs.invocation_summary");
    assert_eq!(jobs["limit"], 2);
    let total = jobs["total"].as_u64().expect("jobs.total");
    assert!(total >= 3, "OCR 一个、翻译拆成两个：{jobs}");
    assert_eq!(jobs["has_more"], true, "{jobs}");
    let items = jobs["items"].as_array().expect("jobs.items");
    assert_eq!(items.len(), 2, "{jobs}");
    for (index, item) in items.iter().enumerate() {
        let path = format!("jobs.items[{index}]");
        assert_definition(item, &contract, "JobListItemView", &path);
        assert_object_keys_allowing_absent(item, &contract, "JobListItemView", &path, &["failure"]);
        assert_exact_object_keys(&item["stages"], &contract, "JobStagesView", &format!("{path}.stages"));
    }
}

/// `JobSubmissionView`：只有 `sibling_job_ids` 可以不出现；嵌套的阶段、链接、操作键集合都要对上。
fn assert_submission(value: &Value, contract: &Value, path: &str) {
    assert_definition(value, contract, "JobSubmissionView", path);
    assert_object_keys_allowing_absent(value, contract, "JobSubmissionView", path, &["sibling_job_ids"]);
    assert_exact_object_keys(&value["stages"], contract, "JobStagesView", &format!("{path}.stages"));
    for stage in ["ocr", "translation", "render"] {
        let stage_path = format!("{path}.stages.{stage}");
        assert_exact_object_keys(&value["stages"][stage], contract, "JobStageRuntimeView", &stage_path);
        assert_object_keys_allowing_absent(
            &value["stages"][stage]["progress"],
            contract,
            "JobProgressView",
            &format!("{stage_path}.progress"),
            &["unit"],
        );
    }
    assert_exact_object_keys(&value["links"], contract, "JobLinksView", &format!("{path}.links"));
    assert_exact_object_keys(&value["actions"], contract, "JobActionsView", &format!("{path}.actions"));
    for (name, action) in value["actions"].as_object().expect("actions") {
        assert_exact_object_keys(action, contract, "ActionLinkView", &format!("{path}.actions.{name}"));
    }
}

/// serde 认的字段（`deny_unknown_fields` 的报错里列着全部）。
pub(super) fn rust_field_names<T: DeserializeOwned>(type_name: &str) -> BTreeSet<String> {
    const PROBE: &str = "__contract_probe__";
    let probe = Value::Object(serde_json::Map::from_iter([(PROBE.to_string(), json!(0))]));
    let Err(error) = serde_json::from_value::<T>(probe) else {
        panic!("{type_name} 接受了不认识的字段：它该是 deny_unknown_fields");
    };
    let message = error.to_string();
    assert!(message.starts_with(&format!("unknown field `{PROBE}`")), "{type_name}: {message}");
    // "unknown field `x`, expected one of `a`, `b`" / "expected `a`" / "there are no fields"
    message
        .split('`')
        .skip(1)
        .step_by(2)
        .filter(|name| *name != PROBE)
        .map(str::to_string)
        .collect()
}

/// 按契约给一个合法的样例值（每个属性都填）。
fn sample(schema: &Value, contract: &Value) -> Value {
    if let Some(reference) = schema.get("$ref").and_then(Value::as_str) {
        let name = reference.strip_prefix("#/definitions/").expect("local ref");
        return sample(definition(contract, name), contract);
    }
    if let Some(first) = schema.get("enum").and_then(Value::as_array).and_then(|options| options.first()) {
        return first.clone();
    }
    if let Some(first) = schema.get("anyOf").and_then(Value::as_array).and_then(|branches| branches.first()) {
        return sample(first, contract);
    }
    let kind = match &schema["type"] {
        Value::String(kind) => kind.as_str(),
        Value::Array(kinds) => kinds.iter().filter_map(Value::as_str).find(|kind| *kind != "null").expect("non-null type"),
        other => panic!("unsupported type {other}"),
    };
    match kind {
        "string" => json!("x"),
        "integer" => json!(schema.get("minimum").and_then(Value::as_i64).unwrap_or(1).max(1)),
        "number" => json!(0.5),
        "boolean" => json!(true),
        "array" => json!([sample(&schema["items"], contract)]),
        "object" => Value::Object(
            schema["properties"]
                .as_object()
                .map(|properties| {
                    properties.iter().map(|(key, property)| (key.clone(), sample(property, contract))).collect()
                })
                .unwrap_or_default(),
        ),
        other => panic!("unsupported type {other}"),
    }
}

pub(super) fn assert_request_fields_match<T: DeserializeOwned>(contract: &Value, name: &str) {
    let schema = definition(contract, name);
    assert_eq!(schema["additionalProperties"], false, "{name} 在 Rust 里是 deny_unknown_fields，契约要写 additionalProperties: false");
    assert_eq!(rust_field_names::<T>(name), schema_keys(contract, name), "{name}：Rust 认的字段和契约对不上");
    let full = sample(schema, contract);
    if let Err(error) = serde_json::from_value::<T>(full.clone()) {
        panic!("{name}：契约字段全填上解析失败：{error}；样例 {full}");
    }
}

#[test]
fn request_bodies_and_queries_accept_exactly_the_contract_fields() {
    let contract = contract(CONTRACT);
    assert_request_fields_match::<ListDocumentsQuery>(&contract, "ListDocumentsQuery");
    assert_request_fields_match::<PatchDocumentInput>(&contract, "PatchDocumentInput");
    assert_request_fields_match::<DeleteDocumentQuery>(&contract, "DeleteDocumentQuery");
    assert_request_fields_match::<SearchQuery>(&contract, "SearchQuery");
    assert_request_fields_match::<ListDocumentMetadataSuggestionsQuery>(&contract, "ListDocumentMetadataSuggestionsQuery");
    assert_request_fields_match::<CreateDocumentMetadataSuggestionInput>(&contract, "CreateDocumentMetadataSuggestionInput");
    assert_request_fields_match::<ApplyDocumentMetadataSuggestionInput>(&contract, "ApplyDocumentMetadataSuggestionInput");
    assert_request_fields_match::<CreateCollectionInput>(&contract, "CreateCollectionInput");
    assert_request_fields_match::<PatchCollectionInput>(&contract, "PatchCollectionInput");
    assert_request_fields_match::<AddCollectionDocumentsInput>(&contract, "AddCollectionDocumentsInput");
    assert_request_fields_match::<ListDocumentJobsQuery>(&contract, "ListDocumentJobsQuery");
    // 翻译、OCR 的请求体是 POST /jobs 的 CreateJobInput：顶层字段在这里对上，五个段从 create-job.v1 原样抄来，
    // 由 contracts/tests/library-documents-shared-definitions.test.mjs 锁成一致，段和 Rust 的对照在
    // retainpdf-core 的 models/input/request.rs contract_tests。
    assert_eq!(
        definition(&contract, "CreateJobInput")["additionalProperties"],
        false,
        "CreateJobInput 是 deny_unknown_fields"
    );
    assert_eq!(rust_field_names::<CreateJobInput>("CreateJobInput"), schema_keys(&contract, "CreateJobInput"));

    // 端点清单里的每个 input / query / output 都有定义，请求一侧都是封闭的。
    for endpoint in contract["endpoints"].as_array().expect("endpoints") {
        for role in ["input", "query", "output"] {
            let Some(name) = endpoint.get(role).and_then(Value::as_str) else { continue };
            let schema = definition(&contract, name);
            if role != "output" {
                assert_eq!(schema["additionalProperties"], false, "{name}（{role}）要写 additionalProperties: false");
            }
        }
    }
}
