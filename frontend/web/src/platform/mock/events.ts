import { currentMockScenario, isoOffsetMinutes } from "./scenario.js";

export function buildMockEvents(scenario = currentMockScenario()) {
  const items: any[] = [
    {
      seq: 1,
      ts: isoOffsetMinutes(-10),
      level: "info",
      stage: "queued",
      stage_detail: "PDF 上传完成，任务已进入队列",
      event_type: "stage_progress",
      event: "stage_progress",
      message: "PDF 上传完成，任务已进入队列",
      progress_current: 2,
      progress_total: 12,
      payload: { scenario },
    },
  ];
  if (["ocr", "translate", "render", "done", "failed"].includes(scenario)) {
    items.push({
      seq: 2,
      ts: isoOffsetMinutes(-8),
      level: "info",
      stage: "ocr_processing",
      stage_detail: "正在执行 OCR，第 5/12 页",
      provider: "paddle",
      provider_stage: "paddle_running",
      event_type: "stage_progress",
      event: "stage_progress",
      message: "正在执行 OCR，第 5/12 页",
      progress_current: scenario === "ocr" ? 5 : 12,
      progress_total: 12,
      payload: { origin: "mock" },
    });
  }
  if (["translate", "parallel", "render", "done", "failed"].includes(scenario)) {
    const current = scenario === "parallel" ? 120 : scenario === "translate" ? 18 : 55;
    const total = scenario === "parallel" ? 900 : 55;
    items.push({
      seq: 3,
      ts: isoOffsetMinutes(-6),
      level: "info",
      lane: "main",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      stage_detail: "正在翻译正文与公式，第 18/55 批",
      event_type: "progress",
      event: "stage_progress",
      message: "正在翻译正文与公式，第 18/55 批",
      progress_current: current,
      progress_total: total,
      progress_unit: "batch",
      progress: {
        unit: "batch",
        current,
        total,
      },
      payload: { origin: "mock" },
    });
  }
  if (scenario === "parallel") {
    items.push({
      seq: 4,
      ts: isoOffsetMinutes(-5),
      level: "info",
      lane: "background",
      display_stage: "render",
      stage: "render_preprocess",
      substage: "render_prewarm",
      stage_detail: "后台预热渲染资源",
      event_type: "progress",
      event: "stage_progress",
      message: "render payload prewarm: ready indents=333 geometry=836 elapsed=1.58s",
      progress_current: 2,
      progress_total: 3,
      progress_unit: "step",
      progress: {
        unit: "step",
        current: 2,
        total: 3,
      },
      payload: {
        origin: "mock",
        lane: "background",
      },
    });
  }
  if (["render", "done", "failed"].includes(scenario)) {
    items.push({
      seq: 4,
      ts: isoOffsetMinutes(-4),
      level: "info",
      stage: "rendering",
      stage_detail: scenario === "failed" ? "正在渲染第 9/12 页" : "正在渲染第 8/12 页",
      event_type: "stage_progress",
      event: "stage_progress",
      message: scenario === "failed" ? "正在渲染第 9/12 页" : "正在渲染第 8/12 页",
      progress_current: scenario === "render" ? 8 : scenario === "failed" ? 9 : 12,
      progress_total: 12,
      payload: { origin: "mock" },
    });
  }
  if (scenario === "done") {
    items.push({
      seq: 5,
      ts: isoOffsetMinutes(-1),
      level: "info",
      stage: "finished",
      stage_detail: "PDF 已生成，可以下载",
      event_type: "artifact_published",
      event: "artifact_published",
      message: "PDF 已生成，可以下载",
      progress_current: 12,
      progress_total: 12,
      payload: { artifact_key: "pdf" },
    });
  }
  if (scenario === "failed") {
    items.push({
      seq: 5,
      ts: isoOffsetMinutes(-1),
      level: "error",
      stage: "rendering",
      stage_detail: "渲染阶段失败",
      event_type: "job_failed",
      event: "job_failed",
      message: "渲染阶段失败",
      progress_current: 9,
      progress_total: 12,
      payload: { message: "mock render failure" },
    });
  }
  return { items, limit: 50, offset: 0 };
}
