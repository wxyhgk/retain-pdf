use super::*;
use retainpdf_core::models::domain::JobArtifacts;
use retainpdf_core::models::request::CreateJobInput;

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
    use retainpdf_api_base::test_fixtures::minimal_pdf_bytes;
    use retainpdf_core::models::domain::{JobStatusKind, WorkflowKind};

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


/// 回归：原任务上又提交了一次原地精修（排队中，output_pdf 已清空），阅读仍然打开它上一份 PDF，
/// 而不是退回更早的重新排版。排序用上一份 PDF 的完成时间。
#[test]
fn a_queued_in_place_rerun_keeps_serving_its_previous_pdf() {
    use retainpdf_api_base::test_fixtures::minimal_pdf_bytes;
    use retainpdf_core::models::domain::{JobStatusKind, WorkflowKind};

    let root = std::env::temp_dir().join(format!("retain-reading-queued-{:016x}", fastrand::u64(..)));
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
    let mut original = job("original", "2026-10-06T13:38:13", "2026-10-09T17:35:34");
    let relayout = job("relayout", "2026-10-09T15:15:23", "2026-10-09T15:15:27");
    // 又点了一次精修：排队中，原地重跑把 output_pdf 挪到 previous_output_pdf、完成时间挪到 previous_finished_at。
    original.status = JobStatusKind::Queued;
    original.finished_at = None;
    let artifacts = original.artifacts.as_mut().unwrap();
    artifacts.previous_output_pdf = artifacts.output_pdf.take();
    artifacts.previous_finished_at = Some("2026-10-09T17:35:34".to_string());

    let sources = document_merge_sources(&[relayout.clone(), original.clone()], &root);
    let ranked: Vec<_> = sources.iter().map(|source| source.ranked.clone()).collect();
    assert_eq!(single_whole_document_job(&merge_plan(1, &ranked)), Some("original"));

    // 开始跑之后上一份 PDF 可能被改写：不再参与，退回重新排版的那份。
    original.status = JobStatusKind::Running;
    let sources = document_merge_sources(&[relayout, original], &root);
    let ranked: Vec<_> = sources.iter().map(|source| source.ranked.clone()).collect();
    let _ = std::fs::remove_dir_all(&root);
    assert_eq!(single_whole_document_job(&merge_plan(1, &ranked)), Some("relayout"));
}

/// `/reading` 和 `/translation-coverage` 每次请求都要知道每个任务译文 PDF 的页数。以前每次都把
/// 整份 PDF 用 lopdf 载入（解出全部对象和流）只为数页数；现在按文件戳（路径、大小、修改时间、
/// inode）缓存，文件没变就不再解析。
#[test]
fn a_job_pdf_is_parsed_once_while_it_stays_the_same_file() {
    use retainpdf_api_base::test_fixtures::minimal_pdf_bytes;
    use retainpdf_core::models::domain::{JobStatusKind, WorkflowKind};

    let root = std::env::temp_dir().join(format!("retain-reading-pagecount-{:016x}", fastrand::u64(..)));
    let rendered = root.join("jobs/a/rendered");
    std::fs::create_dir_all(&rendered).unwrap();
    let pdf = rendered.join("out.pdf");
    let bytes = minimal_pdf_bytes(595, 842);
    std::fs::write(&pdf, &bytes).unwrap();
    let mut job = snapshot("a", "2026-10-01T00:00:00", "jobs/a", "jobs/a/translated");
    job.status = JobStatusKind::Succeeded;
    job.workflow = WorkflowKind::Book;
    let artifacts = job.artifacts.as_mut().unwrap();
    artifacts.output_pdf = Some("jobs/a/rendered/out.pdf".to_string());
    artifacts.ocr_page_numbers = vec![1];
    let jobs = [job];
    assert_eq!(document_merge_sources(&jobs, &root).len(), 1);

    // 原地写成同样长度的乱码、改回原来的修改时间：戳没变。还能数出页数，说明没有再解析。
    let modified = std::fs::metadata(&pdf).unwrap().modified().unwrap();
    std::fs::write(&pdf, vec![b'x'; bytes.len()]).unwrap();
    std::fs::File::options().write(true).open(&pdf).unwrap().set_modified(modified).unwrap();
    let cached = document_merge_sources(&jobs, &root).len();

    // 文件真的变了（长度不同）：重新解析，乱码数不出页数，不参与合并。
    std::fs::write(&pdf, b"not a pdf at all").unwrap();
    let changed = document_merge_sources(&jobs, &root).len();
    let _ = std::fs::remove_dir_all(&root);
    assert_eq!(cached, 1, "文件没变却又把整份 PDF 解析了一遍");
    assert_eq!(changed, 0, "文件变了还在用旧页数");
}

fn source(job_id: &str, created_at: &str, pages: &[u32]) -> MergeSource {
    use super::super::plan::{Rank, RankedPages};
    use super::super::sources::BuildInputs;
    MergeSource {
        ranked: RankedPages {
            rank: Rank {
                producer_created_at: created_at.to_string(),
                finished_at: created_at.to_string(),
                created_at: created_at.to_string(),
                job_id: job_id.to_string(),
            },
            pages: pages.to_vec(),
        },
        inputs: BuildInputs {
            output_pdf: std::path::PathBuf::from(format!("/data/{job_id}.pdf")),
            ocr_page_numbers: pages.to_vec(),
            translations_dir: None,
            normalized_document: None,
            markdown_images_dir: None,
        },
    }
}

fn plan_for(sources: Vec<MergeSource>, selection: &ReadingSelection) -> Vec<PageSource> {
    let ranked: Vec<_> = select_sources(sources, selection).into_iter().map(|s| s.ranked).collect();
    super::super::plan::merge_plan(3, &ranked)
}

#[test]
fn a_version_reads_its_own_pages_over_its_base_whatever_the_dates() {
    // 来源版本（整本）比只重翻第 2 页的版本还晚提交：读第 2 页那个版本时它的页照样盖住来源版本
    let sources = || vec![source("base", "2026-11-05T00:00:00", &[1, 2, 3]), source("redo", "2026-11-01T00:00:00", &[2]), source("other", "2026-11-09T00:00:00", &[1, 2, 3])];
    let version = ReadingSelection::Version { layers: vec![vec!["base".into()], vec!["redo".into()]] };
    assert_eq!(plan_for(sources(), &version), vec![job_page("base", 0), job_page("redo", 0), job_page("base", 2)]);
    // 自动：逐页取最新；排除的任务（隐藏版本的）不用
    let auto = ReadingSelection::Auto { excluded: vec![] };
    assert_eq!(plan_for(sources(), &auto), vec![job_page("other", 0), job_page("other", 1), job_page("other", 2)]);
    let auto = ReadingSelection::Auto { excluded: vec!["other".into()] };
    assert_eq!(plan_for(sources(), &auto), vec![job_page("base", 0), job_page("base", 1), job_page("base", 2)]);
}
