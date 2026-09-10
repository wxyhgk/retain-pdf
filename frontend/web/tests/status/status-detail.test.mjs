import test from "node:test";
import assert from "node:assert/strict";

import { createLegacyStateFixture } from "../helpers/legacy-state-fixture.mjs";
import * as currentJobStateModule from "../../src/features/jobs/domain/runtime/current-job-state.js";
import { createSecondaryResourceStatePort } from "../../src/features/jobs/domain/runtime/secondary-resource-cache.js";
import { createJobRenderContextPort } from "../../src/features/jobs/domain/runtime/render-context.js";
import { normalizedStageEventRecord } from "@retainpdf/domain/job-status";
import { buildEventsPresentation } from "../../src/features/job-detail/domain/snapshot/events.js";
import { buildFailureLogText, buildStatusDetailSnapshot } from "../../src/features/job-detail/domain/snapshot/snapshot.js";
import {
  resolveStageHistoryDuration,
  stageHistoryDisplay,
} from "@retainpdf/domain/job";
import { resolveLiveDurations } from "@retainpdf/domain/job";
import { buildStageHistoryPresentation } from "../../src/features/job-detail/domain/snapshot/history.js";
import { buildStatusCardSnapshot } from "@retainpdf/domain/job-status";
import { buildJobStatusViewModel } from "@retainpdf/domain/job-status";
// bootstrap/status-detail-runtime-port.js 已随 cutover 删除;这是它的纯逻辑
// 拷贝(job-runtime 三个 kept 端口的字面量组合,零 DOM),迁移指向 pages/home
// 的同名实现(两者函数体完全一致,仅头部注释与相对导入路径不同)。
import { createStatusDetailRuntimePort } from "../../src/features/job-detail/domain/status-detail-runtime-port.js";
import { createTranslationState } from "../../src/features/job-detail/domain/dialog/translation-state.js";
import { createStatusDetailTranslationDataPort } from "../../src/features/job-detail/domain/dialog/translation-data-port.js";
import { createStatusDetailTranslationTabCoordinator } from "../../src/features/job-detail/domain/dialog/translation-tab-coordinator.js";
import { createStatusDetailOverviewCoordinator } from "../../src/features/job-detail/domain/dialog/overview-coordinator.js";
import { createStatusDetailConfigPort } from "../../src/features/job-detail/domain/dialog/config-port.js";
import {
  rerunCurrentJob,
  syncRerunAction,
} from "../../src/features/job-detail/domain/dialog/resume-actions.js";
import {
  buildJobDetailEventViewModel,
  buildJobDetailStatusViewModel,
} from "../../src/features/job-detail/domain/page/status-view-model.js";
import { createJobDetailConfigPort } from "../../src/features/job-detail/domain/page/config-port.js";
import { createJobDetailDataPort } from "../../src/features/job-detail/domain/page/data-port.js";
import { createJobDetailResumePort } from "../../src/features/job-detail/domain/page/resume-port.js";
import {
  renderJobDetailFailureSummary,
  renderJobDetailRuntimeSummary,
  summarizeMathMode,
} from "../../src/features/job-detail/domain/page/summary.js";
import {
  isReaderActionEnabled,
  renderJobDetailActionLinks,
} from "../../src/features/job-detail/domain/page/action-links.js";
import {
  loadAndRenderMarkdownFlow,
} from "../../src/features/job-detail/domain/page/markdown-flow.js";
import { renderJobDetailOverview } from "../../src/features/job-detail/domain/page/overview-renderer.js";
import {
  createJobDetailPageState,
  revokeJobDetailMarkdownImageUrls,
} from "../../src/features/job-detail/domain/page/page-state.js";
import {
  buildOcrAmbiguityRequest,
  ocrRecoveryJobId,
  readOcrAmbiguityView,
  requiresOcrAmbiguityResolution,
  resolveOcrAmbiguityRecovery,
} from "../../src/features/job-detail/domain/ocr-ambiguity-recovery.js";

global.window ||= {};
global.window.location ||= {
  protocol: "http:",
  origin: "http://localhost",
  pathname: "/",
};

const OCR_AMBIGUITY_DESCRIPTOR = {
  status: "ambiguous",
  provider: "mineru",
  operation: "apply_upload_url",
  resolution_revision: 4,
  allowed_resolutions: ["bind_existing_receipt", "accept_duplicate_risk"],
  receipt_fields: [
    { name: "batch_id", label: "Batch ID", required: true, secret: false },
    { name: "upload_url", label: "Upload URL", required: true, secret: true },
    { name: "trace_id", label: "Trace ID", required: false, secret: false },
  ],
};

test("failure log:汇总诊断字段、保留日志并隐藏密钥", () => {
  const logText = buildFailureLogText({
    job_id: "job-log-1",
    status: "failed",
    request_payload: {
      translation: { api_key: "must-never-be-copied" },
    },
    diagnostics: {
      failed_stage: "translation",
      failure_code: "PROVIDER_RATE_LIMIT",
      trace_id: "trace-log-1",
      summary: "翻译服务限流",
      raw_exception_message: "Authorization: Bearer live-secret-token",
      traceback: "RuntimeError: api_key=inline-secret",
    },
    log_tail: ["retry 2/3", "access_token=tail-secret"],
  });

  assert.match(logText, /Job ID: job-log-1/);
  assert.match(logText, /阶段: translation/);
  assert.match(logText, /错误码: PROVIDER_RATE_LIMIT/);
  assert.match(logText, /Trace ID: trace-log-1/);
  assert.match(logText, /retry 2\/3/);
  assert.match(logText, /\[REDACTED\]/);
  assert.doesNotMatch(logText, /must-never-be-copied/);
  assert.doesNotMatch(logText, /live-secret-token|inline-secret|tail-secret/);
});

test("OCR ambiguity recovery:识别 diagnostics 契约并生成最小回执请求", () => {
  assert.equal(requiresOcrAmbiguityResolution({
    job: { failure: { failure_code: "ocr_request_ambiguous" } },
  }), true);
  assert.equal(requiresOcrAmbiguityResolution({
    failure: { category: "OCR_REQUEST_AMBIGUOUS" },
  }), true);
  assert.equal(requiresOcrAmbiguityResolution({
    failure: { category: "provider_timeout" },
  }), false);
  assert.equal(ocrRecoveryJobId({
    data: { submission: { job_id: "ocr-recovery-2" } },
  }), "ocr-recovery-2");
  assert.deepEqual(readOcrAmbiguityView({
    diagnostics: { ocr_ambiguity: OCR_AMBIGUITY_DESCRIPTOR },
  }), OCR_AMBIGUITY_DESCRIPTOR);
  assert.deepEqual(buildOcrAmbiguityRequest(
    OCR_AMBIGUITY_DESCRIPTOR,
    "bind_existing_receipt",
    {
      batch_id: " batch-1 ",
      upload_url: " https://signed.example/upload ",
      trace_id: "",
      task_id: "must-not-be-sent",
    },
  ), {
    resolution: "bind_existing_receipt",
    resolution_revision: 4,
    batch_id: "batch-1",
    upload_url: "https://signed.example/upload",
  });
  assert.throws(
    () => buildOcrAmbiguityRequest(OCR_AMBIGUITY_DESCRIPTOR, "bind_existing_receipt", {}),
    /Batch ID/,
  );
});

