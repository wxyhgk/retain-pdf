//! 库里存着的产物路径一次性改成相对数据目录的写法（2026-11-21，数据库重做第 2b 步）。
//!
//! 写任务时路径本来就改成相对的（`normalize_job_artifacts_for_storage`），但事件日志 `events_jsonl` 以前漏了：
//! 真实库 142 个任务存的是本机绝对路径（带用户目录），还会同步到别的设备。写入那边补上以后，已经存着的在这里改一次。
//! 只改落在本机数据目录下的；别的设备同步来的（不在本机数据目录下）原样留着。改完再跑什么都不会动，所以每次起来都可以跑。

use anyhow::Result;
use rusqlite::params;

use crate::storage_paths::to_relative_data_path;

use super::Db;

/// 要改的字段（`artifacts_json` 里的键）。
const FIELDS: &[&str] = &["events_jsonl", "previous_output_pdf"];

impl Db {
    /// 返回改了几个任务。
    pub fn relativize_stored_artifact_paths(&self) -> Result<usize> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let mut changed = 0;
        for field in FIELDS {
            let path = format!("$.{field}");
            let rows: Vec<(String, String)> = {
                let mut stmt = tx.prepare(
                    "SELECT job_id, json_extract(artifacts_json, ?1) FROM artifacts
                     WHERE json_valid(artifacts_json) AND json_extract(artifacts_json, ?1) LIKE '/%'",
                )?;
                let mapped = stmt.query_map(params![path], |row| Ok((row.get(0)?, row.get(1)?)))?;
                mapped.collect::<rusqlite::Result<_>>()?
            };
            for (job_id, absolute) in rows {
                let Ok(relative) = to_relative_data_path(&self.data_root, std::path::Path::new(&absolute)) else {
                    continue;
                };
                changed += tx.execute(
                    "UPDATE artifacts SET artifacts_json = json_set(artifacts_json, ?1, ?2) WHERE job_id = ?3",
                    params![path, relative, job_id],
                )?;
            }
        }
        tx.commit()?;
        Ok(changed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::{CreateJobInput, JobArtifacts, JobSnapshot};

    #[test]
    fn absolute_paths_under_the_data_root_become_relative_and_foreign_ones_stay() {
        let root = std::env::temp_dir().join(format!("retain-stored-paths-{}", fastrand::u64(..)));
        let data_root = root.join("data");
        std::fs::create_dir_all(&data_root).unwrap();
        let db = Db::new(root.join("db.sqlite"), data_root.clone());
        db.init().unwrap();
        for job_id in ["mine", "foreign", "fine"] {
            let mut job = JobSnapshot::new(job_id.into(), CreateJobInput::default(), vec![]);
            job.artifacts = Some(JobArtifacts { job_root: Some(format!("jobs/{job_id}")), ..Default::default() });
            db.save_job(&job).unwrap();
        }
        let set = |job_id: &str, value: &str| {
            db.connect()
                .unwrap()
                .execute(
                    "UPDATE artifacts SET artifacts_json = json_set(artifacts_json, '$.events_jsonl', ?1) WHERE job_id = ?2",
                    params![value, job_id],
                )
                .unwrap();
        };
        let mine = data_root.join("jobs/parent/logs/pipeline_events.jsonl");
        set("mine", mine.to_str().unwrap());
        set("foreign", "/Users/someone-else/RetainPDF/data/jobs/foreign/logs/pipeline_events.jsonl");
        set("fine", "jobs/fine/logs/pipeline_events.jsonl");

        assert_eq!(db.relativize_stored_artifact_paths().unwrap(), 1);
        let events = |job_id: &str| db.get_job(job_id).unwrap().artifacts.unwrap().events_jsonl.unwrap();
        assert_eq!(events("mine"), "jobs/parent/logs/pipeline_events.jsonl");
        assert!(events("foreign").starts_with("/Users/someone-else/"), "别的设备的原样留着");
        assert_eq!(events("fine"), "jobs/fine/logs/pipeline_events.jsonl");
        assert_eq!(db.relativize_stored_artifact_paths().unwrap(), 0, "再跑什么都不动");

        // 写任务时也改成相对的；数据目录外的不报错。
        let mut job = db.get_job("fine").unwrap();
        job.artifacts.as_mut().unwrap().events_jsonl = Some(mine.to_string_lossy().into_owned());
        db.save_job(&job).unwrap();
        assert_eq!(events("fine"), "jobs/parent/logs/pipeline_events.jsonl");
        let mut job = db.get_job("fine").unwrap();
        job.artifacts.as_mut().unwrap().events_jsonl = Some("/elsewhere/pipeline_events.jsonl".into());
        db.save_job(&job).unwrap();
        assert_eq!(events("fine"), "/elsewhere/pipeline_events.jsonl");
        let _ = std::fs::remove_dir_all(&root);
    }
}
