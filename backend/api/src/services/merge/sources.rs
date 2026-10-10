//! 从任务里读出合并要用的两样东西：排序和页号（交给 `plan`）、去哪读产物（交给
//! `derived_artifacts::merged`）。这里是唯一读磁盘、认识 `JobSnapshot` 的一层。

use std::path::{Path, PathBuf};

use crate::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use crate::services::document_pages::translated_document_pages;
use crate::storage_paths::{
    resolve_data_path, resolve_normalized_document, resolve_ocr_markdown_images_dir,
    resolve_output_pdf,
};

use super::plan::{Rank, RankedPages};

/// 一个任务能不能参与合并、覆盖哪些文档页：输出 PDF 第 `i` 页 = 文档第 `pages[i]` 页。
///
/// 只有同时满足这些的任务才算「覆盖」，否则返回 `None`：
///
/// - **成功了**。部分成功的任务没有 PDF —— 翻译导出门禁是全过或全不过（有页进了 dead
///   letter 整个任务就失败），所以不存在「这个任务翻好了其中几页」，粒度是整个任务。
///   取消的任务即使磁盘上有 PDF 也不算：取消可能在 PDF 写完之后才到。
/// - **不是纯 OCR 任务**。它没有译文。
/// - **输出 PDF 真的在、而且读得出页数**。原地重新排版（`rerun.rs`）一开始就删掉
///   `rendered/`，那段时间这个任务不覆盖任何页 —— 现算自然就看到了。
/// - **PDF 页数 == 算出来的覆盖页数**。对不上就拒绝：拼错页比不拼更糟，用户会看到
///   第 7 页的译文出现在第 3 页的位置上。
///
/// # 为什么现算、不在任务成功时持久化
///
/// `ocr_page_numbers` 和 `start/end` 本身已经持久化、对完成的任务不再变，覆盖范围完全
/// 可以由它们推出来。持久化一份反而要在原地重新排版时记得重算，否则就和磁盘对不上。
///
/// # 用的是「实际执行」的范围，不是用户意图
///
/// `start/end` 是 `prepare.rs` 改写过的、流水线真正跑的本地位置。**不用**
/// `translation.page_ranges`：那是用户想要的，而 `resolve_translation_selection` 在拿不到
/// 文档页数时会把它整个忽略、按本地位置照跑 —— 用户只要第 5-8 页，实际可能翻了整份
/// OCR。按实际执行算，合并至少不会拼错。
pub(crate) fn covered_pages(
    status: &JobStatusKind,
    workflow: &WorkflowKind,
    ocr_page_numbers: &[u32],
    start_page: i64,
    end_page: i64,
    output_pdf_page_count: Option<usize>,
) -> Option<Vec<u32>> {
    if !matches!(status, JobStatusKind::Succeeded | JobStatusKind::Queued) || *workflow == WorkflowKind::Ocr {
        return None;
    }
    let page_count = output_pdf_page_count?;
    let pages = translated_document_pages(ocr_page_numbers, start_page, end_page)?;
    (pages.len() == page_count).then_some(pages)
}

/// 拼的时候去哪读这个任务的产物。合并计划用不到这些。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BuildInputs {
    pub output_pdf: PathBuf,
    /// OCR 本地页 `L` = 文档第 `ocr_page_numbers[L]` 页（数据层改写页号用）。
    pub ocr_page_numbers: Vec<u32>,
    pub translations_dir: Option<PathBuf>,
    pub normalized_document: Option<PathBuf>,
    pub markdown_images_dir: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MergeSource {
    pub ranked: RankedPages,
    pub inputs: BuildInputs,
}

