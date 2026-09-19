use std::path::PathBuf;

use anyhow::{anyhow, Result};

use crate::job_events::cas_persist_job_with_resources;
use crate::models::domain::{JobArtifacts, JobRuntimeState};
use crate::storage_paths::build_job_paths;

use super::translation_checkpoint_resume::import_translation_checkpoint_candidate;
use crate::job_runner::stage_contract::ocr_ready_inputs_for_translation;
use crate::job_runner::{attach_job_paths, JobPersistDeps};

pub(super) async fn prepare_job_from_ocr_artifacts(
    deps: &JobPersistDeps,
    mut job: JobRuntimeState,
    source_job_id: &str,
    action_label: &str,
) -> Result<(JobRuntimeState, PathBuf)> {
    let source_job = deps.db.get_job(&source_job_id)?;
    let source_artifacts = source_job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow!("artifact source job has no artifacts: {source_job_id}"))?;
    let source_runtime = source_job.clone().into_runtime();
    let ocr_inputs = ocr_ready_inputs_for_translation(&source_runtime, &deps.data_root)?;
    let source_pdf_path = ocr_inputs.source_pdf_path;
    let normalized_path = ocr_inputs.normalized_path;
    let layout_json_path = ocr_inputs.layout_json_path;

    let job_paths = build_job_paths(&deps.output_root, &job.job_id)?;
    import_translation_checkpoint_candidate(
        &deps.output_root,
        &source_job.job_id,
        &source_job.status,
        &job_paths.translated_dir,
    )?;
    attach_job_paths(&mut job, &job_paths);
    copy_ocr_checkpoint_artifacts(&mut job, &source_job_id, source_artifacts);
    if let Some(artifacts) = job.artifacts.as_mut() {
        artifacts.copy_translation_inputs_from(source_artifacts);
        artifacts.source_pdf = Some(source_pdf_path.to_string_lossy().to_string());
        artifacts.normalized_document_json = Some(normalized_path.to_string_lossy().to_string());
        artifacts.layout_json = layout_json_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string());
    }
    job.stage_detail = Some(format!(
        "正在基于任务 {source_job_id} 的 OCR 产物{action_label}"
    ));
    // 这一行任务在 DB 里早就存在了（建任务时落的库，driver 刚把它 CAS 成 queued）。
    // 上面这一串「读源任务产物、导入 checkpoint、拷文件」都不是瞬时的，用户完全
    // 来得及在这段窗口里点取消；无条件整行覆盖会拿更早的内存快照把 canceled 抹掉，
    // 于是一个已经取消的任务又被拉起来跑一遍翻译。
    let updated = cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.data_root,
        &deps.output_root,
        &job.snapshot(),
        &["queued", "running"],
    )?;
    if !updated {
        // 复用产物这条路径本身是幂等的：拷进来的 checkpoint 留着不碍事，下次重试
        // 会重新走一遍。所以 CAS 失败只需要停在这里，别让调用方进翻译阶段。
        anyhow::bail!("job became terminal before the OCR artifacts could be adopted");
    }
    Ok((job, source_pdf_path))
}

