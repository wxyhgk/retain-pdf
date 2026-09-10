import {
  MOCK_JOB_ID,
  MOCK_MARKDOWN_CONTENT,
} from "./constants.js";
import { currentMockScenario, isoOffsetMinutes } from "./scenario.js";
import type { JobLike, StageHistoryEntry } from "@retainpdf/domain/job";

export function buildMockStageHistory(scenario: string): StageHistoryEntry[] {
  const stages = [
    { key: "queued", detail: "上传 PDF", duration_ms: scenario === "upload" ? null : 18_000 },
    { key: "ocr_processing", detail: "OCR 解析", duration_ms: scenario === "ocr" ? null : 126_000 },
    { key: "translating", detail: "翻译正文", duration_ms: scenario === "translate" ? null : 214_000 },
    { key: "rendering", detail: "渲染 PDF", duration_ms: scenario === "render" || scenario === "failed" ? null : 74_000 },
    { key: "finished", detail: "产物发布", duration_ms: scenario === "done" ? 28_000 : null },
  ];
  const order = ["upload", "ocr", "translate", "render", "failed", "done"];
  const currentIndex = order.indexOf(scenario);
  return stages
    .slice(0, scenario === "done" ? stages.length : Math.max(1, currentIndex + 1))
    .map((stage, index) => ({
      stage: stage.key,
      detail: stage.detail,
      enter_at: isoOffsetMinutes(-12 + index * 2),
      exit_at: stage.duration_ms === null ? "" : isoOffsetMinutes(-11 + index * 2),
      duration_ms: stage.duration_ms,
      terminal_status: stage.duration_ms === null ? "" : "completed",
    }));
}

