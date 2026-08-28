import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_BODY_FONT_SIZE_FACTOR,
  DEFAULT_BODY_LEADING_FACTOR,
  DEFAULT_CLASSIFY_BATCH_SIZE,
  DEFAULT_COMPILE_WORKERS,
  DEFAULT_INNER_BBOX_DENSE_SHRINK_X,
  DEFAULT_INNER_BBOX_DENSE_SHRINK_Y,
  DEFAULT_INNER_BBOX_SHRINK_X,
  DEFAULT_INNER_BBOX_SHRINK_Y,
  DEFAULT_LANGUAGE,
  DEFAULT_MODE,
  DEFAULT_PDF_COMPRESS_DPI,
  DEFAULT_RENDER_MODE,
  DEFAULT_RULE_PROFILE,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_TRANSLATED_PDF_NAME,
  DEFAULT_TYPST_FONT_FAMILY,
  DEFAULT_WORKERS,
  DEFAULT_MODEL_VERSION,
} from "../../composition/external.js";

// Hằng số và chuẩn hóa quy trình.
//
// Sao chép từ bootstrap/workflow-constants.js và bootstrap/workflow-normalizers.js:
// bootstrap/ thuộc tầng lắp ráp DI cũ, cổng kiểm soát architecture-boundaries cấm pages
// import; bản thân hằng số vẫn lấy từ src/js/config/ (logic thuần), phần sao chép chỉ là
// khuôn lắp ráp. Khi home cutover xóa thế giới cũ, bản bootstrap theo đó cũng về hưu,
// nơi này trở thành xuất xứ duy nhất.

export const WORKFLOW_BOOK = "book";
export const WORKFLOW_TRANSLATE = "translate";
export const WORKFLOW_RENDER = "render";

export function workflowConstants() {
  return {
    DEFAULT_WORKERS,
    DEFAULT_BATCH_SIZE,
    DEFAULT_CLASSIFY_BATCH_SIZE,
    DEFAULT_COMPILE_WORKERS,
    DEFAULT_TIMEOUT_SECONDS,
    DEFAULT_MODEL_VERSION,
    DEFAULT_LANGUAGE,
    DEFAULT_MODE,
    DEFAULT_RULE_PROFILE,
    DEFAULT_RENDER_MODE,
    DEFAULT_TYPST_FONT_FAMILY,
    DEFAULT_PDF_COMPRESS_DPI,
    DEFAULT_TRANSLATED_PDF_NAME,
    DEFAULT_BODY_FONT_SIZE_FACTOR,
    DEFAULT_BODY_LEADING_FACTOR,
    DEFAULT_INNER_BBOX_SHRINK_X,
    DEFAULT_INNER_BBOX_SHRINK_Y,
    DEFAULT_INNER_BBOX_DENSE_SHRINK_X,
    DEFAULT_INNER_BBOX_DENSE_SHRINK_Y,
    WORKFLOW_BOOK,
    WORKFLOW_TRANSLATE,
    WORKFLOW_RENDER,
  };
}

export function normalizeWorkflow(value, {
  book = WORKFLOW_BOOK,
  translate = WORKFLOW_TRANSLATE,
  render = WORKFLOW_RENDER,
} = {}) {
  const workflow = `${value || ""}`.trim();
  if (workflow === translate || workflow === render) {
    return workflow;
  }
  return book;
}

export function normalizeMathMode(value) {
  return `${value || ""}`.trim() === "placeholder" ? "placeholder" : "direct_typst";
}
