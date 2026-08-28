// Tab «Dịch» — di chuyển từ khu vực tiến trình và khởi tạo của translation-workflow-dialog.
// UI liên quan đến dịch: BookTranslationWorkflowPanel / BookTranslateProgressPanel.

import { BookTranslationWorkflowPanel } from "../panels/BookTranslationWorkflowPanel.jsx";

/**
 * @param {object} props Truyền tiếp các business props cho BookTranslationWorkflowPanel
 */
export function BookDetailTranslateTab(props) {
  return (
    <div
      className="book-detail-tab-translate space-y-5"
      data-book-detail-tab="translate"
    >
      <BookTranslationWorkflowPanel {...props} />
    </div>
  );
}
