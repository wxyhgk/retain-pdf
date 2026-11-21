use std::path::PathBuf;

use serde_json::json;

use super::*;
use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::models::request::CreateJobInput;

const SECRET: &str = "sk-dump-test-0123456789";

struct Fixture {
    root: PathBuf,
    db: Db,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("retain-snapshot-diff-{}", fastrand::u64(..)));
        let db = Db::new(root.join("db.sqlite"), root.join("data"));
        db.init().unwrap();
        Self { root, db }
    }

    fn seed_job(&self, job_id: &str) {
        let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec!["python".to_string()]);
        job.status = JobStatusKind::Succeeded;
        job.request_payload.translation.api_key = SECRET.to_string();
        job.error = Some(format!("调用失败：key {SECRET} 无效"));
        self.db.save_job(&job).unwrap();
        for message in ["开始", "完成"] {
            self.db
                .append_event(job_id, "info", None, None, None, None, "stage", None, message, None, None, None, None, None)
                .unwrap();
        }
    }

    fn dump(&self) -> Vec<DumpEntry> {
        let mut entries = Vec::new();
        self.db
            .dump_read_model(|entry| {
                entries.push(entry);
                Ok(())
            })
            .unwrap();
        entries
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn entry<'a>(entries: &'a [DumpEntry], kind: &str, id: &str) -> &'a DumpEntry {
    entries.iter().find(|e| e.kind == kind && e.id == id).unwrap_or_else(|| panic!("没有 {kind}/{id}"))
}

#[test]
fn dump_reads_jobs_events_and_lists_through_the_read_interface() {
    let fixture = Fixture::new();
    fixture.seed_job("job-b");
    fixture.seed_job("job-a");
    let entries = fixture.dump();

    let job = entry(&entries, "job", "job-a");
    assert_eq!(job.data["snapshot"]["record"]["job_id"], "job-a");
    assert_eq!(job.data["listed_snapshot_same"], true);
    let events = entry(&entries, "job_events", "job-a").data.as_array().unwrap().len();
    assert_eq!(events, 2);
    assert_eq!(entry(&entries, "list", "jobs").data.as_array().unwrap().len(), 2, "列表按接口自己的顺序");
    assert_eq!(entry(&entries, "list", "jobs_with_status/succeeded").data["count"], 2);

    let mut sorted = entries.clone();
    sorted.sort_by(|a, b| (&a.kind, &a.id).cmp(&(&b.kind, &b.id)));
    assert_eq!(sorted, entries, "按（类别，编号）排好序");
    let jobs: Vec<&str> = entries.iter().filter(|e| e.kind == "job").map(|e| e.id.as_str()).collect();
    assert_eq!(jobs, vec!["job-a", "job-b"]);
}

#[test]
fn dump_replaces_inline_credentials_with_fingerprints() {
    let fixture = Fixture::new();
    fixture.seed_job("job-a");
    let text = serde_json::to_string(&fixture.dump()).unwrap();
    assert!(!text.contains(SECRET), "导出里不许有凭证原文");
    let fingerprint = fingerprint(SECRET);
    let job = serde_json::to_string(&entry(&fixture.dump(), "job", "job-a").data).unwrap();
    assert!(job.contains(&format!("\"api_key\":\"{fingerprint}\"")), "凭证键换成指纹");
    assert!(job.contains(&format!("key {fingerprint} 无效")), "别处出现的原文也换成指纹");
}

#[test]
fn same_database_dumps_compare_equal() {
    let fixture = Fixture::new();
    fixture.seed_job("job-a");
    fixture.seed_job("job-b");
    let report = compare_dumps(fixture.dump().into_iter().map(Ok), fixture.dump().into_iter().map(Ok), &[], 50).unwrap();
    assert!(report.differences.is_empty(), "{:?}", report.differences);
    assert!(report.compared > 4);
}

fn sample() -> Vec<DumpEntry> {
    vec![
        DumpEntry { kind: "job".into(), id: "a".into(), data: json!({"record": {"status": "failed", "stage": "x"}, "list": [1, 2]}) },
        DumpEntry { kind: "job_events".into(), id: "a".into(), data: json!([1, 2, 3]) },
    ]
}

#[test]
fn compare_reports_field_paths_and_missing_entries() {
    let before = sample();
    let mut after = sample();
    after[0].data["record"]["status"] = json!("succeeded");
    after[0].data["list"] = json!([1, 2, 9]);
    after.remove(1);
    after.push(DumpEntry { kind: "upload".into(), id: "u".into(), data: json!({}) });

    let report = compare_dumps(before.clone().into_iter().map(Ok), after.clone().into_iter().map(Ok), &[], 50).unwrap();
    let found: Vec<(String, String)> = report.differences.iter().map(|d| (d.kind.clone(), d.path.clone())).collect();
    assert_eq!(
        found,
        vec![
            ("job".into(), "list[2]".into()),
            ("job".into(), "record.status".into()),
            ("job_events".into(), String::new()),
            ("upload".into(), String::new()),
        ]
    );
    assert_eq!(report.differences[1].before, Some(json!("failed")));
    assert_eq!(report.differences[2].after, None, "迁移后少了一条");
    assert_eq!(report.by_kind.get("job"), Some(&2));
}

#[test]
fn ignore_rules_match_whole_kinds_and_path_prefixes_on_segment_boundaries() {
    let before = sample();
    let mut after = sample();
    after[0].data["record"]["status"] = json!("succeeded");
    after[0].data["record"]["stage"] = json!("y");
    after[1].data = json!([]);

    let rules = vec!["job_events".to_string(), "job:record.stat".to_string()];
    let report = compare_dumps(before.clone().into_iter().map(Ok), after.clone().into_iter().map(Ok), &rules, 50).unwrap();
    assert_eq!(report.ignored, 1);
    let paths: Vec<&str> = report.differences.iter().map(|d| d.path.as_str()).collect();
    assert_eq!(paths, vec!["record.stage", "record.status"], "前缀按字段边界算，record.stat 不吃掉 record.status");

    let rules = vec!["job:record".to_string()];
    let report = compare_dumps(before.clone().into_iter().map(Ok), after.clone().into_iter().map(Ok), &rules, 50).unwrap();
    assert!(report.differences.iter().all(|d| d.kind == "job_events"));
}

#[test]
fn compare_limits_reported_differences_but_counts_all() {
    let before = vec![DumpEntry { kind: "job".into(), id: "a".into(), data: json!([1, 2, 3, 4]) }];
    let after = vec![DumpEntry { kind: "job".into(), id: "a".into(), data: json!([5, 6, 7, 8]) }];
    let report = compare_dumps(before.clone().into_iter().map(Ok), after.clone().into_iter().map(Ok), &[], 2).unwrap();
    assert_eq!(report.differences.len(), 2);
    assert_eq!(report.by_kind.get("job"), Some(&4));
}

#[test]
fn compare_rejects_unsorted_or_duplicate_input() {
    let mut unsorted = sample();
    unsorted.reverse();
    let error = compare_dumps(unsorted.into_iter().map(Ok), sample().into_iter().map(Ok), &[], 50).unwrap_err();
    assert!(error.to_string().contains("迁移前的导出顺序乱了"), "{error}");
    let mut duplicated = sample();
    duplicated.insert(1, duplicated[0].clone());
    assert!(compare_dumps(sample().into_iter().map(Ok), duplicated.into_iter().map(Ok), &[], 50).is_err());
}
