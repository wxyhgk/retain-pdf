/** 打开阅读器：不重复查 documents，PDF 下载不排在 regions 后面。
 *
 * # 起因（Playwright，100ms 延迟 / 20Mbps）
 *
 *   1383ms  发出 metadata / manifest / job / regions
 *   1958–2212  第一次 GET /documents?job_id=   ← 宿主 loadSessionSnapshot 里
 *   2217–2462  第二次 GET /documents?job_id=   ← session-assets 又查一遍
 *   2465     才开始下 PDF
 *
 * 两次 documents 查询内容完全一样、而且串行；两次都要等 regions（544KB）下完；PDF
 * 又要等它们。PDF 地址其实只依赖 job / manifest（和 documents 链接），跟 regions
 * 无关。
 *
 * # 这里守的
 *
 * 1. snapshot 带回 linkedDocument 时，session 不再自己查一遍；
 * 2. 宿主能单独给可选产物（regions / metadata）时，PDF 下载在 regions 返回之前就开始；
 * 3. 2026-11-03 起页面也不等 regions：PDF 下完就就绪（大书的 regions 要 3 秒、8 MB，PDF 早下完了），
 *    regions 到了再进 session（regionsSettled 置上）；PDF 下载失败也不等 regions 就报；
 * 4. 行为不变：同一个 PDF 只下一次、regions 照样进 session、regions 失败照旧降级。
 *
 * 用 deferred 精确控制「regions 何时返回」，不靠计时。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { deferred, wait, waitFor } from "../helpers/async.mjs";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/reader.html?job_id=job-par",
  pretendToBeVisual: true,
});
for (const key of ["window", "document", "history", "location", "HTMLElement", "Event", "Node"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    writable: true,
    configurable: true,
  });
}
globalThis.dispatchEvent = dom.window.dispatchEvent.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
const { useReaderSession } = await import("../../../../frontend/packages/reader/src/hooks/use-reader-session.ts");

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const JOB = { job_id: "job-par", status: "succeeded", workflow: "translate", document_id: "doc-par" };
const MANIFEST = { items: [] };
const LINKED = { document_id: "doc-par", active_job_id: "job-other", active_version_id: "" };
const REGIONS = { items: [{
  item_id: "r1",
  source: { page: 1, bbox: [0, 0, 10, 10] },
  translated: { page: 1, bbox: [0, 0, 10, 10] },
}] };

/** 一个「宿主」：记录每次调用，regions 由 regionsGate 控制何时返回。 */
// loadProtectedPdfFile 有模块级字节缓存：每条测试用自己的一组 PDF 地址，
// 不然后面的测试命中缓存、根本不发请求。
let hostSeq = 0;
function makeHost({ regionsGate, regionsFail = false, pdfStatus = 200 }) {
  hostSeq += 1;
  const SRC = `/src-${hostSeq}.pdf`;
  const TR = `/tr-${hostSeq}.pdf`;
  const events = [];
  const pdfFetches = [];
  let documentLookups = 0;
  const optional = async () => {
    events.push("optional:start");
    await regionsGate.promise;
    events.push("optional:done");
    return regionsFail
      ? { regionsPayload: { items: [] }, readerMetadata: null, readerErrors: { regions: new Error("regions 500"), metadata: null } }
      : { regionsPayload: REGIONS, readerMetadata: null, readerErrors: { regions: null, metadata: null } };
  };
  const sessionData = {
    loadSessionSnapshot: async (input) => {
      events.push(`snapshot:start:optional=${input.includeOptionalArtifacts !== false}`);
      // 宿主自己查过一次 documents，并把结果带回来。
      documentLookups += 1;
      const extras = input.includeOptionalArtifacts !== false
        ? await optional()
        : { regionsPayload: { items: [] }, readerMetadata: null, readerErrors: { regions: null, metadata: null } };
      events.push("snapshot:done");
      return {
        loadPlan: { kind: "open-job-artifacts" },
        jobId: input.jobId,
        documentId: "doc-par",
        jobStatus: "succeeded",
        workflow: "translate",
        title: "",
        sourceUrl: SRC,
        translatedUrl: TR,
        sourceOnly: false,
        sourcePayload: JOB,
        manifestPayload: MANIFEST,
        regions: extras.regionsPayload.items,
        readerMetadata: { source: null, translated: null },
        readerErrors: extras.readerErrors,
        linkedDocument: LINKED,
      };
    },
    loadReaderOptionalArtifacts: optional,
    loadReaderPayload: async () => { throw new Error("有 snapshot 时不该走 loadReaderPayload"); },
    loadJobPayload: async () => JOB,
    fetchDocumentByJobId: async () => {
      documentLookups += 1;
      events.push("documents");
      return LINKED;
    },
    fetchProtected: async () => { throw new Error("unexpected"); },
    resolveResourceUrl: (url) => url,
    resolveReaderSourcePdf: () => SRC,
    resolveReaderTranslatedPdfUrl: () => TR,
    resolveReaderArtifactUrl: () => "",
  };
  const fetchPdf = async (url) => {
    pdfFetches.push(url);
    events.push(`pdf:${url}`);
    return { ok: pdfStatus === 200, status: pdfStatus, arrayBuffer: async () => PDF_BYTES.buffer.slice(0) };
  };
  setReaderAdapters({
    isMockMode: () => false,
    resolveResourceUrl: (url) => url,
    resolveReaderJobId: () => "job-par",
    resolveReaderDocumentId: () => "",
    defaultReaderPageConfigPort: { messageTargetOrigin: () => "*" },
    fetchProtected: fetchPdf,
    defaultReaderDataPort: {
      fetchProtected: fetchPdf,
      loadJobPayload: async () => JOB,
      loadReaderPayload: sessionData.loadReaderPayload,
    },
    sessionData,
  });
  return { events, pdfFetches, pdfs: [SRC, TR].sort(), lookups: () => documentLookups };
}

