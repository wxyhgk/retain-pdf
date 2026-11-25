//! 数据库重做的比对工具（2026-11-20 定，见 `docs/ops/planning/database-redesign/`）。
//!
//! 每一步重做都是「表变了、读出来的东西不变」。这里把**数据库层对外的读接口**读出来的东西整理成一条条记录，
//! 迁移前用旧程序导一份、迁移后用新程序导一份，逐条比对：任务快照、产物清单、进度事件、断点续跑记录、书、上传、
//! 译文版本、进度流……读接口不变，导出的内容就该一模一样。
//!
//! - 只调 `Db` 的公开读接口，不直接读表；唯一例外是 [`enumerate_keys`]：读接口要先知道编号（上传、进度流的
//!   主人、断点续跑的阶段和外部调用）才能读，这几个编号从表里列出来。改表名时只改这一处。
//! - 任务请求里可能有用户直接填的 API Key：导出前换成指纹（`[secret sha256:前 12 位]`），值变了还能比出来，
//!   但不落明文。
//! - 只读；但打开一个旧版本的库会按现在的程序升级它（和平时打开一样），所以**只对副本用**。

use std::collections::{BTreeMap, BTreeSet};

use anyhow::Result;
use serde::Serialize;
use serde_json::{json, Value};

use crate::models::domain::JobStatusKind;

use super::Db;

/// 导出的一条记录：一类东西的一个编号。
#[derive(Debug, Clone, PartialEq, Serialize, serde::Deserialize)]
pub struct DumpEntry {
    pub kind: String,
    pub id: String,
    pub data: Value,
}

/// 读接口要先知道的编号；从表里列出（见模块说明）。
struct EnumeratedKeys {
    upload_ids: Vec<String>,
    feed_owners: Vec<String>,
    /// 任务 → (第几次运行, 阶段)
    pipeline_stages: BTreeMap<String, Vec<(u32, String)>>,
    /// 任务 → (第几次运行, 外部调用的键)
    pipeline_dispatches: BTreeMap<String, Vec<(u32, String)>>,
}

const STATUSES: [JobStatusKind; 5] = [
    JobStatusKind::Queued,
    JobStatusKind::Running,
    JobStatusKind::Succeeded,
    JobStatusKind::Failed,
    JobStatusKind::Canceled,
];
const PAGE: u32 = 1000;
/// 请求里这些键的值是凭证（和 retainpdf-core 的 redaction 一致，外加 OCR 选项里的）。
const SECRET_KEYS: &[&str] = &["api_key", "reviewer_api_key", "mineru_token", "paddle_token", "credential", "token"];

