// 状态详情 · 任务详情页：config / data / resume port、摘要与概览渲染、操作链接、Markdown 流程、页面状态。
// 从原 status-detail.test.mjs（1500+ 行）按主题拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import { createStatusDetailConfigPort } from "../../src/features/job-detail/domain/dialog/config-port.js";
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

global.window ||= {};
global.window.location ||= {
  protocol: "http:",
  origin: "http://localhost",
  pathname: "/",
};

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
    // job-detail 只用 /markdown JSON；/markdown/document 已弃用（端点可删）。
    loadMarkdown: async (jobId, apiPrefix) => {
      calls.push(["markdown", jobId, apiPrefix]);
      return { content: "# ok" };
    },
    loadEvents: async (jobId, apiPrefix, query) => {
      calls.push(["events", jobId, apiPrefix, query]);
      return { items: [] };
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
  assert.deepEqual(await port.fetchJobEvents("job-detail", port.apiPrefix, { limit: 10, cursor: "test-cursor" }), { items: [] });
  assert.deepEqual(await port.resumeJob("job-detail", port.apiPrefix), { job_id: "job-resume" });
  assert.deepEqual(await port.fetchProtected("http://asset.test/file.pdf"), {
    url: "http://asset.test/file.pdf",
  });
  assert.deepEqual(calls, [
    ["job", "job-detail", "/detail-api"],
    ["manifest", "job-detail", "/detail-api"],
    ["diagnostics", "job-detail", "/detail-api"],
    ["resume-plan", "job-detail", "/detail-api"],
    ["markdown", "job-detail", "/detail-api"],
    ["events", "job-detail", "/detail-api", { limit: 10, cursor: "test-cursor" }],
    ["resume", "job-detail", "/detail-api"],
  ]);
  assert.equal(port.rerunJob, undefined, "续跑只走 resumeJob（POST /jobs/:id/actions/resume）");
});

test("job detail resume port 只按任务号续跑，没有任务号直接报错", async () => {
  const calls = [];
  const port = createJobDetailResumePort({
    apiPrefix: "/detail-api",
    resumeJob: async (jobId, apiPrefix) => {
      calls.push(["resume", jobId, apiPrefix]);
      return { job_id: "job-resumed" };
    },
  });

  assert.deepEqual(await port.submit({ jobId: "job-current" }), { job_id: "job-resumed" });
  await assert.rejects(port.submit({ jobId: "" }), /缺少 job_id/);
  assert.deepEqual(calls, [["resume", "job-current", "/detail-api"]]);
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

test("job detail markdown flow：没发布 Markdown 的任务（失败的）不去取 /reader/markdown", async () => {
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: () => null };
  const fields = {};
  const links = {};
  const state = { markdownPayload: { content: "旧的" } };
  try {
    for (const job of [
      { status: "failed", artifacts: { markdown: { ready: false, json_path: "/api/v1/jobs/job-failed/reader/markdown" } } },
      { status: "failed", artifacts: {} },
    ]) {
      await loadAndRenderMarkdownFlow({
        fetchProtected: async () => {
          throw new Error("no image fetch expected");
        },
        job,
        jobId: "job-failed",
        loadMarkdownPayload: async () => {
          throw new Error("不该去取 /reader/markdown");
        },
        markdownImageUrls: [],
        setActionLink: (id, url, enabled) => {
          links[id] = { enabled: Boolean(enabled), url };
        },
        setText: (id, value) => {
          fields[id] = value;
        },
        state,
      });
      assert.equal(state.markdownPayload, null);
      assert.equal(fields["detail-markdown-status"], "当前任务没有已发布 Markdown");
      assert.equal(links["detail-markdown-json-btn"].enabled, false);
    }
  } finally {
    globalThis.document = previousDocument;
  }
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
        actions: { resume: { enabled: true, url: "/resume/job-overview" } },
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