/// 读磁盘的那一层：解析输出 PDF、读它的页数，交给 `covered_pages` 判定。
///
/// `producer_created_at` 是**产出这份译文的那个任务**的提交时间，必须由调用方给 —— 它要
/// 查另一个任务（`translations_dir` 的主人），这里拿不到。刻意不设默认值：默认成自己的
/// 提交时间的话，忘了查也照样能跑，换一次字体就会让旧译文盖掉后来专门重翻的页。
pub(crate) fn job_merge_source(
    job: &JobSnapshot,
    data_root: &Path,
    producer_created_at: &str,
) -> Option<MergeSource> {
    let artifacts = job.artifacts.as_ref()?;
    // 原地重跑（重排 / 精修）还在排队：新 PDF 还没出来，上一份还在磁盘上，就用它。开始跑之后
    // 它可能被改写，不再参与（covered_pages 只认成功和排队）。
    let queued_rerun = job.status == JobStatusKind::Queued;
    let output_pdf = if queued_rerun {
        artifacts
            .previous_output_pdf
            .as_deref()
            .and_then(|path| resolve_data_path(data_root, path).ok())
    } else {
        resolve_output_pdf(job, data_root)
    }
    .filter(|path| path.is_file());
    let page_count = output_pdf
        .as_deref()
        .and_then(|path| lopdf::Document::load(path).ok())
        .map(|document| document.get_pages().len());
    let pages = covered_pages(
        &job.status,
        &job.workflow,
        &artifacts.ocr_page_numbers,
        job.request_payload.translation.start_page,
        job.request_payload.translation.end_page,
        page_count,
    )?;
    Some(MergeSource {
        ranked: RankedPages {
            rank: Rank {
                producer_created_at: producer_created_at.to_string(),
                finished_at: if queued_rerun { artifacts.previous_finished_at.clone() } else { job.finished_at.clone() }
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| job.created_at.clone()),
                created_at: job.created_at.clone(),
                job_id: job.job_id.clone(),
            },
            pages,
        },
        inputs: BuildInputs {
            output_pdf: output_pdf?,
            ocr_page_numbers: artifacts.ocr_page_numbers.clone(),
            translations_dir: artifacts
                .translations_dir
                .as_deref()
                .and_then(|path| resolve_data_path(data_root, path).ok()),
            normalized_document: resolve_normalized_document(job, data_root)
                .filter(|path| path.is_file()),
            markdown_images_dir: resolve_ocr_markdown_images_dir(job, data_root),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::covered_pages;
    use crate::models::domain::{JobStatusKind, WorkflowKind};

    const OK: JobStatusKind = JobStatusKind::Succeeded;

    #[test]
    fn a_succeeded_translation_job_covers_its_mapped_pages() {
        let ocr = [6, 7, 8, 9, 10];
        assert_eq!(
            covered_pages(&OK, &WorkflowKind::Book, &ocr, 1, 3, Some(3)),
            Some(vec![7, 8, 9])
        );
    }

    #[test]
    fn only_succeeded_and_queued_reruns_cover_anything() {
        // 部分成功不存在（导出门禁全过或全不过）；取消的即使有 PDF 也不算。排队中的只有原地重跑
        // 留着上一份 PDF 时才会走到这里（job_merge_source 给出页数），见下面的回归测试。
        let ocr = [1, 2, 3];
        assert_eq!(covered_pages(&JobStatusKind::Queued, &WorkflowKind::Book, &ocr, 0, -1, None), None);
        for status in [
            JobStatusKind::Running,
            JobStatusKind::Failed,
            JobStatusKind::Canceled,
        ] {
            assert_eq!(
                covered_pages(&status, &WorkflowKind::Book, &ocr, 0, -1, Some(3)),
                None,
                "{status:?} 的任务被当成了覆盖"
            );
        }
    }

    #[test]
    fn an_ocr_only_job_covers_nothing() {
        // 它没有译文。不排除的话，重新 OCR 一次就会让原文盖掉译文。
        let ocr = [1, 2, 3];
        assert_eq!(
            covered_pages(&OK, &WorkflowKind::Ocr, &ocr, 0, -1, Some(3)),
            None
        );
    }

    #[test]
    fn translate_and_render_workflows_both_count() {
        let ocr = [1, 2];
        for workflow in [WorkflowKind::Book, WorkflowKind::Translate, WorkflowKind::Render] {
            assert_eq!(
                covered_pages(&OK, &workflow, &ocr, 0, -1, Some(2)),
                Some(vec![1, 2]),
                "{workflow:?} 没被算作覆盖"
            );
        }
    }

    #[test]
    fn a_missing_output_pdf_covers_nothing() {
        // 原地重新排版一开始就删掉 rendered/，那段时间不覆盖任何页。
        let ocr = [1, 2, 3];
        assert_eq!(
            covered_pages(&OK, &WorkflowKind::Book, &ocr, 0, -1, None),
            None
        );
    }

    #[test]
    fn a_page_count_mismatch_is_rejected_rather_than_stitched_wrong() {
        // 映射说 3 页，PDF 只有 2 页 —— 拼进去就是错页。宁可不拼。
        let ocr = [6, 7, 8];
        assert_eq!(
            covered_pages(&OK, &WorkflowKind::Book, &ocr, 0, -1, Some(2)),
            None,
            "页数对不上却被接受了"
        );
        assert_eq!(
            covered_pages(&OK, &WorkflowKind::Book, &ocr, 0, -1, Some(4)),
            None,
            "PDF 比映射多一页也该拒绝"
        );
    }

    #[test]
    fn an_unmappable_range_covers_nothing() {
        let ocr = [1, 2, 3];
        assert_eq!(
            covered_pages(&OK, &WorkflowKind::Book, &ocr, 0, 9, Some(10)),
            None
        );
        assert_eq!(
            covered_pages(&OK, &WorkflowKind::Book, &[], 0, -1, Some(0)),
            None,
            "OCR 一页都没覆盖时不该返回空覆盖"
        );
    }
}

#[cfg(test)]
mod job_merge_source_tests {
    use super::job_merge_source;
    use crate::api_tests::jobs_common::minimal_pdf_bytes;
    use crate::models::domain::{JobArtifacts, JobSnapshot, JobStatusKind, WorkflowKind};
    use crate::models::request::CreateJobInput;

    struct DataRoot(std::path::PathBuf);

    impl Drop for DataRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// 一个复用 OCR 的范围任务：OCR 来自 `ocr-job`，它自己的目录里没有 md/。
    fn reuse_job(data_root: &std::path::Path, ocr_page_numbers: Vec<u32>) -> JobSnapshot {
        let ocr_job = data_root.join("jobs/ocr-job");
        std::fs::create_dir_all(ocr_job.join("ocr/normalized")).unwrap();
        std::fs::create_dir_all(ocr_job.join("md/images")).unwrap();
        std::fs::write(ocr_job.join("ocr/normalized/document.v1.json"), b"{}").unwrap();
        let rendered = data_root.join("jobs/reuse-job/rendered");
        std::fs::create_dir_all(&rendered).unwrap();
        std::fs::write(rendered.join("out.pdf"), minimal_pdf_bytes(595, 842)).unwrap();

        let mut job = JobSnapshot::new("reuse-job".to_string(), CreateJobInput::default(), vec![]);
        job.status = JobStatusKind::Succeeded;
        job.workflow = WorkflowKind::Book;
        job.created_at = "2026-10-03T00:00:00".to_string();
        job.request_payload.translation.start_page = 0;
        job.request_payload.translation.end_page = -1;
        job.artifacts = Some(JobArtifacts {
            job_root: Some("jobs/reuse-job".to_string()),
            output_pdf: Some("jobs/reuse-job/rendered/out.pdf".to_string()),
            normalized_document_json: Some("jobs/ocr-job/ocr/normalized/document.v1.json".to_string()),
            translations_dir: Some("jobs/reuse-job/translated".to_string()),
            ocr_page_numbers,
            ..JobArtifacts::default()
        });
        job
    }

    fn data_root() -> DataRoot {
        DataRoot(std::env::temp_dir().join(format!("retain-merge-source-{:016x}", fastrand::u64(..))))
    }

    #[test]
    fn reads_rank_pages_and_build_inputs_from_a_job() {
        let root = data_root();
        let job = reuse_job(&root.0, vec![5]);
        let source = job_merge_source(&job, &root.0, "2026-10-01T00:00:00").expect("该参与合并");

        // 排序：产出者时间用调用方给的，不是自己的 created_at。
        assert_eq!(source.ranked.rank.producer_created_at, "2026-10-01T00:00:00");
        assert_eq!(source.ranked.rank.created_at, "2026-10-03T00:00:00");
        assert_eq!(source.ranked.rank.finished_at, "2026-10-03T00:00:00", "没有完成时间时退回提交时间");
        assert_eq!(source.ranked.rank.job_id, "reuse-job");
        let mut finished = job.clone();
        finished.finished_at = Some("2026-10-04T08:00:00".to_string());
        let source = job_merge_source(&finished, &root.0, "2026-10-01T00:00:00").expect("该参与合并");
        assert_eq!(source.ranked.rank.finished_at, "2026-10-04T08:00:00");
        assert_eq!(source.ranked.pages, vec![5], "1 页的输出 PDF 应该是文档第 5 页");

        // 构建输入：图片目录来自提供 OCR 的任务。
        assert_eq!(source.inputs.output_pdf, root.0.join("jobs/reuse-job/rendered/out.pdf"));
        assert_eq!(source.inputs.ocr_page_numbers, vec![5]);
        assert_eq!(source.inputs.translations_dir, Some(root.0.join("jobs/reuse-job/translated")));
        assert_eq!(
            source.inputs.normalized_document,
            Some(root.0.join("jobs/ocr-job/ocr/normalized/document.v1.json"))
        );
        assert_eq!(source.inputs.markdown_images_dir, Some(root.0.join("jobs/ocr-job/md/images")));
    }

    #[test]
    fn a_pdf_page_count_that_disagrees_with_the_mapping_keeps_the_job_out() {
        // 映射说 2 页，磁盘上的 PDF 只有 1 页。
        let root = data_root();
        let job = reuse_job(&root.0, vec![5, 6]);
        assert_eq!(job_merge_source(&job, &root.0, "2026-10-01T00:00:00"), None);
    }

    #[test]
    fn a_job_whose_output_pdf_was_removed_keeps_out() {
        // 原地重新排版一开始就删掉 rendered/。
        let root = data_root();
        let job = reuse_job(&root.0, vec![5]);
        std::fs::remove_dir_all(root.0.join("jobs/reuse-job/rendered")).unwrap();
        assert_eq!(job_merge_source(&job, &root.0, "2026-10-01T00:00:00"), None);
    }
}
