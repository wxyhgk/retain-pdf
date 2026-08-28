import { currentMockScenario, isoOffsetMinutes } from "./scenario.js";

export function buildMockEvents(scenario = currentMockScenario()) {
  const items: any[] = [
    {
      seq: 1,
      ts: isoOffsetMinutes(-10),
      level: "info",
      stage: "queued",
      stage_detail: "Đã tải PDF lên, nhiệm vụ đã vào hàng chờ",
      event_type: "stage_progress",
      event: "stage_progress",
      message: "Đã tải PDF lên, nhiệm vụ đã vào hàng chờ",
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
      stage_detail: "Đang chạy OCR, trang 5/12",
      provider: "paddle",
      provider_stage: "paddle_running",
      event_type: "stage_progress",
      event: "stage_progress",
      message: "Đang chạy OCR, trang 5/12",
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
      stage_detail: "Đang dịch nội dung và công thức, lô 18/55",
      event_type: "progress",
      event: "stage_progress",
      message: "Đang dịch nội dung và công thức, lô 18/55",
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
      stage_detail: "Đang làm nóng tài nguyên render nền",
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
      stage_detail: scenario === "failed" ? "Đang render trang 9/12" : "Đang render trang 8/12",
      event_type: "stage_progress",
      event: "stage_progress",
      message: scenario === "failed" ? "Đang render trang 9/12" : "Đang render trang 8/12",
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
      stage_detail: "PDF đã tạo, có thể tải xuống",
      event_type: "artifact_published",
      event: "artifact_published",
      message: "PDF đã tạo, có thể tải xuống",
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
      stage_detail: "Giai đoạn render thất bại",
      event_type: "job_failed",
      event: "job_failed",
      message: "Giai đoạn render thất bại",
      progress_current: 9,
      progress_total: 12,
      payload: { message: "mock render failure" },
    });
  }
  return { items, limit: 50, offset: 0 };
}
