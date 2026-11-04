use crate::progress::live_stage::{canonicalize_job_event, compact_stage_basis, parse_feed_line};
use super::files::{self, SourceFile};
use retainpdf_data::db::{Db, EventProjectionInput, EventSourceVersion, NewFeedItem, StoredEventFeed};
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::{redact_json_value, redact_text, sensitive_values, JobEventRecord};
use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_core::storage_paths::resolve_events_jsonl;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;

const CHUNK: u32 = 1024;
/// 第一次建事件流（或作废后重建）时每批读多少条。建的过程中事件流不对外，分批只为不把整份历史放进内存；
/// 每批提交都要把乱序的 `event_id` 索引弄脏的页写一遍，批太小就写很多遍：28 万条事件 1024 一批要 275 次提交，
/// release 构建 46 秒，16384 一批 21 秒（2026-11-04）。之后的增量同步照旧 1024 一批。
pub(super) const INITIAL_CHUNK: u32 = 16384;
// 导入规则一变就要加一：版本进了 context 摘要，旧投影会整体重建，
// 否则已经导入的事件（比如 v2 混进来的子任务终态）会永远留在里面。
// v3：OCR 子任务的生命周期/终态事件不再导入父任务事件流。
const CANONICAL_VERSION: u32 = 3;

#[derive(Default, Clone, Serialize, Deserialize)]
pub(super) struct DbCheckpoint {
    revision: i64,
    after: i64,
}

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(default)]
pub(super) struct Checkpoints {
    pub initializing: bool,
    db: BTreeMap<String, DbCheckpoint>,
    files: BTreeMap<String, files::Checkpoint>,
    pub stage_basis: Vec<JobEventRecord>,
    retention_cutoff: Option<String>,
}

struct Sources {
    jobs: Vec<JobSnapshot>,
    versions: Vec<EventSourceVersion>,
    files: BTreeMap<String, SourceFile>,
    authority: BTreeMap<String, bool>,
    cutoffs: BTreeMap<String, Option<String>>,
    context: String,
}

fn sources(db: &Db, root: &Path, owner: &JobSnapshot) -> Result<Sources, AppError> {
    let mut jobs = vec![owner.clone()];
    if let Some(child_id) = owner
        .artifacts
        .as_ref()
        .and_then(|a| a.ocr_job_id.as_deref())
        .filter(|id| !id.is_empty() && *id != owner.job_id)
    {
        if let Ok(child) = db.get_job(child_id) {
            jobs.push(child);
        }
    }
    let mut versions = Vec::new();
    let mut authority = BTreeMap::new();
    let mut cutoffs = BTreeMap::new();
    for job in &jobs {
        versions.push(db.event_source_version(&job.job_id)?);
        let durable = db.has_pipeline_attempt(&job.job_id)?;
        let cutoff = db.event_source_retention_cutoff(&job.job_id)?;
        cutoffs.insert(job.job_id.clone(), cutoff.clone());
        authority.insert(job.job_id.clone(), durable);
    }
    describe_sources(root, jobs, versions, authority, cutoffs)
}

fn describe_sources(
    root: &Path,
    jobs: Vec<JobSnapshot>,
    versions: Vec<EventSourceVersion>,
    authority: BTreeMap<String, bool>,
    cutoffs: BTreeMap<String, Option<String>>,
) -> Result<Sources, AppError> {
    let mut files = BTreeMap::new();
    let mut contexts = Vec::new();
    for job in &jobs {
        let path = resolve_events_jsonl(job, root).filter(|path| {
            path.file_name()
                .is_some_and(|name| name == "pipeline_events.jsonl")
        });
        if let Some(path) = path {
            let key = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .into_owned();
            if !files.contains_key(&key) {
                if let Some(file) = files::inspect(path)? {
                    files.insert(key, file);
                }
            }
        }
        // Hash context, never persist request credentials as cache metadata.
        contexts.push(json!([
            job.job_id,
            job.workflow,
            job.status,
            job.failure,
            job.error,
            job.request_payload,
            authority.get(&job.job_id),
            cutoffs.get(&job.job_id).cloned().flatten(),
            job.artifacts.as_ref().map(|a| (&a.job_root, &a.ocr_job_id))
        ]));
    }
    let context = files::digest(
        &serde_json::to_vec(&json!([
            CANONICAL_VERSION,
            contexts,
            files.keys().collect::<Vec<_>>()
        ]))
        .map_err(anyhow::Error::from)?,
    );
    Ok(Sources {
        jobs,
        versions,
        files,
        authority,
        cutoffs,
        context,
    })
}

