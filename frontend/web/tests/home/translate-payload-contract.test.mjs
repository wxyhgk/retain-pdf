// 详情页「翻译」发起 payload 的两条契约。两条都曾经坏过，且都是静默坏的。

import test from "node:test";
import assert from "node:assert/strict";

const { createWorkflowPayloadAssembly } = await import(
  "../../src/features/ingest/domain/workflow/payload-assembly.js"
);
const { WORKFLOW_CONSTANTS } = await import(
  "../../src/features/ingest/domain/workflow/contracts.js"
).catch(() => ({ WORKFLOW_CONSTANTS: undefined }));

// --- 1. 选页码时不得发 legacy 的 start_page/end_page -------------------------
//
// ocr.page_ranges 会让 runner 先把 PDF 裁成子集（ocr_flow/transport.rs 的
// prepare_uploaded_source_pdf），OCR JSON 里只剩选中的那几页。而 translation 的
// start_page/end_page 是 execution_plan.py:60 交给 resolve_page_range 的 0 基
// 下标、基准是**裁后**的 JSON——与用户输入的 1 基原文页号不是一套坐标。
//
// 旧代码两个都发，实测后果（用真实 resolve_page_range 算过）：
//   选 1-1  → 裁成 1 页 → resolve(1,1,1) 抛 Invalid page range  → 任务直接失败
//   选 3-5  → 裁成 3 页 → resolve(3,3,5) 抛 Invalid page range  → 任务直接失败
//   选 5-12 → 裁成 8 页 → resolve(8,5,12)=(5,7) → 只翻原文 10-12 页，前 5 页被静默吞掉
//
// 省略这两个字段即取默认 0 / -1（-1 = 到末页），语义正是「把裁后的整份翻完」。

// 预算只是防挂死的兜底，不是断言：条件成立就立刻返回，调大它不会让任何用例变慢。
async function waitUntil(predicate, description) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  assert.fail(`等待超时：${description}`);
}

