/** 一次上传多本：一本一本传、传完一起交；后端拒收时剩下的不再交；没交上的可以再交。 */
import test from "node:test";
import assert from "node:assert/strict";
import { deferred } from "../helpers/async.mjs";

globalThis.window = {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  __FRONT_RUNTIME_CONFIG__: { apiBase: "http://127.0.0.1:41000", xApiKey: "batch-key" },
};

const { createBatchUploadSession, summarizeBatch } = await import("../../src/features/ingest/domain/upload/batch-session.ts");
const { createBatchFileUploader } = await import("../../src/features/ingest/domain/upload/batch-file-upload.ts");
const { runBatchSubmit } = await import("../../src/features/ingest/domain/actions/submit/batch.ts");
const { queueFullErrorFromPayload, insufficientStorageErrorFromPayload, QUEUE_FULL_MESSAGE, isRefusedSubmission } = await import(
  "../../../packages/api/src/http.ts"
);

const pdf = (name, size = 1000) => ({ name, size, type: "application/pdf" });
const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

test("一本一本地传：同时只传一本，进度和结果写到各自那一行", async () => {
  const pending = [];
  const session = createBatchUploadSession({
    uploadFile: (file, onProgress) => {
      const call = deferred();
      pending.push({ file, onProgress, call });
      return call.promise;
    },
    submitBatch: async () => ({ status: "done", submitted: 0, failed: 0 }),
  });
  const done = session.start([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")]);
  await settle();
  assert.equal(pending.length, 1, "同时只传一本");
  assert.deepEqual(session.getSnapshot().items.map((item) => item.status), ["uploading", "waiting", "waiting"]);
  pending[0].onProgress(50, 200);
  assert.equal(session.getSnapshot().items[0].progress, 25);
  pending[0].call.resolve({ uploadId: "up-a", documentId: "doc-a", fileName: "a.pdf", pageCount: 12 });
  await settle();
  assert.equal(pending.length, 2);
  pending[1].call.reject(new Error("超过 50MB"));
  await settle();
  pending[2].call.resolve({ uploadId: "up-c", documentId: "doc-c", fileName: "c.pdf", pageCount: 3 });
  await done;
  const items = session.getSnapshot().items;
  assert.deepEqual(items.map((item) => [item.status, item.uploadId, item.message]), [
    ["uploaded", "up-a", ""],
    ["upload_failed", "", "超过 50MB"],
    ["uploaded", "up-c", ""],
  ]);
  assert.deepEqual(summarizeBatch(session.getSnapshot()), {
    total: 3, uploading: false, readyToSubmit: 2, uploadFailed: 1, submitted: 0, submitFailed: 0,
  });
});

test("关掉弹窗以后不再开始传下一本", async () => {
  const pending = [];
  const session = createBatchUploadSession({
    uploadFile: () => {
      const call = deferred();
      pending.push(call);
      return call.promise;
    },
    submitBatch: async () => ({ status: "done", submitted: 0, failed: 0 }),
  });
  const done = session.start([pdf("a.pdf"), pdf("b.pdf")]);
  await settle();
  session.dispose();
  pending[0].resolve({ uploadId: "up-a", documentId: "", fileName: "a.pdf", pageCount: 1 });
  // 先断言再等循环结束：要是第二本开始传了，它永远不返回，先等 done 测试就挂住了。
  await settle();
  assert.equal(pending.length, 1, "第二本没有开始传");
  await done;
});

async function uploadedSession(submitBatch, names = ["a.pdf", "b.pdf", "c.pdf"]) {
  const session = createBatchUploadSession({
    uploadFile: async (file) => ({ uploadId: `up-${file.name}`, documentId: "", fileName: file.name, pageCount: 5 }),
    submitBatch,
  });
  await session.start(names.map((name) => pdf(name)));
  return session;
}

test("全交上了：每本标「已提交」，allSubmitted", async () => {
  const asked = [];
  const session = await uploadedSession(async (uploadIds, onItem) => {
    asked.push(uploadIds);
    for (const id of uploadIds) onItem(id, { ok: true, jobId: `job-${id}` });
    return { status: "done", submitted: uploadIds.length, failed: 0 };
  });
  const result = await session.submit();
  assert.deepEqual(asked, [["up-a.pdf", "up-b.pdf", "up-c.pdf"]]);
  assert.equal(result.allSubmitted, true);
  assert.ok(session.getSnapshot().items.every((item) => item.status === "submitted"));
  assert.equal(await session.submit(), null, "交过的不会再交");
});

test("有没交上的：留着原因，再交只交没交上的", async () => {
  const asked = [];
  let round = 0;
  const session = await uploadedSession(async (uploadIds, onItem) => {
    asked.push(uploadIds);
    round += 1;
    for (const id of uploadIds) {
      if (round === 1 && id !== "up-a.pdf") onItem(id, { ok: false, message: "排队的任务太多了，等前面的开跑再交。" });
      else onItem(id, { ok: true, jobId: `job-${id}` });
    }
    return { status: "done", submitted: round === 1 ? 1 : uploadIds.length, failed: round === 1 ? 2 : 0 };
  });
  const first = await session.submit();
  assert.equal(first.allSubmitted, false);
  assert.deepEqual(session.getSnapshot().items.map((item) => item.status), ["submitted", "submit_failed", "submit_failed"]);
  assert.match(session.getSnapshot().items[1].message, /排队的任务太多了/);
  const second = await session.submit();
  assert.deepEqual(asked[1], ["up-b.pdf", "up-c.pdf"]);
  assert.equal(second.allSubmitted, true);
});

test("被就绪校验拦下（没配凭据）：一本都没交，回到可以再交", async () => {
  const session = await uploadedSession(async () => ({ status: "blocked", submitted: 0, failed: 0 }));
  const result = await session.submit();
  assert.equal(result.allSubmitted, false);
  assert.ok(session.getSnapshot().items.every((item) => item.status === "uploaded"));
  assert.equal(session.getSnapshot().submitting, false);
});

function batchSubmitOptions(overrides = {}) {
  const calls = { submitted: [], created: [], refresh: [], text: [] };
  const options = {
    uploadIds: ["up-1", "up-2", "up-3"],
    collectRunPayload: ({ uploadId, pageRanges }) => ({ workflow: "book", source: { upload_id: uploadId }, ocr: { page_ranges: pageRanges } }),
    workflow: "book",
    desktopMode: false,
    configPort: { isMock: () => false },
    apiPrefix: "/api/v1",
    desktopConfigured: true,
    setText: (id, value) => calls.text.push([id, value]),
    submitJobRequest: async (_prefix, payload) => {
      calls.submitted.push(payload);
      return { job_id: `job-${payload.source.upload_id}` };
    },
    workflowNeedsUpload: () => true,
    workflowNeedsCredentials: () => true,
    currentBudgetState: () => ({ blocking: false }),
    hasBrowserCredentials: () => true,
    libraryEventPort: {
      publishJobCreated: (job) => calls.created.push(job.job_id),
      requestRefresh: (opts) => calls.refresh.push(opts),
    },
    ...overrides,
  };
  return { options, calls };
}

test("批量提交：每本用自己的上传编号、整本，交一个报一个，最后刷新一次书架", async () => {
  const { options, calls } = batchSubmitOptions();
  const items = [];
  const result = await runBatchSubmit({ ...options, onItem: (id, outcome) => items.push([id, outcome]) });
  assert.deepEqual(result, { status: "done", submitted: 3, failed: 0 });
  assert.deepEqual(calls.submitted.map((payload) => [payload.source.upload_id, payload.ocr.page_ranges]), [
    ["up-1", ""], ["up-2", ""], ["up-3", ""],
  ]);
  assert.deepEqual(calls.created, ["job-up-1", "job-up-2", "job-up-3"]);
  assert.deepEqual(items.map(([id, outcome]) => [id, outcome.ok]), [["up-1", true], ["up-2", true], ["up-3", true]]);
  assert.equal(calls.refresh.length, 1);
});

test("后端拒收（排队满了）：剩下的不再交，各自标上原因；普通错误不挡后面的", async () => {
  const queueFull = queueFullErrorFromPayload(429, { error: { code: "TOO_MANY_REQUESTS", details: { reason: "queue_full" } } });
  let n = 0;
  const { options, calls } = batchSubmitOptions({
    uploadIds: ["up-1", "up-2", "up-3", "up-4"],
    submitJobRequest: async (_prefix, payload) => {
      n += 1;
      if (n === 1) throw new Error("提交失败: 400 bad request");
      if (n === 3) throw queueFull;
      calls.submitted.push(payload);
      return { job_id: `job-${payload.source.upload_id}` };
    },
  });
  const items = [];
  const result = await runBatchSubmit({ ...options, onItem: (id, outcome) => items.push([id, outcome.ok ? "ok" : outcome.message]) });
  assert.equal(n, 3, "排队满了以后第 4 本没有发请求");
  assert.deepEqual(result, { status: "done", submitted: 1, failed: 3 });
  assert.deepEqual(items, [
    ["up-1", "提交失败: 400 bad request"],
    ["up-2", "ok"],
    ["up-3", QUEUE_FULL_MESSAGE],
    ["up-4", QUEUE_FULL_MESSAGE],
  ]);
});

test("没配凭据：一本都不交，错误框里说原因", async () => {
  let opened = 0;
  const { options, calls } = batchSubmitOptions({
    hasBrowserCredentials: () => false,
    openBrowserCredentialsDialog: () => {
      opened += 1;
    },
  });
  const result = await runBatchSubmit(options);
  assert.equal(result.status, "blocked");
  assert.equal(calls.submitted.length, 0);
  assert.equal(opened, 1);
  assert.ok(calls.text.some(([id, value]) => id === "error-box" && /凭证/.test(value)));
});

test("排队满了、磁盘不够都算提交被拒，换成一句中文", () => {
  const queueFull = queueFullErrorFromPayload(429, {
    code: 42900,
    message: "1000 jobs are already waiting to run (limit 1000); try again after some of them start",
    error: { code: "TOO_MANY_REQUESTS", details: { reason: "queue_full" } },
  }, "http://127.0.0.1:41000/api/v1/jobs");
  assert.equal(queueFull.message, "排队的任务太多了，等前面的开跑再交。");
  assert.equal(queueFull.status, 429);
  assert.equal(queueFull.reason, "queue_full");
  assert.ok(isRefusedSubmission(queueFull));
  assert.equal(queueFullErrorFromPayload(429, { error: { code: "TOO_MANY_REQUESTS" } }), null, "别的 429 照旧");
  assert.ok(isRefusedSubmission(insufficientStorageErrorFromPayload(503, { error: { details: { reason: "insufficient_storage" } } })));
});

test("传其中一本：不是 PDF、太大、页数超了都在发请求前拦下；成功时返回上传编号和页数", async () => {
  const requests = [];
  const uploader = createBatchFileUploader({
    configPort: { buildUploadUrl: () => "http://127.0.0.1:41000/api/v1/uploads" },
    apiPrefix: "/api/v1",
    frontMaxBytes: 50 * 1024 * 1024,
    frontMaxPageCount: 999,
    countPdfPages: async (file) => file.pages,
    collectUploadFormData: (file) => ({ file: file.name }),
    submitUploadRequest: async (url, form, onProgress) => {
      requests.push([url, form.file]);
      onProgress?.(10, 10);
      return { upload_id: "up-1", document_id: "doc-1", filename: form.file, page_count: 12 };
    },
  });
  await assert.rejects(uploader.uploadFile({ name: "notes.txt", size: 10, type: "text/plain" }), { message: "不是 PDF 文件" });
  await assert.rejects(uploader.uploadFile({ ...pdf("big.pdf", 60 * 1024 * 1024), pages: 1 }), { message: "超过 50MB" });
  await assert.rejects(uploader.uploadFile({ ...pdf("long.pdf"), pages: 1200 }), { message: "超过 999 页" });
  await assert.rejects(uploader.uploadFile({ ...pdf("broken.pdf"), pages: 0 }), { message: "PDF 解析失败，文件可能损坏" });
  assert.equal(requests.length, 0);
  const progress = [];
  const result = await uploader.uploadFile({ ...pdf("ok.pdf"), pages: 12 }, (loaded, total) => progress.push([loaded, total]));
  assert.deepEqual(result, { uploadId: "up-1", documentId: "doc-1", fileName: "ok.pdf", pageCount: 12 });
  assert.deepEqual(progress, [[10, 10]]);
});

test("建任务、书的翻译回 429 queue_full：报错就是那句中文，不带英文原话和请求摘要", async () => {
  const { submitJobRequest } = await import("../../../packages/api/src/jobs-submit.ts");
  const { translateDocument } = await import("../../../packages/api/src/documents.ts");
  const body = {
    code: 42900,
    message: "1000 jobs are already waiting to run (limit 1000); try again after some of them start",
    error: { code: "TOO_MANY_REQUESTS", details: { reason: "queue_full" } },
  };
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(body), { status: 429, headers: { "content-type": "application/json" } });
  try {
    for (const run of [
      () => submitJobRequest("/api/v1", { workflow: "translate", source: { upload_id: "up-1" } }),
      () => translateDocument("/api/v1", "doc-1", {}),
    ]) {
      const error = await run().catch((e) => e);
      assert.ok(isRefusedSubmission(error));
      assert.equal(error.message, QUEUE_FULL_MESSAGE);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("批量面板：每行的状态文字；传完之前不能交；有没交上的按钮改成重新提交", async () => {
  const { makeDom, click } = await import("../helpers/dom.mjs");
  const dom = makeDom();
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { flushSync } = await import("react-dom");
  const { BatchUploadPanel } = await import("../../src/features/ingest/ui/components/upload/BatchUploadPanel.jsx");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const calls = [];
  const item = (key, status, extra = {}) => ({ key, name: `${key}.pdf`, status, progress: 0, pageCount: 0, uploadId: "", message: "", ...extra });
  const render = (items, ocrOnly = false) => flushSync(() => root.render(React.createElement(BatchUploadPanel, {
    batch: { items, submitting: false },
    ocrOnly,
    optionsOpen: false,
    onToggleOptions: () => calls.push("options"),
    onSubmit: () => calls.push("submit"),
    onStoreOnly: () => calls.push("store"),
    onReset: () => calls.push("reset"),
    optionsSlot: null,
  })));
  const submit = () => host.querySelector('[data-batch-action="submit"]');

  render([item("a", "uploaded", { uploadId: "up-a", pageCount: 12 }), item("b", "uploading", { progress: 40 }), item("c", "waiting")]);
  assert.deepEqual([...host.querySelectorAll(".batch-upload-status")].map((el) => el.textContent), ["已上传 · 12 页", "上传中 40%", "等待上传"]);
  assert.match(host.querySelector(".batch-upload-head").textContent, /正在上传（1\/3）/);
  assert.ok(submit().disabled, "还在传时不能交");
  assert.equal(submit().getAttribute("type"), "button", "不能触发外层单本的表单提交");

  render([item("a", "submitted", { uploadId: "up-a" }), item("b", "submit_failed", { uploadId: "up-b", message: "排队的任务太多了，等前面的开跑再交。" }), item("c", "upload_failed", { message: "超过 50MB" })], true);
  assert.equal(submit().textContent, "重新提交没交上的 1 本");
  assert.ok(!submit().disabled);
  assert.ok(host.querySelector('[data-batch-status="upload_failed"]').classList.contains("is-problem"));
  assert.ok(host.querySelector('[data-batch-action="options"]').classList.contains("hidden"), "仅 OCR 没有翻译选项");
  click(dom, submit());
  click(dom, host.querySelector('[data-batch-action="store-only"]'));
  assert.deepEqual(calls, ["submit", "store"]);

  render([item("a", "uploaded", { uploadId: "up-a" }), item("b", "uploaded", { uploadId: "up-b" })], true);
  assert.equal(submit().textContent, "开始 OCR（2 本）");
  root.unmount();
  dom.window.close();
});

test("页数上限跟着设置里选的 OCR：PaddleOCR 999、MinerU 600、GLM-OCR 不限；超了说怎么办", async () => {
  const { ocrMaxPages } = await import("../../src/platform/config/providers.ts");
  assert.equal(ocrMaxPages("paddle"), 999);
  assert.equal(ocrMaxPages("mineru"), 600);
  assert.equal(ocrMaxPages("glm_ocr"), 0, "GLM-OCR 分段识别，不限页数");

  let provider = "paddle";
  const uploader = createBatchFileUploader({
    configPort: { buildUploadUrl: () => "http://127.0.0.1:41000/api/v1/uploads" },
    apiPrefix: "/api/v1",
    frontMaxBytes: 50 * 1024 * 1024,
    // 每次选文件现问：换了 OCR 立刻按新的算。
    frontMaxPageCount: () => ocrMaxPages(provider),
    pageLimitHint: () => "可以换成 GLM-OCR",
    countPdfPages: async (file) => file.pages,
    collectUploadFormData: (file) => ({ file: file.name, pages: file.pages }),
    submitUploadRequest: async (_url, form) => ({ upload_id: "up-long", document_id: "doc-long", filename: form.file, page_count: form.pages }),
  });
  await assert.rejects(uploader.uploadFile({ ...pdf("long.pdf"), pages: 1500 }), { message: "超过 999 页（可以换成 GLM-OCR）" });
  provider = "glm_ocr";
  const result = await uploader.uploadFile({ ...pdf("long.pdf"), pages: 1500 });
  assert.equal(result.pageCount, 1500);
});