test("OCR ambiguity recovery:显式接受重复风险后切换到新任务轮询", async () => {
  const calls = [];
  const pending = [];
  const statuses = [];
  const result = await resolveOcrAmbiguityRecovery({
    job: { job_id: "ocr-source-1" },
    descriptor: OCR_AMBIGUITY_DESCRIPTOR,
    resolution: "accept_duplicate_risk",
    apiPrefix: "/api/v1",
    resolveOcrAmbiguity: async (jobId, apiPrefix, request) => {
      calls.push([jobId, apiPrefix, request]);
      return { submission: { job_id: "ocr-recovery-1" } };
    },
    startPolling: (jobId) => calls.push(["poll", jobId]),
    closeDialog: () => calls.push(["close"]),
    setPending: (value) => pending.push(value),
    setStatus: (value) => statuses.push(value),
    setGlobalError: (value) => calls.push(["error", value]),
  });

  assert.deepEqual(result, { ok: true, conflict: false });
  assert.deepEqual(calls, [
    ["ocr-source-1", "/api/v1", {
      resolution: "accept_duplicate_risk",
      resolution_revision: 4,
    }],
    ["close"],
    ["error", ""],
    ["poll", "ocr-recovery-1"],
  ]);
  assert.deepEqual(pending, [true, false]);
  assert.deepEqual(statuses, ["正在创建新的 OCR 恢复任务…"]);
});

test("OCR ambiguity recovery:409 时刷新诊断且不启动旧恢复任务", async () => {
  const calls = [];
  const statuses = [];
  const conflict = new Error("revision stale");
  conflict.status = 409;
  const result = await resolveOcrAmbiguityRecovery({
    job: { job_id: "ocr-source-failed" },
    descriptor: OCR_AMBIGUITY_DESCRIPTOR,
    resolution: "bind_existing_receipt",
    values: {
      batch_id: "batch-2",
      upload_url: "https://signed.example/2",
    },
    resolveOcrAmbiguity: async () => {
      throw conflict;
    },
    refreshDiagnostics: async () => calls.push("refresh"),
    closeDialog: () => calls.push("close"),
    startPolling: () => calls.push("poll"),
    setStatus: (value) => statuses.push(value),
  });

  assert.deepEqual(result, { ok: false, conflict: true });
  assert.deepEqual(calls, ["refresh"]);
  assert.match(statuses.at(-1), /状态已变化/);
});


test("status detail snapshot runtime stage follows public presentation", () => {
  const snapshot = buildStatusDetailSnapshot({
    job_id: "job-status-detail-public-stage",
    status: "running",
    display_stage: "translation",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    stage_detail: "render payload prewarm: ready",
    progress: { unit: "batch", current: 30, total: 100 },
  }, { items: [] });

  assert.equal(/render|prewarm|渲染/.test(snapshot.runtime.currentStage), false);
  assert.match(snapshot.runtime.currentStage, /translation|翻译|第 30\/100 批/);
});

test("status detail snapshot runtime stage follows normalized stage snapshot", () => {
  const snapshot = buildStatusDetailSnapshot({
    job_id: "job-status-detail-normalized-stage",
    status: "running",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    stage_detail: "render payload prewarm: ready",
    progress: { unit: "step", current: 1, total: 3 },
    stage_snapshot: {
      stageKey: "translate",
      publicStage: "translation",
      source: "public-stage",
      lane: "main",
      substage: "translation_batches",
      detail: "正在翻译正文内容",
      progress: {
        current: 30,
        total: 100,
        percent: 30,
        unit: "batch",
      },
    },
  }, { items: [] });

  assert.equal(/render|prewarm|渲染/.test(snapshot.runtime.currentStage), false);
  assert.match(snapshot.runtime.currentStage, /翻译|第 30\/100 批/);
});

test("status detail snapshot does not use legacy user_stage as runtime public stage", () => {
  const snapshot = buildStatusDetailSnapshot({
    job_id: "job-status-detail-legacy-user-stage",
    status: "running",
    user_stage: "translation",
    stage: "render_preprocess",
    current_stage: "render_preprocess",
    progress: { unit: "batch", current: 30, total: 100 },
  }, { items: [] });

  assert.equal(/translation|翻译|render|渲染/.test(snapshot.runtime.currentStage), false);
});

test("stage history display prefers public stage over raw internal stage", () => {
  const entry = {
    display_stage: "translation",
    stage: "render_preprocess",
    detail: "",
  };
  const display = stageHistoryDisplay(entry);

  assert.equal(display.title, "翻译准备 / 跨栏跨页判断");
  assert.equal(display.stage, "翻译准备 / 跨栏跨页判断");
  assert.equal(/render|prewarm|渲染/.test(`${display.title} ${display.stage}`), false);

  const presentation = buildStageHistoryPresentation({
    status: "running",
    stage_history: [
      {
        ...entry,
        enter_at: "2026-01-01T00:00:00Z",
      },
    ],
  }, {
    now: "2026-01-01T00:00:01Z",
  });

  assert.equal(presentation.hasItems, true);
  assert.match(presentation.markup, /翻译准备/);
  assert.equal(/render_preprocess|prewarm/.test(presentation.markup), false);
});

test("stage history presentation accepts backend runtime stage history payload", () => {
  const presentation = buildStageHistoryPresentation({
    status: "running",
    runtime: {
      stage_history: [
        {
          display_stage: "translation",
          stage: "render_preprocess",
          enter_at: "2026-01-01T00:00:00Z",
          duration_ms: 1000,
        },
      ],
    },
  });

  assert.equal(presentation.hasItems, true);
  assert.equal(presentation.emptyText, "暂无阶段记录");
  assert.match(presentation.markup, /翻译准备/);
  assert.equal(/后端未返回 runtime\.stage_history|render_preprocess/.test(presentation.markup), false);
});

test("status detail config port owns detail page urls", () => {
  const port = createStatusDetailConfigPort({
    buildPageUrl(path, params) {
      return `app://${path}?job_id=${params.job_id}`;
    },
  });

  assert.equal(port.buildDetailPageUrl("job-123"), "app://./detail.html?job_id=job-123");
  assert.equal(port.buildDetailPageUrl(""), "");
});

