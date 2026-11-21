//! 每个任务的模型用量汇总（缓存，v34）。怎么算、什么时候重算在任务包的 `reports/usage`；这里只管存取。
//! 表的说明见迁移 `v34_job_usage_cache.sql`。

use std::collections::HashMap;

use anyhow::Result;
use rusqlite::params;

use crate::models::domain::now_iso;

use super::Db;

/// 一组用量（阶段、模型、接口域名、月份相同的若干行）。
#[derive(Debug, Clone, PartialEq)]
pub struct UsageRollupRow {
    pub stage: String,
    pub model: String,
    pub host: String,
    /// `YYYY-MM`；取不出月份的行是 None。
    pub month: Option<String>,
    pub first_at: Option<String>,
    pub last_at: Option<String>,
    pub requests: u64,
    pub requests_without_usage: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_hit_tokens: u64,
    pub cache_reported_input_tokens: u64,
    pub cache_write_tokens: u64,
    pub reasoning_tokens: u64,
    pub estimated_cost_usd: f64,
    pub priced_requests: u64,
    pub list_priced_requests: u64,
    pub unpriced_requests: u64,
    pub price_provider: Option<String>,
    pub price_basis: Option<String>,
    pub first_priced_seq: Option<u64>,
}

/// 一个任务存着的汇总。
#[derive(Debug, Clone, PartialEq)]
pub struct UsageCacheEntry {
    /// 算的时候台账、报告文件的大小和修改时间、价格表指纹；对不上就该重算。
    pub source_key: String,
    pub has_records: bool,
    /// 用了旧报告折算。
    pub estimated: bool,
    pub rows: Vec<UsageRollupRow>,
}

impl Db {
    /// 这些任务存着的汇总（没存过的不在结果里）。一次读完，「总用量」接口一个请求只查两次库。
    pub fn usage_cache_entries(&self, job_ids: &[&str]) -> Result<HashMap<String, UsageCacheEntry>> {
        let conn = self.connect()?;
        let ids = serde_json::to_string(job_ids)?;
        let mut entries: HashMap<String, UsageCacheEntry> = HashMap::new();
        let mut stmt = conn.prepare(
            "SELECT job_id, source_key, has_records, estimated FROM job_usage_cache
             WHERE job_id IN (SELECT value FROM json_each(?1))",
        )?;
        let rows = stmt.query_map(params![ids], |row| {
            Ok((
                row.get::<_, String>(0)?,
                UsageCacheEntry {
                    source_key: row.get(1)?,
                    has_records: row.get(2)?,
                    estimated: row.get(3)?,
                    rows: Vec::new(),
                },
            ))
        })?;
        for row in rows {
            let (job_id, entry) = row?;
            entries.insert(job_id, entry);
        }
        let mut stmt = conn.prepare(
            "SELECT job_id, stage, model, host, month, first_at, last_at, requests, requests_without_usage,
                    input_tokens, output_tokens, cache_hit_tokens, cache_reported_input_tokens, cache_write_tokens,
                    reasoning_tokens, estimated_cost_usd, priced_requests, list_priced_requests, unpriced_requests,
                    price_provider, price_basis, first_priced_seq
             FROM job_usage_rollups WHERE job_id IN (SELECT value FROM json_each(?1))
             ORDER BY job_id, stage, model, host, month",
        )?;
        let rows = stmt.query_map(params![ids], |row| {
            let count = |index: usize| -> rusqlite::Result<u64> { Ok(row.get::<_, i64>(index)?.max(0) as u64) };
            Ok((
                row.get::<_, String>(0)?,
                UsageRollupRow {
                    stage: row.get(1)?,
                    model: row.get(2)?,
                    host: row.get(3)?,
                    month: row.get::<_, String>(4).map(|month| (!month.is_empty()).then_some(month))?,
                    first_at: row.get(5)?,
                    last_at: row.get(6)?,
                    requests: count(7)?,
                    requests_without_usage: count(8)?,
                    input_tokens: count(9)?,
                    output_tokens: count(10)?,
                    cache_hit_tokens: count(11)?,
                    cache_reported_input_tokens: count(12)?,
                    cache_write_tokens: count(13)?,
                    reasoning_tokens: count(14)?,
                    estimated_cost_usd: row.get(15)?,
                    priced_requests: count(16)?,
                    list_priced_requests: count(17)?,
                    unpriced_requests: count(18)?,
                    price_provider: row.get(19)?,
                    price_basis: row.get(20)?,
                    first_priced_seq: row.get::<_, Option<i64>>(21)?.map(|seq| seq.max(0) as u64),
                },
            ))
        })?;
        for row in rows {
            let (job_id, rollup) = row?;
            if let Some(entry) = entries.get_mut(&job_id) {
                entry.rows.push(rollup);
            }
        }
        Ok(entries)
    }