fn copy_ocr_checkpoint_artifacts(
    job: &mut JobRuntimeState,
    source_job_id: &str,
    source_artifacts: &JobArtifacts,
) {
    let artifacts = job.artifacts.get_or_insert_with(JobArtifacts::default);
    artifacts.copy_ocr_checkpoint_from(source_job_id, source_artifacts);
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;
    use crate::db::Db;
    use crate::models::domain::{JobSnapshot, JobStatusKind};
    use crate::models::request::CreateJobInput;
    use crate::storage_paths::TRANSLATION_CHECKPOINT_FILE_NAME;

    #[tokio::test]
    async fn ocr_artifacts_and_resume_checkpoint_need_only_persistence_resources() {
        let root = std::env::temp_dir().join(format!(
            "retain-translation-artifacts-persist-{}",
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(root.join("source")).unwrap();
        std::fs::write(root.join("source/source.pdf"), b"source fixture").unwrap();
        let db = Arc::new(Db::new(root.join("jobs.db"), root.clone()));
        db.init().unwrap();
        let deps = JobPersistDeps::new(db, root.clone(), root.join("jobs"));
        let mut source = JobSnapshot::new("source".into(), CreateJobInput::default(), vec![]);
        source.status = JobStatusKind::Failed;
        source.artifacts = Some(JobArtifacts {
            source_pdf: Some("source/source.pdf".into()),
            normalized_document_json: Some("source/document.v1.json".into()),
            layout_json: Some("source/layout.json".into()),
            ..Default::default()
        });
        deps.db.save_job(&source).unwrap();
        let job =
            JobSnapshot::new("translate".into(), CreateJobInput::default(), vec![]).into_runtime();

        assert!(
            prepare_job_from_ocr_artifacts(&deps, job.clone(), "source", "继续翻译")
                .await
                .is_err()
        );
        assert!(deps.db.get_job("translate").is_err());
        std::fs::write(root.join("source/document.v1.json"), b"{}").unwrap();
        std::fs::write(root.join("source/layout.json"), b"{}").unwrap();
        let source_paths = build_job_paths(&deps.output_root, "source").unwrap();
        std::fs::create_dir_all(&source_paths.translated_dir).unwrap();
        let source_checkpoint = source_paths
            .translated_dir
            .join(TRANSLATION_CHECKPOINT_FILE_NAME);
        let checkpoint = br#"{"schema":"translation_checkpoint_v1","schema_version":1,"status":"in_progress","pages":[]}"#;
        std::fs::write(&source_checkpoint, checkpoint).unwrap();

        let (prepared, source_pdf) =
            prepare_job_from_ocr_artifacts(&deps, job, "source", "继续翻译")
                .await
                .unwrap();
        assert_eq!(source_pdf, root.join("source/source.pdf"));
        let saved = deps.db.get_job(&prepared.job_id).unwrap();
        assert_eq!(
            saved.stage_detail.as_deref(),
            Some("正在基于任务 source 的 OCR 产物继续翻译")
        );
        let artifacts = saved.artifacts.unwrap();
        assert_eq!(
            artifacts.normalized_document_json.as_deref(),
            Some("source/document.v1.json")
        );
        assert_eq!(artifacts.layout_json.as_deref(), Some("source/layout.json"));
        let target_paths = build_job_paths(&deps.output_root, "translate").unwrap();
        assert_eq!(
            std::fs::read(
                target_paths
                    .translated_dir
                    .join(TRANSLATION_CHECKPOINT_FILE_NAME)
            )
            .unwrap(),
            checkpoint
        );
        assert_eq!(std::fs::read(&source_checkpoint).unwrap(), checkpoint);
        assert_eq!(
            serde_json::to_value(deps.db.get_job("source").unwrap().artifacts).unwrap(),
            serde_json::to_value(source.artifacts).unwrap()
        );
        drop(deps);
        std::fs::remove_dir_all(root).unwrap();
    }

    /// 「认领 OCR 产物」不是瞬时的：读源任务、拷 checkpoint 都要时间，
    /// 用户完全来得及在这段窗口里点取消。driver 手上的还是取消之前的快照。
    ///
    /// 反证方式：把上面的 CAS 换回 `persist_runtime_job_with_resources`，
    /// 这个测试必须变红——写会成功、canceled 被复活成 queued，函数也不再返回 Err。
    #[tokio::test]
    async fn canceled_job_is_not_revived_while_adopting_ocr_artifacts() {
        let root = std::env::temp_dir().join(format!(
            "retain-translation-artifacts-cas-{}",
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(root.join("source")).unwrap();
        std::fs::write(root.join("source/source.pdf"), b"source fixture").unwrap();
        std::fs::write(root.join("source/document.v1.json"), b"{}").unwrap();
        std::fs::write(root.join("source/layout.json"), b"{}").unwrap();
        let db = Arc::new(Db::new(root.join("jobs.db"), root.clone()));
        db.init().unwrap();
        let deps = JobPersistDeps::new(db, root.clone(), root.join("jobs"));
        let mut source = JobSnapshot::new("source".into(), CreateJobInput::default(), vec![]);
        source.status = JobStatusKind::Failed;
        source.artifacts = Some(JobArtifacts {
            source_pdf: Some("source/source.pdf".into()),
            normalized_document_json: Some("source/document.v1.json".into()),
            layout_json: Some("source/layout.json".into()),
            ..Default::default()
        });
        deps.db.save_job(&source).unwrap();

        // 任务行早就在库里（建任务时落的），且用户已经把它取消了。
        let stale = JobSnapshot::new("translate".into(), CreateJobInput::default(), vec![]);
        let mut canceled = stale.clone();
        canceled.status = JobStatusKind::Canceled;
        deps.db.save_job(&canceled).unwrap();

        let result =
            prepare_job_from_ocr_artifacts(&deps, stale.into_runtime(), "source", "继续翻译").await;

        assert!(
            result.is_err(),
            "任务已终态时必须停下，不能让调用方继续进翻译阶段"
        );
        assert!(
            matches!(
                deps.db.get_job("translate").unwrap().status,
                JobStatusKind::Canceled
            ),
            "取消被 driver 的旧快照覆盖掉了：用户点了取消，任务却接着跑翻译"
        );
        drop(deps);
        std::fs::remove_dir_all(root).unwrap();
    }
}
