use crate::api_tests::jobs_common::test_state;
use crate::models::domain::{
    CreateJobInput, JobArtifacts, JobSnapshot, OcrProviderDiagnostics, OcrProviderKind,
};
use crate::error::AppError;
use crate::services::jobs::list_jobs_filtered;

#[test]
fn jobs_limit_out_of_range_is_400_and_has_more_comes_from_one_extra_row() {
    let state = test_state("job-list-limit");
    let request = serde_json::to_string(
        &JobSnapshot::new("seed".into(), CreateJobInput::default(), vec![]).request_payload,
    )
    .unwrap();
    let conn = rusqlite::Connection::open(&state.config.jobs_db_path).unwrap();
    conn.execute(
        "WITH RECURSIVE n(value) AS (SELECT 1 UNION ALL SELECT value + 1 FROM n WHERE value < 501) \
         INSERT INTO jobs (job_id, workflow, status, created_at, updated_at, command_json, request_json, log_tail_json) \
         SELECT printf('job-%05d', value), 'book', 'queued', '2026-01-01', '2026-01-01', '[]', ?1, '[]' FROM n",
        [request],
    ).unwrap();
    for limit in [1, 500] {
        let query = serde_json::from_value(serde_json::json!({"limit":limit})).unwrap();
        let page = list_jobs_filtered(&state.db, &query).unwrap();
        assert_eq!(page.jobs.len(), limit as usize);
        assert_eq!(page.limit, limit);
        assert!(page.has_more, "501 条，limit={limit} 还有下一页");
    }
    // 最后一页：501 条，limit=500，offset=1 刚好取完，has_more 为 false。
    let query = serde_json::from_value(serde_json::json!({"limit":500, "offset":1})).unwrap();
    let page = list_jobs_filtered(&state.db, &query).unwrap();
    assert_eq!((page.jobs.len(), page.has_more), (500, false));
    // 越界是 400，不静默夹。
    for limit in [0, 501, u32::MAX] {
        let query = serde_json::from_value(serde_json::json!({"limit":limit})).unwrap();
        let error = list_jobs_filtered(&state.db, &query).err().expect("limit out of range");
        assert!(matches!(error, AppError::BadRequest(_)), "limit={limit}");
    }
    let query = serde_json::from_value(serde_json::json!({"limit":1, "offset":1})).unwrap();
    assert_eq!(
        list_jobs_filtered(&state.db, &query).unwrap().jobs[0].job_id,
        "job-00500"
    );
}

#[test]
fn jobs_q_and_job_ids_filter_before_pagination() {
    let state = test_state("job-list-q-job-ids");
    for id in ["4-none", "3-paper-a", "2-paper-b", "1-paper-c"] {
        let mut job = JobSnapshot::new(id.into(), CreateJobInput::default(), vec![]);
        job.updated_at = "2026-01-01T00:00:00Z".into();
        state.db.save_job(&job).unwrap();
    }
    let ids = |value: serde_json::Value| {
        let query = serde_json::from_value(value).unwrap();
        let page = list_jobs_filtered(&state.db, &query).unwrap();
        (
            page.jobs.iter().map(|job| job.job_id.clone()).collect::<Vec<_>>(),
            page.has_more,
        )
    };
    // q：子串、不分大小写，先过滤再分页。
    assert_eq!(
        ids(serde_json::json!({"q":"  PAPER ", "limit":2})),
        (vec!["3-paper-a".to_string(), "2-paper-b".to_string()], true)
    );
    assert_eq!(
        ids(serde_json::json!({"q":"paper", "limit":2, "offset":2})),
        (vec!["1-paper-c".to_string()], false)
    );
    assert_eq!(ids(serde_json::json!({"q":"no match"})), (vec![], false));
    // job_ids：逗号分隔的白名单，仍然分页。
    assert_eq!(
        ids(serde_json::json!({"job_ids":"1-paper-c, 4-none,missing", "limit":1})),
        (vec!["4-none".to_string()], true)
    );
}

#[test]
fn jobs_provider_filter_is_applied_before_pagination() {
    let state = test_state("job-list-provider");
    for (id, provider) in [
        ("3-nonmatching", OcrProviderKind::Mineru),
        ("2-first", OcrProviderKind::Paddle),
        ("1-second", OcrProviderKind::Paddle),
    ] {
        let mut job = JobSnapshot::new(id.into(), CreateJobInput::default(), vec![]);
        job.updated_at = "2026-01-01T00:00:00Z".into();
        job.artifacts = Some(JobArtifacts {
            ocr_provider_diagnostics: Some(OcrProviderDiagnostics::new(provider)),
            ..Default::default()
        });
        state.db.save_job(&job).unwrap();
    }
    let query =
        serde_json::from_value(serde_json::json!({"provider":"PADDLE", "limit":1, "offset":1}))
            .unwrap();
    let jobs = list_jobs_filtered(&state.db, &query).unwrap().jobs;
    assert_eq!(jobs.len(), 1);
    assert_eq!(jobs[0].job_id, "1-second");
}
