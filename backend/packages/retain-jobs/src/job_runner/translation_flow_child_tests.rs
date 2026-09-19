//! OCR 子任务必须写入 `jobs.document_id`，否则它的产物永远无法被复用。
//!
//! 现象：一体化任务（book）在翻译/渲染阶段失败后，重试仍要整本重跑 OCR，
//! 尽管 OCR 子任务本身是 succeeded 的。
//!
//! 根因在**列表查询**，不在单条查询：
//!   * `get_document_by_job_id` 有 COALESCE 回退（document_id 为空时用
//!     upload_id 反查 uploads.content_hash），所以后端的复用校验本来就能过；
//!   * 但 `list_jobs_for_document` 是裸的 `WHERE jobs.document_id = ?1`，
//!     **没有回退**。子任务的 document_id 是 NULL，于是它压根不出现在该文档的
//!     任务列表里；前端 `selectReusableOcrJob` 只能从这个列表里挑复用候选，
//!     自然永远挑不到——用户看不到「复用已有 OCR」这个选项。
//!
//! 主任务的归属由 `lifecycle.rs` 的 `update_document_after_job` 在终态时补上，
//! 而 OCR 子任务由 `translation_flow_child.rs` 独立创建并直接落库，从不经过
//! 那条流程。
//!
//! 注：`ocr_stage_succeeded` 本身很宽容（父任务失败也认子任务的 succeeded），
//! MinerU 也不在排除名单里——卡住复用的只是这个归属缺口。

use super::{create_ocr_child_job, mark_parent_ocr_submitting, TranslationUploadSource};
use crate::job_runner::ProcessRuntimeDeps;
use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::models::domain::UploadRecord;
use crate::models::request::CreateJobInput;
use crate::storage_paths::JobPaths;

fn seed_upload(deps: &ProcessRuntimeDeps, upload_id: &str, content_hash: &str) {
    let stored = deps.persist.data_root.join(format!("{upload_id}.pdf"));
    std::fs::create_dir_all(&deps.persist.data_root).unwrap();
    std::fs::write(&stored, b"%PDF-1.4\n").unwrap();
    deps.db
        .save_upload_with_document(&UploadRecord {
            upload_id: upload_id.to_string(),
            filename: "sample.pdf".to_string(),
            stored_path: stored.to_string_lossy().to_string(),
            bytes: 9,
            page_count: 1,
            uploaded_at: crate::models::domain::now_iso(),
            developer_mode: false,
            content_hash: content_hash.to_string(),
        })
        .unwrap();
}

#[test]
fn ocr_child_job_inherits_document_ownership() {
    let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
    let upload_id = "upload-ocr-child";
    let content_hash = "doc-hash-ocr-child";
    seed_upload(&deps, upload_id, content_hash);

    let mut parent_snapshot = JobSnapshot::new(
        "job-parent".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    parent_snapshot.upload_id = Some(upload_id.to_string());
    deps.db.save_job(&parent_snapshot).unwrap();
    let mut parent = parent_snapshot.into_runtime();
    // 父任务的归属走既有路径（等价于 lifecycle 终态时的补齐）
    deps.db
        .link_job_to_document(&parent.job_id, upload_id)
        .unwrap();

    let paths = JobPaths::for_job(&deps.persist.data_root, &parent.job_id);
    let source = TranslationUploadSource {
        upload_id: upload_id.to_string(),
    };
    create_ocr_child_job(&deps, &mut parent, &paths, &source).unwrap();

    let child_id = format!("{}-ocr", parent.job_id);
    let document_id = deps
        .db
        .get_document_by_job_id(&parent.job_id)
        .expect("query parent document")
        .expect("parent must be linked")
        .document_id;

    // 关键契约：子任务要出现在该文档的任务列表里。
    // 这条列表查询是裸的 `WHERE jobs.document_id = ?1`，没有 COALESCE 回退，
    // 所以只有真正写入了 document_id 才看得见——前端的复用候选正是从这里挑。
    let jobs = deps
        .db
        .list_jobs_for_document(&document_id, 50, 0)
        .expect("list jobs for document");
    let child_visible = jobs.iter().any(|job| job.job_id == child_id);

    assert!(
        child_visible,
        "OCR 子任务必须出现在文档任务列表中，否则前端 selectReusableOcrJob 永远挑不到它，\
         表现为「OCR 成功了但重试仍要整本重跑」。当前列表：{:?}",
        jobs.iter().map(|job| job.job_id.as_str()).collect::<Vec<_>>(),
    );
}


/// driver 手上的 `parent_job` 是阶段开始时的内存快照，永远是 Running；
/// 用户点取消走的是另一条 CAS 写。这里断言 driver 不能把那次取消盖掉。
///
/// 反证方式：把 `mark_parent_ocr_submitting` 里的 CAS 换回
/// `persist_runtime_job_with_resources`，这个测试必须变红——写会成功、
/// DB 里的 canceled 变成 running，函数也不再返回 Err。
#[test]
fn canceled_parent_is_not_revived_when_submitting_ocr() {
    let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
    let upload_id = "upload-ocr-submit-canceled";
    seed_upload(&deps, upload_id, "doc-hash-ocr-submit-canceled");

    let mut stale = JobSnapshot::new(
        "job-parent-submit-canceled".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    stale.upload_id = Some(upload_id.to_string());
    // 先把「用户已取消」这个事实落库，再拿取消之前的快照去推进阶段。
    let mut canceled = stale.clone();
    canceled.status = JobStatusKind::Canceled;
    deps.db.save_job(&canceled).unwrap();
    let mut parent = stale.into_runtime();

    let result = mark_parent_ocr_submitting(&deps, &mut parent);

    assert!(
        result.is_err(),
        "父任务已终态时必须停下：再往下就是建 OCR 子任务、调付费接口"
    );
    assert!(
        matches!(
            deps.db.get_job("job-parent-submit-canceled").unwrap().status,
            JobStatusKind::Canceled
        ),
        "取消被 driver 的旧快照覆盖回 running——用户点了取消，最终却看到「失败」，OCR 的钱白花"
    );
}

/// 取消也可能恰好卡在「建完子任务、回写父任务」这个窗口里。
///
/// 反证方式：把 `create_ocr_child_job` 结尾那次父任务 CAS 换回
/// `persist_runtime_job_with_resources`，这个测试必须变红。
#[test]
fn canceled_parent_is_not_revived_when_creating_the_ocr_child() {
    let deps = crate::job_runner::process_runner::tests::test_runtime_deps(1);
    let upload_id = "upload-ocr-child-canceled";
    seed_upload(&deps, upload_id, "doc-hash-ocr-child-canceled");

    let mut stale = JobSnapshot::new(
        "job-parent-child-canceled".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    stale.upload_id = Some(upload_id.to_string());
    let mut canceled = stale.clone();
    canceled.status = JobStatusKind::Canceled;
    deps.db.save_job(&canceled).unwrap();
    let mut parent = stale.into_runtime();

    let paths = JobPaths::for_job(&deps.persist.data_root, &parent.job_id);
    let source = TranslationUploadSource {
        upload_id: upload_id.to_string(),
    };
    let result = create_ocr_child_job(&deps, &mut parent, &paths, &source);

    assert!(
        result.is_err(),
        "父任务已终态时必须停下，不能把子任务交给调用方去驱动"
    );
    assert!(
        matches!(
            deps.db.get_job("job-parent-child-canceled").unwrap().status,
            JobStatusKind::Canceled
        ),
        "回写 artifacts.ocr_job_id 时把 canceled 覆盖成了 running"
    );
}