    /// 换掉一个任务存着的汇总（整份重写）。
    pub fn store_usage_cache(&self, job_id: &str, entry: &UsageCacheEntry) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM job_usage_cache WHERE job_id = ?1", params![job_id])?;
        tx.execute(
            "INSERT INTO job_usage_cache (job_id, source_key, has_records, estimated, computed_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![job_id, entry.source_key, entry.has_records, entry.estimated, now_iso()],
        )?;
        {
            let mut insert = tx.prepare(
                "INSERT INTO job_usage_rollups (
                    job_id, stage, model, host, month, first_at, last_at, requests, requests_without_usage,
                    input_tokens, output_tokens, cache_hit_tokens, cache_reported_input_tokens, cache_write_tokens,
                    reasoning_tokens, estimated_cost_usd, priced_requests, list_priced_requests, unpriced_requests,
                    price_provider, price_basis, first_priced_seq
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)",
            )?;
            for row in &entry.rows {
                insert.execute(params![
                    job_id,
                    row.stage,
                    row.model,
                    row.host,
                    row.month.as_deref().unwrap_or(""),
                    row.first_at,
                    row.last_at,
                    row.requests as i64,
                    row.requests_without_usage as i64,
                    row.input_tokens as i64,
                    row.output_tokens as i64,
                    row.cache_hit_tokens as i64,
                    row.cache_reported_input_tokens as i64,
                    row.cache_write_tokens as i64,
                    row.reasoning_tokens as i64,
                    row.estimated_cost_usd,
                    row.priced_requests as i64,
                    row.list_priced_requests as i64,
                    row.unpriced_requests as i64,
                    row.price_provider,
                    row.price_basis,
                    row.first_priced_seq.map(|seq| seq as i64),
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// 去掉不在 `keep` 里的任务的汇总（任务目录删掉了）。返回去掉几个。
    pub fn prune_usage_cache(&self, keep: &[&str]) -> Result<usize> {
        let conn = self.connect()?;
        Ok(conn.execute(
            "DELETE FROM job_usage_cache WHERE job_id NOT IN (SELECT value FROM json_each(?1))",
            params![serde_json::to_string(keep)?],
        )?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(stage: &str, month: Option<&str>) -> UsageRollupRow {
        UsageRollupRow {
            stage: stage.into(),
            model: "m".into(),
            host: "h".into(),
            month: month.map(str::to_string),
            first_at: Some("2026-10-01T00:00:00Z".into()),
            last_at: None,
            requests: 3,
            requests_without_usage: 1,
            input_tokens: 100,
            output_tokens: 10,
            cache_hit_tokens: 40,
            cache_reported_input_tokens: 80,
            cache_write_tokens: 0,
            reasoning_tokens: 5,
            estimated_cost_usd: 0.012345,
            priced_requests: 2,
            list_priced_requests: 1,
            unpriced_requests: 1,
            price_provider: Some("deepseek".into()),
            price_basis: Some("host".into()),
            first_priced_seq: Some(4),
        }
    }

    #[test]
    fn entries_round_trip_replace_and_prune() {
        let root = std::env::temp_dir().join(format!("retain-usage-cache-{}", fastrand::u64(..)));
        let db = Db::new(root.join("db.sqlite"), root.join("data"));
        db.init().unwrap();
        let entry = UsageCacheEntry {
            source_key: "k1".into(),
            has_records: true,
            estimated: false,
            // 读回来按（阶段，模型，域名，月份）排，取不出月份的（空串）在前。
            rows: vec![row("translation", None), row("translation", Some("2026-10"))],
        };
        db.store_usage_cache("job-a", &entry).unwrap();
        db.store_usage_cache("job-b", &UsageCacheEntry { rows: Vec::new(), has_records: false, ..entry.clone() }).unwrap();
        let loaded = db.usage_cache_entries(&["job-a", "job-b", "job-missing"]).unwrap();
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded["job-a"], entry, "原样读回来（月份取不出的那组也在）");
        assert!(loaded["job-b"].rows.is_empty());

        let replaced = UsageCacheEntry { source_key: "k2".into(), rows: vec![row("ocr", Some("2026-11"))], ..entry };
        db.store_usage_cache("job-a", &replaced).unwrap();
        assert_eq!(db.usage_cache_entries(&["job-a"]).unwrap()["job-a"], replaced, "整份换掉");

        assert_eq!(db.prune_usage_cache(&["job-a"]).unwrap(), 1);
        assert_eq!(db.usage_cache_entries(&["job-a", "job-b"]).unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(&root);
    }
}
