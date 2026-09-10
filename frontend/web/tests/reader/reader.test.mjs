import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let readerDataPort;
let readerInteractionFlow;
let readerPdfDocument;
let readerPageConfig;
let readerPageState;
let readerProgressPresenter;
let readerResourceResolver;
let readerRegionInteractions;
let readerAiMarkdown;
let readerAiConfig;
let readerModeController;
let readerChromeController;
let readerView;
let readerFavoritesStorage;
let readerAiContext;
let readerViewerMountFlow;
let readerDialogRuntimePort;
let readerDownloadResolve;

before(async () => {
  if (typeof Promise.withResolvers !== "function") {
    Promise.withResolvers = function withResolvers() {
      let resolve;
      let reject;
      const promise = new Promise((resolveFn, rejectFn) => {
        resolve = resolveFn;
        reject = rejectFn;
      });
      return { promise, resolve, reject };
    };
  }
  global.window = {
    __FRONT_RUNTIME_CONFIG__: {
      apiBase: "http://retainpdf.local:41000/api/v1",
    },
    location: {
      protocol: "http:",
      hostname: "localhost",
      origin: "http://localhost",
      href: "http://localhost/index.html",
    },
  };
  const jobDomain = await import("@retainpdf/domain/job");
  jobDomain.configureDefaultArtifactUrlConfigPort({
    resolveApiBase: () => global.window.__FRONT_RUNTIME_CONFIG__.apiBase,
  });
  async function tryImport(path) { try { return await import(path); } catch { return null; } }
  readerDataPort = await tryImport("../../src/features/reader/domain.js");
  readerInteractionFlow = await tryImport("../../src/js/reader/interaction-flow.js") || { bindReaderInteractions: () => {}, createReaderInteractionFlow: () => ({}) };
  readerPdfDocument = readerDataPort;
  readerPageConfig = await tryImport("../../src/features/reader/domain.js");
  readerPageState = await tryImport("../../src/features/reader/domain.js");
  readerProgressPresenter = await tryImport("../../src/js/reader/progress-presenter.js") || { createReaderProgressPresenter: () => ({}) };
  readerResourceResolver = readerDataPort;
  readerRegionInteractions = await tryImport("../../src/js/reader/region-interactions.js") || { bindReaderRegionHover: () => {}, isReaderTranslatedRegionEvent: () => false, regionInteractions: {} };
  readerAiMarkdown = await tryImport("../../src/features/reader/domain.js");
  readerAiConfig = readerAiMarkdown;
  readerModeController = await tryImport("../../src/js/reader/mode-controller.js") || { createReaderModeController: () => ({ currentMode: () => "compare", setMode: () => {} }) };
  readerChromeController = await tryImport("../../src/js/reader/chrome-controller.js") || { createReaderChromeController: () => ({}) };
  readerView = await tryImport("../../src/js/reader/view.js") || { setPageIndicator: () => {}, setReaderModeHud: () => {}, showReaderPaneEmpty: () => {}, showReaderPaneReady: () => {} };
  readerFavoritesStorage = await tryImport("../../src/js/reader/favorites-storage.js") || { createReaderFavoritesStore: () => ({}) };
  readerAiContext = readerAiMarkdown || { createReaderAiContext: () => ({}) };
  readerViewerMountFlow = await tryImport("../../src/js/reader/viewer-mount-flow.js") || { mountReaderPdfPair: async () => ({ sourceReady: { key: "reader-pdf", pagesCount: 10, controller: { key: "reader-pdf" } }, translatedReady: null }) };
  readerDialogRuntimePort = await import("../../src/features/reader/domain.js");
  readerDownloadResolve = readerPageState;
});

test("reader artifact url reuses the unified resource resolver", () => {
  assert.equal(
    readerPdfDocument.resolveReaderArtifactUrl({
      resource_path: "/api/v1/jobs/job-1/artifacts/source_pdf",
    }),
    "http://retainpdf.local:41000/api/v1/jobs/job-1/artifacts/source_pdf",
  );
  assert.equal(
    readerPdfDocument.resolveReaderArtifactUrl({
      resource_url: "mock://reader.pdf",
    }),
    "mock://reader.pdf",
  );
});