impl Db {
    /// 把读接口读出来的东西逐条交给 `sink`，按（类别，编号）从小到大，边读边交（不整份放在内存里）。返回条数。
    pub fn dump_read_model(&self, sink: impl FnMut(DumpEntry) -> Result<()>) -> Result<usize> {
        let keys = enumerate_keys(self)?;
        let mut jobs = self.list_jobs(u32::MAX, 0, None, None)?;
        let listed_order: Vec<String> = jobs.iter().map(|job| job.job_id.clone()).collect();
        jobs.sort_by(|a, b| a.job_id.cmp(&b.job_id));
        let mut secrets: BTreeSet<String> = BTreeSet::new();
        for job in &jobs {
            secrets.extend(crate::models::sensitive_values(&job.request_payload));
        }
        let secrets: Vec<String> = secrets.into_iter().collect();
        let mut out = OrderedSink { sink, secrets, last: None, count: 0 };

        // 类别按字母顺序：collection、document、event_feed、glossary、job、job_events、job_pipeline、list、tag、upload。
        let mut collections = self.list_collections()?;
        collections.sort_by(|a, b| a.collection_id.cmp(&b.collection_id));
        for collection in collections {
            let id = collection.collection_id.clone();
            out.emit("collection", &id, serde_json::to_value(collection)?)?;
        }

        let (mut documents, document_total) = self.list_documents_with_total(u32::MAX, 0, &Default::default())?;
        let document_order: Vec<String> = documents.iter().map(|d| d.document_id.clone()).collect();
        documents.sort_by(|a, b| a.document_id.cmp(&b.document_id));
        for document in &documents {
            let document_id = document.document_id.as_str();
            let job_ids = self.job_ids_for_document(document_id)?;
            out.emit(
                "document",
                document_id,
                json!({
                    "record": self.get_document(document_id)?,
                    "listed_record_same": serde_json::to_value(document)? == serde_json::to_value(self.get_document(document_id)?)?,
                    "uploads": self.uploads_for_document(document_id)?,
                    "first_upload": self.find_upload_for_document(document_id)?,
                    "job_ids": job_ids,
                    "jobs_listed": self.list_jobs_for_document(document_id, u32::MAX, 0)?
                        .into_iter().map(|job| job.job_id.clone()).collect::<Vec<_>>(),
                    "job_count": self.count_jobs_for_document(document_id)?,
                    "jobs_depending_on": self.jobs_depending_on(&job_ids)?,
                    "translation_versions": self.list_translation_versions(document_id, true)?,
                    "current_translation_version": self.document_current_translation_version(document_id)?,
                    "hidden_version_jobs": self.hidden_translation_version_jobs(document_id)?,
                    "title_suggestions": self.list_document_metadata_suggestions(document_id, u32::MAX)?,
                    // v39 起：阅读页提问的问答记录（连同问答）
                    "ask_threads": self.list_ask_threads(document_id)?
                        .into_iter()
                        .map(|thread| {
                            let messages = self.ask_thread_messages(&thread.thread_id)?;
                            Ok(json!({ "thread": thread, "messages": messages }))
                        })
                        .collect::<Result<Vec<_>>>()?,
                }),
            )?;
        }

        for owner in &keys.feed_owners {
            let Some(feed) = self.load_event_feed(owner)? else { continue };
            let mut items = Vec::new();
            let mut after = 0;
            loop {
                let page = self.read_event_feed_page(owner, &feed.epoch, after, feed.high_seq, PAGE)?;
                let Some(last) = page.last() else { break };
                after = last.seq;
                items.extend(page);
            }
            out.emit("event_feed", owner, json!({ "feed": feed, "items": items }))?;
        }

        let mut glossaries = self.list_glossaries()?;
        glossaries.sort_by(|a, b| a.glossary_id.cmp(&b.glossary_id));
        for glossary in glossaries {
            let id = glossary.glossary_id.clone();
            out.emit("glossary", &id, serde_json::to_value(glossary)?)?;
        }

        for job in &jobs {
            let job_id = job.job_id.as_str();
            let snapshot = self.get_job(job_id)?;
            out.emit(
                "job",
                job_id,
                json!({
                    "snapshot": snapshot,
                    "listed_snapshot_same": serde_json::to_value(job)? == serde_json::to_value(&snapshot)?,
                    "artifact_entries": self.list_job_artifact_entries(job_id)?,
                    "process_record": self.job_process_record(job_id)?,
                    "status": self.job_status(job_id)?,
                    "document_id": self.document_id_for_job(job_id)?,
                    "translation_version": self.translation_version_of_job(job_id)?,
                    "model_recovery": self.model_recovery_summary(job_id)?,
                    "auto_resume_next": self.next_auto_resume_tally(job_id)?,
                    "ocr_dispatch": self.latest_ocr_dispatch_for_job(job_id)?,
                    "has_pipeline_attempt": self.has_pipeline_attempt(job_id)?,
                    "has_running_pipeline_attempt": self.has_running_pipeline_attempt(job_id)?,
                    "running_stage_key": self.running_pipeline_stage_key(job_id)?,
                    "running_stage_state": self.running_pipeline_stage_state(job_id)?,
                    "event_source_version": self.event_source_version(job_id)?,
                    "event_retention_cutoff": self.event_source_retention_cutoff(job_id)?,
                }),
            )?;
        }
        for job in &jobs {
            out.emit("job_events", &job.job_id, json!(all_job_events(self, &job.job_id)?))?;
        }
        for job in &jobs {
            let job_id = job.job_id.as_str();
            let mut stages = Vec::new();
            for (attempt, stage_key) in keys.pipeline_stages.get(job_id).into_iter().flatten() {
                stages.push(json!({
                    "attempt": attempt,
                    "stage_key": stage_key,
                    "state": self.pipeline_stage_state(job_id, *attempt, stage_key)?,
                    "checkpoint": self.pipeline_checkpoint(job_id, *attempt, stage_key)?,
                    "units": self.list_pipeline_units(job_id, *attempt, stage_key)?,
                }));
            }
            let mut dispatches = Vec::new();
            for (attempt, dispatch_key) in keys.pipeline_dispatches.get(job_id).into_iter().flatten() {
                dispatches.push(json!({
                    "attempt": attempt,
                    "dispatch_key": dispatch_key,
                    "record": self.pipeline_dispatch(job_id, *attempt, dispatch_key)?,
                }));
            }
            if !stages.is_empty() || !dispatches.is_empty() {
                out.emit("job_pipeline", job_id, json!({ "stages": stages, "dispatches": dispatches }))?;
            }
        }

        // 列表和计数：查询条件（状态、流程）换了存法以后还要筛得一样、排得一样。
        let mut lists: Vec<(String, Value)> = vec![
            ("documents".into(), json!({ "total": document_total, "ids": document_order })),
            ("document_titles".into(), serde_json::to_value(self.document_titles(&documents.iter().map(|d| d.document_id.clone()).collect::<Vec<_>>())?)?),
            ("jobs".into(), json!(listed_order)),
            ("jobs_without_document".into(), json!(self.jobs_without_document()?)),
            ("resumable_pipeline_jobs".into(), json!(self.list_resumable_pipeline_job_ids()?)),
            ("stuck_queued_jobs".into(), json!(self.list_stuck_queued_job_ids()?)),
            ("unsettled_ocr_children".into(), serde_json::to_value(self.list_unsettled_ocr_children()?)?),
        ];
        for status in &STATUSES {
            let name = serde_json::to_value(status)?.as_str().unwrap_or_default().to_string();
            let with_status: Vec<String> =
                self.list_jobs_with_status(status)?.into_iter().map(|job| job.job_id.clone()).collect();
            lists.push((
                format!("jobs_with_status/{name}"),
                json!({
                    "count": self.count_jobs_with_status(status)?,
                    "jobs": with_status,
                    "process_records": self.list_job_process_records_with_status(status)?,
                }),
            ));
        }
        lists.sort_by(|a, b| a.0.cmp(&b.0));
        for (id, data) in lists {
            out.emit("list", &id, data)?;
        }

        // 标签（v37 起）。
        let mut tags = self.list_tags(None)?;
        tags.sort_by(|a, b| a.tag_id.cmp(&b.tag_id));
        for tag in tags {
            let id = tag.tag_id.clone();
            out.emit("tag", &id, serde_json::to_value(tag)?)?;
        }

        for upload_id in &keys.upload_ids {
            out.emit("upload", upload_id, serde_json::to_value(self.get_upload(upload_id)?)?)?;
        }
        Ok(out.count)
    }
}