test("选页码翻译只发 ocr.page_ranges，不发会错位的 start_page/end_page", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  for (const key of ["window", "document", "HTMLElement", "Event", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window, writable: true, configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { useBookDetailTranslate } = await import(
    "../../src/features/book-detail/ui/use-book-detail-translate.js"
  );

  // 真正驱动 hook，捕获它交给后端的 payload——不去匹配源码文本。
  async function submitWith({ reusableOcrJob, spec = "3-5" }) {
    let captured = null;
    let api = null;
    function Probe() {
      api = useBookDetailTranslate({
        open: true,
        documentId: "doc_1",
        pageCount: 20,
        reusableOcrJob,
        actions: {
          submitDocument: async (_id, payload) => { captured = payload; return null; },
        },
        withBusy: async (_k, fn) => { await fn(); },
        setError: () => {},
      });
      return null;
    }
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    root.render(React.createElement(Probe));
    // 必须等挂载副作用跑完，不能只等首次渲染：usePageRange 的作用域 effect 会把
    // rangeOn/pageSpec 清成初值，随后另一个 effect 按 pageCount 回填 `1-N`。
    // 在回填之前设值会被这次重置整个抹掉，后面就永远等不到选页状态。
    await waitUntil(() => api !== null && api.pageSpec === "1-20", "页码范围初始回填完成");
    api.setRangeOn(true);
    api.setPageSpec(spec);
    // 等选页状态真的落到下一次渲染，而不是赌一个固定毫秒数：三个 setter 各触发
    // 一次更新，CI 上负载高时 30ms 未必够，handleTranslate 就会读到旧状态、
    // 什么都不提交，captured 保持 null，最后炸在一个与本用例断言无关的
    // "Cannot read properties of undefined"。
    await waitUntil(
      () => api.rangeOn === true && api.pageSpec === spec,
      "选页状态落到下一次渲染",
    );
    await api.handleTranslate();
    await waitUntil(() => captured !== null, "捕获提交 payload");
    root.unmount();
    host.remove();
    return captured;
  }

  // 无可复用 OCR：ocr.page_ranges 裁页，translation 不得带选页坐标。
  const fresh = await submitWith({ reusableOcrJob: null });
  assert.equal(fresh.ocr.page_ranges, "3-5", "仍通过 ocr.page_ranges 裁页");
  const translation = fresh.translation || {};
  assert.equal(
    translation.start_page, undefined,
    "start_page 是对裁后 JSON 的 0 基下标，与用户输入的 1 基页号错位，不能发",
  );
  assert.equal(translation.end_page, undefined, "end_page 同理不能发");

  // 复用已有 OCR：artifact 是整本，按原文 1 基页号挑页，这条不能被改坏。
  const reused = await submitWith({
    reusableOcrJob: { job_id: "job_ocr_1", workflow: "ocr", status: "succeeded" },
  });
  assert.deepEqual(
    reused.translation.page_ranges, [3, 4, 5],
    "复用分支用原文 1 基页号",
  );
  assert.equal(reused.ocr, undefined, "复用分支不裁页");

  // 混合范围（摘要 + 第 3 章 + 附录的某张表）。两条路都要把它原样、正确地交出去：
  //   - 无可复用 OCR：规范化成 `1-3,7,12-13` 交给 ocr.page_ranges（MinerU 原生支持）
  //   - 复用 OCR：展开成 1 起的文档页号交给 translation.page_ranges
  const mixedFresh = await submitWith({ reusableOcrJob: null, spec: "12-13, 1-3, 7" });
  assert.equal(
    mixedFresh.ocr.page_ranges, "1-3,7,12-13",
    "混合范围没有规范化（乱序/空格会让服务商解析失败或翻错页）",
  );
  assert.equal(mixedFresh.translation?.start_page, undefined, "混合范围也不能发 start_page");

  const mixedReused = await submitWith({
    reusableOcrJob: { job_id: "job_ocr_1", workflow: "ocr", status: "succeeded" },
    spec: "12-13, 1-3, 7",
  });
  assert.deepEqual(
    mixedReused.translation.page_ranges, [1, 2, 3, 7, 12, 13],
    "复用分支的混合范围没有展开成升序的 1 起文档页号",
  );
});

// --- 2. 详情页「翻译整本」不得受上传弹窗的 OCR Tab 影响 ----------------------
//
// buildTranslateJobConfig 服务的是详情页翻译；isOcrOnlyMode() 是**上传弹窗**的
// Tab 状态。旧代码在这里读它，于是：用户在「添加」弹窗点过 OCR Tab 再关掉弹窗
// （close 不重置 ocrOnly），之后任何一本书的「翻译整本」都会整段丢掉 translation，
// 被后端以 "base_url is required" 拒掉——而凭据其实配得好好的。

function makeAssembly(ocrOnly, extraSubmitValues = {}) {
  return createWorkflowPayloadAssembly({
    constants: WORKFLOW_CONSTANTS || { WORKFLOW_BOOK: "book", WORKFLOW_OCR: "ocr", WORKFLOW_RENDER: "render" },
    developerConfigWithDefaults: () => ({
      model: "deepseek-flash",
      baseUrl: "https://api.deepseek.com/v1",
      workers: 8,
      batchSize: 4,
      classifyBatchSize: 12,
      compileWorkers: 2,
      timeoutSeconds: 600,
      mathMode: "direct_typst",
      translateTitles: true,
      glossaryId: "",
      workflow: "book",
    }),
    isOcrOnlyMode: () => ocrOnly,
    currentPageRanges: () => "",
    getUploadState: () => ({ uploadId: "up_1", uploadedPageCount: 10 }),
    workflowNeedsUpload: () => true,
    workflowUsesRenderStage: () => true,
    defaultPaddleApiUrl: () => "https://paddleocr.aistudio-app.com",
    defaultOcrProvider: () => "paddle",
    defaultPaddleToken: () => "tok",
    defaultModelApiKey: () => "sk-test",
    readSubmitValues: () => ({
      ocrProvider: "paddle",
      ocrCredentialRef: "",
      ocrToken: "tok",
      translationCredentialRef: "",
      modelApiKey: "sk-test",
      selectedGlossaryId: "",
      ...extraSubmitValues,
    }),
  });
}

test("上传弹窗选的排版引擎进 render.engine；默认不发", () => {
  assert.equal(makeAssembly(false, { renderEngine: "rpr_fit" }).collectRunPayload().render.engine, "rpr_fit");
  assert.equal("engine" in makeAssembly(false).collectRunPayload().render, false);
});

test("详情页翻译配置始终带 translation 段，不受上传弹窗 OCR Tab 影响", () => {
  for (const ocrOnly of [false, true]) {
    const assembly = makeAssembly(ocrOnly);
    const config = assembly.buildTranslateJobConfig("");
    assert.ok(
      config.translation,
      `ocrOnly=${ocrOnly} 时 buildTranslateJobConfig 仍必须带 translation 段`,
    );
    assert.equal(config.translation.base_url, "https://api.deepseek.com/v1");
    assert.equal(config.translation.model, "deepseek-flash");
    assert.equal(config.translation.api_key, "sk-test");
    assert.ok(config.ocr, "OCR 段照常存在");
  }
});

test("OCR-only 有自己的 builder，两者职责不混", () => {
  const assembly = makeAssembly(false);
  const ocrConfig = assembly.buildOcrJobConfig("");
  assert.ok(ocrConfig.ocr, "buildOcrJobConfig 带 OCR 段");
  assert.equal(
    ocrConfig.translation,
    undefined,
    "要 OCR-only 的调用方走这个 builder，而不是靠翻译 builder 读弹窗状态",
  );
});