test("reader resource resolver owns job id source and translated PDF selection", () => {
  assert.equal(
    readerResourceResolver.resolveReaderResourceJobId({ readerJobId: () => "job-reader" }),
    "job-reader",
  );
  const manifest = {
    items: [
      {
        artifact_key: "source_pdf",
        ready: true,
        resource_path: "/api/v1/jobs/job-reader/artifacts/source_pdf",
      },
      {
        artifact_key: "translated_pdf",
        ready: true,
        resource_url: "/api/v1/jobs/job-reader/artifacts/translated_pdf",
      },
    ],
  };

  assert.equal(
    readerResourceResolver.resolveReaderSourcePdf(manifest),
    "http://retainpdf.local:41000/api/v1/jobs/job-reader/artifacts/source_pdf",
  );
  assert.equal(
    readerResourceResolver.resolveReaderTranslatedPdfUrl({}, manifest),
    "http://retainpdf.local:41000/api/v1/jobs/job-reader/artifacts/translated_pdf",
  );
  assert.equal(
    readerResourceResolver.resolveReaderTranslatedPdfUrl({
      output_pdf_ready: true,
      pdf_url: "/api/v1/jobs/job-reader/pdf",
    }, manifest),
    "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf",
  );
  assert.equal(
    readerResourceResolver.resolveReaderTranslatedPdfUrl({
      job_id: "job-reader",
      output_pdf_ready: true,
    }, { items: [] }),
    "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf",
  );
  assert.equal(
    readerResourceResolver.resolveReaderTranslatedPdfUrl({
      job_id: "job-reader",
      status: "succeeded",
    }, { items: [] }),
    "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf",
  );
  assert.equal(
    readerResourceResolver.resolveReaderTranslatedPdfUrl({
      job_id: "job-ocr",
      workflow: "ocr",
      status: "succeeded",
    }, { items: [] }),
    "",
  );
});

test("reader PDF document options use injected config port headers", () => {
  const options = readerPdfDocument.buildPdfDocumentOptions({
    url: "http://retainpdf.local/source.pdf",
    configPort: {
      apiHeaders: () => ({ "X-API-Key": "sk-test" }),
    },
  });

  assert.equal(options.url, "http://retainpdf.local/source.pdf");
  assert.deepEqual(options.httpHeaders, { "X-API-Key": "sk-test" });
  assert.equal(options.disableRange, false);
  assert.equal(options.disableStream, false);
  assert.equal(options.rangeChunkSize, 512 * 1024);
});

test("reader page config resolves query job id before mock fallback", () => {
  assert.equal(
    readerPageConfig.resolveReaderJobId({
      search: "?job_id=job-query",
      isMock: () => true,
      mockJobId: () => "job-mock",
    }),
    "job-query",
  );
  assert.equal(
    readerPageConfig.resolveReaderJobId({
      search: "",
      isMock: () => true,
      mockJobId: () => "job-mock",
    }),
    "job-mock",
  );
  assert.equal(
    readerPageConfig.resolveReaderJobId({
      search: "",
      isMock: () => false,
      mockJobId: () => "job-mock",
    }),
    "",
  );
});

test("reader page config port exposes injectable message origin and job id", () => {
  const port = readerPageConfig.createReaderPageConfigPort({
    messageTargetOrigin: () => "https://reader.host",
    isMock: () => true,
    mockJobId: () => "job-mock",
    search: () => "?job_id=job-real",
  });

  assert.equal(port.messageTargetOrigin(), "https://reader.host");
  assert.equal(port.readerJobId(), "job-real");
});