test("job detail config port owns reader detail urls and share note", () => {
  const port = createJobDetailConfigPort({
    buildPageUrl(path, params) {
      return `app://${path}?job_id=${params.job_id}`;
    },
    isMock: () => true,
  });

  assert.equal(port.buildReaderPageUrl("job-123"), "app://./reader.html?job_id=job-123");
  assert.equal(port.buildReaderPageUrl(""), "");
  assert.equal(port.buildDetailPageUrl("job-456"), "app://./detail.html?job_id=job-456");
  assert.equal(port.buildDetailPageUrl(""), "");
  assert.equal(port.detailShareNote(), "当前为 mock 明细页，可直接分享当前链接。");

  const normalPort = createJobDetailConfigPort({
    buildPageUrl: () => "",
    isMock: () => false,
  });
  assert.equal(normalPort.detailShareNote(), "当前详情页可直接通过 URL 分享给其他人。");
});

test("job detail data port owns overview markdown and action API calls", async () => {
  const calls = [];
  const port = createJobDetailDataPort({
    apiPrefix: "/detail-api",
    loadJob: async (jobId, options) => {
      const apiPrefix = typeof options === "string" ? options : options?.apiPrefix;
      calls.push(["job", jobId, apiPrefix]);
      return { job_id: jobId };
    },
    loadManifest: async (jobId, apiPrefix) => {
      calls.push(["manifest", jobId, apiPrefix]);
      return { items: [] };
    },
    loadDiagnostics: async (jobId, apiPrefix) => {
      calls.push(["diagnostics", jobId, apiPrefix]);
      throw new Error("diagnostics unavailable");
    },
    loadResumePlan: async (jobId, apiPrefix) => {
      calls.push(["resume-plan", jobId, apiPrefix]);
      throw new Error("resume unavailable");
    },
    loadMarkdownDocument: async (jobId, apiPrefix) => {
      calls.push(["markdown-document", jobId, apiPrefix]);
      return null;
    },
    loadMarkdown: async (jobId, apiPrefix) => {
      calls.push(["markdown", jobId, apiPrefix]);
      return { content: "# ok" };
    },
    loadEvents: async (jobId, apiPrefix, limit, offset) => {
      calls.push(["events", jobId, apiPrefix, limit, offset]);
      return { items: [] };
    },
    rerun: async (url) => {
      calls.push(["rerun", url]);
      return { job_id: "job-rerun" };
    },
    resume: async (jobId, apiPrefix) => {
      calls.push(["resume", jobId, apiPrefix]);
      return { job_id: "job-resume" };
    },
    fetchProtectedResource: async (url) => ({ url }),
  });

  assert.deepEqual(await port.loadOverview("job-detail"), {
    diagnosticsPayload: null,
    manifestPayload: { items: [] },
    payloadRaw: { job_id: "job-detail" },
    resumePlan: null,
  });
  assert.deepEqual(await port.loadMarkdownPayload("job-detail"), { content: "# ok" });
  assert.deepEqual(await port.fetchJobEvents("job-detail", port.apiPrefix, 10, 20), { items: [] });
  assert.deepEqual(await port.resumeJob("job-detail", port.apiPrefix), { job_id: "job-resume" });
  assert.deepEqual(await port.rerunJob("/rerun"), { job_id: "job-rerun" });
  assert.deepEqual(await port.fetchProtected("http://asset.test/file.pdf"), {
    url: "http://asset.test/file.pdf",
  });
  assert.deepEqual(calls, [
    ["job", "job-detail", "/detail-api"],
    ["manifest", "job-detail", "/detail-api"],
    ["diagnostics", "job-detail", "/detail-api"],
    ["resume-plan", "job-detail", "/detail-api"],
    ["markdown-document", "job-detail", "/detail-api"],
    ["markdown", "job-detail", "/detail-api"],
    ["events", "job-detail", "/detail-api", 10, 20],
    ["resume", "job-detail", "/detail-api"],
    ["rerun", "/rerun"],
  ]);
});


test("job detail resume port chooses resume by job id before rerun url", async () => {
  const calls = [];
  const port = createJobDetailResumePort({
    apiPrefix: "/detail-api",
    resumeJob: async (jobId, apiPrefix) => {
      calls.push(["resume", jobId, apiPrefix]);
      return { job_id: "job-resumed" };
    },
    rerunJob: async (url) => {
      calls.push(["rerun", url]);
      return { job_id: "job-rerun" };
    },
  });

  assert.deepEqual(await port.submit({ actionUrl: "/rerun-old", jobId: "job-current" }), {
    job_id: "job-resumed",
  });
  assert.deepEqual(await port.submit({ actionUrl: "/rerun-old", jobId: "" }), {
    job_id: "job-rerun",
  });
  assert.deepEqual(calls, [
    ["resume", "job-current", "/detail-api"],
    ["rerun", "/rerun-old"],
  ]);
});

test("job detail summary renderer owns runtime and failure text fields", () => {
  const fields = {};
  const setText = (id, value) => {
    fields[id] = value;
  };
  const job = {
    status: "failed",
    retry_count: 2,
    last_stage_transition_at: "2026-06-16T01:02:03Z",
    terminal_reason: "provider_error",
    request_payload_math_mode: "placeholder",
    invocation_protocol: "book.v1",
    stage_spec_version: "stage.v2",
    failure: {
      failure_category: "translation",
      failed_stage: "translation",
      retryable: true,
      suggestion: "retry later",
    },
    failure_diagnostic: {
      root_cause: "rate limit",
    },
    final_failure_summary: "翻译失败",
    log_tail: ["line a", "last line"],
  };

  renderJobDetailRuntimeSummary({
    durations: {
      stageElapsedText: "1分钟",
      totalElapsedText: "2分钟",
    },
    job,
    setText,
    statusViewModel: {
      stageDetail: "翻译失败",
      runtimeCurrentStage: "翻译",
    },
  });
  renderJobDetailFailureSummary({ job, setText });

  assert.equal(fields["detail-status-summary"], "任务已失败，请检查报错提示后重试。");
  assert.equal(fields["detail-stage-detail"], "翻译失败");
  assert.equal(fields["detail-runtime-current-stage"], "翻译");
  assert.equal(fields["detail-runtime-stage-elapsed"], "1分钟");
  assert.equal(fields["detail-runtime-total-elapsed"], "2分钟");
  assert.equal(fields["detail-runtime-retry-count"], "2");
  assert.equal(fields["detail-runtime-terminal-reason"], "provider_error");
  assert.equal(fields["detail-runtime-math-mode"], "placeholder - 公式占位保护");
  assert.equal(fields["detail-failure-summary"], "翻译失败");
  assert.equal(fields["detail-failure-category"], "translation");
  assert.equal(fields["detail-failure-stage"], "translation");
  assert.equal(fields["detail-failure-root-cause"], "rate limit");
  assert.equal(fields["detail-failure-suggestion"], "retry later");
  assert.equal(fields["detail-failure-last-log-line"], "last line");
  assert.equal(fields["detail-failure-retryable"], "是");
  assert.equal(summarizeMathMode({ request_payload_math_mode: "direct_typst" }), "direct_typst - 模型直出公式");
});

