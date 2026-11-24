//! /api/v1/jobs/:id/data 与 /data/:dataset 经真实路由。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::util::ServiceExt;

use crate::api_tests::jobs_common::{read_json, seed_legacy_layout_job, seed_virtual_job, test_state};
use crate::app::build_app;
use crate::models::{CreateJobInput, JobSnapshot};
use crate::storage_paths::{attach_job_paths, build_job_paths};

async fn get(state: &crate::AppState, uri: &str) -> axum::response::Response {
    build_app(state.clone())
        .oneshot(Request::builder().uri(uri).header("X-API-Key", "test-key").body(Body::empty()).unwrap())
        .await
        .unwrap()
}

/// 契约 job-data.v1 的两条返回（2026-11-24 起对真实返回钉键集合）。
fn assert_job_data(value: &serde_json::Value, name: &str, path: &str) {
    super::job_view_contract::assert_contract_view(value, "job-data.v1.schema.json", name, path);
}

#[tokio::test]
async fn job_data_routes_list_and_query_registered_datasets() {
    let state = test_state("job-data-routes");
    let mut job = JobSnapshot::new("job-data".to_string(), CreateJobInput::default(), vec![]);
    let paths = build_job_paths(&state.config.output_root, "job-data").unwrap();
    attach_job_paths(&mut job, &paths);
    state.db.save_job(&job).unwrap();
    let rows: String = [
        serde_json::json!({"revision_id": "r1", "item_id": "p003-b004", "page_idx": 2, "source": "refine", "ts": "1"}),
        serde_json::json!({"revision_id": "r2", "item_id": "p003-b004", "page_idx": 2, "source": "user", "ts": "2"}),
    ]
    .iter()
    .map(|row| format!("{row}\n"))
    .collect();
    std::fs::write(paths.translated_dir.join("revisions.v1.jsonl"), rows).unwrap();

    let catalog = read_json(get(&state, "/api/v1/jobs/job-data/data").await).await["data"].clone();
    assert_job_data(&catalog, "JobDataCatalogView", "catalog");
    for (index, dataset) in catalog["datasets"].as_array().unwrap().iter().enumerate() {
        assert_job_data(dataset, "JobDataDatasetInfo", &format!("catalog.datasets[{index}]"));
        for (field_index, field) in dataset["fields"].as_array().unwrap().iter().enumerate() {
            assert_job_data(field, "JobDataFieldInfo", &format!("catalog.datasets[{index}].fields[{field_index}]"));
        }
    }
    let revisions = catalog["datasets"].as_array().unwrap().iter().find(|d| d["name"] == "revisions").unwrap().clone();
    assert_eq!(revisions["available"], true);

    let data = read_json(get(&state, "/api/v1/jobs/job-data/data/revisions?source=user&fields=source").await).await["data"].clone();
    assert_job_data(&data, "JobDataView", "data(rows)");
    assert_eq!(data["total"], 1);
    assert_eq!(data["rows"][0]["reader_item_id"], "p003-b0004");
    assert_eq!(data["rows"][0]["page"], 3);

    let groups = read_json(get(&state, "/api/v1/jobs/job-data/data/revisions?group_by=item_id").await).await["data"].clone();
    assert_job_data(&groups, "JobDataView", "data(groups)");
    assert_job_data(&groups["groups"][0], "JobDataGroup", "data(groups).groups[0]");
    assert_eq!(groups["groups"][0]["count"], 2);

    assert_eq!(get(&state, "/api/v1/jobs/job-data/data/revisions?nope=1").await.status(), StatusCode::BAD_REQUEST);
    assert_eq!(get(&state, "/api/v1/jobs/job-data/data/secrets").await.status(), StatusCode::NOT_FOUND);
    assert_eq!(get(&state, "/api/v1/jobs/job-missing/data").await.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn job_data_reads_a_merged_reading_job_and_rejects_legacy_layouts() {
    let state = test_state("job-data-virtual");
    let (job_id, root) = seed_virtual_job(&state);
    std::fs::write(
        root.join("translated/revisions.v1.jsonl"),
        format!("{}\n", serde_json::json!({"revision_id": "r1", "item_id": "p003-b004", "page_idx": 2, "source": "user", "ts": "1"})),
    )
    .unwrap();

    // 合并目录里有的数据集照常读，没有的（artifacts/、logs/ 下的）是 available:false，不是错误。
    let catalog = read_json(get(&state, &format!("/api/v1/jobs/{job_id}/data")).await).await["data"].clone();
    let datasets = catalog["datasets"].as_array().unwrap();
    assert!(datasets.iter().any(|d| d["name"] == "revisions" && d["available"] == true), "{catalog}");
    assert!(datasets.iter().any(|d| d["available"] == false), "{catalog}");
    let rows = read_json(get(&state, &format!("/api/v1/jobs/{job_id}/data/revisions")).await).await["data"].clone();
    assert_eq!(rows["total"], 1);
    let missing = get(&state, &format!("/api/v1/jobs/{job_id}/data/qa_violations")).await;
    assert_eq!(missing.status(), StatusCode::OK);
    let missing = read_json(missing).await["data"].clone();
    assert_job_data(&missing, "JobDataView", "data(missing)");
    assert_eq!(missing["available"], false);

    // 虚拟 id 格式对、但没有这份合并：和别的读接口一样 404。
    let bogus = format!("merged-{}-fedcba9876543210", "a".repeat(64));
    assert_eq!(get(&state, &format!("/api/v1/jobs/{bogus}/data")).await.status(), StatusCode::NOT_FOUND);

    // 旧目录格式的任务：409，和别的读接口一样。
    seed_legacy_layout_job(&state, "job-legacy");
    assert_eq!(get(&state, "/api/v1/jobs/job-legacy/data").await.status(), StatusCode::CONFLICT);
    assert_eq!(get(&state, "/api/v1/jobs/job-legacy/data/revisions").await.status(), StatusCode::CONFLICT);
}