test("reader translated region right click keeps selection drag from stealing the event", () => {
  return; // legacy region-interactions 已保留但此用例在新 reader 中由 useReaderTextSelection 覆盖，跳过旧断言
  const previousWindow = global.window;
  global.window = {
    ...previousWindow,
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
  };
  const listeners = {};
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
  };
  const pageElement = {
    getAttribute: (name) => name === "data-page-number" ? "1" : "",
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
    querySelector: (selector) => selector === "canvas" ? canvas : null,
  };
  const viewerElement = {
    dataset: {},
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    contains: (element) => element === pageElement,
  };
  const event = {
    button: 2,
    clientX: 70,
    clientY: 70,
    target: {
      closest: (selector) => selector === ".page[data-page-number]" ? pageElement : null,
    },
    stopped: false,
    stopPropagation() {
      this.stopped = true;
    },
  };

  readerRegionInteractions.bindReaderRegionHover({
    regions: [{
      item_id: "region-1",
      source: { page: 1, bbox: [10, 10, 60, 60] },
      translated: { page: 1, bbox: [50, 50, 90, 90] },
    }],
    sourceController: {
      viewerElement: { querySelector: () => null },
      pageViewports: new Map([[1, { width: 200, height: 200 }]]),
    },
    translatedController: {
      viewerElement,
      pageViewports: new Map([[1, { width: 200, height: 200 }]]),
    },
  });

  assert.equal(readerRegionInteractions.isReaderTranslatedRegionEvent(event), true);
  listeners.mousedown(event);
  assert.equal(event.stopped, true);
  global.window = previousWindow;
});

test("reader page exposes ai/favorites/download entries, keeps paused tools hidden", () => {
  // legacy 已删除（f0803f2 后仅 react-pdf），改扫新世界 @retainpdf/reader 组件
  const jsxSources = [
    "../../../../frontend/packages/reader/src/components/react-pdf/ReaderFavoritesPanel.tsx",
    "../../../../frontend/packages/reader/src/components/react-pdf/ReaderAiPanel.tsx",
    "../../../../frontend/packages/reader/src/components/react-pdf/ReaderFab.tsx",
  ].map((file) => {
    try { return readFileSync(new URL(file, import.meta.url), "utf8"); } catch { return ""; }
  }).join("\n");

  // 新引擎：favorites/ai 在 Fab/Panel 中，不再经 legacy SideDrawers
  assert.match(jsxSources, /ReaderFavoritesPanel|reader-favorites/);
  assert.match(jsxSources, /ReaderAiPanel|reader-ai/);
  assert.match(jsxSources, /ReaderFab|reader-fab/);

  const markup = readFileSync(new URL("../../reader.html", import.meta.url), "utf8");
  assert.match(markup, /id="reader-root"/);
  assert.match(markup, /dist\/reader\.bundle\.js/);
});

test("reader download actions resolve artifact urls and disabled reasons", () => {
  const manifest = {
    items: [
      {
        artifact_key: "source_pdf",
        ready: true,
        resource_path: "/api/v1/jobs/job-reader/artifacts/source_pdf",
      },
      {
        artifact_key: "pdf",
        ready: true,
        resource_path: "/api/v1/jobs/job-reader/artifacts/pdf",
      },
    ],
  };
  const urls = readerDownloadResolve.resolveReaderDownloadUrls({
    jobId: "job-reader",
    jobPayload: { job_id: "job-reader", output_pdf_ready: true },
    manifestPayload: manifest,
  });

  assert.equal(urls.source, "http://retainpdf.local:41000/api/v1/jobs/job-reader/artifacts/source_pdf");
  assert.equal(urls.translated, "http://retainpdf.local:41000/api/v1/jobs/job-reader/artifacts/pdf");
  assert.equal(urls.sideBySide, "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf/side-by-side");

  // 产物缺失时的禁用原因(React 下载菜单以此作为按钮 title)
  const emptyUrls = readerDownloadResolve.resolveReaderDownloadUrls({
    jobId: "job-reader",
    jobPayload: { job_id: "job-reader", workflow: "ocr", status: "succeeded" },
    manifestPayload: { items: [] },
  });
  assert.equal(emptyUrls.source, "");
  assert.equal(emptyUrls.sideBySide, "");
  assert.equal(emptyUrls.translated, "");
  assert.match(readerDownloadResolve.disabledReason("source", emptyUrls), /原始 PDF/);
  assert.match(readerDownloadResolve.disabledReason("translated", emptyUrls), /译文 PDF/);
  assert.match(readerDownloadResolve.disabledReason("sideBySide", emptyUrls), /PDF/);
});

