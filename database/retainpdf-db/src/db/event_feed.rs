//! Rebuildable event read models. Files are read by the caller outside the
//! transaction; source-version checks and owner checkpoints publish atomically.
use anyhow::{ensure, Result};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde_json::Value;

use super::rows::row_to_job_event;
use super::Db;
use crate::models::api::JobEventRecord;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct EventSourceVersion {
    pub job_id: String,
    /// Highest sequence ever observed, including rows later deleted.
    pub high_seq: i64,
    /// Changes for mutation/deletion or insertion behind the append watermark.
    pub revision: i64,
}

#[derive(Debug, Clone)]
pub struct SourceEvent {
    pub event_uid: String,
    pub event: JobEventRecord,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct StoredEventFeed {
    pub epoch: String,
    pub revision: i64,
    pub context: String,
    pub checkpoints: Value,
    /// Highest published sequence; zero denotes an empty, newly created feed.
    /// Retention leaves holes and does not lower this watermark.
    pub high_seq: i64,
    pub retention_cutoff: Option<String>,
}

#[derive(Debug, Clone)]
pub struct NewFeedItem {
    pub source_key: String,
    pub event_id: String,
    pub ts: String,
    /// 首次建流时排序用（整理后内容里的 `raw.source_seq`）。
    pub source_seq: Option<i64>,
    /// 来自 events 的那条原始事件（v35）：给了就不存内容，读的时候现算。
    pub source_event_uid: Option<String>,
    /// Caller must sanitize before passing durable projection payloads here.
    /// 来自 events 的条目传 None（见 `source_event_uid`）。
    pub payload: Option<Value>,
}

/// 进度流里的一条。v35 起来自 events 的条目不存整理好的内容：`payload` 是 None，`source` 是那条原始事件，
/// 内容由任务包按写进来时同一套规则现算（progress/event_feed）。来自 jsonl 文件的条目照旧带 `payload`。
#[derive(Debug, Clone, serde::Serialize)]
pub struct StoredFeedItem {
    pub seq: i64,
    pub event_id: String,
    pub payload: Option<Value>,
    pub source: Option<JobEventRecord>,
}

fn source_version(conn: &Connection, job_id: &str) -> Result<EventSourceVersion> {
    let (high_seq, revision) = conn
        .query_row(
            "SELECT high_seq, revision FROM event_source_versions WHERE job_id = ?1",
            [job_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?
        .unwrap_or((0, 0));
    Ok(EventSourceVersion {
        job_id: job_id.to_owned(),
        high_seq,
        revision,
    })
}

fn source_retention_cutoff(conn: &Connection, job_id: &str) -> Result<Option<String>> {
    conn.query_row(
        "SELECT MAX(cutoff) FROM (
             SELECT retention_cutoff AS cutoff FROM event_source_versions WHERE job_id = ?1
             UNION ALL
             SELECT retention_cutoff AS cutoff FROM event_feeds WHERE owner_job_id = ?1
             UNION ALL
             SELECT cutoff FROM event_feed_retention WHERE singleton = 1
               AND EXISTS (SELECT 1 FROM jobs WHERE job_id = ?1
                   AND status IN ('succeeded', 'failed', 'canceled'))
         )",
        [job_id],
        |row| row.get(0),
    )
    .map_err(Into::into)
}

fn load_feed(conn: &Connection, owner: &str) -> Result<Option<StoredEventFeed>> {
    let row = conn
        .query_row(
            "SELECT epoch, revision, context, checkpoints_json, high_seq, retention_cutoff
             FROM event_feeds WHERE owner_job_id = ?1",
            [owner],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .optional()?;
    row.map(
        |(epoch, revision, context, checkpoints, high_seq, retention_cutoff)| {
            Ok(StoredEventFeed {
                epoch,
                revision,
                context,
                checkpoints: serde_json::from_str(&checkpoints)?,
                high_seq,
                retention_cutoff,
            })
        },
    )
    .transpose()
}

impl Db {
    pub fn event_source_version(&self, job_id: &str) -> Result<EventSourceVersion> {
        source_version(&self.connect()?, job_id)
    }

    /// Read before importing source rows or selecting their stage basis. A
    /// source can be consumed by a parent's feed without having its own feed.
    /// Previously applied cleanup survives a later rerender to a running state.
    pub fn event_source_retention_cutoff(&self, job_id: &str) -> Result<Option<String>> {
        source_retention_cutoff(&self.connect()?, job_id)
    }

    pub fn list_event_source_after(
        &self,
        job_id: &str,
        after: i64,
        through: i64,
        limit: u32,
    ) -> Result<Vec<SourceEvent>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT job_id, seq, ts, level, stage, stage_detail, provider, provider_stage,
                    event, event_type, progress_current, progress_total, payload_json,
                    retry_count, elapsed_ms, message, event_uid
             FROM events WHERE job_id = ?1 AND seq > ?2 AND seq <= ?3
             ORDER BY seq ASC LIMIT ?4",
        )?;
        let rows = stmt.query_map(params![job_id, after, through, limit], |row| {
            Ok(SourceEvent {
                event_uid: row.get(16)?,
                event: row_to_job_event(row)?,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Into::into)
    }

    pub fn load_event_feed(&self, owner: &str) -> Result<Option<StoredEventFeed>> {
        load_feed(&self.connect()?, owner)
    }

    /// False means another publisher or a source mutation won the race. No
    /// checkpoint or item is written on conflict. Appends above the captured
    /// source high watermark are allowed: they belong to the next sync batch.
    #[allow(clippy::too_many_arguments)]
    pub fn commit_event_feed(
        &self,
        owner: &str,
        expected_revision: Option<i64>,
        epoch: &str,
        context: &str,
        checkpoints: &Value,
        items: &[NewFeedItem],
        reset: bool,
        source_versions: &[EventSourceVersion],
    ) -> Result<bool> {
        ensure!(!epoch.is_empty(), "event feed epoch must not be empty");
        // 写入用 INSERT OR IGNORE（重复的条目跳过），它也会悄悄跳过违反 CHECK 的行，所以「既没内容也没指向原始事件」在这里拦。
        ensure!(
            items.iter().all(|item| item.payload.is_some() || item.source_event_uid.is_some()),
            "event feed item needs a payload or a source event"
        );
        // Serialization can be sizeable and does not need the SQLite write lock.
        let checkpoints_json = serde_json::to_string(checkpoints)?;
        let serialized_items = items
            .iter()
            .map(|item| item.payload.as_ref().map(serde_json::to_string).transpose())
            .collect::<std::result::Result<Vec<_>, _>>()?;
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let previous = load_feed(&tx, owner)?;
        if previous.as_ref().map(|feed| feed.revision) != expected_revision {
            return Ok(false);
        }
        for expected in source_versions {
            if source_version(&tx, &expected.job_id)?.revision != expected.revision {
                return Ok(false);
            }
        }
        if let Some(previous) = &previous {
            ensure!(
                (reset && previous.epoch != epoch) || (!reset && previous.epoch == epoch),
                "event feed reset requires a new epoch"
            );
        }
        // Recheck the same policy exposed to source importers while holding the
        // transaction; it also protects feeds first built after cleanup.
        let retention_cutoff = source_retention_cutoff(&tx, owner)?;
        let revision = previous.as_ref().map_or(1, |feed| feed.revision + 1);
        let mut high_seq = if reset {
            0
        } else {
            previous.as_ref().map_or(0, |feed| feed.high_seq)
        };
        tx.execute(
            "INSERT INTO event_feeds(owner_job_id, epoch, revision, context, checkpoints_json,
                    high_seq, retention_cutoff)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(owner_job_id) DO UPDATE SET epoch = excluded.epoch,
                    revision = excluded.revision, context = excluded.context,
                    checkpoints_json = excluded.checkpoints_json,
                    high_seq = excluded.high_seq, retention_cutoff = excluded.retention_cutoff",
            params![
                owner,
                epoch,
                revision,
                context,
                checkpoints_json,
                high_seq,
                retention_cutoff
            ],
        )?;
        if reset {
            tx.execute(
                "DELETE FROM event_feed_items WHERE owner_job_id = ?1",
                [owner],
            )?;
        }
        {
            let mut insert = tx.prepare(
                "INSERT OR IGNORE INTO event_feed_items
                 (owner_job_id, seq, source_key, event_id, ts, source_seq, source_event_uid, payload_json)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            )?;
            for (item, payload_json) in items.iter().zip(serialized_items) {
                if retention_cutoff
                    .as_ref()
                    .is_some_and(|cutoff| item.ts < *cutoff)
                {
                    continue;
                }
                let inserted = insert.execute(params![
                    owner,
                    high_seq + 1,
                    item.source_key,
                    item.event_id,
                    item.ts,
                    item.source_seq,
                    item.source_event_uid,
                    payload_json,
                ])?;
                if inserted == 1 {
                    high_seq += 1;
                }
            }
        }
        let publish_initial = previous.as_ref().is_some_and(|feed| {
            feed.checkpoints
                .get("initializing")
                .and_then(Value::as_bool)
                == Some(true)
        }) && checkpoints.get("initializing").and_then(Value::as_bool)
            == Some(false);
        if publish_initial {
            // Bootstrap chunks are private while initializing. Reindex only at
            // publication, so chronological ordering does not require keeping
            // the full historical set in the caller's memory. Negative interim
            // keys avoid collisions with the (owner, seq) primary key.
            tx.execute(
                "CREATE TEMP TABLE event_feed_publish_order AS
                 SELECT source_key, ROW_NUMBER() OVER(
                     ORDER BY ts, COALESCE(source_seq, 0), event_id
                 ) AS new_seq
                 FROM event_feed_items WHERE owner_job_id = ?1",
                [owner],
            )?;
            tx.execute_batch(
                "CREATE UNIQUE INDEX event_feed_publish_order_key
                 ON event_feed_publish_order(source_key)",
            )?;
            // 只挪位置变了的行。导入顺序多半已经是最终顺序（库里的事件按序号读、时间本来就递增），以前每行都改两遍
            // 序号，28 万条要 5 秒（2026-11-04）。新序号是 1..N 的一个排列，没挪的行占着的号不会和挪的行撞。
            tx.execute(
                "UPDATE event_feed_items SET seq = -(
                     SELECT new_seq FROM event_feed_publish_order
                     WHERE event_feed_publish_order.source_key = event_feed_items.source_key
                 ) WHERE owner_job_id = ?1 AND seq <> (
                     SELECT new_seq FROM event_feed_publish_order
                     WHERE event_feed_publish_order.source_key = event_feed_items.source_key
                 )",
                [owner],
            )?;
            tx.execute(
                "UPDATE event_feed_items SET seq = -seq WHERE owner_job_id = ?1 AND seq < 0",
                [owner],
            )?;
            high_seq =
                tx.query_row("SELECT COUNT(*) FROM event_feed_publish_order", [], |row| {
                    row.get(0)
                })?;
        }
        tx.execute(
            "UPDATE event_feeds SET high_seq = ?2 WHERE owner_job_id = ?1",
            params![owner, high_seq],
        )?;
        tx.commit()?;
        Ok(true)
    }

    /// Visit unpublished bootstrap records in their eventual published order.
    /// The caller can derive bounded state without collecting historical rows;
    /// its subsequent publication must still compare-and-swap the feed revision.
    pub fn visit_event_feed_initial_order(
        &self,
        owner: &str,
        epoch: &str,
        mut visitor: impl FnMut(StoredFeedItem) -> Result<()>,
    ) -> Result<()> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let feed = load_feed(&tx, owner)?;
        ensure!(
            feed.as_ref().map(|feed| feed.epoch.as_str()) == Some(epoch),
            "event feed epoch changed"
        );
        ensure!(
            feed.as_ref()
                .and_then(|feed| feed.checkpoints.get("initializing"))
                .and_then(Value::as_bool)
                == Some(true),
            "event feed is not initializing"
        );
        // Keep this order identical to bootstrap publication above. Source
        // sequence is the tie-breaker, never the temporary insertion sequence.
        let mut stmt = tx.prepare(
            &format!(
                "SELECT ROW_NUMBER() OVER(
                     ORDER BY f.ts, COALESCE(f.source_seq, 0), f.event_id
                 ) AS final_seq, f.event_id, f.payload_json, {SOURCE_EVENT_COLUMNS}
                 FROM event_feed_items f {SOURCE_EVENT_JOIN} WHERE f.owner_job_id = ?1
                 ORDER BY f.ts, COALESCE(f.source_seq, 0), f.event_id"
            ),
        )?;
        let mut rows = stmt.query([owner])?;
        while let Some(row) = rows.next()? {
            visitor(feed_item_from_row(row)?)?;
        }
        Ok(())
    }