/// 脱敏、查顺序、交出去。比对是按顺序合并两份导出，乱序就比不对，所以这里拦住。
struct OrderedSink<F> {
    sink: F,
    secrets: Vec<String>,
    last: Option<(String, String)>,
    count: usize,
}

impl<F: FnMut(DumpEntry) -> Result<()>> OrderedSink<F> {
    fn emit(&mut self, kind: &str, id: &str, data: Value) -> Result<()> {
        let key = (kind.to_string(), id.to_string());
        if let Some(last) = &self.last {
            anyhow::ensure!(*last < key, "导出顺序乱了：{last:?} 之后是 {key:?}");
        }
        self.last = Some(key);
        self.count += 1;
        (self.sink)(DumpEntry { kind: kind.to_string(), id: id.to_string(), data: scrub(data, &self.secrets) })
    }
}

fn all_job_events(db: &Db, job_id: &str) -> Result<Vec<crate::models::api::JobEventRecord>> {
    let mut events = Vec::new();
    loop {
        let page = db.list_job_events(job_id, PAGE, events.len() as u32)?;
        let done = page.len() < PAGE as usize;
        events.extend(page);
        if done {
            return Ok(events);
        }
    }
}

/// 读接口要用的编号。**改表名、拆表时改这里**（见模块说明）。
fn enumerate_keys(db: &Db) -> Result<EnumeratedKeys> {
    let conn = db.connect()?;
    let strings = |sql: &str| -> Result<Vec<String>> {
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    };
    let pairs = |sql: &str| -> Result<BTreeMap<String, Vec<(u32, String)>>> {
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as u32, row.get::<_, String>(2)?))
        })?;
        let mut map: BTreeMap<String, Vec<(u32, String)>> = BTreeMap::new();
        for row in rows {
            let (job_id, attempt, key) = row?;
            map.entry(job_id).or_default().push((attempt, key));
        }
        Ok(map)
    };
    Ok(EnumeratedKeys {
        upload_ids: strings("SELECT upload_id FROM uploads ORDER BY upload_id")?,
        feed_owners: strings("SELECT owner_job_id FROM event_feeds ORDER BY owner_job_id")?,
        pipeline_stages: pairs("SELECT job_id, attempt, stage_key FROM pipeline_stages ORDER BY job_id, attempt, stage_key")?,
        pipeline_dispatches: pairs(
            "SELECT job_id, attempt, dispatch_key FROM pipeline_dispatches ORDER BY job_id, attempt, dispatch_key",
        )?,
    })
}

