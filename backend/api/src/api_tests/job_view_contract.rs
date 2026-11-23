//! job-status/library-books 生产者契约锁（library-books 只剩删任务的返回）。
//!
//! 通过真实 router 获取 serde JSON，再按 backend-root/contracts 中的定义验证。
//! 这里有意不复制 Rust DTO 构造器，避免测试与生产者同时漂移。

use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use crate::app::build_app;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot, JobStatusKind};

use super::jobs_common::{read_json, test_state};

pub(super) fn contract(file_name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("backend root")
        .join("contracts")
        .join(file_name);
    serde_json::from_str(&std::fs::read_to_string(path).expect("read contract"))
        .expect("parse contract")
}

pub(super) fn definition<'a>(contract: &'a Value, name: &str) -> &'a Value {
    contract["definitions"]
        .get(name)
        .unwrap_or_else(|| panic!("contract definition missing: {name}"))
}

pub(super) fn object_keys(value: &Value, path: &str) -> BTreeSet<String> {
    value
        .as_object()
        .unwrap_or_else(|| panic!("{path} must be an object"))
        .keys()
        .cloned()
        .collect()
}

pub(super) fn schema_keys(contract: &Value, name: &str) -> BTreeSet<String> {
    definition(contract, name)["properties"]
        .as_object()
        .unwrap_or_else(|| panic!("definition {name} missing properties"))
        .keys()
        .cloned()
        .collect()
}

pub(super) fn assert_exact_object_keys(value: &Value, contract: &Value, name: &str, path: &str) {
    assert_eq!(
        object_keys(value, path),
        schema_keys(contract, name),
        "{path} serde keys drifted from {name}"
    );
}

/// 键集合要和契约一致，只有 `absent_ok` 里的键允许不出现（契约里是可选键，
/// 序列化时 `skip_serializing_if` 会整个省掉）。多出契约没有的键永远不行。
pub(super) fn assert_object_keys_allowing_absent(
    value: &Value,
    contract: &Value,
    name: &str,
    path: &str,
    absent_ok: &[&str],
) {
    let actual = object_keys(value, path);
    let declared = schema_keys(contract, name);
    let expected: BTreeSet<String> = declared
        .iter()
        .filter(|key| !absent_ok.contains(&key.as_str()))
        .cloned()
        .collect();
    assert!(
        actual.is_subset(&declared) && expected.is_subset(&actual),
        "{path} serde keys drifted from {name}: actual {actual:?}, declared {declared:?}, may be absent {absent_ok:?}"
    );
}

fn matches_type(value: &Value, expected: &str) -> bool {
    match expected {
        "null" => value.is_null(),
        "boolean" => value.is_boolean(),
        "string" => value.is_string(),
        "number" => value.is_number(),
        "integer" => value.as_i64().is_some() || value.as_u64().is_some(),
        "array" => value.is_array(),
        "object" => value.is_object(),
        other => panic!("unsupported schema type: {other}"),
    }
}

