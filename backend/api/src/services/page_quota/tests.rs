use super::billable_pages;
use crate::models::domain::{CreateJobInput, ResolvedJobSpec, WorkflowKind};

fn spec(workflow: WorkflowKind, edit: impl FnOnce(&mut CreateJobInput)) -> ResolvedJobSpec {
    let mut input = CreateJobInput { workflow, ..Default::default() };
    edit(&mut input);
    ResolvedJobSpec::from_input(input)
}

#[test]
fn whole_document_by_default() {
    assert_eq!(billable_pages(&spec(WorkflowKind::Book, |_| {}), 12), 12);
    assert_eq!(billable_pages(&spec(WorkflowKind::Ocr, |_| {}), 12), 12);
    assert_eq!(
        billable_pages(&spec(WorkflowKind::Translate, |_| {}), 12),
        12
    );
}

#[test]
fn ocr_page_ranges_select_pages() {
    let ocr = spec(WorkflowKind::Ocr, |input| {
        input.ocr.page_ranges = "1, 3-5".into()
    });
    assert_eq!(billable_pages(&ocr, 12), 4);
    // 选错了照常按整本算：任务会失败，失败全额退。
    let broken = spec(WorkflowKind::Ocr, |input| {
        input.ocr.page_ranges = "40-50".into()
    });
    assert_eq!(billable_pages(&broken, 12), 12);
}

#[test]
fn translation_selection_by_document_pages() {
    let book = spec(WorkflowKind::Book, |input| {
        input.translation.page_ranges = vec![2, 3, 3, 99]
    });
    assert_eq!(billable_pages(&book, 12), 2, "去重、越界的不算");
}

#[test]
fn translation_selection_by_start_and_end() {
    let book = spec(WorkflowKind::Book, |input| {
        input.translation.start_page = 2;
        input.translation.end_page = 5;
    });
    assert_eq!(billable_pages(&book, 12), 4);
    let to_end = spec(WorkflowKind::Book, |input| {
        input.translation.start_page = 10
    });
    assert_eq!(billable_pages(&to_end, 12), 2);
}

#[test]
fn translation_never_exceeds_the_ocr_selection() {
    let book = spec(WorkflowKind::Book, |input| {
        input.ocr.page_ranges = "1-3".into();
        input.translation.end_page = 9;
    });
    assert_eq!(billable_pages(&book, 12), 3);
}

#[test]
fn render_is_free_and_bad_ranges_still_cost_a_page() {
    assert_eq!(billable_pages(&spec(WorkflowKind::Render, |_| {}), 12), 0);
    let inverted = spec(WorkflowKind::Book, |input| {
        input.translation.start_page = 5;
        input.translation.end_page = 2;
    });
    assert_eq!(billable_pages(&inverted, 12), 1);
    assert_eq!(billable_pages(&spec(WorkflowKind::Book, |_| {}), 0), 0);
}