/// 凭证换成指纹：凭证键的值整个换掉，别处出现的凭证原文也换掉。
fn scrub(value: Value, secrets: &[String]) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, value)| {
                    let value = match value {
                        Value::String(text) if SECRET_KEYS.contains(&key.as_str()) && !text.is_empty() => {
                            Value::String(fingerprint(&text))
                        }
                        other => scrub(other, secrets),
                    };
                    (key, value)
                })
                .collect(),
        ),
        Value::Array(items) => Value::Array(items.into_iter().map(|item| scrub(item, secrets)).collect()),
        Value::String(mut text) => {
            for secret in secrets {
                if text.contains(secret.as_str()) {
                    text = text.replace(secret.as_str(), &fingerprint(secret));
                }
            }
            Value::String(text)
        }
        other => other,
    }
}

fn fingerprint(secret: &str) -> String {
    let hex = super::documents::rows::sha256_hex(secret.as_bytes());
    format!("[secret sha256:{}]", &hex[..12])
}

// ---------------------------------------------------------------- 比对

/// 一处不同：哪条记录、哪个字段，两边的值（太长的截断）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DumpDifference {
    pub kind: String,
    pub id: String,
    /// 字段路径，例如 `snapshot.record.status`、`items[3].payload`；整条多了或少了是空。
    pub path: String,
    pub before: Option<Value>,
    pub after: Option<Value>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DumpComparison {
    pub compared: usize,
    pub ignored: usize,
    pub differences: Vec<DumpDifference>,
    /// 每类有几条不同（differences 截断时也是全的）。
    pub by_kind: BTreeMap<String, usize>,
}

