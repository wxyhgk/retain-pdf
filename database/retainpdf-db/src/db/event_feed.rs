//! Rebuildable event read models. Files are read by the caller outside the
//! transaction; source-version checks and owner checkpoints publish atomically.
use anyhow::{ensure, Result};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde_json::Value;

use super::rows::row_to_job_event;
use super::Db;
use crate::models::api::JobEventRecord;

#[derive(Debug, Clone, PartialEq, Eq)]
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

#[derive(Debug, Clone)]
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
    /// Caller must sanitize before passing durable projection payloads here.
    pub payload: Value,
}

#[derive(Debug, Clone)]
pub struct StoredFeedItem {
    pub seq: i64,
    pub event_id: String,
    pub payload: Value,
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
                   AND status_json IN ('\"succeeded\"', '\"failed\"', '\"canceled\"'))
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
        // Serialization can be sizeable and does not need the SQLite write lock.
        let checkpoints_json = serde_json::to_string(checkpoints)?;
        let serialized_items = items
            .iter()
            .map(|item| serde_json::to_string(&item.payload))
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
                 (owner_job_id, seq, source_key, event_id, ts, payload_json)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6)",
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
                     ORDER BY ts, COALESCE(json_extract(payload_json, '$.raw.source_seq'), 0), event_id
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
            "SELECT ROW_NUMBER() OVER(
                 ORDER BY ts, COALESCE(json_extract(payload_json, '$.raw.source_seq'), 0), event_id
             ) AS final_seq, event_id, payload_json
             FROM event_feed_items WHERE owner_job_id = ?1
             ORDER BY ts, COALESCE(json_extract(payload_json, '$.raw.source_seq'), 0), event_id",
        )?;
        let mut rows = stmt.query([owner])?;
        while let Some(row) = rows.next()? {
            let payload: String = row.get(2)?;
            visitor(StoredFeedItem {
                seq: row.get(0)?,
                event_id: row.get(1)?,
                payload: serde_json::from_str(&payload)?,
            })?;
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
            "SELECT seq, event_id, payload_json FROM (
                 SELECT seq, event_id, payload_json FROM event_feed_items
                 WHERE owner_job_id = ?1 AND seq > ?2 AND seq <= ?3
                 ORDER BY seq DESC LIMIT ?4
             ) ORDER BY seq ASC"
        } else {
            "SELECT seq, event_id, payload_json FROM event_feed_items
             WHERE owner_job_id = ?1 AND seq > ?2 AND seq <= ?3
             ORDER BY seq ASC LIMIT ?4"
        };
        let mut stmt = tx.prepare(sql)?;
        let rows = stmt.query_map(params![owner, after, through, limit], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        rows.map(|row| {
            let (seq, event_id, payload) = row?;
            Ok(StoredFeedItem {
                seq,
                event_id,
                payload: serde_json::from_str(&payload)?,
            })
        })
        .collect()
    }
}

#[cfg(test)]
#[path = "event_feed_tests.rs"]
mod tests;