test("job detail action links own reader and pdf readiness rules", () => {
  const links = {};
  const setActionLink = (id, url, enabled) => {
    links[id] = { enabled: Boolean(enabled), url };
  };
  const manifestPayload = {
    items: [
      { artifact_key: "source_pdf", ready: true },
      { artifact_key: "translated_pdf", ready: true },
    ],
  };
  const job = { job_id: "job-reader" };
  const actions = {
    pdf: "/api/v1/jobs/job-reader/pdf",
    pdfEnabled: true,
  };

  assert.equal(isReaderActionEnabled({ actions, job, manifestPayload }), true);
  renderJobDetailActionLinks({ actions, job, manifestPayload, setActionLink });

  assert.equal(links["detail-reader-btn"].enabled, true);
  assert.match(links["detail-reader-btn"].url, /reader\.html\?job_id=job-reader/);
  assert.deepEqual(links["detail-pdf-btn"], {
    enabled: true,
    url: "/api/v1/jobs/job-reader/pdf",
  });
  assert.equal(isReaderActionEnabled({
    actions,
    job,
    manifestPayload: { items: [{ artifact_key: "translated_pdf", ready: true }] },
  }), false);
});

test("job detail markdown flow owns loading state and status fallbacks", async () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById() {
      return null;
    },
  };
  const fields = {};
  const links = {};
  const state = {};
  const setText = (id, value) => {
    fields[id] = value;
  };
  const setActionLink = (id, url, enabled) => {
    links[id] = { enabled: Boolean(enabled), url };
  };
  const markdownPayload = {
    content: "# ok",
    file_name: "book.md",
    raw_url: "/raw.md",
    json_url: "/markdown/document",
    images: [],
  };

  try {
    await loadAndRenderMarkdownFlow({
      fetchProtected: async () => {
        throw new Error("no image fetch expected");
      },
      job: {
        markdown_ready: true,
        artifacts: { markdown: { ready: true } },
      },
      jobId: "job-md",
      loadMarkdownPayload: async (jobId) => {
        assert.equal(jobId, "job-md");
        return markdownPayload;
      },
      markdownImageUrls: [],
      setActionLink,
      setText,
      state,
    });

    assert.equal(state.markdownPayload, markdownPayload);
    assert.equal(fields["detail-markdown-status"], "已加载 /markdown JSON · book.md");
    assert.equal(fields["detail-markdown-image-count"], "0");
    assert.equal(fields["detail-markdown-preview"], "# ok");
    assert.equal(links["detail-markdown-raw-btn"].enabled, true);
    assert.equal(links["detail-markdown-json-btn"].enabled, true);

    await loadAndRenderMarkdownFlow({
      fetchProtected: async () => ({}),
      job: {
        markdown_ready: true,
        artifacts: { markdown: { ready: true } },
      },
      jobId: "job-md",
      loadMarkdownPayload: async () => {
        throw new Error("markdown unavailable");
      },
      markdownImageUrls: [],
      setActionLink,
      setText,
      state: {},
    });

    assert.equal(fields["detail-markdown-status"], "markdown unavailable");
  } finally {
    globalThis.document = previousDocument;
  }
});



test("job detail overview renderer owns state updates and rerun status", () => {
  const previousDocument = globalThis.document;
  const rerunButton = { disabled: false };
  globalThis.document = {
    getElementById(id) {
      return id === "detail-rerun-btn" ? rerunButton : null;
    },
  };
  const state = { markdownImageUrls: [], eventsPayload: null };
  const fields = {};
  const links = {};
  try {
    renderJobDetailOverview({
      diagnosticsPayload: null,
      job: {
        job_id: "job-overview",
        status: "succeeded",
        actions: { rerun: { enabled: true, url: "/rerun/job-overview" } },
      },
      manifestPayload: { items: [] },
      resumePlan: { can_resume: true, from_stage: "translation" },
      setActionLink(id, url, enabled) {
        links[id] = { enabled: Boolean(enabled), url };
      },
      setEventsStatus(value) {
        fields.eventsStatus = value;
      },
      setText(id, value) {
        fields[id] = value;
      },
      state,
    });
  } finally {
    globalThis.document = previousDocument;
  }

  assert.equal(state.job.job_id, "job-overview");
  assert.deepEqual(state.manifestPayload, { items: [] });
  assert.equal(state.resumePlan.can_resume, true);
  assert.match(state.rerunActionUrl, /\/rerun\/job-overview$/);
  assert.equal(rerunButton.disabled, false);
  assert.equal(fields["detail-rerun-status"], "可从 translation 恢复");
  assert.equal(fields.eventsStatus, "尚未加载");
  assert.equal(links["detail-reader-btn"].enabled, false);
});

test("job detail page state owns initial shape and markdown image cleanup", () => {
  const state = createJobDetailPageState();
  assert.deepEqual(Object.keys(state), [
    "job",
    "manifestPayload",
    "markdownPayload",
    "markdownImageUrls",
    "eventsPayload",
    "eventsLoadingPromise",
    "rerunActionUrl",
    "resumePlan",
  ]);
  assert.equal(state.job, null);
  assert.deepEqual(state.markdownImageUrls, []);

  const revoked = [];
  const previousUrl = globalThis.URL;
  globalThis.URL = {
    ...previousUrl,
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };
  try {
    state.markdownImageUrls.push("blob:a", "blob:b");
    revokeJobDetailMarkdownImageUrls(state);
  } finally {
    globalThis.URL = previousUrl;
  }

  assert.deepEqual(revoked, ["blob:a", "blob:b"]);
  assert.deepEqual(state.markdownImageUrls, []);
});

test("status detail runtime port narrows current job cache access", () => {
  const state = createLegacyStateFixture();
  const port = createStatusDetailRuntimePort(state);
  const job = { job_id: "job-detail-port", status: "running" };
  const events = { items: [{ seq: 1, display_stage: "translation" }] };
  const diagnostics = { summary: "ok" };
  const resumePlan = { can_resume: true };

  const context = port.applyOverviewPayload({
    payload: {
      ...job,
      started_at: "2026-01-01T00:00:00Z",
      finished_at: "2026-01-01T00:02:00Z",
    },
    eventsPayload: events,
    diagnosticsPayload: diagnostics,
    resumePlan,
    fallbackJobId: job.job_id,
  });

  assert.equal(port.currentJobId(), job.job_id);
  assert.equal(context.job.job_id, job.job_id);
  assert.deepEqual(context.job.diagnostics, diagnostics);
  assert.deepEqual(context.events, events);
  assert.equal(port.currentJobSnapshot().job_id, job.job_id);
  assert.deepEqual(port.currentRenderContext(job.job_id).events, events);
  assert.equal(port.currentJobFinishedAt(), "2026-01-01T00:02:00Z");
  assert.equal(port.rerunContext().job.job_id, job.job_id);
  assert.deepEqual(port.rerunContext().resumePlan, resumePlan);
  assert.deepEqual(currentJobStateModule.createCurrentJobStatePort(state).getSnapshot().diagnostics, diagnostics);
  assert.deepEqual(createJobRenderContextPort(state).currentFor(job.job_id).events, events);
  assert.deepEqual(createSecondaryResourceStatePort(state).cachedFor("events", job.job_id), events);
});

