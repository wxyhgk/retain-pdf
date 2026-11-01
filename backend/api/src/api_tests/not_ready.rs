//! 「还没产出」的规矩（docs/api/00-约定/02-认证与错误.md，规矩和删留第 2 条），经真实路由：
//! - 原始文件、报告：任务在、东西还没有 → 404 + `error.details.reason = "not_ready"`，文案 `<名字> not ready`；
//! - 任务本身不存在 → 普通 404，`details` 是 `{}`；
//! - 摘要类（质量摘要、用量、各种列表、取数目录）→ 200，空的部分给 null、空列表或 0 / `available: false`。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use serde_json::{json, Value};
use tower::util::ServiceExt;

use super::file_responses::{seed, RUNNING_JOB};
use super::jobs_common::read_json;
use crate::app::build_app;
use crate::models::domain::{CreateJobInput, JobSnapshot, JobStatusKind};

/// 排队中、还没开始跑的任务：库里有记录，连输出目录都还没有。
const QUEUED_JOB: &str = "not-ready-queued";

async fn get(state: &crate::AppState, uri: &str) -> (StatusCode, Value) {
    let response = build_app(state.clone())
        .oneshot(Request::builder().uri(uri).header("X-API-Key", "test-key").body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    (status, read_json(response).await)
}

fn save_queued_job(state: &crate::AppState) {
    let mut input = CreateJobInput::default();
    input.runtime.job_id = QUEUED_JOB.to_string();
    let mut job = JobSnapshot::new(QUEUED_JOB.to_string(), input, vec!["python".to_string()]);
    job.status = JobStatusKind::Queued;
    job.artifacts = None;
    job.sync_runtime_state();
    state.db.save_job(&job).expect("save queued job");
}

/// 每类出口（output / pages / internal / 阅读 / 报告 / 译文条目）的地址（相对 `/api/v1/jobs/<任务>`）
/// 和「还没产出」时的文案。
const RAW_OUTPUTS: &[(&str, &str)] = &[
    ("files/output/translated.pdf", "translated.pdf not ready"),
    ("files/output/side-by-side.pdf", "source.pdf not ready"),
    ("files/output/translated.docx", "source.pdf not ready"),
    ("files/output/ocr.md", "ocr.md not ready"),
    ("files/output/ocr.zip", "ocr.md not ready"),
    ("files/output/ocr/images/page-1/fig.png", "ocr/images not ready"),
    ("files/output/all.zip", "all.zip not ready"),
    ("files/pages/1.jpg", "translated.pdf not ready"),
    ("files/internal/normalized-document.json", "normalized-document.json not ready"),
    ("files/internal/typst/render.pdf", "typst/render.pdf not ready"),
    ("reader/markdown", "markdown not ready"),
    ("reader/regions/p001-b0001", "reader regions not ready"),
    ("reports/translation", "translation report not ready"),
    ("reports/translation-qa", "translation-qa report not ready"),
    ("reports/layout-fit", "layout-fit report not ready"),
    ("reports/refine", "refine report not ready"),
    ("translations/p001-b001", "translation manifest not ready"),
    ("translations/p001-b001/revisions", "translation manifest not ready"),
];

fn assert_not_ready(uri: &str, status: StatusCode, body: &Value, message: &str) {
    assert_eq!(status, StatusCode::NOT_FOUND, "{uri}: {body}");
    assert_eq!(body["code"], 40400, "{uri}: {body}");
    assert_eq!(body["error"]["code"], "NOT_FOUND", "{uri}: {body}");
    assert_eq!(body["error"]["details"], json!({ "reason": "not_ready" }), "{uri}: {body}");
    assert_eq!(body["message"], message, "{uri}: {body}");
}

#[tokio::test]
async fn raw_files_and_reports_of_an_existing_job_are_404_not_ready() {
    let fixture = seed();
    for (path, message) in RAW_OUTPUTS {
        let uri = format!("/api/v1/jobs/{RUNNING_JOB}/{path}");
        let (status, body) = get(&fixture.state, &uri).await;
        assert_not_ready(&uri, status, &body, message);
    }
}

#[tokio::test]
async fn a_job_without_an_output_directory_is_also_not_ready() {
    let fixture = seed();
    save_queued_job(&fixture.state);
    for (path, message) in [
        ("files/output/translated.docx", "translated.docx not ready"),
        ("files/output/all.zip", "all.zip not ready"),
        ("reader/markdown", "markdown not ready"),
        ("reader/regions/p001-b0001", "reader regions not ready"),
        ("reports/refine", "refine report not ready"),
    ] {
        let uri = format!("/api/v1/jobs/{QUEUED_JOB}/{path}");
        let (status, body) = get(&fixture.state, &uri).await;
        assert_not_ready(&uri, status, &body, message);
    }
}

#[tokio::test]
async fn a_missing_job_is_a_plain_404_without_reason() {
    let fixture = seed();
    for (path, _) in RAW_OUTPUTS {
        let uri = format!("/api/v1/jobs/no-such-job/{path}");
        let (status, body) = get(&fixture.state, &uri).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{uri}: {body}");
        assert_eq!(body["error"]["details"], json!({}), "{uri}: {body}");
        assert_eq!(body["message"], "job not found: no-such-job", "{uri}: {body}");
    }
}

#[tokio::test]
async fn summaries_and_lists_stay_200_with_empty_values() {
    let fixture = seed();
    save_queued_job(&fixture.state);
    // 在跑（有输出目录、里面什么都没有）和排队（连输出目录都没有）两种都要 200。
    for job in [RUNNING_JOB, QUEUED_JOB] {
        let j = format!("/api/v1/jobs/{job}");
        let ok = |uri: &str, status: StatusCode, body: &Value| {
            assert_eq!(status, StatusCode::OK, "{uri}: {body}");
            body["data"].clone()
        };

        let uri = format!("{j}/translations");
        let (status, body) = get(&fixture.state, &uri).await;
        let data = ok(&uri, status, &body);
        assert_eq!((data["items"].clone(), data["total"].clone(), data["has_more"].clone()), (json!([]), json!(0), json!(false)), "{uri}");

        let uri = format!("{j}/reports/quality");
        let (status, body) = get(&fixture.state, &uri).await;
        let data = ok(&uri, status, &body);
        for section in ["preparation", "qa", "layout", "refine"] {
            assert!(data[section].is_null(), "{uri}: {section} = {}", data[section]);
        }

        let uri = format!("{j}/reports/quality/items?kind=qa");
        let (status, body) = get(&fixture.state, &uri).await;
        let data = ok(&uri, status, &body);
        assert_eq!((data["items"].clone(), data["total"].clone()), (json!([]), json!(0)), "{uri}");

        let uri = format!("{j}/data");
        let (status, body) = get(&fixture.state, &uri).await;
        let data = ok(&uri, status, &body);
        let datasets = data["datasets"].as_array().expect("datasets");
        assert!(!datasets.is_empty() && datasets.iter().all(|d| d["available"] == false), "{uri}: {data}");

        let uri = format!("{j}/data/qa_violations");
        let (status, body) = get(&fixture.state, &uri).await;
        let data = ok(&uri, status, &body);
        assert_eq!((data["available"].clone(), data["total"].clone()), (json!(false), json!(0)), "{uri}");

        for path in ["files", "reader/regions", "reader/metadata", "reports/usage", "reports/failure"] {
            let uri = format!("{j}/{path}");
            let (status, body) = get(&fixture.state, &uri).await;
            ok(&uri, status, &body);
        }
    }
}
