import test, { before } from "node:test";
import assert from "node:assert/strict";
// 数据端口白盒测试直连 src，避免依赖需单独构建的 reader dist（与
// markdown-payload.test.mjs 相同边界）。
import { createReaderDataPort } from "../../../../frontend/packages/reader/src/shared/data/data-port.ts";

let readerDataPort;
let readerPdfDocument;
let readerPageConfig;
let readerPageState;
let readerResourceResolver;
let readerAiMarkdown;
let readerAiConfig;
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
  readerPdfDocument = readerDataPort;
  readerPageConfig = await tryImport("../../src/features/reader/domain.js");
  readerPageState = await tryImport("../../src/features/reader/domain.js");
  readerResourceResolver = readerDataPort;
  readerAiMarkdown = await tryImport("../../src/features/reader/domain.js");
  readerAiConfig = readerAiMarkdown;
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
    "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/translated.pdf",
  );
  assert.equal(
    readerResourceResolver.resolveReaderTranslatedPdfUrl({
      job_id: "job-reader",
      status: "succeeded",
    }, { items: [] }),
    "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/translated.pdf",
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

// 删：「reader translated region right click keeps selection drag from stealing the event」。
// 用例第一行就是 `return;`（旧 src/js/reader/region-interactions 已删，新 reader 的块级
// 交互只剩悬停复制，见 reader-hover-copy.test.mjs），后面的断言永远不执行；它依赖的
// 那批 src/js/reader/* 动态 import 也只会拿到兜底空桩，一并删掉。

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
  assert.equal(urls.sideBySide, "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/side-by-side.pdf?download=1");

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

test("reader data port owns page API orchestration and fallbacks", async () => {
  const calls = [];
  const port = createReaderDataPort({
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
    loadRegions: async (jobId, apiPrefix) => {
      calls.push(["regions", jobId, apiPrefix]);
      throw new Error("regions unavailable");
    },
    loadMetadata: async (jobId, apiPrefix) => {
      calls.push(["metadata", jobId, apiPrefix]);
      throw new Error("metadata unavailable");
    },
    fetchProtectedResource: async (url) => ({ url }),
  });

  const { readerErrors, ...payloadCore } = await port.loadReaderPayload("job-reader");
  assert.deepEqual(payloadCore, {
    jobPayload: { job_id: "job-reader" },
    manifestPayload: { items: [] },
    readerMetadata: null,
    regionsPayload: { items: [] },
  });
  assert.equal(readerErrors.regions.message, "regions unavailable");
  assert.equal(readerErrors.metadata.message, "metadata unavailable");
  assert.deepEqual(await port.fetchProtected("http://asset.test/file.pdf"), {
    url: "http://asset.test/file.pdf",
  });
  assert.deepEqual(await port.loadMarkdownPayload("job-reader"), {
    content: "# ok",
  });
  assert.deepEqual(calls, [
    ["job", "job-reader", "/reader-api"],
    ["manifest", "job-reader", "/reader-api"],
    ["regions", "job-reader", "/reader-api"],
    ["metadata", "job-reader", "/reader-api"],
    ["markdown", "job-reader", "/reader-api"],
  ]);
});

test("reader data port treats a missing in-progress manifest as an empty artifact set", async () => {
  const port = createReaderDataPort({
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
    readerErrors: { regions: null, metadata: null },
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
    sideBySidePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/side-by-side.pdf?download=1",
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
    translatedPdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/translated.pdf",
    sideBySidePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/side-by-side.pdf?download=1",
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
    translatedPdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/translated.pdf",
    sideBySidePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/side-by-side.pdf?download=1",
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
    translatedPdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/translated.pdf",
    sideBySidePdf: "http://retainpdf.local:41000/api/v1/jobs/job-reader/files/output/side-by-side.pdf?download=1",
  });
});
