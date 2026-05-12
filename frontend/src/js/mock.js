const MOCK_JOB_ID = "mock-job-20260415";
const MOCK_MARKDOWN_CONTENT = [
  "# Mock Markdown",
  "",
  "这是一段用于前端联调的 Markdown 预览。",
  "",
  '<div style="text-align: center;"><img src="page-1/imgs/mock-figure-1.png" alt="Mock Image" width="48%" /></div>',
].join("\n");

function currentMockScenario() {
  const value = new URLSearchParams(window.location.search).get("mock")?.trim().toLowerCase() || "";
  const aliases = {
    queued: "upload",
    running: "translate",
    succeeded: "done",
    complete: "done",
    completed: "done",
  };
  const normalized = aliases[value] || value;
  return ["upload", "ocr", "translate", "render", "done", "failed"].includes(normalized) ? normalized : "";
}

function isoOffsetMinutes(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function buildMockJobPayload(scenario = currentMockScenario()) {
  const normalized = scenario || "translate";
  const scenarioMap = {
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
      currentStage: "translating",
      current: 18,
      total: 55,
      percent: 33,
      stageDetail: "正在翻译正文与公式，第 18/55 批",
      activeMs: 214_000,
      totalMs: 358_000,
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
    stage_detail: scenarioConfig.stageDetail,
    progress: {
      current: scenarioConfig.current,
      total: scenarioConfig.total,
      percent: scenarioConfig.percent,
    },
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
        provider: "mineru",
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

function buildMockStageHistory(scenario) {
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

function buildMockManifest(scenario = currentMockScenario()) {
  if (scenario !== "done") {
    return { items: [] };
  }
  return {
    items: [
      { artifact_key: "source_pdf", ready: true, resource_url: "mock://source.pdf" },
      { artifact_key: "pdf", ready: true, resource_url: "mock://translated.pdf" },
      { artifact_key: "markdown_raw", ready: true, resource_url: "mock://markdown.raw" },
      { artifact_key: "markdown_images_dir", ready: true, resource_url: "mock://markdown/images/" },
      { artifact_key: "markdown_bundle_zip", ready: true, resource_url: "mock://bundle.zip" },
    ],
  };
}

function buildMockEvents(scenario = currentMockScenario()) {
  const items = [
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
  if (["translate", "render", "done", "failed"].includes(scenario)) {
    items.push({
      seq: 3,
      ts: isoOffsetMinutes(-6),
      level: "info",
      stage: "translating",
      stage_detail: "正在翻译正文与公式，第 18/55 批",
      event_type: "stage_progress",
      event: "stage_progress",
      message: "正在翻译正文与公式，第 18/55 批",
      progress_current: scenario === "translate" ? 18 : 55,
      progress_total: 55,
      payload: { origin: "mock" },
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

function mockPdfBytes(label = "Mock PDF") {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 68 >>
stream
BT
/F1 24 Tf
72 760 Td
(${label}) Tj
0 -36 Td
(RetainPDF Mock Preview) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000366 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
436
%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function isMockScenarioEnabled() {
  return !!currentMockScenario();
}

export function getMockScenario() {
  return currentMockScenario();
}

export function getMockJobId() {
  return MOCK_JOB_ID;
}

export function getMockJobPayload(jobId = "") {
  if (jobId && jobId !== MOCK_JOB_ID) {
    throw new Error("未找到该 mock 任务，请检查 job_id 是否正确。");
  }
  return buildMockJobPayload();
}

export function getMockJobEvents() {
  return buildMockEvents();
}

export function getMockJobArtifactsManifest() {
  return buildMockManifest();
}

export function getMockJobList() {
  return {
    items: [buildMockJobPayload()],
    limit: 20,
    offset: 0,
    has_more: false,
  };
}

export function getMockJobMarkdown() {
  return {
    job_id: MOCK_JOB_ID,
    content: MOCK_MARKDOWN_CONTENT,
    raw_url: "mock://markdown.raw",
    raw_path: "mock://markdown.raw",
    images_base_url: "mock://markdown/images/",
    images_base_path: "mock://markdown/images/",
  };
}

export function submitMockJob() {
  return buildMockJobPayload();
}

export function submitMockUpload() {
  return {
    upload_id: "mock-upload-id",
    filename: "mock.pdf",
    page_count: 12,
    bytes: 2_621_440,
  };
}

export async function fetchMockProtected(url) {
  const normalized = `${url || ""}`.trim();
  if (normalized === "mock://translated.pdf") {
    return new Response(mockPdfBytes("Translated PDF"), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  }
  if (normalized === "mock://source.pdf") {
    return new Response(mockPdfBytes("Source PDF"), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
  }
  if (normalized === "mock://bundle.zip") {
    return new Response(new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
      },
    });
  }
  if (normalized === "mock://markdown.raw") {
    return new Response(MOCK_MARKDOWN_CONTENT, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  }
  if (normalized === "mock://markdown.json") {
    return new Response(JSON.stringify(getMockJobMarkdown()), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  if (normalized === "mock://markdown/images/page-1/imgs/mock-figure-1.png") {
    const pixel = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12,
      2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 252, 255, 31, 0,
      3, 3, 2, 0, 239, 212, 141, 245, 0, 0, 0, 0, 73, 69, 78, 68,
      174, 66, 96, 130,
    ]);
    return new Response(pixel, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  }
  return new Response("mock resource not found", { status: 404 });
}