    pub fn read_event_feed_page(
        &self,
        owner: &str,
        epoch: &str,
        after: i64,
        through: i64,
        limit: u32,
    ) -> Result<Vec<StoredFeedItem>> {
        self.read_event_feed_rows(owner, epoch, after, through, limit, false)
    }

    /// Select the latest existing records, not `high_seq - limit`: retention
    /// may leave holes in an otherwise monotonic published sequence.
    pub fn read_event_feed_tail(
        &self,
        owner: &str,
        epoch: &str,
        through: i64,
        limit: u32,
    ) -> Result<Vec<StoredFeedItem>> {
        self.read_event_feed_rows(owner, epoch, 0, through, limit, true)
    }

    fn read_event_feed_rows(
        &self,
        owner: &str,
        epoch: &str,
        after: i64,
        through: i64,
        limit: u32,
        tail: bool,
    ) -> Result<Vec<StoredFeedItem>> {
        let mut conn = self.connect()?;
        // The epoch check and rows must be read from the same SQLite snapshot.
        let tx = conn.transaction()?;
        let current_epoch: Option<String> = tx
            .query_row(
                "SELECT epoch FROM event_feeds WHERE owner_job_id = ?1",
                [owner],
                |row| row.get(0),
            )
            .optional()?;
        ensure!(
            current_epoch.as_deref() == Some(epoch),
            "event feed epoch changed"
        );
        let sql = if tail {
            format!(
                "SELECT * FROM (
                     SELECT f.seq, f.event_id, f.payload_json, {SOURCE_EVENT_COLUMNS}
                     FROM event_feed_items f {SOURCE_EVENT_JOIN}
                     WHERE f.owner_job_id = ?1 AND f.seq > ?2 AND f.seq <= ?3
                     ORDER BY f.seq DESC LIMIT ?4
                 ) ORDER BY 1 ASC"
            )
        } else {
            format!(
                "SELECT f.seq, f.event_id, f.payload_json, {SOURCE_EVENT_COLUMNS}
                 FROM event_feed_items f {SOURCE_EVENT_JOIN}
                 WHERE f.owner_job_id = ?1 AND f.seq > ?2 AND f.seq <= ?3
                 ORDER BY f.seq ASC LIMIT ?4"
            )
        };
        let mut stmt = tx.prepare(&sql)?;
        let mut rows = stmt.query(params![owner, after, through, limit])?;
        let mut items = Vec::new();
        while let Some(row) = rows.next()? {
            items.push(feed_item_from_row(row)?);
        }
        Ok(items)
    }
}

