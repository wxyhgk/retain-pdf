use std::collections::HashSet;

use anyhow::Result;

use crate::db::{Db, PipelineAttemptCursor, PipelineUnitCommit};

use super::super::stdout_parser::PipelineCheckpointObservation;

pub(super) fn apply_durable_checkpoint(
    db: &Db,
    cursor: &mut PipelineAttemptCursor,
    observation: PipelineCheckpointObservation,
) -> Result<()> {
    if observation.stage.trim() != cursor.stage_key {
        anyhow::bail!(
            "pipeline checkpoint stage mismatch for job {}: worker={} authoritative={}",
            cursor.job_id,
            observation.stage,
            cursor.stage_key
        );
    }
    let unit_fields = (
        observation.unit_key.as_deref(),
        observation.unit_order,
        observation.page_index,
        observation.page_hash.as_deref(),
    );
    let present_unit_fields = [
        unit_fields.0.is_some(),
        unit_fields.1.is_some(),
        unit_fields.2.is_some(),
        unit_fields.3.is_some(),
    ]
    .into_iter()
    .filter(|present| *present)
    .count();
    if present_unit_fields != 0 && present_unit_fields != 4 {
        anyhow::bail!(
            "pipeline checkpoint has a partial committed-unit identity for job {}",
            cursor.job_id
        );
    }
    if present_unit_fields != 0 && !observation.committed_pages.is_empty() {
        anyhow::bail!(
            "pipeline checkpoint mixes legacy unit fields with committed_pages for job {}",
            cursor.job_id
        );
    }

    let commits = if let (Some(unit_key), Some(unit_order), Some(page_index), Some(page_hash)) =
        unit_fields
    {
        vec![PipelineUnitCommit {
            unit_key: unit_key.to_string(),
            unit_order,
            page_index: Some(page_index),
            page_hash: page_hash.to_string(),
            producer_generation: Some(observation.producer_generation),
            payload: serde_json::json!({
                "phase": observation.phase.clone(),
                "status": observation.status.clone(),
                "progress": observation.progress.clone(),
                "changed_item_ids": [unit_key],
            }),
        }]
    } else {
        batch_commits(cursor, &observation)?
    };

    if !commits.is_empty() {
        let checkpoint = db.commit_pipeline_units(cursor, &commits)?;
        cursor.generation = checkpoint.generation;
    }
    if observation.status == "complete" {
        let checkpoint = db.complete_pipeline_stage(cursor)?;
        cursor.generation = checkpoint.generation;
    }
    // checkpoint 只做 durable 单元提交,运行期不再投影到 job.progress_* /
    // stage_detail。
    //
    // 原先这里会把 `completed_item_count/item_count` 写进 job,再由
    // job_events::derivation 派生一条 stage_progress。但 pipeline 自己也在主
    // lane 上发翻译进度,两个来源轮流成为「最新一条」,分母一个是批次(167)、
    // 一个是全量文本块(642,含早已完成的 234 块),派生事件的 substage 还沿用
    // OCR 遗留的 "done"、unit 被推成 batch,界面于是显示「236/642 批」,百分比
    // 13%→40%→23%→45% 来回跳。
    //
    // 现在翻译进度只有一个来源:pipeline 的 translation_batches 观测,它按本轮
    // 待翻译块计数(progress_unit=block),文案「已翻译 x/N 块 · 已完成 p/P 页」
    // 也由它给出。数字和文字出自同一条事件,也就不会再出现「数字换了、文案还是
    // 入场语」(旧 seq 111/115 那类覆盖)的问题。
    Ok(())
}

