use anyhow::{anyhow, Result};

use crate::job_events::cas_persist_job_with_resources;
use crate::models::domain::{JobArtifacts, JobRuntimeState};
use crate::storage_paths::build_job_paths;

use super::stage_contract::translation_ready_inputs_for_render;
use super::{attach_job_paths, JobPersistDeps};

pub(super) struct RenderArtifactInputs {
    pub(super) source_pdf_path: std::path::PathBuf,
    pub(super) translations_dir: std::path::PathBuf,
}

pub(super) fn prepare_render_job_from_artifacts(
    deps: &JobPersistDeps,
    mut job: JobRuntimeState,
) -> Result<(JobRuntimeState, RenderArtifactInputs)> {
    let source_job_id = job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .to_string();
    if source_job_id.is_empty() {
        return Err(anyhow!("render workflow requires source.artifact_job_id"));
    }
    let source_job = deps.db.get_job(&source_job_id)?;
    let source_artifacts = source_job
        .artifacts
        .as_ref()
        .ok_or_else(|| anyhow!("artifact source job has no artifacts: {source_job_id}"))?;
    let translation_outputs = source_artifacts.translation_outputs();
    let render_inputs =
        translation_ready_inputs_for_render(source_artifacts, &deps.data_root, &source_job_id)?;

    let job_paths = build_job_paths(&deps.output_root, &job.job_id)?;
    attach_job_paths(&mut job, &job_paths);
    let artifacts = job.artifacts.get_or_insert_with(JobArtifacts::default);
    artifacts.copy_translation_inputs_from(source_artifacts);
    artifacts.translations_dir = translation_outputs.translations_dir.map(str::to_string);
    // 同 `translation_flow_artifacts`：写的是已存在的任务行，而解析源任务产物的
    // 这段时间里用户可能已经取消。无条件覆盖会把 canceled 复活成 running，
    // 紧接着就去起渲染进程。
    let updated = cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.data_root,
        &deps.output_root,
        &job.snapshot(),
        &["queued", "running"],
    )?;
    if !updated {
        // 这里只是「认领已有产物、准备重跑」，还没有任何副作用，停下就是干净的。
        anyhow::bail!("job became terminal before the translation artifacts could be adopted");
    }

    Ok((
        job,
        RenderArtifactInputs {
            source_pdf_path: render_inputs.source_pdf_path,
            translations_dir: render_inputs.translations_dir,
        },
    ))
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;
    use crate::db::Db;
    use crate::models::domain::{JobSnapshot, JobStatusKind};
    use crate::models::request::CreateJobInput;
    use crate::storage_paths::TRANSLATION_MANIFEST_FILE_NAME;

    #[test]
    fn render_artifacts_resolve_and_persist_without_runtime_dependencies() {
        let root = std::env::temp_dir().join(format!(
            "retain-render-artifacts-persist-{}",
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(root.join("source/translated")).unwrap();
        std::fs::write(root.join("source/source.pdf"), b"source fixture").unwrap();
        let db = Arc::new(Db::new(root.join("jobs.db"), root.clone()));
        db.init().unwrap();
        let deps = JobPersistDeps::new(db, root.clone(), root.join("jobs"));
        let mut source = JobSnapshot::new("source".into(), CreateJobInput::default(), vec![]);
        source.artifacts = Some(JobArtifacts {
            source_pdf: Some("source/source.pdf".into()),
            translations_dir: Some("source/translated".into()),
            normalized_document_json: Some("source/document.v1.json".into()),
            ..Default::default()
        });
        deps.db.save_job(&source).unwrap();
        let mut input = CreateJobInput::default();
        input.source.artifact_job_id = " source ".into();
        let job = JobSnapshot::new("render".into(), input, vec![]).into_runtime();

        assert!(prepare_render_job_from_artifacts(&deps, job.clone()).is_err());
        assert!(deps.db.get_job("render").is_err());
        std::fs::write(
            root.join("source/translated")
                .join(TRANSLATION_MANIFEST_FILE_NAME),
            br#"{"pages":[]}"#,
        )
        .unwrap();
        let (prepared, inputs) = prepare_render_job_from_artifacts(&deps, job).unwrap();
        assert_eq!(inputs.source_pdf_path, root.join("source/source.pdf"));
        assert_eq!(inputs.translations_dir, root.join("source/translated"));
        let saved = deps.db.get_job(&prepared.job_id).unwrap();
        let artifacts = saved.artifacts.unwrap();
        assert_eq!(
            artifacts.translations_dir.as_deref(),
            Some("source/translated")
        );
        assert_eq!(
            artifacts.normalized_document_json.as_deref(),
            Some("source/document.v1.json")
        );
        assert_eq!(artifacts.job_root.as_deref(), Some("jobs/render"));
        let untouched = deps.db.get_job("source").unwrap();
        assert_eq!(
            serde_json::to_value(untouched.artifacts).unwrap(),
            serde_json::to_value(source.artifacts).unwrap()
        );
        drop(deps);
        std::fs::remove_dir_all(root).unwrap();
    }

    /// 渲染任务同样是「认领已有产物、准备重跑」：解析源任务产物期间用户可能取消。
    ///
    /// 反证方式：把上面的 CAS 换回 `persist_runtime_job_with_resources`，
    /// 这个测试必须变红。
    #[test]
    fn canceled_job_is_not_revived_while_adopting_translation_artifacts() {
        let root = std::env::temp_dir().join(format!(
            "retain-render-artifacts-cas-{}",
            fastrand::u64(..)
        ));
        std::fs::create_dir_all(root.join("source/translated")).unwrap();
        std::fs::write(root.join("source/source.pdf"), b"source fixture").unwrap();
        std::fs::write(
            root.join("source/translated")
                .join(TRANSLATION_MANIFEST_FILE_NAME),
            br#"{"pages":[]}"#,
        )
        .unwrap();
        let db = Arc::new(Db::new(root.join("jobs.db"), root.clone()));
        db.init().unwrap();
        let deps = JobPersistDeps::new(db, root.clone(), root.join("jobs"));
        let mut source = JobSnapshot::new("source".into(), CreateJobInput::default(), vec![]);
        source.artifacts = Some(JobArtifacts {
            source_pdf: Some("source/source.pdf".into()),
            translations_dir: Some("source/translated".into()),
            normalized_document_json: Some("source/document.v1.json".into()),
            ..Default::default()
        });
        deps.db.save_job(&source).unwrap();

        let mut input = CreateJobInput::default();
        input.source.artifact_job_id = "source".into();
        let stale = JobSnapshot::new("render".into(), input, vec![]);
        let mut canceled = stale.clone();
        canceled.status = JobStatusKind::Canceled;
        deps.db.save_job(&canceled).unwrap();

        let result = prepare_render_job_from_artifacts(&deps, stale.into_runtime());

        assert!(
            result.is_err(),
            "任务已终态时必须停下，不能让调用方接着起渲染进程"
        );
        assert!(
            matches!(
                deps.db.get_job("render").unwrap().status,
                JobStatusKind::Canceled
            ),
            "取消被 driver 的旧快照覆盖掉了：用户点了取消，任务却接着渲染"
        );
        drop(deps);
        std::fs::remove_dir_all(root).unwrap();
    }
}