test("status detail runtime port ignores stale resume plans", () => {
  const state = createLegacyStateFixture();
  const job = { job_id: "job-current", status: "failed" };
  currentJobStateModule.syncCurrentJobSnapshot(state, job, job.job_id);
  currentJobStateModule.cacheJobResumePlan(state, "job-old", { can_resume: true });

  const port = createStatusDetailRuntimePort(state);

  assert.equal(port.currentJobId(), job.job_id);
  assert.deepEqual(port.rerunContext().job, job);
  assert.equal(port.rerunContext().resumePlan, null);
});

test("status detail runtime port reads current job store instead of legacy fields", () => {
  const state = createLegacyStateFixture();
  const currentJobPort = currentJobStateModule.createCurrentJobStatePort(state);
  const job = { job_id: "job-store-authority", status: "failed" };
  const resumePlan = { can_resume: true };

  currentJobPort.syncSnapshot(job, job.job_id, {
    startedAt: "2026-02-01T00:00:00Z",
    finishedAt: "2026-02-01T00:03:00Z",
  });
  currentJobPort.cacheResumePlan(job.job_id, resumePlan);

  state.currentJobId = "legacy-wrong";
  state.currentJobSnapshot = { job_id: "legacy-wrong", status: "running" };
  state.currentJobResumePlanJobId = "legacy-wrong";
  state.currentJobResumePlan = { can_resume: false };
  state.currentJobFinishedAt = "legacy-finished-at";

  const port = createStatusDetailRuntimePort(state);

  assert.equal(port.currentJobId(), job.job_id);
  assert.deepEqual(port.currentJobSnapshot(), job);
  assert.deepEqual(port.currentResumePlan(), resumePlan);
  assert.deepEqual(port.rerunContext(), { job, resumePlan });
  assert.equal(port.currentJobFinishedAt(), "2026-02-01T00:03:00Z");
});

test("status detail resume actions route UI side effects through view port", async () => {
  const calls = [];
  const viewPort = {
    closeDialog: () => calls.push(["close"]),
    setRerunAction: (payload) => calls.push(["action", payload.enabled, payload.status]),
    setRerunDisabled: (disabled) => calls.push(["disabled", disabled]),
  };
  const rerunContext = {
    job: {
      job_id: "job-resume-action",
      status: "failed",
      actions: {
        rerun: {
          enabled: true,
          url: "/api/v1/jobs/job-resume-action/rerun",
        },
      },
    },
    resumePlan: { can_resume: true, from_stage: "translation" },
  };
  const textCalls = [];
  const pollingCalls = [];
  const resolveActions = (job) => ({
    rerun: job.actions.rerun.url,
    rerunEnabled: job.actions.rerun.enabled,
  });

  const actionUrl = syncRerunAction({
    ...rerunContext,
    viewPort,
    resolveActions,
  });
  await rerunCurrentJob({
    rerunContext,
    rerunJob: async (url) => {
      calls.push(["rerun", url]);
      return { job_id: "job-resumed-action" };
    },
    setText: (...args) => textCalls.push(args),
    startPolling: (jobId) => pollingCalls.push(jobId),
    viewPort,
    resolveActions,
  });

  assert.match(actionUrl, /\/api\/v1\/jobs\/job-resume-action\/rerun$/);
  assert.deepEqual(calls, [
    ["action", true, "可从 translation 恢复"],
    ["action", true, "正在提交恢复任务..."],
    ["disabled", true],
    ["rerun", actionUrl],
    ["close"],
  ]);
  assert.deepEqual(textCalls, [["error-box", "已创建恢复任务 job-resumed-action，开始轮询。"]]);
  assert.deepEqual(pollingCalls, ["job-resumed-action"]);
});

test("status detail overview coordinator renders cached snapshot before fresh payload", async () => {
  const state = createLegacyStateFixture();
  const runtimePort = createStatusDetailRuntimePort(state);
  const snapshots = [];
  const renders = [];
  currentJobStateModule.syncCurrentJobSnapshot(state, {
    job_id: "job-overview",
    status: "running",
    display_stage: "translation",
  }, "job-overview");

  const coordinator = createStatusDetailOverviewCoordinator({
    runtimePort,
    apiPrefix: "/api/v1",
    fetchJobPayload: async (jobId, options) => {
      const apiPrefix = typeof options === "string" ? options : options?.apiPrefix;
      assert.equal(jobId, "job-overview");
      assert.equal(apiPrefix, "/api/v1");
      return {
        job_id: "job-overview",
        status: "succeeded",
        display_stage: "done",
      };
    },
    fetchJobEvents: async (_jobId, _apiPrefix, limit, afterSeq) => {
      assert.equal(limit, 200);
      assert.equal(afterSeq, 0);
      return { items: [{ seq: 2, display_stage: "done" }] };
    },
    fetchJobDiagnostics: async () => ({ summary: "ok" }),
    fetchResumePlan: async () => ({ can_resume: false }),
    fetchJobStageActions: async () => ({
      stages: [{
        stage: "ocr",
        can_retry: true,
        action: { method: "POST", url: "/retry-stage", body: { stage: "ocr" } },
      }],
    }),
    renderJob: (context) => renders.push(context),
    renderOverviewSnapshot: (context) => snapshots.push(context),
  });

  await coordinator.ensureLoaded();

  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].job.job_id, "job-overview");
  assert.equal(snapshots[0].job.status, "running");
  assert.equal(snapshots[1].job.status, "succeeded");
  assert.equal(renders.length, 1);
  assert.equal(runtimePort.currentJobSnapshot().diagnostics.summary, "ok");
  assert.equal(runtimePort.rerunContext().resumePlan.can_resume, false);
  assert.equal(snapshots[1].stageActions.stages[0].action.body.stage, "ocr");
});

test("status detail overview coordinator reuses in-flight refresh", async () => {
  const state = createLegacyStateFixture();
  const runtimePort = createStatusDetailRuntimePort(state);
  currentJobStateModule.syncCurrentJobSnapshot(state, {
    job_id: "job-overview-inflight",
    status: "running",
  }, "job-overview-inflight");
  let fetchCount = 0;
  let resolvePayload;
  const payloadPromise = new Promise((resolve) => {
    resolvePayload = resolve;
  });
  const coordinator = createStatusDetailOverviewCoordinator({
    runtimePort,
    fetchJobPayload: () => {
      fetchCount += 1;
      return payloadPromise;
    },
    renderOverviewSnapshot() {},
  });

  const first = coordinator.ensureLoaded();
  const second = coordinator.ensureLoaded();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCount, 1);
  resolvePayload({ job_id: "job-overview-inflight", status: "succeeded" });
  await Promise.all([first, second]);
  assert.equal(fetchCount, 1);
});

