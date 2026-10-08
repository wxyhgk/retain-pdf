//! 已提交译文的修订登记。
//!
//! 单块修订(PATCH translation/items/:item_id)由 Python 原子改写页文件和
//! checkpoint,不经过 worker stdout,数据库里登记的还是修订前的 page_hash。这里把
//! 修订后的页登记成持久状态,让实时译文读模型、页快照和提交事件流看到新文本。
//!
//! # 不新开 attempt
//!
//! 修订不是一次 pipeline 执行:没有 worker、没有阶段推进,任务状态也不该变。新开
//! attempt 会让任务多一轮 `pipeline_attempt_started/terminal`,attempt 号被占掉一个,
//! 中途崩溃还会留下一个 running attempt 被启动恢复当成可续跑的任务;失败任务上的
//! 那个 attempt 也说不清该落 succeeded 还是 failed。
//!
//! 所以这里在**该页当前生效的那一行**上原地推进:实时译文按
//! `attempt DESC, generation DESC` 取每页最新一行(`latest_pipeline_unit_for_page`),
//! 就推进那一行的 page_hash / producer_generation,并把它所在 attempt 的 generation
//! 加一作为这一行的新 generation。前端按 (attempt, generation) 判断新旧,同一 attempt
//! 内 generation 单调增,新快照自然胜出。attempt 的 status / finished_at 不动。
//!
//! # 不碰 running attempt
//!
//! generation 是 worker 的 fencing token。页的最新一行属于正在跑的 attempt 时,推进
//! 它的 generation 会让 worker 下一次提交因 stale cursor 失败;而且那一页此刻归
//! worker 所有,它会自己提交。这种页跳过(`running_attempt`)。
//!
//! # 幂等与单调
//!
//! 调用方从 checkpoint 读出「应当登记的状态」后调用,可以重复调用、乱序调用:
//! hash 已一致的跳过(`current`),数据库里已有更新 producer_generation 的跳过
//! (`superseded`)。两次修订的登记交错时,后到的旧状态不会覆盖先到的新状态。

use std::collections::HashMap;

