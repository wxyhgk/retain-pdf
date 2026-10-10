use super::*;
use crate::models::request::CreateJobInput;

fn job_page(id: &str, local: usize) -> PageSource {
    PageSource::Job { job_id: id.to_string(), local_index: local }
}

#[test]
fn a_single_job_covering_the_whole_document_in_order_is_opened_directly() {
    let plan = [job_page("a", 0), job_page("a", 1), job_page("a", 2)];
    assert_eq!(single_whole_document_job(&plan), Some("a"));
}

#[test]
fn anything_short_of_one_whole_document_job_needs_a_merge() {
    // 单个任务只覆盖一部分：它的 PDF 只有那几页，对照模式会错页 —— 也要合并。
    assert_eq!(single_whole_document_job(&[job_page("a", 0), PageSource::Original]), None);
    assert_eq!(single_whole_document_job(&[PageSource::Original, job_page("a", 0)]), None);
    // 两个任务。
    assert_eq!(single_whole_document_job(&[job_page("a", 0), job_page("b", 0)]), None);
    // 一个任务但顺序不对（不会真的发生，但不能当成整本直接打开）。
    assert_eq!(single_whole_document_job(&[job_page("a", 1), job_page("a", 0)]), None);
    assert_eq!(single_whole_document_job(&[]), None);
}

fn snapshot(job_id: &str, created_at: &str, job_root: &str, translations_dir: &str) -> JobSnapshot {
    let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec![]);
    job.created_at = created_at.to_string();
    job.artifacts = Some(JobArtifacts {
        job_root: Some(job_root.to_string()),
        translations_dir: Some(translations_dir.to_string()),
        ..JobArtifacts::default()
    });
    job
}

#[test]
fn a_render_job_ranks_by_the_job_that_produced_its_translation() {
    let data_root = Path::new("/data");
    let producer = snapshot("p", "2026-10-01T00:00:00", "jobs/p", "jobs/p/translated");
    let relayout = snapshot("r", "2026-10-05T00:00:00", "jobs/r", "jobs/p/translated");
    let jobs = [producer.clone(), relayout.clone()];
    assert_eq!(producer_created_at(&relayout, &jobs, data_root), "2026-10-01T00:00:00");
    assert_eq!(producer_created_at(&producer, &jobs, data_root), "2026-10-01T00:00:00");
}

#[test]
fn a_render_job_whose_producer_is_gone_falls_back_to_its_own_time() {
    let relayout = snapshot("r", "2026-10-05T00:00:00", "jobs/r", "jobs/deleted/translated");
    assert_eq!(producer_created_at(&relayout, &[relayout.clone()], Path::new("/data")), "2026-10-05T00:00:00");
}

#[test]
fn a_job_root_that_merely_shares_a_prefix_is_not_the_producer() {
    // jobs/p 不是 jobs/p2/translated 的产出者 —— 按路径组件比，不按字符串前缀比。
    let data_root = Path::new("/data");
    let lookalike = snapshot("p", "2026-09-01T00:00:00", "jobs/p", "jobs/p/translated");
    let job = snapshot("p2", "2026-10-05T00:00:00", "jobs/p2", "jobs/p2/translated");
    assert_eq!(producer_created_at(&job, &[lookalike, job.clone()], data_root), "2026-10-05T00:00:00");
}


/// 回归：原始翻译任务上原地精修（重写了它的 PDF）之后，阅读要打开它，而不是之前另建的
/// 重新排版任务。几个任务同一份译文、同一个产出者；原任务提交得最早，但最后跑完。
#[test]
fn reading_opens_the_in_place_refined_original_rather_than_an_earlier_relayout() {
    use crate::api_tests::jobs_common::minimal_pdf_bytes;
    use crate::models::domain::{JobStatusKind, WorkflowKind};

    let root = std::env::temp_dir().join(format!("retain-reading-refine-{:016x}", fastrand::u64(..)));
    let job = |job_id: &str, created_at: &str, finished_at: &str| {
        let rendered = root.join(format!("jobs/{job_id}/rendered"));
        std::fs::create_dir_all(&rendered).unwrap();
        std::fs::write(rendered.join("out.pdf"), minimal_pdf_bytes(595, 842)).unwrap();
        let mut job = snapshot(job_id, created_at, &format!("jobs/{job_id}"), "jobs/original/translated");
        job.status = JobStatusKind::Succeeded;
        job.workflow = WorkflowKind::Render;
        job.finished_at = Some(finished_at.to_string());
        let artifacts = job.artifacts.as_mut().unwrap();
        artifacts.output_pdf = Some(format!("jobs/{job_id}/rendered/out.pdf"));
        artifacts.ocr_page_numbers = vec![1];
        job
    };
    let original = job("original", "2026-10-06T13:38:13", "2026-10-09T17:00:00");
    let relayout = job("relayout", "2026-10-09T06:35:45", "2026-10-09T06:40:00");
    let jobs = [relayout, original];

    let sources = document_merge_sources(&jobs, &root);
    let ranked: Vec<_> = sources.iter().map(|source| source.ranked.clone()).collect();
    let plan = merge_plan(1, &ranked);
    let _ = std::fs::remove_dir_all(&root);
    assert_eq!(sources.len(), 2, "两个任务都应参与");
    assert_eq!(single_whole_document_job(&plan), Some("original"), "打开的是精修之前排的旧 PDF");
}