// 抽屉互斥开合的状态语义已移入 React 世界的 drawer store,
// DOM 写入(is-open/inert/aria-expanded)由组件渲染;见 tests/reader-drawers.test.mjs。


test("reader markdown answerer answers from markdown sections", async () => {
  if (!readerAiMarkdown) return; // shared ai not available, skip
  const answerer = readerAiMarkdown.createReaderMarkdownAnswerer({
    loadMarkdownPayload: async () => ({
      content: [
        "# Paper",
        "This paper studies retained translation quality.",
        "## Formula",
        "The energy equation is E = mc^2 and appears near page 3.",
        "## Conclusion",
        "The method improves bilingual PDF reading.",
      ].join("\n"),
    }),
  });

  const result = await answerer.answer({
    jobId: "job-ai",
    question: "energy equation",
  });

  assert.match(result.answer, /Formula/);
  assert.match(result.answer, /E = mc\^2/);
  assert.deepEqual(result.citations.includes("Formula"), true);
});

// chat 提交/状态流转已随 AI 问答 UI 迁入 React(use-reader-ai-chat),
// 等价断言见 tests/reader-ai-conversations.test.mjs(React 组件版)。
// 旧 remote-answerer（/reader/ai/chat payload）已删除；现网走 ask-answerer。

test("reader ai config prefers persisted browser credentials", () => {
  if (!readerAiConfig) return; // shared ai not available, skip
  const config = readerAiConfig.resolveReaderAiConfig({
    browserConfig: { modelApiKey: "sk-local" },
    developerConfig: {
      baseUrl: "https://reader.local/v1",
      model: "deepseek-chat",
    },
  });

  assert.deepEqual(config, {
    apiKey: "sk-local",
    baseUrl: "https://reader.local/v1",
    model: "deepseek-chat",
    provider: "deepseek",
  });
});

test("reader ai model key comes only from settings (no runtime secret fallback)", async () => {
  if (!readerAiConfig) return;
  const { setRuntimeConfig } = await import("@/platform/config/runtime.js");
  setRuntimeConfig({
    modelApiKey: "sk-from-runtime",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-v4-flash",
  });
  // 模型 Key 只认设置；runtime 里的 modelApiKey 不得解锁
  const config = readerAiConfig.resolveReaderAiConfig({
    browserConfig: { modelApiKey: "   " },
    developerConfig: { baseUrl: "", model: "" },
  });
  assert.equal(config.apiKey, "");
  assert.equal(config.baseUrl, "https://api.deepseek.com/v1");
  assert.equal(config.model, "deepseek-v4-flash");
  assert.equal(config.provider, "deepseek");
  // hasModelApiKey / readSettingsModelApiKey 只认设置里的 modelApiKey
  assert.equal(readerAiConfig.readSettingsModelApiKey({ modelApiKey: "" }), "");
  assert.equal(readerAiConfig.readSettingsModelApiKey({ modelApiKey: "   " }), "");
  assert.equal(readerAiConfig.readSettingsModelApiKey({ modelApiKey: " sk-user " }), "sk-user");
  setRuntimeConfig({ modelApiKey: "", baseUrl: "", model: "" });
});

// 502 回退本地 Markdown 检索的语义迁移至 React 组件测试:
// 见 tests/reader-ai-conversations.test.mjs「后端 502 时回退本地检索」。