/// 进度流条目连上它的原始事件（v35）。`e.event_uid <> ''` 让 SQLite 用得上 events 上的部分唯一索引 `idx_events_uid`。
const SOURCE_EVENT_JOIN: &str =
    "LEFT JOIN events e ON f.source_event_uid IS NOT NULL AND e.event_uid = f.source_event_uid AND e.event_uid <> ''";
/// 原始事件的列，顺序同 `rows::row_to_job_event`；在结果里从第 4 列（下标 3）起。
const SOURCE_EVENT_COLUMNS: &str = "e.job_id, e.seq, e.ts, e.level, e.stage, e.stage_detail, e.provider, e.provider_stage,
     e.event, e.event_type, e.progress_current, e.progress_total, e.payload_json, e.retry_count, e.elapsed_ms, e.message";

/// 一行（seq, event_id, payload_json, 原始事件的列…）变成条目。没存内容、原始事件也没了（读的同时被保留期删掉），
/// 按「事件流变了」报：调用方当游标过期处理，前端从头重读，下一次同步会因为来源的 revision 变了而重建。
fn feed_item_from_row(row: &rusqlite::Row<'_>) -> Result<StoredFeedItem> {
    let payload: Option<String> = row.get(2)?;
    let source = match row.get::<_, Option<String>>(3)? {
        Some(_) => Some(super::rows::row_to_job_event_at(row, 3)?),
        None => None,
    };
    ensure!(payload.is_some() || source.is_some(), "event feed epoch changed: source event expired");
    Ok(StoredFeedItem {
        seq: row.get(0)?,
        event_id: row.get(1)?,
        payload: payload.map(|text| serde_json::from_str(&text)).transpose()?,
        source,
    })
}

#[cfg(test)]
#[path = "event_feed_tests.rs"]
mod tests;
