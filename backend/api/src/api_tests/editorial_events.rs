//! 翻译 agent 的编辑部事件 `GET /api/v1/jobs/:job_id/progress/editorial`（2026-10-30）。
//!
//! 事件文件是调度写的 `translated/agent/run/events.jsonl`；这里按条数续读、原样转发，返回的键集合对着
//! `job-events.v2` 契约的 `EditorialEventListView`。legacy 任务没有文件，返回空列表。

use std::fs;

use axum::http::StatusCode;
use serde_json::Value;

use super::job_view_contract::{assert_exact_object_keys, contract};
use super::jobs_common::test_state;
use super::library_documents_contract::assert_request_fields_match;
use super::library_paging::send;
use crate::models::api::EditorialEventsQuery;
use crate::models::{CreateJobInput, JobArtifacts, JobSnapshot};

const CONTRACT: &str = "job-events.v2.schema.json";

fn seed_job(state: &crate::AppState, job_id: &str, events: Option<&str>) {
    let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec!["python".to_string()]);
    let job_root = state.config.data_root.join("jobs").join(job_id);
    fs::create_dir_all(&job_root).expect("job root");
    if let Some(text) = events {
        let path = job_root.join("translated/agent/run/events.jsonl");
        fs::create_dir_all(path.parent().expect("events dir")).expect("events dir");
        fs::write(path, text).expect("write events");
    }
    job.artifacts = Some(JobArtifacts { job_root: Some(format!("jobs/{job_id}")), ..JobArtifacts::default() });
    state.db.save_job(&job).expect("save job");
}

async fn get(state: &crate::AppState, uri: &str) -> (StatusCode, Value) {
    send(state, "GET", uri, None).await
}

const EVENTS: &str = concat!(
    r#"{"v":"editorial.v1","ts":1.5,"type":"run_started","pages":2,"model":"claude-haiku-5-5","doc_title":"T","resumed":0}"#, "\n",
    r#"{"v":"editorial.v1","ts":2.0,"type":"page_started","page":1,"label":"1","blocks":3}"#, "\n",
    r#"{"v":"editorial.v1","ts":2.5,"type":"translate_call","page":1,"attempt":1,"blocks":["a"],"role":"translator"}"#, "\n",
    r#"{"v":"editorial.v1","ts":3.0,"type":"page_do"#,
);

#[tokio::test]
async fn editorial_events_are_read_by_count_and_match_the_contract() {
    let state = test_state("editorial-events");
    let contract = contract(CONTRACT);
    seed_job(&state, "job-editorial-agent", Some(EVENTS));

    let (status, payload) = get(&state, "/api/v1/jobs/job-editorial-agent/progress/editorial").await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    let data = &payload["data"];
    assert_exact_object_keys(data, &contract, "EditorialEventListView", "editorial");
    let events = data["events"].as_array().expect("events");
    assert_eq!(events.len(), 3, "the unfinished last line is not read yet: {data}");
    assert_eq!(events[0]["doc_title"], "T", "events are passed through as written");
    assert_eq!((data["next_after"].as_u64(), data["has_more"].as_bool()), (Some(3), Some(false)));

    let (_, page) = get(&state, "/api/v1/jobs/job-editorial-agent/progress/editorial?after=1&limit=1").await;
    let page = &page["data"];
    assert_eq!(page["events"][0]["type"], "page_started");
    assert_eq!((page["next_after"].as_u64(), page["has_more"].as_bool()), (Some(2), Some(true)));
}

#[tokio::test]
async fn a_job_without_editorial_events_gets_an_empty_list_and_unknown_jobs_are_404() {
    let state = test_state("editorial-events-legacy");
    seed_job(&state, "job-editorial-legacy", None);
    let (status, payload) = get(&state, "/api/v1/jobs/job-editorial-legacy/progress/editorial").await;
    assert_eq!(status, StatusCode::OK, "{payload}");
    assert_eq!(payload["data"]["events"], serde_json::json!([]));
    assert_eq!(payload["data"]["next_after"], 0);

    let (status, _) = get(&state, "/api/v1/jobs/job-missing/progress/editorial").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    let (status, _) = get(&state, "/api/v1/jobs/job-editorial-legacy/progress/editorial?cursor=x").await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "unknown query fields are rejected");
}

#[test]
fn the_query_accepts_exactly_the_contract_fields() {
    assert_request_fields_match::<EditorialEventsQuery>(&contract(CONTRACT), "EditorialEventsQuery");
}
