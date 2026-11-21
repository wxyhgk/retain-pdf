//! Request-scoped inputs for validating many live-stage projections together.
//! A short read transaction captures owners, direct OCR children, source clocks,
//! authority and feeds; no event history or filesystem work occurs in it.
use std::collections::HashMap;

use anyhow::Result;
use rusqlite::{Connection, Row};

use super::rows::{row_to_job_snapshot, JOB_SELECT_SQL};
use super::{Db, EventSourceVersion, StoredEventFeed};
use crate::models::domain::JobSnapshot;

#[derive(Debug)]
pub struct EventProjectionInput {
    pub job: JobSnapshot,
    pub version: EventSourceVersion,
    pub has_pipeline_attempt: bool,
    pub retention_cutoff: Option<String>,
    pub feed: Option<StoredEventFeed>,
}

#[cfg(test)]
thread_local! { static QUERIES: std::cell::Cell<usize> = const { std::cell::Cell::new(0) }; }

fn decode_input(row: &Row<'_>, job: JobSnapshot) -> Result<EventProjectionInput> {
    let feed = row
        .get::<_, Option<String>>(25)?
        .map(|epoch| {
            Ok::<_, anyhow::Error>(StoredEventFeed {
                epoch,
                revision: row.get(26)?,
                context: row.get(27)?,
                checkpoints: serde_json::from_str(&row.get::<_, String>(28)?)?,
                high_seq: row.get(29)?,
                retention_cutoff: row.get(30)?,
            })
        })
        .transpose()?;
    Ok(EventProjectionInput {
        version: EventSourceVersion {
            job_id: job.job_id.clone(),
            high_seq: row.get(21)?,
            revision: row.get(22)?,
        },
        job,
        has_pipeline_attempt: row.get(23)?,
        retention_cutoff: row.get(24)?,
        feed,
    })
}

fn read_inputs(conn: &Connection, ids: &[&str]) -> Result<HashMap<String, EventProjectionInput>> {
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let sql = format!(
        "SELECT candidates.*, COALESCE(source.high_seq, 0), COALESCE(source.revision, 0),
            EXISTS(SELECT 1 FROM pipeline_attempts WHERE job_id = candidates.job_id),
            (SELECT MAX(cutoff) FROM (
                SELECT source.retention_cutoff AS cutoff
                UNION ALL SELECT feed.retention_cutoff
                UNION ALL SELECT cutoff FROM event_feed_retention WHERE singleton = 1
                    AND candidates.status IN ('succeeded', 'failed', 'canceled')
            )),
            feed.epoch, feed.revision, feed.context, feed.checkpoints_json,
            feed.high_seq, feed.retention_cutoff
         FROM ({JOB_SELECT_SQL} WHERE jobs.job_id IN (SELECT value FROM json_each(?1))) candidates
         LEFT JOIN event_source_versions source ON source.job_id = candidates.job_id
         LEFT JOIN event_feeds feed ON feed.owner_job_id = candidates.job_id"
    );
    #[cfg(test)]
    QUERIES.with(|queries| queries.set(queries.get() + 1));
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query([serde_json::to_string(ids)?])?;
    let mut inputs = HashMap::new();
    while let Some(row) = rows.next()? {
        // A malformed child job is absent, just as get_job would fail. Broken
        // projection metadata instead aborts the fast path so callers retry
        // through the normal per-owner path, without silently omitting events.
        if let Ok(job) = row_to_job_snapshot(row) {
            let input = decode_input(row, job)?;
            inputs.insert(input.job.job_id.clone(), input);
        }
    }
    Ok(inputs)
}

impl Db {
    /// At most two bound queries, independent of page size. The second reads
    /// direct child jobs only; it does not recursively traverse their children.
    pub fn load_event_projection_inputs(
        &self,
        owner_ids: &[&str],
    ) -> Result<HashMap<String, EventProjectionInput>> {
        if owner_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let mut inputs = read_inputs(&tx, owner_ids)?;
        let children: Vec<_> = inputs
            .values()
            .filter_map(|input| {
                input
                    .job
                    .artifacts
                    .as_ref()?
                    .ocr_job_id
                    .as_deref()
                    .filter(|id| !id.is_empty() && !inputs.contains_key(*id))
            })
            .collect();
        let child_inputs = read_inputs(&tx, &children)?;
        inputs.extend(child_inputs);
        tx.commit()?;
        Ok(inputs)
    }
}

#[cfg(test)]
#[path = "event_projection_inputs_tests.rs"]
mod tests;