test("status detail overview coordinator ignores stale fresh payloads", async () => {
  const state = createLegacyStateFixture();
  const runtimePort = createStatusDetailRuntimePort(state);
  const renders = [];
  currentJobStateModule.syncCurrentJobSnapshot(state, {
    job_id: "job-a",
    status: "running",
  }, "job-a");
  let resolvePayload;
  const payloadPromise = new Promise((resolve) => {
    resolvePayload = resolve;
  });
  const coordinator = createStatusDetailOverviewCoordinator({
    runtimePort,
    fetchJobPayload: () => payloadPromise,
    fetchJobEvents: async () => ({ items: [{ seq: 1, display_stage: "translation" }] }),
    fetchResumePlan: async () => ({ can_resume: true }),
    renderJob: (context) => renders.push(context),
    renderOverviewSnapshot() {},
  });

  const refresh = coordinator.ensureLoaded();
  await new Promise((resolve) => setImmediate(resolve));
  currentJobStateModule.syncCurrentJobSnapshot(state, {
    job_id: "job-b",
    status: "running",
  }, "job-b");
  resolvePayload({
    job_id: "job-a",
    status: "succeeded",
  });
  await refresh;

  const snapshot = currentJobStateModule.createCurrentJobStatePort(state).getSnapshot();
  assert.equal(snapshot.jobId, "job-b");
  assert.equal(snapshot.snapshot.job_id, "job-b");
  assert.notEqual(snapshot.resumePlanJobId, "job-a");
  assert.equal(renders.length, 0);
});

test("status detail translation data port owns query paging and item selection", async () => {
  const state = createTranslationState();
  let current = "job-translation-port";
  const calls = [];
  const port = createStatusDetailTranslationDataPort({
    translationState: state,
    apiPrefix: "/api/v1",
    currentJobId: () => current,
    fetchTranslationDiagnostics: async (jobId, apiPrefix) => {
      calls.push(["summary", jobId, apiPrefix]);
      return { summary: { counts: { total: 2 } } };
    },
    fetchTranslationItems: async (jobId, apiPrefix, query) => {
      calls.push(["items", jobId, apiPrefix, { ...query }]);
      return {
        total: 2,
        items: [
          { item_id: "item-1" },
          { item_id: "item-2" },
        ],
      };
    },
    fetchTranslationItem: async (jobId, itemId, apiPrefix) => {
      calls.push(["item", jobId, itemId, apiPrefix]);
      return { item_id: itemId, item: { item_id: itemId, source_text: "source" } };
    },
    replayTranslationItem: async (jobId, itemId, apiPrefix) => {
      calls.push(["replay", jobId, itemId, apiPrefix]);
      return { payload: { replay_result: "ok" } };
    },
  });

  port.applyQuery({ finalStatus: "failed", q: "term" });
  const selection = await port.loadSummaryAndItems({ selectFirst: true });
  assert.deepEqual(selection, {
    jobId: "job-translation-port",
    selectedItemId: "item-1",
    shouldLoadSelectedItem: true,
    selectionChanged: true,
  });
  assert.equal(state.query.finalStatus, "failed");
  assert.equal(state.query.q, "term");
  assert.equal(state.query.offset, 0);
  assert.equal(state.summary.summary.counts.total, 2);
  assert.equal(state.selectedItemId, "item-1");

  await port.loadItem(selection.jobId, selection.selectedItemId);
  assert.equal(state.selectedItem.item.item_id, "item-1");
  await port.replaySelectedItem();
  assert.equal(state.replay.payload.replay_result, "ok");

  assert.equal(port.changePage("next"), true);
  assert.equal(state.query.offset, 20);
  const keptSelection = await port.loadItems(current, { selectFirst: true });
  assert.deepEqual(keptSelection, {
    selectedItemId: "item-1",
    shouldLoadSelectedItem: false,
    selectionChanged: false,
  });

  current = "job-other";
  assert.equal(port.syncJob(), "job-other");
  assert.equal(state.jobId, "job-other");
  assert.equal(state.selectedItemId, "");
});

test("status detail translation data port clears stale selected item for empty result pages", async () => {
  const state = createTranslationState();
  state.jobId = "job-empty";
  state.selectedItemId = "item-old";
  state.selectedItem = { item_id: "item-old" };
  state.replay = { payload: {} };
  const port = createStatusDetailTranslationDataPort({
    translationState: state,
    apiPrefix: "/api/v1",
    currentJobId: () => "job-empty",
    fetchTranslationDiagnostics: async () => ({}),
    fetchTranslationItems: async () => ({ total: 0, items: [] }),
    fetchTranslationItem: async () => {
      throw new Error("empty item pages should not load item details");
    },
    replayTranslationItem: async () => ({}),
  });

  const selection = await port.loadItems("job-empty", { selectFirst: true });

  assert.deepEqual(selection, {
    selectedItemId: "",
    shouldLoadSelectedItem: false,
    selectionChanged: true,
  });
  assert.equal(state.selectedItemId, "");
  assert.equal(state.selectedItem, null);
  assert.equal(state.replay, null);
});

test("status detail translation tab coordinator owns render orchestration", async () => {
  const state = createTranslationState();
  const renderCalls = [];
  const dataPort = createStatusDetailTranslationDataPort({
    translationState: state,
    apiPrefix: "/api/v1",
    currentJobId: () => "job-tab",
    fetchTranslationDiagnostics: async () => ({ summary: { counts: { total: 1 } } }),
    fetchTranslationItems: async () => ({
      total: 1,
      items: [{ item_id: "item-tab" }],
    }),
    fetchTranslationItem: async (_jobId, itemId) => ({
      item_id: itemId,
      item: { item_id: itemId },
    }),
    replayTranslationItem: async () => ({ payload: { replay_result: "ok" } }),
  });
  const coordinator = createStatusDetailTranslationTabCoordinator({
    dataPort,
    renderEmpty: (message) => renderCalls.push(["empty", message]),
    renderSummary: () => renderCalls.push(["summary"]),
    renderItems: (options = {}) => renderCalls.push(["items", options]),
    renderItemDetail: (options = {}) => renderCalls.push(["detail", options]),
    renderReplay: () => renderCalls.push(["replay"]),
    setReplayLoading: (payload) => renderCalls.push(["replay-loading", payload]),
  });

  await coordinator.ensureLoaded();

  assert.equal(state.loaded, true);
  assert.equal(state.selectedItemId, "item-tab");
  assert.equal(state.selectedItem.item.item_id, "item-tab");
  assert.deepEqual(renderCalls.map((call) => call[0]), [
    "empty",
    "summary",
    "items",
    "detail",
    "replay",
    "items",
    "detail",
    "replay",
    "detail",
  ]);

  renderCalls.length = 0;
  await coordinator.ensureLoaded();
  assert.deepEqual(renderCalls.map((call) => call[0]), ["summary", "items", "detail", "replay"]);

  renderCalls.length = 0;
  await coordinator.changePage("prev");
  assert.deepEqual(renderCalls, []);
});