fn validate_schema(
    value: &Value,
    schema: &Value,
    contract: &Value,
    path: &str,
) -> Result<(), String> {
    if let Some(reference) = schema.get("$ref").and_then(Value::as_str) {
        let name = reference
            .strip_prefix("#/definitions/")
            .ok_or_else(|| format!("{path}: unsupported ref {reference}"))?;
        return validate_schema(value, definition(contract, name), contract, path);
    }

    if let Some(branches) = schema.get("anyOf").and_then(Value::as_array) {
        if branches
            .iter()
            .any(|branch| validate_schema(value, branch, contract, path).is_ok())
        {
            return Ok(());
        }
        return Err(format!("{path}: value {value} does not match anyOf"));
    }

    if let Some(options) = schema.get("enum").and_then(Value::as_array) {
        if !options.contains(value) {
            return Err(format!("{path}: value {value} is outside enum {options:?}"));
        }
    }

    if let Some(expected) = schema.get("type") {
        let accepted = match expected {
            Value::String(kind) => matches_type(value, kind),
            Value::Array(kinds) => kinds
                .iter()
                .filter_map(Value::as_str)
                .any(|kind| matches_type(value, kind)),
            _ => return Err(format!("{path}: invalid schema type declaration")),
        };
        if !accepted {
            return Err(format!(
                "{path}: value {value} does not match type {expected}"
            ));
        }
    }

    if value.is_null() {
        return Ok(());
    }

    if let Some(minimum) = schema.get("minimum").and_then(Value::as_f64) {
        if value.as_f64().is_some_and(|number| number < minimum) {
            return Err(format!("{path}: value {value} is below {minimum}"));
        }
    }
    if let Some(maximum) = schema.get("maximum").and_then(Value::as_f64) {
        if value.as_f64().is_some_and(|number| number > maximum) {
            return Err(format!("{path}: value {value} is above {maximum}"));
        }
    }

    if let Some(properties) = schema.get("properties").and_then(Value::as_object) {
        let object = value
            .as_object()
            .ok_or_else(|| format!("{path}: expected object"))?;
        if let Some(required) = schema.get("required").and_then(Value::as_array) {
            for key in required.iter().filter_map(Value::as_str) {
                if !object.contains_key(key) {
                    return Err(format!("{path}: missing required key {key}"));
                }
            }
        }
        for key in object.keys() {
            if !properties.contains_key(key) {
                return Err(format!("{path}: undeclared producer key {key}"));
            }
        }
        for (key, property_schema) in properties {
            if let Some(property_value) = object.get(key) {
                validate_schema(
                    property_value,
                    property_schema,
                    contract,
                    &format!("{path}.{key}"),
                )?;
            }
        }
    }

    if schema.get("properties").is_none() {
        if let (Some(additional_schema), Some(object)) =
            (schema.get("additionalProperties"), value.as_object())
        {
            if additional_schema == &Value::Bool(false) && !object.is_empty() {
                return Err(format!("{path}: additional properties are forbidden"));
            }
            if additional_schema.is_object() {
                for (key, item) in object {
                    validate_schema(item, additional_schema, contract, &format!("{path}.{key}"))?;
                }
            }
        }
    }

    if let (Some(items), Some(values)) = (schema.get("items"), value.as_array()) {
        for (index, item) in values.iter().enumerate() {
            validate_schema(item, items, contract, &format!("{path}[{index}]"))?;
        }
    }

    Ok(())
}

pub(super) fn assert_definition(value: &Value, contract: &Value, name: &str, path: &str) {
    if let Err(error) = validate_schema(value, definition(contract, name), contract, path) {
        panic!("{name} fixture violates schema: {error}");
    }
}

