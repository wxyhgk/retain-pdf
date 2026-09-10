//! job-status/library-books 生产者契约锁。
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

fn contract(file_name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("backend root")
        .join("contracts")
        .join(file_name);
    serde_json::from_str(&std::fs::read_to_string(path).expect("read contract"))
        .expect("parse contract")
}

fn definition<'a>(contract: &'a Value, name: &str) -> &'a Value {
    contract["definitions"]
        .get(name)
        .unwrap_or_else(|| panic!("contract definition missing: {name}"))
}

fn object_keys(value: &Value, path: &str) -> BTreeSet<String> {
    value
        .as_object()
        .unwrap_or_else(|| panic!("{path} must be an object"))
        .keys()
        .cloned()
        .collect()
}

fn schema_keys(contract: &Value, name: &str) -> BTreeSet<String> {
    definition(contract, name)["properties"]
        .as_object()
        .unwrap_or_else(|| panic!("definition {name} missing properties"))
        .keys()
        .cloned()
        .collect()
}

fn assert_exact_object_keys(value: &Value, contract: &Value, name: &str, path: &str) {
    assert_eq!(
        object_keys(value, path),
        schema_keys(contract, name),
        "{path} serde keys drifted from {name}"
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

fn assert_definition(value: &Value, contract: &Value, name: &str, path: &str) {
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
        &format!("/api/v1/jobs/{job_id}/events?limit=20&offset=0"),
    )
    .await;
    let library_list = get_data(app.clone(), "/api/v1/library/books").await;
    let library_detail = get_data(app, &format!("/api/v1/library/books/{job_id}")).await;

    let job_contract = contract("job-status.v1.schema.json");
    assert_definition(&job_list, &job_contract, "JobListView", "job_list");
    assert_definition(&job_detail, &job_contract, "JobDetailView", "job_detail");
    assert_definition(&job_events, &job_contract, "JobEventListView", "job_events");
    assert_exact_object_keys(&job_list, &job_contract, "JobListView", "job_list");
    assert_exact_object_keys(
        &job_list["items"][0],
        &job_contract,
        "JobListItemView",
        "job_list.items[0]",
    );
    assert_exact_object_keys(&job_detail, &job_contract, "JobDetailView", "job_detail");
    assert_exact_object_keys(
        &job_detail["book_summary"],
        &job_contract,
        "BookSummaryView",
        "job_detail.book_summary",
    );
    assert_eq!(
        job_detail["book_summary"]["thumbnail_url"],
        format!("http://127.0.0.1:41000/api/v1/jobs/{job_id}/thumbnail")
    );
    assert_eq!(job_events["limit"], 20);
    assert_eq!(job_events["offset"], 0);
    assert_eq!(
        job_events["items"][0]["payload"]["metadata"]["flags"][1],
        false
    );

    let library_contract = contract("library-books.v1.schema.json");
    assert_definition(
        &job_list,
        &library_contract,
        "JobListView",
        "job_list (library contract)",
    );
    assert_definition(
        &library_list,
        &library_contract,
        "LibraryBookListView",
        "library_list",
    );
    assert_definition(
        &library_detail,
        &library_contract,
        "LibraryBookDetailView",
        "library_detail",
    );
    assert_exact_object_keys(
        &job_list,
        &library_contract,
        "JobListView",
        "job_list (library contract)",
    );
    assert_exact_object_keys(
        &job_list["items"][0],
        &library_contract,
        "JobListItemView",
        "job_list.items[0] (library contract)",
    );
    assert_exact_object_keys(
        &library_list,
        &library_contract,
        "LibraryBookListView",
        "library_list",
    );
    assert_exact_object_keys(
        &library_list["items"][0],
        &library_contract,
        "LibraryBookListItemView",
        "library_list.items[0]",
    );
    assert_exact_object_keys(
        &library_detail,
        &library_contract,
        "LibraryBookDetailView",
        "library_detail",
    );
    assert_eq!(
        library_detail["thumbnail_url"],
        format!("http://127.0.0.1:41000/api/v1/library/books/{job_id}/thumbnail")
    );
}