test("status detail translation tab coordinator applies filters and replays selected item", async () => {
  const state = createTranslationState();
  let itemCalls = 0;
  const renderCalls = [];
  const dataPort = createStatusDetailTranslationDataPort({
    translationState: state,
    apiPrefix: "/api/v1",
    currentJobId: () => "job-tab-filter",
    fetchTranslationDiagnostics: async () => ({}),
    fetchTranslationItems: async () => ({
      total: 0,
      items: [],
    }),
    fetchTranslationItem: async () => {
      itemCalls += 1;
      return {};
    },
    replayTranslationItem: async () => ({ payload: { replay_result: "ok" } }),
  });
  const coordinator = createStatusDetailTranslationTabCoordinator({
    dataPort,
    renderEmpty: (message) => renderCalls.push(["empty", message]),
    renderSummary: () => renderCalls.push(["summary"]),
    renderItems: (options = {}) => renderCalls.push(["items", options]),
    renderItemDetail: (options = {}) => renderCalls.push(["detail", options]),
    renderReplay: () => renderCalls.push(["replay"]),
    setReplayLoading: (payload) => renderCalls.push(["replay-loading", payload]),
  });

  await coordinator.applyFilter({ finalStatus: "failed", q: "abc" });
  assert.equal(state.query.finalStatus, "failed");
  assert.equal(state.query.q, "abc");
  assert.equal(state.selectedItemId, "");
  assert.equal(itemCalls, 0);
  assert.deepEqual(renderCalls.map((call) => call[0]), [
    "summary",
    "summary",
    "items",
    "detail",
    "replay",
  ]);

  renderCalls.length = 0;
  state.selectedItemId = "item-replay";
  await coordinator.replaySelected();
  assert.equal(state.replay.payload.replay_result, "ok");
  assert.deepEqual(renderCalls.map((call) => call[0]), ["replay-loading", "replay"]);
});

test("job detail status view model follows main lane display stage", () => {
  const snapshot = buildJobDetailStatusViewModel(
    {
      job_id: "job-detail",
      status: "running",
      display_stage: "translation",
      stage: "translating",
      substage: "translation_batches",
      progress: { unit: "batch", current: 28, total: 5216 },
    },
    {
      items: [
        {
          seq: 41,
          display_stage: "render",
          stage: "render_preprocess",
          substage: "render_prewarm",
          lane: "background",
          progress: { unit: "step", current: 1, total: 3 },
          message: "render payload prewarm",
        },
        {
          seq: 42,
          display_stage: "translation",
          stage: "translating",
          substage: "translation_batches",
          lane: "main",
          progress: { unit: "batch", current: 29, total: 5216 },
        },
      ],
    },
  );

  assert.equal(snapshot.stageKey, "translate");
  assert.equal(snapshot.progressText, "第 29/5216 批");
  assert.match(snapshot.runtimeCurrentStage, /翻译|第 29\/5216 批/);
});

test("job detail status view model does not expose legacy stage detail fallback", () => {
  const snapshot = buildJobDetailStatusViewModel(
    {
      job_id: "job-detail-legacy-fallback",
      status: "running",
      display_stage: "translation",
      stage: "render_preprocess",
      current_stage: "render_preprocess",
      stage_detail: "render payload prewarm: ready",
      progress: { unit: "batch", current: 30, total: 100 },
    },
    { items: [] },
  );

  assert.equal(snapshot.stageKey, "translate");
  assert.equal(/render|prewarm|渲染/.test(snapshot.runtimeCurrentStage), false);
});

test("job detail status view model does not use legacy user_stage as runtime stage", () => {
  const snapshot = buildJobDetailStatusViewModel(
    {
      job_id: "job-detail-legacy-user-stage",
      status: "running",
      user_stage: "translation",
      stage: "render_preprocess",
      current_stage: "render_preprocess",
      progress: { unit: "batch", current: 30, total: 100 },
    },
    { items: [] },
  );

  assert.equal(snapshot.stageKey, "running");
  assert.equal(/translation|翻译|render|渲染/.test(snapshot.runtimeCurrentStage), false);
});

test("job detail event view model uses structured progress fields", () => {
  const viewModel = buildJobDetailEventViewModel({
    seq: 99,
    display_stage: "translation",
    stage: "render_preprocess",
    substage: "translation_batches",
    lane: "main",
    event_type: "progress",
    progress: { unit: "batch", current: 4000, total: 5216 },
    stage_detail: "book: completed batch 1/2",
    message: "book: completed batch 1/2",
  });

  assert.equal(viewModel.displayStage, "translation");
  assert.equal(viewModel.substage, "translation_batches");
  assert.equal(viewModel.lane, "main");
  assert.equal(viewModel.progressText, "第 4000/5216 批");
  assert.equal(viewModel.progressCurrent, 4000);
  assert.equal(viewModel.progressTotal, 5216);
  assert.equal(viewModel.progressUnit, "batch");
});

test("job detail event view model does not promote canonical events without display_stage", () => {
  const viewModel = buildJobDetailEventViewModel({
    seq: 100,
    lane: "main",
    user_stage: "render",
    stage: "render_preprocess",
    substage: "render_prewarm",
    event_type: "progress",
    progress: { unit: "step", current: 1, total: 3 },
  });

  assert.equal(viewModel.displayStage, "");
  assert.equal(viewModel.stageText, "进度 1/3");
  assert.equal(viewModel.lane, "main");
  assert.equal(viewModel.progressCurrent, 1);
  assert.equal(viewModel.progressTotal, 3);
});

test("normalized event display record prefers structured progress over provider text", () => {
  const record = normalizedStageEventRecord({
    seq: 100,
    display_stage: "translation",
    stage: "translating",
    substage: "translation_batches",
    lane: "main",
    event_type: "progress",
    progress: { unit: "batch", current: 4000, total: 5216 },
    stage_detail: "book: completed batch 1/2",
    message: "book: completed batch 1/2",
  });

  assert.equal(record.displayStage, "translation");
  assert.equal(record.stageText, "第 4000/5216 批");
  assert.equal(record.progressText, "第 4000/5216 批");
  assert.equal(record.progress.current, 4000);
  assert.equal(record.progress.total, 5216);
});

test("status detail event presentation uses normalized progress records", () => {
  const presentation = buildEventsPresentation({
    items: [
      {
        seq: 101,
        display_stage: "translation",
        stage: "translating",
        substage: "translation_batches",
        lane: "main",
        event_type: "progress",
        progress: { unit: "batch", current: 4001, total: 5216 },
        stage_detail: "book: completed batch 1/2",
        message: "book: completed batch 1/2",
      },
    ],
  });

  assert.equal(presentation.count, 1);
  assert.match(presentation.markup, /translation/);
  assert.match(presentation.markup, /translation_batches/);
  assert.match(presentation.markup, /第 4001\/5216 批/);
});