/// 逐条比对两份导出（都按（类别，编号）从小到大，[`Db::dump_read_model`] 导出的就是；乱序报错）。边读边比，
/// 不把整份放进内存。`ignore` 每一项是 `类别` 或 `类别:字段路径前缀`（例如 `job:snapshot.record.runtime`），
/// 写有意变化、不该算不同的地方。`limit` 限制带回来的条数（计数照样是全的）。
pub fn compare_dumps(
    before: impl IntoIterator<Item = Result<DumpEntry>>,
    after: impl IntoIterator<Item = Result<DumpEntry>>,
    ignore: &[String],
    limit: usize,
) -> Result<DumpComparison> {
    let mut before = Ordered::new("迁移前", before.into_iter());
    let mut after = Ordered::new("迁移后", after.into_iter());
    let mut report = DumpComparison::default();
    let (mut old, mut new) = (before.next()?, after.next()?);
    loop {
        let (kind, id, found) = match (old.take(), new.take()) {
            (None, None) => return Ok(report),
            (Some(a), Some(b)) if (&a.kind, &a.id) == (&b.kind, &b.id) => {
                let mut found = Vec::new();
                diff_values(&a.data, &b.data, String::new(), &mut found);
                (old, new) = (before.next()?, after.next()?);
                (a.kind, a.id, found)
            }
            (Some(a), b) if b.as_ref().is_none_or(|b| (&a.kind, &a.id) < (&b.kind, &b.id)) => {
                (old, new) = (before.next()?, b);
                (a.kind, a.id, vec![(String::new(), Some(a.data), None)])
            }
            (a, Some(b)) => {
                (old, new) = (a, after.next()?);
                (b.kind, b.id, vec![(String::new(), None, Some(b.data))])
            }
            (Some(_), None) => unreachable!("上一支已经接住"),
        };
        if ignore.iter().any(|rule| *rule == kind) {
            report.ignored += 1;
            continue;
        }
        report.compared += 1;
        for (path, old_value, new_value) in found {
            if ignore.iter().any(|rule| ignores(rule, &kind, &path)) {
                continue;
            }
            *report.by_kind.entry(kind.clone()).or_default() += 1;
            if report.differences.len() < limit {
                report.differences.push(DumpDifference {
                    kind: kind.clone(),
                    id: id.clone(),
                    path,
                    before: old_value.map(shorten),
                    after: new_value.map(shorten),
                });
            }
        }
    }
}

/// 一份导出的读头：查顺序。
struct Ordered<I> {
    side: &'static str,
    entries: I,
    last: Option<(String, String)>,
}

impl<I: Iterator<Item = Result<DumpEntry>>> Ordered<I> {
    fn new(side: &'static str, entries: I) -> Self {
        Self { side, entries, last: None }
    }

    fn next(&mut self) -> Result<Option<DumpEntry>> {
        let Some(entry) = self.entries.next().transpose()? else { return Ok(None) };
        let key = (entry.kind.clone(), entry.id.clone());
        if let Some(last) = &self.last {
            anyhow::ensure!(*last < key, "{}的导出顺序乱了（或有重复）：{last:?} 之后是 {key:?}", self.side);
        }
        self.last = Some(key);
        Ok(Some(entry))
    }
}

fn ignores(rule: &str, kind: &str, path: &str) -> bool {
    let Some((rule_kind, prefix)) = rule.split_once(':') else { return false };
    rule_kind == kind
        && (path == prefix
            || path.strip_prefix(prefix).is_some_and(|rest| rest.starts_with('.') || rest.starts_with('[')))
}

type Found = Vec<(String, Option<Value>, Option<Value>)>;

fn diff_values(old: &Value, new: &Value, path: String, found: &mut Found) {
    if old == new {
        return;
    }
    let join = |key: &str| if path.is_empty() { key.to_string() } else { format!("{path}.{key}") };
    match (old, new) {
        (Value::Object(a), Value::Object(b)) => {
            let keys: BTreeSet<&String> = a.keys().chain(b.keys()).collect();
            for key in keys {
                match (a.get(key), b.get(key)) {
                    (Some(x), Some(y)) => diff_values(x, y, join(key), found),
                    (x, y) => found.push((join(key), x.cloned(), y.cloned())),
                }
            }
        }
        (Value::Array(a), Value::Array(b)) => {
            for i in 0..a.len().max(b.len()) {
                let at = format!("{path}[{i}]");
                match (a.get(i), b.get(i)) {
                    (Some(x), Some(y)) => diff_values(x, y, at, found),
                    (x, y) => found.push((at, x.cloned(), y.cloned())),
                }
            }
        }
        _ => found.push((path, Some(old.clone()), Some(new.clone()))),
    }
}

fn shorten(value: Value) -> Value {
    const MAX: usize = 200;
    let text = match &value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    };
    if text.chars().count() <= MAX {
        return value;
    }
    Value::String(format!("{}…（共 {} 字）", text.chars().take(MAX).collect::<String>(), text.chars().count()))
}

#[cfg(test)]
#[path = "snapshot_diff_tests.rs"]
mod tests;