/// A request-local fast path, not a time-based cache. All DB inputs were read
/// in one snapshot; files are inspected after that transaction is released.
/// Any difference falls back to the existing synchronized/CAS-protected path.
pub(super) fn cached_stage_basis(
    root: &Path,
    owner_id: &str,
    inputs: &HashMap<String, EventProjectionInput>,
) -> Result<Option<Vec<JobEventRecord>>, AppError> {
    let Some(owner) = inputs.get(owner_id) else {
        return Ok(None);
    };
    let mut selected = vec![owner];
    if let Some(child) = owner
        .job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.ocr_job_id.as_deref())
        .filter(|id| !id.is_empty() && *id != owner_id)
        .and_then(|id| inputs.get(id))
    {
        selected.push(child);
    }
    let sources = describe_sources(
        root,
        selected.iter().map(|input| input.job.clone()).collect(),
        selected.iter().map(|input| input.version.clone()).collect(),
        selected
            .iter()
            .map(|input| (input.job.job_id.clone(), input.has_pipeline_attempt))
            .collect(),
        selected
            .iter()
            .map(|input| (input.job.job_id.clone(), input.retention_cutoff.clone()))
            .collect(),
    )?;
    let Some(feed) = &owner.feed else {
        // Nothing has ever been emitted. Lists need no empty durable feed;
        // /events will create its epoch when a cursor is actually requested.
        return Ok(
            (sources.files.is_empty() && sources.versions.iter().all(|v| v.high_seq == 0))
                .then(Vec::new),
        );
    };
    let Ok(checkpoints) = serde_json::from_value::<Checkpoints>(feed.checkpoints.clone()) else {
        return Ok(None);
    };
    if checkpoints.initializing
        || feed.context != sources.context
        || checkpoints.retention_cutoff != owner.retention_cutoff
        || sources.versions.iter().any(|version| {
            !checkpoints
                .db
                .get(&version.job_id)
                .is_some_and(|checkpoint| {
                    checkpoint.revision == version.revision && checkpoint.after == version.high_seq
                })
        })
        || sources.files.iter().any(|(key, source)| {
            !checkpoints.files.get(key).is_some_and(|checkpoint| {
                checkpoint.identity == source.identity
                    && checkpoint.size == source.size
                    && checkpoint.modified == source.modified
                    && checkpoint.offset <= source.size
            })
        })
    {
        return Ok(None);
    }
    Ok(Some(checkpoints.stage_basis))
}

pub(super) fn synchronize(
    db: &Db,
    root: &Path,
    owner: &JobSnapshot,
) -> Result<StoredEventFeed, AppError> {
    let started = std::time::Instant::now();
    for _ in 0..8 {
        let current_owner = db.get_job(&owner.job_id)?;
        let sources = sources(db, root, &current_owner)?;
        if let Some(feed) = synchronize_snapshot(db, root, &current_owner, &sources)? {
            tracing::debug!(job_id = %owner.job_id, elapsed_ms = started.elapsed().as_millis() as u64,
                high_seq = feed.high_seq, "event projection synchronized");
            return Ok(feed);
        }
    }
    Err(AppError::service_unavailable(
        "event sources are changing; retry the read",
    ))
}