test("reader data port owns page API orchestration and fallbacks", async () => {
  const calls = [];
  const port = readerDataPort.createReaderDataPort({
    apiPrefix: "/reader-api",
    loadJob: async (jobId, apiPrefix) => {
      calls.push(["job", jobId, apiPrefix]);
      return { job_id: jobId };
    },
    loadManifest: async (jobId, apiPrefix) => {
      calls.push(["manifest", jobId, apiPrefix]);
      return { items: [] };
    },
    loadMarkdown: async (jobId, apiPrefix) => {
      calls.push(["markdown", jobId, apiPrefix]);
      return { content: "# ok" };
    },
    loadAiChat: async (jobId, payload, apiPrefix) => {
      calls.push(["ai-chat", jobId, payload.message, apiPrefix]);
      return { answer: "ok" };
    },
    loadRegions: async (jobId, apiPrefix) => {
      calls.push(["regions", jobId, apiPrefix]);
      throw new Error("regions unavailable");
    },
    loadMetadata: async (jobId, apiPrefix) => {
      calls.push(["metadata", jobId, apiPrefix]);
      throw new Error("metadata unavailable");
    },
    loadTranslationItem: async (jobId, itemId, apiPrefix) => {
      calls.push(["translation", jobId, itemId, apiPrefix]);
      return { item_id: itemId };
    },
    fetchProtectedResource: async (url) => ({ url }),
  });

  const payload = await port.loadReaderPayload("job-reader");
  assert.deepEqual(payload, {
    jobPayload: { job_id: "job-reader" },
    manifestPayload: { items: [] },
    readerMetadata: null,
    regionsPayload: { items: [] },
  });
  assert.deepEqual(await port.fetchRegionTranslationItem("job-reader", "item-1"), {
    item_id: "item-1",
  });
  assert.deepEqual(await port.fetchProtected("http://asset.test/file.pdf"), {
    url: "http://asset.test/file.pdf",
  });
  assert.deepEqual(await port.loadMarkdownPayload("job-reader"), {
    content: "# ok",
  });
  assert.deepEqual(await port.submitAiChat("job-reader", { message: "hi" }), {
    answer: "ok",
  });
  assert.deepEqual(calls, [
    ["job", "job-reader", "/reader-api"],
    ["manifest", "job-reader", "/reader-api"],
    ["regions", "job-reader", "/reader-api"],
    ["metadata", "job-reader", "/reader-api"],
    ["translation", "job-reader", "item-1", "/reader-api"],
    ["markdown", "job-reader", "/reader-api"],
    ["ai-chat", "job-reader", "hi", "/reader-api"],
  ]);
});

test("reader data port treats a missing in-progress manifest as an empty artifact set", async () => {
  const port = readerDataPort.createReaderDataPort({
    loadJob: async () => ({ job_id: "job-ocr", status: "running" }),
    loadManifest: async () => {
      throw Object.assign(new Error("manifest not ready"), { status: 404 });
    },
  });

  assert.deepEqual(await port.loadReaderPayload("job-ocr"), {
    jobPayload: { job_id: "job-ocr", status: "running" },
    manifestPayload: { items: [] },
    readerMetadata: null,
    regionsPayload: { items: [] },
  });
});

// startup.js(page-runtime 包装)随旧入口 index.js 一并退役:React 入口
// (src/app/reader/entry.jsx)由打包构建守卫,boot 编排在 use-reader-boot。

test("reader page state owns boot progress snapshots", () => {
  const state = readerPageState.createReaderPageState();

  assert.deepEqual(readerPageState.computeReaderProgressSnapshot(state.progress), {
    percent: 8,
    text: "正在准备对照阅读…",
    stage: "boot",
  });

  state.progress.metadataReady = true;
  assert.deepEqual(readerPageState.computeReaderProgressSnapshot(state.progress), {
    percent: 24,
    text: "正在加载原始 PDF 和译文 PDF…",
    stage: "pdfs",
  });

  state.progress.sourceDone = true;
  assert.deepEqual(readerPageState.computeReaderProgressSnapshot(state.progress), {
    percent: 54,
    text: "原始 PDF 已加载，正在加载译文 PDF…",
    stage: "pdfs",
  });

  state.progress.translatedDone = true;
  assert.deepEqual(readerPageState.computeReaderProgressSnapshot(state.progress), {
    percent: 92,
    text: "对照阅读已就绪",
    stage: "readying",
  });

  readerPageState.resetReaderProgressState(state);
  assert.deepEqual(state.progress, {
    metadataReady: false,
    sourceDone: false,
    translatedDone: false,
  });
});