fn batch_commits(
    cursor: &PipelineAttemptCursor,
    observation: &PipelineCheckpointObservation,
) -> Result<Vec<PipelineUnitCommit>> {
    let mut page_indexes = HashSet::new();
    observation
        .committed_pages
        .iter()
        .map(|page| {
            if !page_indexes.insert(page.page_index) {
                anyhow::bail!(
                    "pipeline checkpoint contains page {} more than once for job {}",
                    page.page_index,
                    cursor.job_id
                );
            }
            let mut changed_item_ids = page
                .changed_item_ids
                .iter()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>();
            changed_item_ids.sort();
            changed_item_ids.dedup();
            if changed_item_ids.is_empty() {
                changed_item_ids.push(page.unit_key.clone());
            }
            Ok(PipelineUnitCommit {
                unit_key: page.unit_key.clone(),
                unit_order: page.unit_order,
                page_index: Some(page.page_index),
                page_hash: page.page_hash.clone(),
                producer_generation: Some(observation.producer_generation),
                payload: serde_json::json!({
                    "phase": observation.phase.clone(),
                    "status": observation.status.clone(),
                    "progress": observation.progress.clone(),
                    "changed_item_ids": changed_item_ids,
                }),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::job_runner::stdout_parser::parse_pipeline_checkpoint_line;
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

    fn fixture_db(label: &str) -> (std::path::PathBuf, Db) {
        let root = std::env::temp_dir().join(format!(
            "retain-{label}-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        fs::create_dir_all(&root).expect("fixture root");
        let db = Db::new(root.join("jobs.db"), root.clone());
        db.init().expect("init db");
        (root, db)
    }

    #[test]
    fn multi_page_checkpoint_becomes_one_atomic_authoritative_transition() {
        let (root, db) = fixture_db("multi-page-checkpoint");
        let snapshot = JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        db.save_job(&snapshot).expect("seed job");
        let mut cursor = db
            .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
            .expect("translate attempt");
        let observation = parse_pipeline_checkpoint_line(
            r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"pipeline_checkpoint_v1","schema_version":1,"stage":"translate","phase":"translating","status":"in_progress","producer_generation":8,"committed_pages":[{"unit_key":"p001-b2","unit_order":2,"page_index":0,"page_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","changed_item_ids":["p001-b1","p001-b2"]},{"unit_key":"p002-b1","unit_order":3,"page_index":1,"page_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","changed_item_ids":["p002-b1"]}],"progress":{"completed_item_count":3,"item_count":10}}}"#,
        )
        .expect("parse checkpoint");

        apply_durable_checkpoint(&db, &mut cursor, observation).expect("apply checkpoint");

        let units = db
            .list_pipeline_units("job-1", cursor.attempt, "translate")
            .expect("translation units");
        assert_eq!(units.len(), 2);
        assert_eq!(units[0].generation, units[1].generation);
        let events = db
            .list_translation_commit_events_after("job-1", 0, 10)
            .expect("commit events");
        assert_eq!(events.len(), 2);
        assert_eq!(
            events[0].payload["changed_item_ids"],
            serde_json::json!(["p001-b1", "p001-b2"])
        );

        let _ = fs::remove_dir_all(root);
    }

    /// 译后阶段只改了诊断字段、块指纹没变的页,Python 以空的 changed_item_ids 上报,
    /// 只为把 page_hash 推到新字节。Rust 必须照常提交并推进该页的 page_hash,
    /// 否则实时阅读按旧哈希找快照会找不到(旧快照已被 prune)。
    #[test]
    fn byte_only_page_commit_advances_page_hash() {
        let (root, db) = fixture_db("byte-only-page-commit");
        let snapshot = JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        db.save_job(&snapshot).expect("seed job");
        let mut cursor = db
            .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
            .expect("translate attempt");
        for line in [
            r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"pipeline_checkpoint_v1","schema_version":1,"stage":"translate","phase":"translating","status":"in_progress","producer_generation":6,"committed_pages":[{"unit_key":"page:0","unit_order":0,"page_index":0,"page_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","changed_item_ids":["p001-b1"]}],"progress":{"completed_item_count":1,"item_count":1}}}"#,
            r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"pipeline_checkpoint_v1","schema_version":1,"stage":"translate","phase":"repairing","status":"in_progress","producer_generation":7,"committed_pages":[{"unit_key":"page:0","unit_order":0,"page_index":0,"page_hash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","changed_item_ids":[]}],"progress":{"completed_item_count":1,"item_count":1}}}"#,
        ] {
            let observation = parse_pipeline_checkpoint_line(line).expect("parse checkpoint");
            apply_durable_checkpoint(&db, &mut cursor, observation).expect("apply checkpoint");
        }

        let units = db
            .list_pipeline_units("job-1", cursor.attempt, "translate")
            .expect("translation units");
        assert_eq!(units.len(), 1);
        assert_eq!(units[0].page_hash, "c".repeat(64));
        let events = db
            .list_translation_commit_events_after("job-1", 0, 10)
            .expect("commit events");
        assert_eq!(events.len(), 2);
        // 前端只认当页存在的块 id,page:0 不会让任何块闪「已更新」。
        assert_eq!(events[1].payload["changed_item_ids"], serde_json::json!(["page:0"]));

        let _ = fs::remove_dir_all(root);
    }

    /// checkpoint 是 durable 提交,不是公开进度来源。
    ///
    /// 旧实现在这里把 `completed_item_count/item_count` 写进 job.progress_* 与
    /// stage_detail(「已完成 x/642 个文本块」),派生事件和 pipeline 的批次事件
    /// 抢主 lane,进度条 13%→40%→23%→45% 来回跳;更早还出过「committed 那次
    /// checkpoint 把已写对的文案覆盖掉」(seq 111 对、115 被覆盖)。现在 checkpoint
    /// 根本拿不到 job,这里钉住的是:一整段翻译的 checkpoint(含最终 committed)
    /// 走完,持久化的 job 进度与文案原样不动,也不派生任何 stage 进度事件。
    #[test]
    fn checkpoints_never_project_progress_or_detail_onto_the_job() {
        let (root, db) = fixture_db("checkpoint-no-progress-projection");
        let mut snapshot = JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        snapshot.stage = Some("translating".to_string());
        snapshot.stage_detail = Some("已翻译 2/8 块 · 已完成 1/4 页".to_string());
        snapshot.progress_current = Some(2);
        snapshot.progress_total = Some(8);
        db.save_job(&snapshot).expect("seed job");
        let events_before = db.list_job_events("job-1", 100, 0).expect("events before");
        let mut cursor = db
            .acquire_pipeline_attempt("job-1", "worker-a", "translate", 1)
            .expect("translate attempt");

        for line in [
            r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"pipeline_checkpoint_v1","schema_version":1,"stage":"translate","phase":"translating","status":"in_progress","producer_generation":6,"committed_pages":[{"unit_key":"page:0","unit_order":0,"page_index":0,"page_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","changed_item_ids":["p001-b1"]}],"progress":{"completed_item_count":236,"item_count":642,"completed_page_count":3}}}"#,
            r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"pipeline_checkpoint_v1","schema_version":1,"stage":"translate","phase":"validating","status":"in_progress","producer_generation":7,"committed_pages":[{"unit_key":"page:1","unit_order":1,"page_index":1,"page_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","changed_item_ids":["p002-b1"]}],"progress":{"completed_item_count":642,"item_count":642,"completed_page_count":4}}}"#,
            r#"{"event_type":"pipeline_checkpoint","payload":{"schema":"pipeline_checkpoint_v1","schema_version":1,"stage":"translate","phase":"committed","status":"complete","producer_generation":8,"committed_pages":[],"progress":{"completed_item_count":642,"item_count":642,"completed_page_count":4}}}"#,
        ] {
            let observation = parse_pipeline_checkpoint_line(line).expect("parse checkpoint");
            apply_durable_checkpoint(&db, &mut cursor, observation).expect("apply checkpoint");
        }

        let stored = db.get_job("job-1").expect("stored job");
        assert_eq!(stored.progress_current, Some(2));
        assert_eq!(stored.progress_total, Some(8));
        assert_eq!(
            stored.stage_detail.as_deref(),
            Some("已翻译 2/8 块 · 已完成 1/4 页")
        );
        let events_after = db.list_job_events("job-1", 100, 0).expect("events after");
        let new_progress_events: Vec<_> = events_after
            .iter()
            .skip(events_before.len())
            .filter(|event| {
                matches!(event.event.as_str(), "stage_progress" | "stage_updated")
                    || event.progress_current.is_some()
            })
            .collect();
        assert!(
            new_progress_events.is_empty(),
            "checkpoint 不得派生进度事件: {new_progress_events:?}"
        );

        let _ = fs::remove_dir_all(root);
    }
}