fn synchronize_snapshot(
    db: &Db,
    root: &Path,
    owner: &JobSnapshot,
    sources: &Sources,
) -> Result<Option<StoredEventFeed>, AppError> {
    let secrets = sources
        .jobs
        .iter()
        .flat_map(|job| sensitive_values(&job.request_payload))
        .collect::<Vec<_>>();
    let mut stored = db.load_event_feed(&owner.job_id)?;
    let mut checkpoints: Checkpoints = stored
        .as_ref()
        .and_then(|s| serde_json::from_value(s.checkpoints.clone()).ok())
        .unwrap_or_default();
    let cutoff = sources.cutoffs.get(&owner.job_id).cloned().flatten();
    let mut reset = stored
        .as_ref()
        .is_some_and(|s| s.context != sources.context)
        || checkpoints.retention_cutoff != cutoff;
    for version in &sources.versions {
        if checkpoints
            .db
            .get(&version.job_id)
            .is_some_and(|previous| previous.revision != version.revision)
        {
            reset = true;
        }
    }
    for (key, source) in &sources.files {
        if let Some(previous) = checkpoints.files.get(key) {
            if files::changed(source, previous)? {
                reset = true;
            }
        }
    }
    if reset || stored.is_none() {
        tracing::debug!(job_id = %owner.job_id, rebuilding = reset, "event projection initialization");
        // Keep incarnations of unchanged physical files during DB/context-only
        // rebuilds so event identities survive resets.
        let mut preserved = BTreeMap::new();
        for (key, source) in &sources.files {
            if let Some(previous) = checkpoints.files.get(key) {
                if !files::changed(source, previous)? {
                    preserved.insert(
                        key.clone(),
                        files::Checkpoint {
                            incarnation: previous.incarnation.clone(),
                            ..Default::default()
                        },
                    );
                }
            }
        }
        checkpoints = Checkpoints {
            initializing: true,
            files: preserved,
            retention_cutoff: cutoff,
            ..Default::default()
        };
    }
    let mut epoch = if reset || stored.is_none() {
        format!("{:032x}", fastrand::u128(..))
    } else {
        stored.as_ref().unwrap().epoch.clone()
    };
    loop {
        let chunk = if checkpoints.initializing { INITIAL_CHUNK } else { CHUNK };
        let before = serde_json::to_value(&checkpoints).map_err(anyhow::Error::from)?;
        let mut records: Vec<(String, JobEventRecord)> = Vec::new();
        let mut more = false;
        for version in &sources.versions {
            let checkpoint = checkpoints.db.entry(version.job_id.clone()).or_default();
            checkpoint.revision = version.revision;
            if checkpoint.after < version.high_seq {
                let batch = db.list_event_source_after(
                    &version.job_id,
                    checkpoint.after,
                    version.high_seq,
                    chunk,
                )?;
                let count = batch.len();
                for row in batch {
                    checkpoint.after = checkpoint.after.max(row.event.seq);
                    records.push((
                        format!("db:{}:{}", version.job_id, row.event_uid),
                        row.event,
                    ));
                }
                if count < chunk as usize {
                    checkpoint.after = version.high_seq;
                }
                more |= checkpoint.after < version.high_seq;
            }
        }
        for (key, source) in &sources.files {
            let checkpoint = checkpoints.files.entry(key.clone()).or_default();
            if checkpoint.incarnation.is_empty() {
                checkpoint.incarnation = format!("{:032x}", fastrand::u128(..));
            }
            let (lines, pending) = files::read_batch(source, checkpoint, chunk as usize)?;
            more |= pending;
            for (offset, line_number, line) in lines {
                if line.trim().is_empty() {
                    continue;
                }
                let value: Value = match serde_json::from_str(&line) {
                    Ok(value) => value,
                    Err(_) => {
                        tracing::warn!(line = line_number, "malformed event line skipped");
                        continue;
                    }
                };
                let source_id = value
                    .get("job_id")
                    .and_then(Value::as_str)
                    .filter(|id| !id.is_empty())
                    .unwrap_or(&owner.job_id);
                if !sources.authority.contains_key(source_id) {
                    continue;
                }
                if sources.authority[source_id]
                    && value.get("schema").and_then(Value::as_str)
                        == Some("pipeline_stage_observation_v1")
                    && matches!(
                        value
                            .get("event")
                            .or_else(|| value.get("event_type"))
                            .and_then(Value::as_str),
                        Some("stage_transition" | "stage_progress")
                    )
                {
                    continue;
                }
                if let Some(event) = parse_feed_line(source_id, &source.path, &line, line_number) {
                    records.push((
                        format!("jsonl:{source_id}:{}:{offset}", checkpoint.incarnation),
                        event,
                    ));
                }
            }
        }
        records.sort_by(|a, b| {
            a.1.ts
                .cmp(&b.1.ts)
                .then_with(|| a.1.seq.cmp(&b.1.seq))
                .then_with(|| a.0.cmp(&b.0))
        });
        let mut new_items = Vec::with_capacity(records.len());
        let mut basis = checkpoints.stage_basis.clone();
        let base = if reset {
            0
        } else {
            stored.as_ref().map(|s| s.high_seq).unwrap_or(0)
        };
        for (source_key, mut event) in records {
            if checkpoints
                .retention_cutoff
                .as_deref()
                .is_some_and(|cutoff| event.ts.as_str() < cutoff)
            {
                continue;
            }
            if sources
                .cutoffs
                .get(&event.job_id)
                .and_then(|cutoff| cutoff.as_deref())
                .is_some_and(|cutoff| event.ts.as_str() < cutoff)
            {
                continue;
            }
            if event.job_id != owner.job_id && is_ocr_child_lifecycle_event(&event) {
                continue;
            }
            sanitize(&mut event, &secrets);
            let source_id = event.job_id.clone();
            let kind = if source_id != owner.job_id {
                "ocr_child"
            } else if source_key.starts_with("db:") {
                // This is presentation metadata only, not the trusted key.
                if event
                    .payload
                    .as_ref()
                    .and_then(|p| p.get("authority"))
                    .is_some()
                {
                    "pipeline_state"
                } else {
                    "db"
                }
            } else {
                "pipeline_jsonl"
            };
            if source_id != owner.job_id {
                event.job_id = owner.job_id.clone();
                event.payload = Some(
                    json!({"raw_source_kind":"ocr_child", "source_job_id":source_id, "source_event":event.payload.take()}),
                );
            }
            canonicalize_job_event(&mut event, kind);
            event.seq = base + new_items.len() as i64 + 1;
            basis.push(event.clone());
            let event_id = files::digest(format!("{}\0{source_key}", owner.job_id).as_bytes());
            new_items.push(NewFeedItem {
                source_key,
                event_id,
                ts: event.ts.clone(),
                payload: serde_json::to_value(event).map_err(anyhow::Error::from)?,
            });
        }
        checkpoints.stage_basis = compact_stage_basis(&basis);
        // Sources may be appended while we read the captured upper bound,
        // but replacing/truncating a file must never publish mixed identities.
        for source in sources.files.values() {
            let Some(current) = files::inspect(source.path.clone())? else {
                return Ok(None);
            };
            if current.identity != source.identity
                || current.size < source.size
                || (current.size == source.size && current.modified != source.modified)
            {
                return Ok(None);
            }
        }
        let after = serde_json::to_value(&checkpoints).map_err(anyhow::Error::from)?;
        if reset || stored.is_none() || before != after || !new_items.is_empty() {
            tracing::debug!(job_id = %owner.job_id, imported_events = new_items.len(), "publishing event projection batch");
            let committed_revision = stored.as_ref().map_or(1, |s| s.revision + 1);
            let committed = db.commit_event_feed(
                &owner.job_id,
                stored.as_ref().map(|s| s.revision),
                &epoch,
                &sources.context,
                &after,
                &new_items,
                reset,
                &sources.versions,
            )?;
            if !committed {
                return Ok(None);
            }
            stored = db.load_event_feed(&owner.job_id)?;
            // Another process may have advanced/reset this feed between our
            // commit and reload. Never combine its revision with our older
            // checkpoints and then overwrite its progress on the next batch.
            if stored.as_ref().map(|feed| feed.revision) != Some(committed_revision) {
                return Ok(None);
            }
            reset = false;
            if let Some(feed) = &stored {
                epoch = feed.epoch.clone();
            }
        }
        if more {
            continue;
        }
        if checkpoints.initializing {
            // Bootstrap reorders delivery positions at publication. Rebuild
            // the sufficient statistics using that exact order: compacting
            // temporary import positions can discard the winning event when
            // timestamps tie across sources or chunk boundaries.
            let mut basis = Vec::new();
            let visited = db.visit_event_feed_initial_order(&owner.job_id, &epoch, |row| {
                let mut event: JobEventRecord = serde_json::from_value(row.payload)?;
                event.seq = row.seq;
                basis.push(event);
                if basis.len() >= CHUNK as usize {
                    basis = compact_stage_basis(&basis);
                }
                Ok(())
            });
            if let Err(error) = visited {
                if matches!(
                    error.to_string().as_str(),
                    "event feed epoch changed" | "event feed is not initializing"
                ) {
                    return Ok(None);
                }
                return Err(error.into());
            }
            checkpoints.stage_basis = compact_stage_basis(&basis);
            checkpoints.initializing = false;
            let committed_revision = stored.as_ref().map_or(1, |s| s.revision + 1);
            let committed = db.commit_event_feed(
                &owner.job_id,
                stored.as_ref().map(|s| s.revision),
                &epoch,
                &sources.context,
                &serde_json::to_value(&checkpoints).map_err(anyhow::Error::from)?,
                &[],
                false,
                &sources.versions,
            )?;
            if !committed {
                return Ok(None);
            }
            stored = db.load_event_feed(&owner.job_id)?;
            if stored.as_ref().map(|feed| feed.revision) != Some(committed_revision) {
                return Ok(None);
            }
        }
        let current_owner = db.get_job(&owner.job_id)?;
        if self::sources(db, root, &current_owner)?.context != sources.context {
            return Ok(None);
        }
        return Ok(stored);
    }
}

