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
} from "@/platform/config/workflow-defaults.js";
// DEFAULT_MODEL_VERSION 与上面 18 个 DEFAULT_* 不同源，别一把梭。
import { DEFAULT_MODEL_VERSION } from "@/platform/config/model-constants.js";

// 工作流常量与归一化。
//
// 拷贝自 bootstrap/workflow-constants.js 与 bootstrap/workflow-normalizers.js:
// bootstrap/ 属旧 DI 装配层,architecture-boundaries 门禁禁止 pages import;
// 常量本体仍从 src/js/config/(纯逻辑)取,拷贝的只是组装样板。
// home cutover 删除旧世界时,bootstrap 版随之退役,此处成为唯一出处。

export const WORKFLOW_BOOK = "book";
export const WORKFLOW_TRANSLATE = "translate";
export const WORKFLOW_RENDER = "render";
export const WORKFLOW_OCR = "ocr";

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
    WORKFLOW_OCR,
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