export function buildMockJobPayload(scenario = currentMockScenario()): JobLike {
  const normalized = scenario || "translate";
  const scenarioMap: Record<string, {
    status: string;
    stage: string;
    displayStage?: string;
    substage?: string;
    lane?: string;
    unit?: string;
    currentStage: string;
    current: number;
    total: number;
    percent: number;
    stageDetail: string;
    activeMs: number;
    totalMs: number;
    backgroundStages?: Array<Record<string, unknown>>;
  }> = {
    upload: {
      status: "queued",
      stage: "queued",
      currentStage: "queued",
      current: 2,
      total: 12,
      percent: 17,
      stageDetail: "正在上传 PDF，准备提交 OCR 任务",
      activeMs: 18_000,
      totalMs: 18_000,
    },
    ocr: {
      status: "running",
      stage: "ocr_processing",
      currentStage: "ocr_processing",
      current: 5,
      total: 12,
      percent: 42,
      stageDetail: "正在执行 OCR，第 5/12 页",
      activeMs: 126_000,
      totalMs: 144_000,
    },
    translate: {
      status: "running",
      stage: "translating",
      displayStage: "translation",
      substage: "translation_batches",
      lane: "main",
      unit: "batch",
      currentStage: "translating",
      current: 18,
      total: 55,
      percent: 33,
      stageDetail: "正在翻译正文与公式，第 18/55 批",
      activeMs: 214_000,
      totalMs: 358_000,
    },
    parallel: {
      status: "running",
      stage: "translating",
      displayStage: "translation",
      substage: "translation_batches",
      lane: "main",
      unit: "batch",
      currentStage: "translating",
      current: 120,
      total: 900,
      percent: 13,
      stageDetail: "正在翻译正文内容，第 120/900 批",
      activeMs: 236_000,
      totalMs: 380_000,
      backgroundStages: [
        {
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          lane: "background",
          progress: {
            unit: "step",
            current: 2,
            total: 3,
            percent: 66.6666666667,
          },
        },
      ],
    },
    render: {
      status: "running",
      stage: "rendering",
      currentStage: "rendering",
      current: 8,
      total: 12,
      percent: 67,
      stageDetail: "正在渲染第 8/12 页",
      activeMs: 74_000,
      totalMs: 512_000,
    },
    done: {
      status: "succeeded",
      stage: "finished",
      currentStage: "finished",
      current: 12,
      total: 12,
      percent: 100,
      stageDetail: "处理完成，可以下载结果",
      activeMs: 28_000,
      totalMs: 540_000,
    },
    failed: {
      status: "failed",
      stage: "rendering",
      currentStage: "rendering",
      current: 9,
      total: 12,
      percent: 75,
      stageDetail: "渲染阶段失败",
      activeMs: 96_000,
      totalMs: 496_000,
    },
  };
  const scenarioConfig = scenarioMap[normalized] || scenarioMap.translate;
  const status = scenarioConfig.status;
  return {
    job_id: MOCK_JOB_ID,
    workflow: "book",
    job_type: "book",
    status,
    stage: scenarioConfig.stage,
    display_stage: scenarioConfig.displayStage || undefined,
    substage: scenarioConfig.substage || undefined,
    lane: scenarioConfig.lane || undefined,
    stage_detail: scenarioConfig.stageDetail,
    progress: {
      unit: scenarioConfig.unit || undefined,
      current: scenarioConfig.current,
      total: scenarioConfig.total,
      percent: scenarioConfig.percent,
    },
    background_stages: scenarioConfig.backgroundStages || [],
    timestamps: {
      created_at: isoOffsetMinutes(-12),
      updated_at: isoOffsetMinutes(0),
      started_at: isoOffsetMinutes(-10),
      finished_at: status === "succeeded" || status === "failed" ? isoOffsetMinutes(-1) : "",
      duration_seconds: status === "succeeded" ? 540 : status === "failed" ? 496 : null,
    },
    runtime: {
      current_stage: scenarioConfig.currentStage,
      active_stage_elapsed_ms: scenarioConfig.activeMs,
      total_elapsed_ms: scenarioConfig.totalMs,
      retry_count: status === "failed" ? 1 : 0,
      terminal_reason: status === "failed" ? "渲染器退出码非零" : status === "succeeded" ? "completed" : "",
      stage_history: buildMockStageHistory(normalized),
    },
    invocation: {
      input_protocol: "stage_spec",
      stage_spec_schema_version: "v1",
    },
    request_payload: {
      source: { upload_id: "mock-upload-id" },
      ocr: {
        provider: "paddle",
        page_ranges: "1-12",
      },
      translation: {
        mode: "sci",
        math_mode: "direct_typst",
      },
      render: {
        render_mode: "auto",
      },
    },
    actions: {
      cancel: {
        enabled: false,
        url: "mock://cancel",
      },
      rerun: {
        enabled: status === "failed",
        method: "POST",
        url: "mock://rerun",
      },
      open_markdown: {
        enabled: status === "succeeded",
        url: "mock://markdown.json",
      },
      open_markdown_raw: {
        enabled: status === "succeeded",
        url: "mock://markdown.raw",
      },
      download_pdf: {
        enabled: status === "succeeded",
        url: "mock://translated.pdf",
      },
      download_bundle: {
        enabled: status === "succeeded",
        url: "mock://bundle.zip",
      },
    },
    artifacts: {
      pdf_ready: status === "succeeded",
      markdown_ready: status === "succeeded",
      bundle_ready: status === "succeeded",
      markdown: {
        ready: status === "succeeded",
        json_url: "mock://markdown.json",
        raw_url: "mock://markdown.raw",
        images_base_url: "mock://markdown/images/",
        file_name: "full.md",
        size_bytes: MOCK_MARKDOWN_CONTENT.length,
      },
    },
    failure: status === "failed"
      ? {
          summary: "任务失败，但这是前端 mock 场景。",
          category: "mock_render_failure",
          stage: "render",
          root_cause: "用于 UI 调试的模拟失败。",
          suggestion: "切换 ?mock=succeeded 查看成功态。",
          retryable: true,
        }
      : null,
  };
}