async function mountSession() {
  const sessions = [];
  function HookHost() {
    const session = useReaderSession();
    React.useEffect(() => { sessions.push(session); }, [session]);
    return null;
  }
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(HookHost));
  return {
    sessions,
    cleanup() {
      root.unmount();
      host.remove();
      setReaderAdapters(null);
    },
  };
}

test("snapshot 带回 linkedDocument 时，session 不再自己查 documents", async () => {
  const regionsGate = deferred();
  regionsGate.resolve();
  const host = makeHost({ regionsGate });
  const { sessions, cleanup } = await mountSession();
  try {
    await waitFor(() => sessions.some((s) => s.assetsReady), () => `session 没就绪：${host.events.join(" → ")}`);
    assert.equal(host.lookups(), 1, `documents 查了 ${host.lookups()} 次：${host.events.join(" → ")}`);
  } finally {
    cleanup();
  }
});

test("PDF 下载在 regions 返回之前就开始，下完就就绪不等 regions；regions 回来后照样进 session；每个 PDF 只下一次", async () => {
  const regionsGate = deferred();
  const host = makeHost({ regionsGate });
  const { sessions, cleanup } = await mountSession();
  try {
    await waitFor(() => host.events.includes("optional:start"), () => `regions 没发出：${host.events.join(" → ")}`);
    // 给 PDF 下载留足机会：regions 一直不回。
    for (let i = 0; i < 20 && host.pdfFetches.length < 2; i += 1) await wait(5);
    assert.deepEqual(
      [...host.pdfFetches].sort(),
      host.pdfs,
      `regions 还没返回时 PDF 没开始下：${host.events.join(" → ")}`,
    );
    // regions 一直不回，页面照样就绪：块还没到。
    const ready = await waitFor(() => sessions.find((s) => s.assetsReady), () => `regions 没回来就不就绪：${host.events.join(" → ")}`);
    assert.ok(ready.sourceFile && ready.translatedFile);
    assert.equal(ready.regions.length, 0);
    assert.equal(ready.regionsSettled, false, "块还没到就说到了");
    regionsGate.resolve();
    const settled = await waitFor(() => sessions.find((s) => s.regionsSettled), "regions 进 session");
    assert.equal(settled.regions.length, 1, "regions 没进 session");
    assert.equal(settled.assetsReady, true);
    assert.deepEqual([...host.pdfFetches].sort(), host.pdfs, "PDF 被下了不止一次");
  } finally {
    cleanup();
  }
});

test("regions 失败照旧降级：PDF 照常就绪，错误记进 readerErrors", async () => {
  const regionsGate = deferred();
  regionsGate.resolve();
  const host = makeHost({ regionsGate, regionsFail: true });
  const { sessions, cleanup } = await mountSession();
  try {
    const ready = await waitFor(() => sessions.find((s) => s.assetsReady), () => `session 没就绪：${host.events.join(" → ")}`);
    assert.equal(ready.boot.failed, false);
    assert.deepEqual([...host.pdfFetches].sort(), host.pdfs);
    assert.equal(ready.regions.length, 0);
    assert.match(String(ready.readerErrors.regions?.message), /regions 500/);
  } finally {
    cleanup();
  }
});

test("PDF 在等 regions 期间就下载失败：不等 regions 就以下载错误收尾，不残留未处理的 rejection", async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  const regionsGate = deferred();
  const host = makeHost({ regionsGate, pdfStatus: 500 });
  const { sessions, cleanup } = await mountSession();
  try {
    await waitFor(() => host.pdfFetches.length === 2, () => `PDF 没发出：${host.events.join(" → ")}`);
    const failed = await waitFor(() => sessions.find((s) => s.boot.failed), "regions 还没回来，PDF 失败就该报了");
    assert.match(failed.boot.text, /读取 PDF 失败 \(500\)/);
    assert.equal(failed.assetsReady, false);
    // regions 晚到：不把失败的会话改回去，也不留未处理的 rejection。
    regionsGate.resolve();
    await wait(20);
    assert.equal(sessions.at(-1).boot.failed, true);
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
    cleanup();
  }
});
