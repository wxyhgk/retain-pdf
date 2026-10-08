//! workflow 终态后把「绕过 PATCH 写回的译文修订」登记进实时译文读模型。
//!
//! 渲染阶段的精修（refine）在 Python 渲染子进程里逐块调用 `revise_translation_item`，
//! 原子改写页文件、checkpoint 和 `revisions.v1.jsonl`，但不经过 API 的 PATCH，也不经过
//! worker stdout，所以数据库 `pipeline_units` 里登记的还是精修前的 page_hash。
//!
//! 这里在 workflow 落终态、pipeline attempt 收尾**之后**调用与 PATCH 同一套对账
//! （`retain_data::translation_revisions`）：checkpoint 里出现在修订日志中的页登记成新
//! page_hash，并追加 `pipeline_unit_committed` 事件（source=translation_revision）。
//! 必须在 attempt 收尾之后：Book/Translate 的精修页归属于本次正在跑的 attempt，
//! 对账会把 running attempt 的页跳过（generation 是 worker 的 fencing token）。
//!
//! 成功、失败、取消都调用：精修写回的修订是持久的（文件才是权威），渲染失败也不会回滚
//! 它们。对账幂等、单调；从没修订过的任务只多一次 stat。失败只记日志——打开实时译文时
//! 的读时自愈（api `heal_live_translation_revisions`）还会再补一次。

use std::path::Path;

use tracing::warn;

use super::ProcessRuntimeDeps;
use crate::db::Db;
use crate::storage_paths::JobPaths;
use retain_data::translation_revisions::{
    prune_superseded_revision_snapshots, publish_translation_revisions,
};

pub(super) fn publish_translation_revisions_after_terminal(
    deps: &ProcessRuntimeDeps,
    job_id: &str,
) {
    publish_job_translation_revisions(deps.db.as_ref(), &deps.persist.output_root, job_id);
}