use anyhow::{bail, Result};
use rusqlite::{params, OptionalExtension, Transaction, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::events::append_state_event;
use super::tx::{validate_identity, validate_sha256, ATTEMPT_RUNNING};
use crate::db::Db;
use crate::models::domain::now_iso;

/// 修订后某一页应当登记的状态(取自 Python 写好的 checkpoint)。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RevisedTranslationPage {
    pub page_index: u32,
    pub page_hash: String,
    /// checkpoint 的 generation;快照在 `generation-{producer_generation}/` 下。
    pub producer_generation: u64,
    /// 该页从没登记过时新建行用的 unit 身份;已有行时沿用已有的。
    pub unit_key: String,
    pub unit_order: u64,
    pub changed_item_ids: Vec<String>,
    pub revision_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RevisedPageStatus {
    /// 这次登记了新 page_hash,并追加了一条提交事件。
    Published,
    /// 数据库里已经是这个 page_hash。
    Current,
    /// 数据库里已有更新的 producer_generation(更晚的修订或翻译已经登记)。
    Superseded,
    /// 该页最新一行属于 running attempt,归 worker 所有。
    RunningAttempt,
    /// 任务没有任何 translate 阶段的持久记录(老任务),没有可挂靠的 attempt。
    NoDurableAttempt,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RevisedPagePublication {
    pub page_index: u32,
    pub page_hash: String,
    pub status: RevisedPageStatus,
    /// 生效行所在的 attempt 与 generation(`no_durable_attempt` 时为空)。
    pub attempt: Option<u32>,
    pub generation: Option<u64>,
}

const TRANSLATE_STAGE: &str = "translate";

#[cfg(test)]
#[path = "revisions_tests.rs"]
mod tests;

struct CurrentRow {
    attempt: i64,
    unit_key: String,
    unit_order: i64,
    generation: i64,
    producer_generation: Option<i64>,
    page_hash: String,
    attempt_status: String,
}

impl Db {
    /// 把修订后的页登记进实时译文读模型。一个事务内完成全部页:要么都可见,要么
    /// 都不可见。返回每页的结果,顺序与入参一致。
    pub fn publish_translation_revision(
        &self,
        job_id: &str,
        pages: &[RevisedTranslationPage],
    ) -> Result<Vec<RevisedPagePublication>> {
        validate_identity("job_id", job_id)?;
        let mut seen = std::collections::HashSet::new();
        for page in pages {
            validate_sha256("page_hash", &page.page_hash)?;
            validate_identity("unit_key", &page.unit_key)?;
            if page.producer_generation > i64::MAX as u64 || page.unit_order > i64::MAX as u64 {
                bail!("revised page generation/order exceeds SQLite INTEGER range");
            }
            if !seen.insert(page.page_index) {
                bail!("revised pages contain page {} more than once", page.page_index);
            }
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let timestamp = now_iso();
        // 同一事务里一个 attempt 只推进一次 generation,同批各页共享它。
        let mut bumped: HashMap<i64, i64> = HashMap::new();
        let mut results = Vec::with_capacity(pages.len());
        for page in pages {
            results.push(publish_page(&tx, job_id, page, &timestamp, &mut bumped)?);
        }
        tx.commit()?;
        Ok(results)
    }
}

fn publish_page(
    tx: &Transaction<'_>,
    job_id: &str,
    page: &RevisedTranslationPage,
    timestamp: &str,
    bumped: &mut HashMap<i64, i64>,
) -> Result<RevisedPagePublication> {
    let result = |status, attempt: Option<i64>, generation: Option<i64>| RevisedPagePublication {
        page_index: page.page_index,
        page_hash: page.page_hash.clone(),
        status,
        attempt: attempt.map(|value| value as u32),
        generation: generation.map(|value| value as u64),
    };
    let incoming_generation = page.producer_generation as i64;
    // 与 latest_pipeline_unit_for_page 同一个排序:登记的必须正是读模型会读到的那一行。
    let current = tx
        .query_row(
            r#"
            SELECT u.attempt, u.unit_key, u.unit_order, u.generation,
                   u.producer_generation, u.page_hash, a.status
            FROM pipeline_units u
            JOIN pipeline_attempts a ON a.job_id = u.job_id AND a.attempt = u.attempt
            WHERE u.job_id = ?1 AND u.stage_key = ?2 AND u.page_index = ?3
              AND u.status = 'committed'
            ORDER BY u.attempt DESC, u.generation DESC
            LIMIT 1
            "#,
            params![job_id, TRANSLATE_STAGE, page.page_index],
            |row| {
                Ok(CurrentRow {
                    attempt: row.get(0)?,
                    unit_key: row.get(1)?,
                    unit_order: row.get(2)?,
                    generation: row.get(3)?,
                    producer_generation: row.get(4)?,
                    page_hash: row.get(5)?,
                    attempt_status: row.get(6)?,
                })
            },
        )
        .optional()?;

    let (attempt, unit_key, unit_order, insert, previous_hash) = match current {
        Some(row) => {
            if row.page_hash == page.page_hash {
                return Ok(result(
                    RevisedPageStatus::Current,
                    Some(row.attempt),
                    Some(row.generation),
                ));
            }
            if row
                .producer_generation
                .is_some_and(|existing| existing >= incoming_generation)
            {
                return Ok(result(
                    RevisedPageStatus::Superseded,
                    Some(row.attempt),
                    Some(row.generation),
                ));
            }
            if row.attempt_status == ATTEMPT_RUNNING {
                return Ok(result(
                    RevisedPageStatus::RunningAttempt,
                    Some(row.attempt),
                    Some(row.generation),
                ));
            }
            (
                row.attempt,
                row.unit_key,
                row.unit_order,
                false,
                Some(row.page_hash),
            )
        }
        None => {
            // 该页从没登记过:挂到最近一个有 translate 阶段的 attempt 上。
            let latest = tx
                .query_row(
                    r#"
                    SELECT s.attempt, a.status, a.generation
                    FROM pipeline_stages s
                    JOIN pipeline_attempts a ON a.job_id = s.job_id AND a.attempt = s.attempt
                    WHERE s.job_id = ?1 AND s.stage_key = ?2
                    ORDER BY s.attempt DESC
                    LIMIT 1
                    "#,
                    params![job_id, TRANSLATE_STAGE],
                    |row| {
                        Ok((
                            row.get::<_, i64>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, i64>(2)?,
                        ))
                    },
                )
                .optional()?;
            let Some((attempt, status, generation)) = latest else {
                return Ok(result(RevisedPageStatus::NoDurableAttempt, None, None));
            };
            if status == ATTEMPT_RUNNING {
                return Ok(result(
                    RevisedPageStatus::RunningAttempt,
                    Some(attempt),
                    Some(generation),
                ));
            }
            // 沿用 worker 的 unit 身份;万一已被别的页占了(身份格式变过),换一个
            // 只属于修订的键,排在该 attempt 最后,不挪动阶段游标。
            let taken = tx
                .query_row(
                    r#"
                    SELECT 1 FROM pipeline_units
                    WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
                      AND (unit_key = ?4 OR unit_order = ?5)
                    LIMIT 1
                    "#,
                    params![
                        job_id,
                        attempt,
                        TRANSLATE_STAGE,
                        page.unit_key,
                        page.unit_order as i64
                    ],
                    |_| Ok(()),
                )
                .optional()?
                .is_some();
            let (unit_key, unit_order) = if taken {
                let next_order: i64 = tx.query_row(
                    r#"
                    SELECT COALESCE(MAX(unit_order), -1) + 1 FROM pipeline_units
                    WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
                    "#,
                    params![job_id, attempt, TRANSLATE_STAGE],
                    |row| row.get(0),
                )?;
                (format!("revision-page:{}", page.page_index), next_order)
            } else {
                (page.unit_key.clone(), page.unit_order as i64)
            };
            (attempt, unit_key, unit_order, true, None)
        }
    };

    let generation = match bumped.get(&attempt) {
        Some(generation) => *generation,
        None => {
            let changed = tx.execute(
                r#"
                UPDATE pipeline_attempts
                SET generation = generation + 1, updated_at = ?1
                WHERE job_id = ?2 AND attempt = ?3 AND status != 'running'
                "#,
                params![timestamp, job_id, attempt],
            )?;
            if changed != 1 {
                bail!("pipeline attempt {attempt} for job {job_id} changed while publishing a revision");
            }
            let generation: i64 = tx.query_row(
                "SELECT generation FROM pipeline_attempts WHERE job_id = ?1 AND attempt = ?2",
                params![job_id, attempt],
                |row| row.get(0),
            )?;
            bumped.insert(attempt, generation);
            generation
        }
    };

    let changed_item_ids = if page.changed_item_ids.is_empty() {
        vec![unit_key.clone()]
    } else {
        page.changed_item_ids.clone()
    };
    let payload = json!({
        "phase": "committed",
        "status": "complete",
        "source": "translation_revision",
        "changed_item_ids": changed_item_ids,
        "revision_ids": page.revision_ids,
        "previous_page_hash": previous_hash,
    });
    let payload_json = serde_json::to_string(&payload)?;
    if insert {
        tx.execute(
            r#"
            INSERT INTO pipeline_units (
                job_id, attempt, stage_key, unit_key, unit_order, generation,
                producer_generation, status, page_index, page_hash, payload_json,
                committed_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'committed', ?8, ?9, ?10, ?11, ?11)
            "#,
            params![
                job_id,
                attempt,
                TRANSLATE_STAGE,
                unit_key,
                unit_order,
                generation,
                incoming_generation,
                page.page_index,
                page.page_hash,
                payload_json,
                timestamp,
            ],
        )?;
    } else {
        tx.execute(
            r#"
            UPDATE pipeline_units
            SET generation = ?1, producer_generation = ?2, page_hash = ?3,
                payload_json = ?4, updated_at = ?5
            WHERE job_id = ?6 AND attempt = ?7 AND stage_key = ?8 AND unit_key = ?9
            "#,
            params![
                generation,
                incoming_generation,
                page.page_hash,
                payload_json,
                timestamp,
                job_id,
                attempt,
                TRANSLATE_STAGE,
                unit_key,
            ],
        )?;
    }
    tx.execute(
        r#"
        UPDATE pipeline_stages
        SET generation = ?1,
            last_page_hash = CASE WHEN last_committed_unit_key = ?2 THEN ?3 ELSE last_page_hash END,
            updated_at = ?4
        WHERE job_id = ?5 AND attempt = ?6 AND stage_key = ?7
        "#,
        params![
            generation,
            unit_key,
            page.page_hash,
            timestamp,
            job_id,
            attempt,
            TRANSLATE_STAGE
        ],
    )?;
    // 与 worker 提交同一个事件名与载荷形状:实时译文的 SSE 只认它,前端按
    // (attempt, generation) 拉新快照。多出来的 source / revision_ids 供区分来源。
    append_state_event(
        tx,
        job_id,
        TRANSLATE_STAGE,
        "pipeline_unit_committed",
        &format!("registered translation revision for {unit_key}"),
        json!({
            "attempt": attempt,
            "generation": generation,
            "stage": TRANSLATE_STAGE,
            "unit_key": unit_key,
            "unit_order": unit_order,
            "page_index": page.page_index,
            "page_hash": page.page_hash,
            "producer_generation": incoming_generation,
            "changed_item_ids": changed_item_ids,
            "source": "translation_revision",
            "revision_ids": page.revision_ids,
        }),
    )?;
    Ok(result(
        RevisedPageStatus::Published,
        Some(attempt),
        Some(generation),
    ))
}