test("job status view model preserves status card snapshot fields", () => {
  const job = {
    job_id: "job-status-model",
    status: "succeeded",
    display_stage: "done",
    output_pdf_ready: true,
    progress_percent: 100,
    actions: {
      download_pdf: {
        enabled: true,
        url: "/api/v1/jobs/job-status-model/pdf",
      },
    },
  };
  const events = { items: [] };
  const stagePresentation = {
    label: "完成",
    detail: "翻译 PDF 已生成",
    stageKey: "done",
    visualStageKey: "done",
    progressCurrent: 100,
    progressTotal: 100,
    progressPercent: 100,
    progressText: "已完成",
    progressUnit: "percent",
    progressIndeterminate: false,
    substageKey: "done",
    stageProgressByKey: {
      done: {
        current: 100,
        total: 100,
        percent: 100,
        unit: "percent",
      },
    },
  };
  const input = {
    state: createLegacyStateFixture(),
    job,
    jobId: job.job_id,
    stagePresentation,
    events,
    manifest: null,
    stageActions: null,
    publicErrorText: "-",
  };

  const viewModel = buildJobStatusViewModel(input);
  const snapshot = buildStatusCardSnapshot(input);

  assert.deepEqual(snapshot, viewModel);
  assert.equal(viewModel.jobId, "job-status-model");
  assert.equal(viewModel.stageKey, "done");
  assert.equal(viewModel.progressText, "已完成");
  assert.equal(viewModel.errorText, "");
  assert.equal(viewModel.pdfReady, true);
});

test("job status view model carries manifest actions and retry actions", () => {
  const job = {
    job_id: "job-status-actions",
    status: "succeeded",
    display_stage: "done",
    output_pdf_ready: true,
    artifacts: {},
  };
  const manifest = {
    items: [
      {
        artifact_key: "source_pdf",
        ready: true,
        resource_path: "/api/v1/jobs/job-status-actions/artifacts/source_pdf",
      },
      {
        artifact_key: "markdown_bundle_zip",
        ready: true,
        resource_path: "/api/v1/jobs/job-status-actions/artifacts/markdown_bundle_zip",
      },
      {
        artifact_key: "pdf",
        ready: true,
        resource_path: "/api/v1/jobs/job-status-actions/pdf",
      },
    ],
  };
  const viewModel = buildJobStatusViewModel({
    state: createLegacyStateFixture(),
    job,
    jobId: job.job_id,
    events: { items: [] },
    manifest,
    stageActions: {
      stages: [
        {
          stage: "translation",
          label: "重新翻译",
          can_retry: true,
        },
        {
          stage: "render",
          can_retry: false,
          disabled_reason: "等待翻译完成",
        },
      ],
    },
    publicErrorText: "",
    stagePresentation: {
      label: "完成",
      detail: "翻译 PDF 已生成",
      stageKey: "done",
      visualStageKey: "done",
      progressCurrent: 100,
      progressTotal: 100,
      progressPercent: 100,
      progressText: "已完成",
      progressUnit: "percent",
      progressIndeterminate: false,
      substageKey: "done",
    },
  });

  assert.equal(viewModel.readerReady, true);
  assert.equal(viewModel.sourcePdfReady, true);
  assert.match(viewModel.sourcePdfUrl, /source_pdf/);
  assert.equal(viewModel.markdownBundleReady, true);
  assert.match(viewModel.markdownBundleUrl, /include_job_dir=true/);
  assert.equal(viewModel.stageRetryActions.translate.canRetry, true);
  assert.equal(viewModel.stageRetryActions.translate.stage, "translation");
  assert.equal(viewModel.stageRetryActions.render.canRetry, false);
  assert.equal(viewModel.stageRetryActions.render.disabledReason, "等待翻译完成");
});

test("live duration helpers use explicit timing inputs instead of runtime globals", () => {
  const job = {
    status: "succeeded",
    display_stage: "done",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:03:00Z",
    stage_history: [
      {
        stage: "rendering",
        enter_at: "2026-01-01T00:02:00Z",
      },
    ],
  };

  const durations = resolveLiveDurations(job, {
    finishedAtFallback: "2026-01-01T00:05:00Z",
  });

  assert.equal(durations.totalElapsedText, "5分 0秒");
  assert.equal(
    resolveStageHistoryDuration(job.stage_history[0], job, {
      finishedAtFallback: "2026-01-01T00:05:00Z",
    }),
    180000,
  );
});

test("live duration helpers keep ambiguous succeeded payloads running", () => {
  const job = {
    status: "succeeded",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:03:00Z",
    stage_started_at: "2026-01-01T00:02:00Z",
    stage_history: [
      {
        stage: "translating",
        enter_at: "2026-01-01T00:02:00Z",
      },
    ],
  };

  const durations = resolveLiveDurations(job, {
    finishedAtFallback: "2026-01-01T00:05:00Z",
    now: "2026-01-01T00:06:00Z",
  });

  assert.equal(durations.stageElapsedText, "4分 0秒");
  assert.equal(durations.totalElapsedText, "6分 0秒");
  assert.equal(
    resolveStageHistoryDuration(job.stage_history[0], job, {
      finishedAtFallback: "2026-01-01T00:05:00Z",
      now: "2026-01-01T00:06:00Z",
    }),
    240000,
  );
});

test("job status view model accepts explicit finished-at fallback", () => {
  const job = {
    job_id: "job-status-duration",
    status: "succeeded",
    display_stage: "done",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:02:00Z",
  };
  const viewModel = buildJobStatusViewModel({
    state: createLegacyStateFixture(),
    job,
    jobId: job.job_id,
    events: { items: [] },
    manifest: null,
    stageActions: null,
    publicErrorText: "",
    finishedAtFallback: "2026-01-01T00:04:00Z",
    stagePresentation: {
      label: "完成",
      detail: "翻译 PDF 已生成",
      stageKey: "done",
      visualStageKey: "done",
      progressCurrent: 100,
      progressTotal: 100,
      progressPercent: 100,
      progressText: "已完成",
      progressUnit: "percent",
      progressIndeterminate: false,
      substageKey: "done",
    },
  });

  assert.equal(viewModel.elapsed, "4分 0秒");
});

test("job status view model does not read runtime finished-at fallback implicitly", () => {
  const localState = createLegacyStateFixture();
  localState.currentJobFinishedAt = "2026-01-01T00:10:00Z";
  const job = {
    job_id: "job-status-explicit-duration",
    status: "succeeded",
    display_stage: "done",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:02:00Z",
  };

  const viewModel = buildJobStatusViewModel({
    state: localState,
    job,
    jobId: job.job_id,
    events: { items: [] },
    manifest: null,
    stageActions: null,
    publicErrorText: "",
    stagePresentation: {
      label: "完成",
      detail: "翻译 PDF 已生成",
      stageKey: "done",
      visualStageKey: "done",
      progressCurrent: 100,
      progressTotal: 100,
      progressPercent: 100,
      progressText: "已完成",
      progressUnit: "percent",
      progressIndeterminate: false,
      substageKey: "done",
    },
  });

  assert.equal(viewModel.elapsed, "2分 0秒");
});