fn publish_job_translation_revisions(db: &Db, output_root: &Path, job_id: &str) {
    // 只看任务自己的译文目录：create_new_job=true 的派生任务读的是源任务目录，
    // 不归它登记（与 api 读时自愈的 owned 判断一致）。
    let translations_dir = JobPaths::for_job(output_root, job_id).translated_dir;
    if !translations_dir.is_dir() {
        return;
    }
    match publish_translation_revisions(db, job_id, &translations_dir) {
        Ok(Some(pages)) => {
            if let Err(error) =
                prune_superseded_revision_snapshots(db, job_id, &translations_dir)
            {
                warn!(
                    "job {job_id}: failed to prune superseded translation snapshots after workflow: {error:#}"
                );
            }
            let published = pages
                .iter()
                .filter(|page| page.status == crate::db::RevisedPageStatus::Published)
                .count();
            if published > 0 {
                tracing::info!(
                    "job {job_id}: registered {published} revised translation page(s) for live translation"
                );
            }
        }
        Ok(None) => {}
        Err(error) => warn!(
            "job {job_id}: failed to register translation revisions after workflow: {error:#}"
        ),
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::json;
    use sha2::{Digest, Sha256};

    use super::*;
    use crate::db::{PipelineAttemptCursor, PipelineUnitCommit};
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

    const JOB_ID: &str = "job-refine-publish";
    const PAGE_FILE: &str = "page-001-deepseek.json";

    fn sha256_hex(bytes: &[u8]) -> String {
        Sha256::digest(bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    struct Fixture {
        root: std::path::PathBuf,
        output_root: std::path::PathBuf,
        db: Db,
    }

    impl Fixture {
        fn new(name: &str) -> Self {
            let root = crate::job_runner::test_support::temp_root(name);
            let output_root = root.join("jobs");
            fs::create_dir_all(&output_root).expect("output root");
            let db = Db::new(root.join("jobs.db"), root.clone());
            db.init().expect("init db");
            db.save_job(&JobSnapshot::new(
                JOB_ID.to_string(),
                CreateJobInput::default(),
                vec!["python".to_string()],
            ))
            .expect("seed job");
            Self {
                root,
                output_root,
                db,
            }
        }

        fn translated_dir(&self) -> std::path::PathBuf {
            JobPaths::for_job(&self.output_root, JOB_ID).translated_dir
        }

        /// 翻译阶段提交了第 0 页（page_hash = 初译文件的哈希），attempt 还在跑。
        fn commit_initial_translation(&self, initial_hash: &str) -> PipelineAttemptCursor {
            let cursor = self
                .db
                .acquire_pipeline_attempt(JOB_ID, "worker-a", "translate", 1)
                .expect("claim attempt");
            let checkpoint = self
                .db
                .commit_pipeline_units(
                    &cursor,
                    &[PipelineUnitCommit {
                        unit_key: "page:0".to_string(),
                        unit_order: 0,
                        page_index: Some(0),
                        page_hash: initial_hash.to_string(),
                        producer_generation: Some(1),
                        payload: json!({"phase": "committed"}),
                    }],
                )
                .expect("commit page 0");
            PipelineAttemptCursor {
                generation: checkpoint.generation,
                ..cursor
            }
        }

        /// 模拟渲染子进程里的精修写回（Python `revise_translation_item`）：
        /// 页文件、generation-2 快照、checkpoint 和修订日志，**不碰数据库**。
        fn write_refined_page(&self, refined: &[u8]) -> String {
            self.write_revision(refined, 2, "p001-b003", "rev-refine-1")
        }

        /// 一次被采纳的修改：checkpoint generation 推到 `generation`，建一个包含全部页的
        /// 新快照目录，修订日志追加一行。
        fn write_revision(
            &self,
            refined: &[u8],
            generation: u64,
            item_id: &str,
            revision_id: &str,
        ) -> String {
            let dir = self.translated_dir();
            let snapshot_dir = dir
                .join(".translation-checkpoints")
                .join(format!("generation-{generation}"));
            fs::create_dir_all(&snapshot_dir).expect("snapshot dir");
            let hash = sha256_hex(refined);
            fs::write(dir.join(PAGE_FILE), refined).expect("page file");
            fs::write(snapshot_dir.join(PAGE_FILE), refined).expect("snapshot page");
            fs::write(
                dir.join("translation-checkpoint.v1.json"),
                json!({
                    "status": "complete",
                    "phase": "committed",
                    "generation": generation,
                    "pages": [{
                        "page_index": 0,
                        "path": PAGE_FILE,
                        "page_hash": hash,
                        "last_committed_unit": {"unit_key": "page:0", "unit_order": 0}
                    }]
                })
                .to_string(),
            )
            .expect("checkpoint");
            let journal = dir.join("revisions.v1.jsonl");
            let mut lines = fs::read_to_string(&journal).unwrap_or_default();
            lines.push_str(&format!(
                "{}\n",
                json!({
                    "generation": generation,
                    "item_id": item_id,
                    "revision_id": revision_id,
                    "source": "refine",
                    "page_hashes": {PAGE_FILE: hash}
                })
            ));
            fs::write(journal, lines).expect("revision journal");
            hash
        }

        fn page_hash(&self) -> String {
            self.db
                .latest_pipeline_unit_for_page(JOB_ID, "translate", 0)
                .expect("query")
                .expect("row")
                .page_hash
        }

        fn revision_events(&self) -> Vec<serde_json::Value> {
            self.db
                .list_translation_commit_events_after(JOB_ID, 0, 100)
                .expect("events")
                .into_iter()
                .map(|record| record.payload)
                .filter(|payload| payload["source"] == "translation_revision")
                .collect()
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    /// Book/Translate：精修跑在本次 attempt 里。attempt 还在跑时对账会跳过这一页
    /// （generation 是 worker 的 fencing token），所以必须等 attempt 收尾后再登记。
    #[test]
    fn refined_pages_are_registered_after_the_attempt_finishes() {
        let fixture = Fixture::new("refine-publish-book");
        let initial = sha256_hex(b"[\"initial\"]");
        fixture.commit_initial_translation(&initial);
        let refined = fixture.write_refined_page(br#"["refined"]"#);

        publish_job_translation_revisions(&fixture.db, &fixture.output_root, JOB_ID);
        assert_eq!(fixture.page_hash(), initial, "running attempt 的页归 worker，不能抢先登记");
        assert!(fixture.revision_events().is_empty());

        assert!(fixture
            .db
            .finish_latest_pipeline_attempt(JOB_ID, "succeeded")
            .expect("finish attempt"));
        publish_job_translation_revisions(&fixture.db, &fixture.output_root, JOB_ID);

        assert_eq!(fixture.page_hash(), refined, "数据库 page_hash 要与 checkpoint 一致");
        let events = fixture.revision_events();
        assert_eq!(events.len(), 1, "发出一条 pipeline_unit_committed");
        assert_eq!(events[0]["page_hash"], refined);
        assert_eq!(events[0]["changed_item_ids"], json!(["p001-b003"]));
        assert_eq!(events[0]["revision_ids"], json!(["rev-refine-1"]));

        // 幂等：再跑一次什么都不变、不重复发事件。
        publish_job_translation_revisions(&fixture.db, &fixture.output_root, JOB_ID);
        assert_eq!(fixture.revision_events().len(), 1);
    }

    /// 渲染失败也登记：精修写回的修订是持久的，渲染失败不会回滚它们。
    #[test]
    fn refined_pages_are_registered_even_when_the_workflow_failed() {
        let fixture = Fixture::new("refine-publish-failed");
        let initial = sha256_hex(b"[\"initial\"]");
        fixture.commit_initial_translation(&initial);
        fixture
            .db
            .finish_latest_pipeline_attempt(JOB_ID, "succeeded")
            .expect("finish translation attempt");
        // 原地 Render workflow 开了新的 attempt（只有 render 阶段），随后失败。
        fixture
            .db
            .acquire_pipeline_attempt(JOB_ID, "worker-render", "render", 2)
            .expect("render attempt");
        let refined = fixture.write_refined_page(br#"["refined"]"#);
        fixture
            .db
            .finish_latest_pipeline_attempt(JOB_ID, "failed")
            .expect("finish render attempt");

        publish_job_translation_revisions(&fixture.db, &fixture.output_root, JOB_ID);
        assert_eq!(fixture.page_hash(), refined);
        assert_eq!(fixture.revision_events().len(), 1);
    }

    /// 精修每采纳一处修改 checkpoint generation 就 +1、多一个快照目录。终态登记按最终
    /// checkpoint 一次登记：同一页的多次修改折成一条提交事件，旧 generation 快照被清掉。
    #[test]
    fn several_refine_generations_register_once_against_the_final_checkpoint() {
        let fixture = Fixture::new("refine-publish-generations");
        let initial = sha256_hex(b"[\"initial\"]");
        fixture.commit_initial_translation(&initial);
        fixture
            .db
            .finish_latest_pipeline_attempt(JOB_ID, "succeeded")
            .expect("finish translation attempt");
        fixture.write_revision(br#"["fix one"]"#, 2, "p001-b001", "rev-a");
        fixture.write_revision(br#"["fix one","fix two"]"#, 3, "p001-b002", "rev-b");
        let last = fixture.write_revision(br#"["fix one","fix two","fix three"]"#, 4, "p001-b003", "rev-c");

        publish_job_translation_revisions(&fixture.db, &fixture.output_root, JOB_ID);

        assert_eq!(fixture.page_hash(), last);
        let events = fixture.revision_events();
        assert_eq!(events.len(), 1, "按最终 checkpoint 一次登记");
        assert_eq!(events[0]["producer_generation"], 4);
        assert_eq!(
            events[0]["changed_item_ids"],
            json!(["p001-b001", "p001-b002", "p001-b003"])
        );
        assert_eq!(events[0]["revision_ids"], json!(["rev-a", "rev-b", "rev-c"]));
        let snapshots = fixture.translated_dir().join(".translation-checkpoints");
        assert!(snapshots.join("generation-4").is_dir());
        for stale in [2, 3] {
            assert!(
                !snapshots.join(format!("generation-{stale}")).exists(),
                "登记完成后旧 generation-{stale} 快照应被清理"
            );
        }
    }

    #[test]
    fn jobs_without_revisions_or_translations_are_a_no_op() {
        let fixture = Fixture::new("refine-publish-noop");
        // 没有译文目录。
        publish_job_translation_revisions(&fixture.db, &fixture.output_root, JOB_ID);
        // 有译文目录、没有修订日志。
        fs::create_dir_all(fixture.translated_dir()).expect("translated dir");
        publish_job_translation_revisions(&fixture.db, &fixture.output_root, JOB_ID);
        assert!(fixture.revision_events().is_empty());
    }
}