async fn get_data(app: axum::Router, uri: &str) -> Value {
    let response = app
        .oneshot(
            Request::builder()
                .uri(uri)
                .header("X-API-Key", "test-key")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("response");
    let status = response.status();
    let payload = read_json(response).await;
    assert_eq!(status, StatusCode::OK, "{uri}: {payload}");
    payload["data"].clone()
}

#[tokio::test]
async fn real_job_and_library_views_match_published_schemas() {
    let state = test_state("job-view-contract");
    let job_id = "job-contract-fixture";
    let mut job = JobSnapshot::new(
        job_id.to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Running;
    job.stage = Some("translating".to_string());
    job.stage_detail = Some("已完成第 2/5 批翻译".to_string());
    job.progress_current = Some(2);
    job.progress_total = Some(5);
    let source_pdf = state
        .config
        .data_root
        .join("jobs")
        .join(job_id)
        .join("source/input.pdf");
    fs::create_dir_all(source_pdf.parent().expect("source parent")).expect("create source dir");
    fs::write(&source_pdf, b"%PDF-contract-fixture").expect("write source pdf");
    job.artifacts = Some(JobArtifacts {
        source_pdf: Some(source_pdf.to_string_lossy().to_string()),
        ..JobArtifacts::default()
    });
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save contract fixture job");
    state
        .db
        .append_event(
            job_id,
            "info",
            Some("translating".to_string()),
            Some("已完成第 2/5 批翻译".to_string()),
            Some("paddle".to_string()),
            Some("translation_batches".to_string()),
            "stage_progress",
            Some("progress".to_string()),
            "contract event",
            Some(2),
            Some(5),
            Some(json!({
                "batch": 2,
                "metadata": { "source": "fixture", "flags": [true, false] }
            })),
            Some(0),
            Some(1500),
        )
        .expect("append contract fixture event");

    let app = build_app(state);
    let job_list = get_data(app.clone(), "/api/v1/jobs").await;
    let job_detail = get_data(app.clone(), &format!("/api/v1/jobs/{job_id}")).await;
    let job_events = get_data(
        app.clone(),
        &format!("/api/v1/jobs/{job_id}/progress/events?limit=20&start=head"),
    )
    .await;

    let job_contract = contract("job-status.v1.schema.json");
    assert_definition(&job_list, &job_contract, "JobListView", "job_list");
    assert_definition(&job_detail, &job_contract, "JobDetailView", "job_detail");
    let events_contract = contract("job-events.v2.schema.json");
    assert_definition(
        &job_events,
        &events_contract,
        "JobEventListView",
        "job_events",
    );
    assert_exact_object_keys(
        &job_events,
        &events_contract,
        "JobEventListView",
        "job_events",
    );
    assert_exact_object_keys(&job_list, &job_contract, "JobListView", "job_list");
    // 这个夹具是跑着的任务，没有 `failure`（只有失败的任务才带，见下面的失败任务测试）。
    assert!(job_list["items"][0].get("failure").is_none());
    assert_object_keys_allowing_absent(
        &job_list["items"][0],
        &job_contract,
        "JobListItemView",
        "job_list.items[0]",
        &["failure"],
    );
    assert_exact_object_keys(&job_detail, &job_contract, "JobDetailView", "job_detail");
    assert_exact_object_keys(
        &job_detail["book_summary"],
        &job_contract,
        "BookSummaryView",
        "job_detail.book_summary",
    );
    // 没有书的任务没有封面地址（不再退回任务级的旧地址）。
    assert!(job_detail["book_summary"]["thumbnail_url"].is_null());
    assert!(job_detail["book_summary"]["cover_url"].is_null());
    // 这个任务查不到书（没有上传，也没归属过），书的编号是 null。
    assert!(job_detail["book_summary"]["document_id"].is_null());
    assert_eq!(job_events["limit"], 20);
    assert_eq!(job_events["protocol_version"], 2);
    assert_eq!(job_events["has_more"], false);
    assert!(job_events["next_cursor"].is_string());
    assert_eq!(
        job_events["items"][0]["payload"]["metadata"]["flags"][1],
        false
    );
}

/// `/files` 的返回对着契约核对。用文件出口快照那套夹具：有书、有登记过的产物，
/// 所以 `source` 指向书的文件，`internal` 和 `output` 都有登记过的项。
#[tokio::test]
async fn job_files_view_matches_published_schema() {
    let fixture = super::file_responses::seed();
    let job_id = super::file_responses::JOB;
    let app = build_app(fixture.state.clone());
    let files = get_data(app.clone(), &format!("/api/v1/jobs/{job_id}/files")).await;
    let detail = get_data(app, &format!("/api/v1/jobs/{job_id}")).await;

    let reader_contract = contract("reader-data.v1.schema.json");
    assert_definition(&files, &reader_contract, "JobFilesView", "job_files");
    assert_exact_object_keys(&files, &reader_contract, "JobFilesView", "job_files");
    assert_exact_object_keys(&files["pages"], &reader_contract, "JobPagesView", "job_files.pages");
    assert_exact_object_keys(&files["source"], &reader_contract, "JobFileEntryView", "job_files.source");
    assert!(files["source"]["updated_at"].is_string(), "{}", files["source"]);
    assert!(files["source"]["url"]
        .as_str()
        .expect("source url")
        .ends_with(&format!("/api/v1/documents/{}/files/source.pdf", fixture.document_id)));
    assert!(files["attempt"].as_u64().is_some_and(|attempt| attempt >= 1));
    for group in ["output", "internal"] {
        let entries = files[group]
            .as_array()
            .unwrap_or_else(|| panic!("job_files.{group} must be an array"));
        assert!(!entries.is_empty(), "job_files.{group} should list files");
        for (index, entry) in entries.iter().enumerate() {
            assert_exact_object_keys(
                entry,
                &reader_contract,
                "JobFileEntryView",
                &format!("job_files.{group}[{index}]"),
            );
        }
    }

    // 任务详情里的产物列表链接都指向这个接口。
    let files_path = format!("/api/v1/jobs/{job_id}/files");
    assert_eq!(detail["links"]["artifacts_path"], files_path);
    assert_eq!(detail["links"]["artifacts_manifest_path"], files_path);
    assert_eq!(detail["actions"]["open_artifacts"]["path"], files_path);
    assert_eq!(detail["artifacts"]["manifest_path"], files_path);
    // 任务详情直接给出书的编号，前端拿到详情就能拼原文地址，不用先等文件清单。
    assert_eq!(detail["book_summary"]["document_id"], fixture.document_id.as_str());
}

/// 失败任务的列表项：`failure` 对着契约里的 `JobFailureBriefView` 核对。
///
/// 两个夹具：一个把简报的 8 个字段全填满（键集合必须等于契约的全部属性），一个只有
/// 必填项（root_cause / suggestion / provider / upstream 整个键不出现，不是 null）。
/// 契约 job-status 里的 JobListItemView 要认得这个键（library-books 抄的那份 2026-10-23 删了）。
#[tokio::test]
async fn failed_job_list_item_failure_matches_published_schema() {
    use crate::models::JobFailureInfo;

    let state = test_state("job-failure-brief-contract");
    let save_failed = |job_id: &str, failure: JobFailureInfo| {
        let mut job = JobSnapshot::new(
            job_id.to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.error = Some("fixture failure".to_string());
        job.failure = Some(failure);
        job.sync_runtime_state();
        state.db.save_job(&job).expect("save failed fixture job");
    };
    save_failed(
        "job-brief-full",
        JobFailureInfo {
            stage: "ocr".to_string(),
            category: "unknown".to_string(),
            failed_stage: Some("ocr".to_string()),
            failure_category: Some("provider".to_string()),
            summary: "MinerU 解析失败".to_string(),
            root_cause: Some("parsing failed".to_string()),
            retryable: true,
            provider: Some("mineru".to_string()),
            suggestion: Some("稍后重试".to_string()),
            upstream: Some(crate::models::JobFailureUpstream {
                provider: Some("mineru".to_string()),
                http_status: Some(200),
                code: Some("-60018".to_string()),
            }),
            // 重字段不该出现在列表简报里：契约没有它们，键集合比较会抓到。
            raw_excerpt: Some("Traceback (most recent call last): ...".to_string()),
            ..JobFailureInfo::default()
        },
    );
    save_failed(
        "job-brief-minimal",
        JobFailureInfo {
            stage: "render".to_string(),
            category: "render".to_string(),
            summary: "渲染失败".to_string(),
            retryable: false,
            ..JobFailureInfo::default()
        },
    );

    let app = build_app(state);
    let job_list = get_data(app, "/api/v1/jobs").await;
    let item = |job_id: &str| -> Value {
        job_list["items"]
            .as_array()
            .expect("items")
            .iter()
            .find(|item| item["job_id"] == job_id)
            .unwrap_or_else(|| panic!("{job_id} missing from job list"))
            .clone()
    };
    let full = item("job-brief-full");
    let minimal = item("job-brief-minimal");

    for file_name in ["job-status.v1.schema.json"] {
        let contract = contract(file_name);
        assert_definition(&job_list, &contract, "JobListView", file_name);
        for (label, list_item) in [("full", &full), ("minimal", &minimal)] {
            let path = format!("job_list[{label}] ({file_name})");
            assert_object_keys_allowing_absent(
                list_item,
                &contract,
                "JobListItemView",
                &path,
                &["failure"],
            );
            assert!(list_item["failure"].is_object(), "{path}: failure missing");
        }

        // 填满的简报：键集合 == 契约的全部属性，各字段类型也对得上。
        assert_exact_object_keys(
            &full["failure"],
            &contract,
            "JobFailureBriefView",
            &format!("job_list[full].failure ({file_name})"),
        );
        assert_definition(&full["failure"], &contract, "JobFailureBriefView", "full.failure");
        assert_exact_object_keys(
            &full["failure"]["upstream"],
            &contract,
            "JobFailureUpstream",
            &format!("job_list[full].failure.upstream ({file_name})"),
        );
        assert_eq!(full["failure"]["upstream"]["code"], "-60018");

        // 只有必填项：键集合 == 契约的 required，可选键整个不出现。
        let required: BTreeSet<String> = definition(&contract, "JobFailureBriefView")["required"]
            .as_array()
            .expect("JobFailureBriefView.required")
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect();
        assert_eq!(
            object_keys(&minimal["failure"], "job_list[minimal].failure"),
            required,
            "{file_name}: 没有可选信息时，可选键应整个不出现"
        );
        assert_definition(
            &minimal["failure"],
            &contract,
            "JobFailureBriefView",
            "minimal.failure",
        );
    }
}

/// 删任务的返回 `DELETE /jobs/:job_id` 对着契约的 `LibraryDeleteResultView` 核对键集合
/// （书架删除的旧地址 2026-10-22 删了）。
#[tokio::test]
async fn job_delete_result_matches_published_schema() {
    let state = test_state("job-delete-contract");
    let library_contract = contract("library-books.v1.schema.json");
    for (job_id, uri) in [("job-delete-contract-new", "/api/v1/jobs/job-delete-contract-new")] {
        let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec!["python".to_string()]);
        job.status = JobStatusKind::Succeeded;
        state.db.save_job(&job).expect("save job");
        let response = build_app(state.clone())
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(uri)
                    .header("X-API-Key", "test-key")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");
        let status = response.status();
        let payload = read_json(response).await;
        assert_eq!(status, StatusCode::OK, "{uri}: {payload}");
        assert_definition(&payload["data"], &library_contract, "LibraryDeleteResultView", uri);
        assert_exact_object_keys(&payload["data"], &library_contract, "LibraryDeleteResultView", uri);
    }
}

/// `GET /jobs` 的查询参数：契约 `ListJobsQuery` 的属性和 Rust 认的字段一一对应（两份契约都核）。
/// 解构不写 `..`，Rust 加字段时这里编不过，提醒顺手补契约。
#[test]
fn list_jobs_query_contract_names_every_accepted_param() {
    let query: crate::models::api::ListJobsQuery = serde_json::from_value(json!({
        "include_live_stage": false,
        "limit": 5,
        "offset": 1,
        "status": "running",
        "workflow": "book",
        "provider": "deepseek",
        "q": "paper",
        "job_ids": "a,b",
    }))
    .expect("every contract param parses");
    let crate::models::api::ListJobsQuery {
        include_live_stage,
        limit: _,
        offset: _,
        status: _,
        workflow: _,
        provider: _,
        q: _,
        job_ids: _,
        owner: _, // 不从查询串读，由路由按当前用户填
    } = query;
    assert_eq!(include_live_stage, Some(false));

    let accepted: BTreeSet<String> = [
        "include_live_stage",
        "limit",
        "offset",
        "status",
        "workflow",
        "provider",
        "q",
        "job_ids",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    for file in ["job-status.v1.schema.json"] {
        let contract = contract(file);
        assert_eq!(schema_keys(&contract, "ListJobsQuery"), accepted, "{file}");
        assert_eq!(
            definition(&contract, "ListJobsQuery")["properties"]["include_live_stage"]["type"],
            json!("boolean"),
            "{file}"
        );
    }
}