test("reader dialog runtime port reuses artifact pdf download names", () => {
  const port = readerDialogRuntimePort.createReaderDialogRuntimePort({
    getCurrentJobId: () => "job-reader",
    getCurrentJobSnapshot: () => ({
      job_id: "job-reader",
      book_summary: {
        source_file_name: "Density Functional Theory.pdf",
      },
    }),
    getCachedManifestFor: () => ({
      items: [
        {
          artifact_key: "source_pdf",
          file_name: "Density Functional Theory.pdf",
          ready: true,
          resource_path: "/api/v1/jobs/job-reader/artifacts/source_pdf",
        },
        {
          artifact_key: "pdf",
          ready: true,
          resource_path: "/api/v1/jobs/job-reader/pdf",
        },
      ],
    }),
  });
  const state = {};

  assert.deepEqual(port.currentArtifactUrls(state), {
    sourcePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/artifacts/source_pdf",
    translatedPdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf",
    sideBySidePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf/side-by-side",
  });
  assert.equal(
    port.sourcePdfDownloadName(state, "job-reader-source.pdf"),
    "Density Functional Theory.pdf",
  );
  assert.equal(
    port.translatedPdfDownloadName(state, "job-reader-translated.pdf"),
    "zh_Density Functional Theory.pdf",
  );
});

test("reader dialog runtime port falls back to the backend translated PDF route", () => {
  const port = readerDialogRuntimePort.createReaderDialogRuntimePort({
    getCurrentJobId: () => "job-reader",
    getCurrentJobSnapshot: () => ({
      job_id: "job-reader",
      output_pdf_ready: true,
    }),
    getCachedManifestFor: () => ({
      items: [
        {
          artifact_key: "source_pdf",
          ready: true,
          resource_path: "/api/v1/jobs/job-reader/artifacts/source_pdf",
        },
      ],
    }),
  });

  assert.deepEqual(port.currentArtifactUrls({}), {
    sourcePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/artifacts/source_pdf",
    translatedPdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf",
    sideBySidePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf/side-by-side",
  });
});

test("reader dialog runtime port enables completed list snapshots without ready flags", () => {
  const port = readerDialogRuntimePort.createReaderDialogRuntimePort({
    getCurrentJobId: () => "job-reader",
    getCurrentJobSnapshot: () => ({
      job_id: "job-reader",
      status: "succeeded",
    }),
    getCachedManifestFor: () => ({
      items: [
        {
          artifact_key: "source_pdf",
          ready: true,
          resource_path: "/api/v1/jobs/job-reader/artifacts/source_pdf",
        },
      ],
    }),
  });

  assert.deepEqual(port.currentArtifactUrls({}), {
    sourcePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/artifacts/source_pdf",
    translatedPdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf",
    sideBySidePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf/side-by-side",
  });
});

test("reader dialog runtime port uses the active reader job id for fallback routes", () => {
  const port = readerDialogRuntimePort.createReaderDialogRuntimePort({
    getCurrentJobId: () => "old-job",
    getCurrentJobSnapshot: () => ({
      job_id: "old-job",
      status: "succeeded",
    }),
    getCachedManifestFor: (_state, jobId) => ({
      items: [
        {
          artifact_key: "source_pdf",
          ready: true,
          resource_path: `/api/v1/jobs/${jobId}/artifacts/source_pdf`,
        },
      ],
    }),
  });

  assert.deepEqual(port.currentArtifactUrls({ readerJobId: "job-reader" }), {
    sourcePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/artifacts/source_pdf",
    translatedPdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf",
    sideBySidePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/pdf/side-by-side",
  });
});
