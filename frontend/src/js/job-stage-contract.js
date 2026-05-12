export const JOB_STAGE_GROUPS = Object.freeze({
  queued: Object.freeze(["queued", "pending"]),
  ocr: Object.freeze([
    "startup",
    "running",
    "ocr_submitting",
    "ocr_upload",
    "mineru_upload",
    "ocr_processing",
    "mineru_processing",
    "ocr_result_ready",
    "normalizing",
    "render_prepare",
  ]),
  translate: Object.freeze([
    "translation_prepare",
    "translating",
    "translation_batches",
    "continuation_review",
    "page_policies",
    "domain_inference",
    "garbled_repair",
  ]),
  render: Object.freeze([
    "rendering",
    "saving",
    "render_prepare",
    "compile",
    "overlay",
  ]),
  done: Object.freeze(["finished", "complete", "done", "succeeded"]),
});

export const USER_STAGE_KEYS = Object.freeze(["queued", "ocr", "translate", "render", "done"]);

export function normalizedStageValue(value = "") {
  return `${value || ""}`.trim().toLowerCase();
}

export function stageGroupForRawStage(rawStage = "", status = "") {
  const raw = normalizedStageValue(rawStage);
  const normalizedStatus = normalizedStageValue(status);
  if (normalizedStatus === "succeeded" && JOB_STAGE_GROUPS.done.some((item) => raw.includes(item))) {
    return "done";
  }
  for (const key of USER_STAGE_KEYS) {
    if (JOB_STAGE_GROUPS[key]?.some((item) => raw.includes(item))) {
      if (key === "done" && normalizedStatus !== "succeeded") {
        return "render";
      }
      return key;
    }
  }
  if (raw.includes("translat") || raw.includes("cross")) {
    return "translate";
  }
  if (raw.includes("render") || raw.includes("sav")) {
    return "render";
  }
  if (raw.includes("ocr") || raw.includes("mineru") || raw.includes("paddle") || raw.includes("normaliz")) {
    return "ocr";
  }
  return raw;
}

export function rawStageOfPayload(payload = {}) {
  return `${payload?.current_stage || payload?.stage || payload?.runtime?.current_stage || ""}`.trim().toLowerCase();
}

export function ocrProgressFallbackForRawStage(rawStage = "") {
  const raw = normalizedStageValue(rawStage);
  if (raw.includes("ocr_upload") || raw.includes("ocr_submitting")) {
    return { current: 1, total: 4, text: "OCR 准备中" };
  }
  if (raw.includes("ocr_processing") || raw.includes("mineru_processing")) {
    return { current: 2, total: 4, text: "OCR 处理中" };
  }
  if (raw.includes("ocr_result_ready")) {
    return { current: 3, total: 4, text: "OCR 结果就绪" };
  }
  if (raw.includes("normaliz")) {
    return { current: 4, total: 4, text: "OCR 标准化" };
  }
  return null;
}

export function visualStageKeyForRawStage(rawStage = "", stageKey = "") {
  const raw = normalizedStageValue(rawStage);
  if (stageKey !== "ocr") {
    return stageKey;
  }
  if (raw.includes("ocr_upload") || raw.includes("mineru_upload") || raw.includes("ocr_submitting")) {
    return "ocr_upload";
  }
  if (raw.includes("ocr_processing") || raw.includes("mineru_processing")) {
    return "ocr_processing";
  }
  if (raw.includes("ocr_result_ready")) {
    return "ocr_result_ready";
  }
  if (raw.includes("normaliz")) {
    return "ocr_normalizing";
  }
  return stageKey;
}