/// OCR 子任务里只描述「子任务这一行自己的生命周期」的事件，不导入父任务。
///
/// 导入子任务事件是为了让父任务在 OCR 期间有细粒度进度（第 n/m 页）。但子任务
/// 的建档、状态切换、终态和「任务完成」说的是子任务，改写成父任务的 job_id 后
/// 读起来就是父任务自己完成/失败了——前端把 `job_terminal` 标红，翻译还没开始就
/// 出现「任务完成」。父任务的 OCR 收尾由它自己的事件交代：
/// - `ocr_child_finished`（translation_flow_stage.rs::record_ocr_child_finished），
/// - 子任务失败时，父任务落 failed 会带上子任务的 error，派生出自己的
///   `job_error` / `failure_classified` / `job_terminal`。
fn is_ocr_child_lifecycle_event(event: &JobEventRecord) -> bool {
    let name = event.event.trim();
    if matches!(
        name,
        "job_created" | "status_changed" | "job_terminal" | "pipeline_attempt_terminal"
    ) || matches!(
        event.event_type.as_deref().map(str::trim),
        Some("job_created" | "status_changed" | "job_terminal" | "pipeline_attempt_terminal")
    ) {
        return true;
    }
    matches!(
        event.stage.as_deref().map(str::trim),
        Some("finished" | "failed" | "canceled")
    )
}

fn sanitize(event: &mut JobEventRecord, secrets: &[String]) {
    // Full serialized record sanitization also covers raw metadata/provider
    // fields; never materialize an additional durable credential copy.
    if let Ok(mut value) = serde_json::to_value(&*event) {
        if let Some(object) = value.as_object_mut() {
            object.insert("user_stage".into(), json!(event.user_stage));
            object.insert("progress_current".into(), json!(event.progress_current));
            object.insert("progress_total".into(), json!(event.progress_total));
            object.insert("progress_unit".into(), json!(event.progress_unit));
        }
        if let Ok(redacted) = serde_json::from_value(redact_json_value(&value, secrets)) {
            *event = redacted;
        }
    }
    event.message = redact_text(&event.message, secrets);
}
