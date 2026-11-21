use super::*;
use crate::db::NewRunWrite;
use crate::models::domain::{
    CreateJobInput, JobArtifacts, OcrProviderDiagnostics, OcrProviderKind, UploadRecord,
};

struct TestDb {
    db: Db,
    root: std::path::PathBuf,
}

impl TestDb {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("retain-job-selection-{}", fastrand::u64(..)));
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().unwrap();
        Self { db, root }
    }

    fn seed(
        &self,
        id: &str,
        workflow: WorkflowKind,
        status: JobStatusKind,
        provider: OcrProviderKind,
    ) {
        let mut job = JobSnapshot::new(
            id.into(),
            CreateJobInput {
                workflow,
                ..Default::default()
            },
            vec![],
        );
        job.status = status;
        job.updated_at = "2026-01-01T00:00:00Z".into();
        job.artifacts = Some(JobArtifacts {
            ocr_provider_diagnostics: Some(OcrProviderDiagnostics::new(provider)),
            ..Default::default()
        });
        self.db.save_job(&job).unwrap();
    }
}

impl Drop for TestDb {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn ids(jobs: &[JobSnapshot]) -> Vec<&str> {
    jobs.iter().map(|job| job.job_id.as_str()).collect()
}

#[test]
fn provider_status_and_workflow_filter_before_stable_pagination() {
    let test = TestDb::new();
    test.seed(
        "6-ocr",
        WorkflowKind::Ocr,
        JobStatusKind::Queued,
        OcrProviderKind::Paddle,
    );
    test.seed(
        "5-failed",
        WorkflowKind::Book,
        JobStatusKind::Failed,
        OcrProviderKind::Paddle,
    );
    test.seed(
        "4-mineru",
        WorkflowKind::Book,
        JobStatusKind::Queued,
        OcrProviderKind::Mineru,
    );
    test.seed(
        "3-first",
        WorkflowKind::Book,
        JobStatusKind::Queued,
        OcrProviderKind::Paddle,
    );
    test.seed(
        "2-second",
        WorkflowKind::Book,
        JobStatusKind::Queued,
        OcrProviderKind::Paddle,
    );
    test.seed(
        "1-third",
        WorkflowKind::Book,
        JobStatusKind::Queued,
        OcrProviderKind::Paddle,
    );
    let selection = JobListSelection {
        status: Some(&JobStatusKind::Queued),
        workflow: Some(&WorkflowKind::Book),
        provider: Some("PaDdLe"),
        limit: Some(1),
        offset: 1,
        ..Default::default()
    };
    let jobs = test.db.select_jobs(&selection, |_, _| true).unwrap();
    assert_eq!(ids(&jobs), ["2-second"]);
    let excluded = test
        .db
        .select_jobs(
            &JobListSelection {
                workflow: None,
                exclude_ocr: true,
                ..selection
            },
            |_, _| true,
        )
        .unwrap();
    assert_eq!(ids(&excluded), ["2-second"]);
}

#[test]
fn malformed_rows_and_artifacts_do_not_consume_matching_page_slots() {
    let test = TestDb::new();
    for id in [
        "6-bad-request",
        "5-bad-json",
        "4-bad-artifact-field",
        "3-first",
        "2-second",
        "1-third",
    ] {
        test.seed(
            id,
            WorkflowKind::Book,
            JobStatusKind::Queued,
            OcrProviderKind::Paddle,
        );
    }
    let conn = test.db.connect().unwrap();
    conn.execute(
        "UPDATE jobs SET request_json = 'not json' WHERE job_id = '6-bad-request'",
        [],
    )
    .unwrap();
    conn.execute(
        "UPDATE artifacts SET artifacts_json = 'not json' WHERE job_id = '5-bad-json'",
        [],
    )
    .unwrap();
    conn.execute("UPDATE artifacts SET artifacts_json = json_set(artifacts_json, '$.pages_processed', 'invalid') WHERE job_id = '4-bad-artifact-field'", []).unwrap();
    let jobs = test
        .db
        .select_jobs(
            &JobListSelection {
                provider: Some("paddle"),
                limit: Some(2),
                offset: 1,
                ..Default::default()
            },
            |_, _| true,
        )
        .unwrap();
    assert_eq!(ids(&jobs), ["2-second", "1-third"]);
    let without_provider = test
        .db
        .select_jobs(
            &JobListSelection {
                limit: Some(2),
                ..Default::default()
            },
            |_, _| true,
        )
        .unwrap();
    assert_eq!(
        ids(&without_provider),
        ["5-bad-json", "4-bad-artifact-field"]
    );
    assert!(without_provider.iter().all(|job| job.artifacts.is_none()));
}

#[test]
fn unknown_provider_retains_its_typed_meaning() {
    let test = TestDb::new();
    test.seed(
        "unknown-provider",
        WorkflowKind::Book,
        JobStatusKind::Queued,
        OcrProviderKind::Unknown,
    );
    assert_eq!(
        test.db
            .select_jobs(
                &JobListSelection {
                    provider: Some("UNKNOWN"),
                    ..Default::default()
                },
                |_, _| true
            )
            .unwrap()
            .len(),
        1
    );
    for provider in ["unrecognized", " unknown ", ""] {
        assert!(test
            .db
            .select_jobs(
                &JobListSelection {
                    provider: Some(provider),
                    ..Default::default()
                },
                |_, _| true
            )
            .unwrap()
            .is_empty());
    }
}

#[test]
fn joined_upload_search_metadata_matches_trim_and_invalid_path_fallback() {
    let test = TestDb::new();
    test.seed(
        "with-upload",
        WorkflowKind::Book,
        JobStatusKind::Queued,
        OcrProviderKind::Local,
    );
    let upload = UploadRecord {
        upload_id: "upload-a".into(),
        filename: "  My Paper.pdf  ".into(),
        stored_path: "uploads/a.pdf".into(),
        bytes: 4,
        page_count: 1,
        uploaded_at: "2026-01-01T00:00:00Z".into(),
        developer_mode: false,
        content_hash: String::new(),
    };
    test.db.save_upload(&upload).unwrap();
    let conn = test.db.connect().unwrap();
    conn.execute(
        "UPDATE jobs SET upload_id = ?",
        ["\u{2000}\tupload-a\r\u{3000}"],
    )
    .unwrap();
    let mut seen = Vec::new();
    test.db
        .select_jobs(
            &JobListSelection {
                include_upload_filename: true,
                ..Default::default()
            },
            |_, filename| {
                seen.push(filename.map(str::to_string));
                true
            },
        )
        .unwrap();
    assert_eq!(seen, [Some(upload.filename)]);
    conn.execute("UPDATE uploads SET stored_path = '../outside.pdf'", [])
        .unwrap();
    test.db
        .select_jobs(
            &JobListSelection {
                include_upload_filename: true,
                ..Default::default()
            },
            |_, filename| {
                assert!(filename.is_none());
                true
            },
        )
        .unwrap();
}

#[test]
fn streaming_search_and_exact_ids_have_no_ten_thousand_row_cutoff() {
    let test = TestDb::new();
    let request = serde_json::to_string(
        &JobSnapshot::new("seed".into(), CreateJobInput::default(), vec![]).request_payload,
    )
    .unwrap();
    let conn = test.db.connect().unwrap();
    conn.execute(
        "WITH RECURSIVE n(value) AS (SELECT 1 UNION ALL SELECT value + 1 FROM n WHERE value < 10001) \
         INSERT INTO jobs (job_id, workflow, status, created_at, updated_at, command_json, request_json, log_tail_json) \
         SELECT printf('job-%05d', value), 'book', 'queued', '2026-01-01', '2026-01-01', '[]', ?1, '[]' FROM n",
        [request],
    ).unwrap();
    let mut visited = 0;
    let jobs = test
        .db
        .select_jobs(
            &JobListSelection {
                limit: Some(1),
                ..Default::default()
            },
            |job, _| {
                visited += 1;
                job.job_id == "job-00001"
            },
        )
        .unwrap();
    assert_eq!(visited, 10001);
    assert_eq!(ids(&jobs), ["job-00001"]);
    let requested: Vec<String> = (1..=10001).map(|id| format!("job-{id:05}")).collect();
    let jobs = test
        .db
        .select_jobs(
            &JobListSelection {
                job_ids: Some(&requested),
                ..Default::default()
            },
            |_, _| true,
        )
        .unwrap();
    assert_eq!(jobs.len(), 10001);
    assert_eq!(jobs.last().unwrap().job_id, "job-00001");
    assert!(test.db.list_jobs(0, 0, None, None).unwrap().is_empty());
    assert_eq!(test.db.list_jobs(501, 0, None, None).unwrap().len(), 501);
}

#[test]
fn streaming_stops_after_the_matching_page() {
    let test = TestDb::new();
    for id in ["4-skip", "3-match", "2-match", "1-never-read"] {
        test.seed(
            id,
            WorkflowKind::Book,
            JobStatusKind::Queued,
            OcrProviderKind::Local,
        );
    }
    let mut visited = Vec::new();
    let jobs = test
        .db
        .select_jobs(
            &JobListSelection {
                offset: 1,
                limit: Some(1),
                ..Default::default()
            },
            |job, _| {
                visited.push(job.job_id.clone());
                job.job_id.ends_with("match")
            },
        )
        .unwrap();
    assert_eq!(ids(&jobs), ["2-match"]);
    assert_eq!(visited, ["4-skip", "3-match", "2-match"]);
}

/// job 归属的 document。
///
/// 归属是 `link_job_to_document` 在**建完 job 之后**补写的,也可能由回填补上,
/// 所以「查不到」是正常状态而不是错误。重译后接力 agent 工作区靠这个查询找
/// 同一本书的其它 job —— 它要是把空串当成一个合法 document_id,接力就会去找
/// 「所有没归属的 job」,等于在不相干的书之间搬批注。
#[test]
fn document_id_for_job_treats_null_and_empty_as_unlinked() {
    let db = TestDb::new();
    db.seed(
        "linked",
        WorkflowKind::Translate,
        JobStatusKind::Succeeded,
        OcrProviderKind::Mineru,
    );
    db.seed(
        "never-linked",
        WorkflowKind::Translate,
        JobStatusKind::Succeeded,
        OcrProviderKind::Mineru,
    );
    db.seed(
        "empty-linked",
        WorkflowKind::Translate,
        JobStatusKind::Succeeded,
        OcrProviderKind::Mineru,
    );
    let conn = db.db.connect().unwrap();
    conn.execute(
        "UPDATE jobs SET document_id = 'sha256-abc' WHERE job_id = 'linked'",
        [],
    )
    .unwrap();
    // 历史行可能留下空串而不是 NULL。
    conn.execute(
        "UPDATE jobs SET document_id = '' WHERE job_id = 'empty-linked'",
        [],
    )
    .unwrap();
    drop(conn);

    assert_eq!(
        db.db.document_id_for_job("linked").unwrap().as_deref(),
        Some("sha256-abc")
    );
    assert_eq!(db.db.document_id_for_job("never-linked").unwrap(), None);
    assert_eq!(db.db.document_id_for_job("empty-linked").unwrap(), None);
    // 根本不存在的 job 也是 None,不是错误。
    assert_eq!(db.db.document_id_for_job("no-such-job").unwrap(), None);
}

#[test]
fn title_contains_matches_the_document_title_or_the_callback() {
    let test = TestDb::new();
    for id in ["3-renamed", "2-by-callback", "1-none"] {
        test.seed(id, WorkflowKind::Book, JobStatusKind::Queued, OcrProviderKind::Local);
    }
    let upload = UploadRecord {
        upload_id: "upload-a".into(),
        filename: "plain.pdf".into(),
        stored_path: "uploads/a.pdf".into(),
        bytes: 4,
        page_count: 1,
        uploaded_at: "2026-01-01T00:00:00Z".into(),
        developer_mode: false,
        content_hash: "hash-a".into(),
    };
    test.db.save_upload(&upload).unwrap();
    test.db.upsert_document_from_upload(&upload).unwrap();
    let conn = test.db.connect().unwrap();
    conn.execute("UPDATE documents SET title = 'Quantum Mechanics 2e' WHERE document_id = 'hash-a'", []).unwrap();
    conn.execute("UPDATE jobs SET upload_id = 'upload-a' WHERE job_id = '3-renamed'", []).unwrap();
    let select = |needle: &str| {
        test.db
            .select_jobs(
                &JobListSelection {
                    include_upload_filename: true,
                    title_contains: Some(needle),
                    ..Default::default()
                },
                |job, _| job.job_id == "2-by-callback",
            )
            .unwrap()
    };
    // 书名命中（ASCII 不分大小写，调用方传小写）或回调命中，先过滤再分页。
    assert_eq!(ids(&select("quantum")), ["3-renamed", "2-by-callback"]);
    assert_eq!(ids(&select("mechanics 2e")), ["3-renamed", "2-by-callback"]);
    assert_eq!(ids(&select("biology")), ["2-by-callback"]);
}

/// 运行代次：`save_job_as_new_run` 每次加一，CAS 只认当前代次；普通整行写不动它。
#[test]
fn run_generation_fences_cas_writes_from_earlier_runs() {
    let test = TestDb::new();
    test.seed("gen", WorkflowKind::Book, JobStatusKind::Queued, OcrProviderKind::Paddle);
    assert_eq!(test.db.job_run_generation("gen").unwrap(), Some(0));
    assert_eq!(test.db.job_run_generation("missing").unwrap(), None);

    // 旧运行读到的快照（代次 0）。
    let old_run = test.db.get_job("gen").unwrap();
    assert_eq!(old_run.run_generation, 0);

    // 原地重跑：整行落库并开启新的一次运行。
    let mut rerun = old_run.clone();
    rerun.status = JobStatusKind::Queued;
    assert_eq!(test.db.save_job_as_new_run(&rerun).unwrap(), 1);
    assert_eq!(test.db.get_job("gen").unwrap().run_generation, 1);

    // 旧运行的终态写：状态对（queued）、代次不对 → 落空，新一次运行的行原样。
    let mut stale = old_run.clone();
    stale.status = JobStatusKind::Canceled;
    assert!(!test.db.cas_save_job(&stale, &["queued", "running"]).unwrap());
    assert_eq!(test.db.get_job("gen").unwrap().status, JobStatusKind::Queued);

    // 新一次运行读到的快照写得进去。
    let mut current = test.db.get_job("gen").unwrap();
    current.status = JobStatusKind::Running;
    assert!(test.db.cas_save_job(&current, &["queued", "running"]).unwrap());

    // 普通整行写（启动恢复等）不改代次。
    test.db.save_job(&current).unwrap();
    assert_eq!(test.db.job_run_generation("gen").unwrap(), Some(1));
}

/// 原地重跑的落库只认读到时的状态和代次：两个请求读到同一个终态，只有先来的那个开跑。
#[test]
fn new_run_cas_only_starts_from_the_state_it_read() {
    let test = TestDb::new();
    test.seed("relaunch", WorkflowKind::Render, JobStatusKind::Failed, OcrProviderKind::Paddle);
    let read = test.db.get_job("relaunch").unwrap();
    let mut queued = read.clone();
    queued.status = JobStatusKind::Queued;

    assert_eq!(
        test.db.cas_save_job_as_new_run(&queued, &JobStatusKind::Failed, 0).unwrap(),
        NewRunWrite::Started(1)
    );
    // 同一份读数再来一次：行已经是 queued、代次 1，写不进去，什么都不改。
    let mut second = queued.clone();
    second.stage = Some("second".into());
    assert_eq!(
        test.db.cas_save_job_as_new_run(&second, &JobStatusKind::Failed, 0).unwrap(),
        NewRunWrite::Changed {
            current_status: Some(JobStatusKind::Queued),
            current_generation: 1,
        }
    );
    let stored = test.db.get_job("relaunch").unwrap();
    assert_eq!(stored.run_generation, 1);
    assert_ne!(stored.stage.as_deref(), Some("second"));
    // 那一次跑完了（又是 failed）：状态对上了，代次没对上，照样不写。
    let mut finished = stored.clone();
    finished.status = JobStatusKind::Failed;
    assert!(test.db.cas_save_job(&finished, &["queued"]).unwrap());
    assert!(matches!(
        test.db.cas_save_job_as_new_run(&second, &JobStatusKind::Failed, 0).unwrap(),
        NewRunWrite::Changed { current_generation: 1, .. }
    ));
    assert_eq!(
        test.db.cas_save_job_as_new_run(&second, &JobStatusKind::Failed, 1).unwrap(),
        NewRunWrite::Started(2)
    );
    let mut missing = second.clone();
    missing.job_id = "missing".into();
    assert_eq!(
        test.db.cas_save_job_as_new_run(&missing, &JobStatusKind::Failed, 0).unwrap(),
        NewRunWrite::Missing
    );
    assert!(test.db.get_job("missing").is_err(), "行不存在时不插入");
}

/// CAS 写不许在行不存在时 INSERT：行没了就是「被删了」，写的人该收手。
/// 以前这里直接 upsert，强制删除后 runner 的下一次落库把已删任务复活成 running 的幽灵行。
#[test]
fn cas_save_never_inserts_a_missing_row() {
    let test = TestDb::new();
    let mut job = JobSnapshot::new("deleted".into(), CreateJobInput::default(), vec![]);
    job.status = JobStatusKind::Running;
    test.db.save_job(&job).unwrap();
    test.db.delete_jobs(&["deleted".to_string()]).unwrap();

    assert!(
        !test.db.cas_save_job(&job, &["queued", "running"]).unwrap(),
        "行不存在时 CAS 必须返回 false"
    );
    assert!(test.db.get_job("deleted").is_err(), "CAS 不能把已删除的任务写回来");
    assert!(test.db.job_status("deleted").unwrap().is_none());

    // 行在时的行为不变：期望状态对得上就写，对不上就不写。
    test.db.save_job(&job).unwrap();
    let mut next = job.clone();
    next.stage = Some("translating".into());
    assert!(test.db.cas_save_job(&next, &["queued", "running"]).unwrap());
    let mut canceled = job.clone();
    canceled.status = JobStatusKind::Canceled;
    test.db.save_job(&canceled).unwrap();
    assert!(!test.db.cas_save_job(&next, &["queued", "running"]).unwrap());
}

/// v32：OCR 子任务（`{父任务}-ocr`）写进库时由数据库层填 `parent_job_id`；父任务还不在库里就留空（外键不挡写入），
/// 之后再写一次就补上。状态、流程存的是纯文本。
#[test]
fn saving_an_ocr_child_links_it_to_its_parent_and_stores_plain_text_status() {
    let test = TestDb::new();
    let parent_of = |id: &str| -> Option<String> {
        test.db
            .connect()
            .unwrap()
            .query_row("SELECT parent_job_id FROM jobs WHERE job_id = ?1", [id], |row| row.get(0))
            .unwrap()
    };
    test.seed("orphan-ocr", WorkflowKind::Ocr, JobStatusKind::Queued, OcrProviderKind::Mineru);
    assert_eq!(parent_of("orphan-ocr"), None, "父任务不在：留空");

    test.seed("book-1", WorkflowKind::Book, JobStatusKind::Running, OcrProviderKind::Mineru);
    test.seed("book-1-ocr", WorkflowKind::Ocr, JobStatusKind::Succeeded, OcrProviderKind::Mineru);
    assert_eq!(parent_of("book-1-ocr").as_deref(), Some("book-1"));
    assert_eq!(parent_of("book-1"), None);

    test.seed("orphan", WorkflowKind::Book, JobStatusKind::Queued, OcrProviderKind::Mineru);
    test.seed("orphan-ocr", WorkflowKind::Ocr, JobStatusKind::Queued, OcrProviderKind::Mineru);
    assert_eq!(parent_of("orphan-ocr").as_deref(), Some("orphan"), "父任务后来才有：再写一次就补上");

    let (workflow, status): (String, String) = test
        .db
        .connect()
        .unwrap()
        .query_row("SELECT workflow, status FROM jobs WHERE job_id = 'book-1-ocr'", [], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .unwrap();
    assert_eq!((workflow.as_str(), status.as_str()), ("ocr", "succeeded"));
    assert!(
        test.db.connect().unwrap().execute("UPDATE jobs SET status = '\"failed\"' WHERE job_id = 'book-1'", []).is_err(),
        "CHECK 挡住不认识的取值（包括以前带引号的写法）"
    );
}
