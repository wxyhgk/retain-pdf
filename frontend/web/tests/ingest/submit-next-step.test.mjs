import test from "node:test";
import assert from "node:assert/strict";

import { SUBMIT_BLOCK_REASONS } from "@/platform/contracts/submit-readiness-contract.js";
import { resolveSubmitControlState } from "../../src/features/ingest/domain/workflow/submit-controls.js";
import { createFileUploadHandler } from "../../src/features/ingest/domain/upload/execution.js";
import { createUploadConfigPort } from "../../src/features/ingest/domain/upload/config-port.js";

const workflowNeedsUpload = (workflow) => workflow !== "render";
const workflowNeedsCredentials = (workflow) => workflow !== "render";
const workflowSubmitLabel = (workflow) => (workflow === "render" ? "开始渲染" : "直接翻译");

function baseControlArgs(overrides = {}) {
  return {
    workflow: "book",
    isMock: false,
    desktopMode: false,
    uploadId: "",
    renderSourceJobId: "",
    hasBrowserCredentials: false,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
    ...overrides,
  };
}

test("提交按钮常显：缺上传时仍可见，仅禁用", () => {
  const state = resolveSubmitControlState(baseControlArgs({
    hasBrowserCredentials: true,
    uploadId: "",
  }));

  assert.equal(state.disabled, true);
  assert.equal(state.actionVisible, true);
  assert.equal(state.readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_UPLOAD);
});

test("提交按钮常显：缺凭证时仍可见，仅禁用", () => {
  const state = resolveSubmitControlState(baseControlArgs({
    hasBrowserCredentials: false,
    uploadId: "upload-1",
  }));

  assert.equal(state.disabled, true);
  assert.equal(state.actionVisible, true);
  assert.equal(state.readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_CREDENTIALS);
});

test("提交按钮常显：就绪时可见且可用", () => {
  const state = resolveSubmitControlState(baseControlArgs({
    hasBrowserCredentials: true,
    uploadId: "upload-1",
  }));

  assert.equal(state.disabled, false);
  assert.equal(state.actionVisible, true);
  assert.equal(state.readiness.ready, true);
});

function createUploadHandler({ balanceStatus = "ok", balanceRejects = false } = {}) {
  const statuses = [];
  const refreshCalls = [];
  const file = { name: "book.pdf", size: 1024 };
  const handler = createFileUploadHandler({
    viewPort: {
      selectedFile: () => file,
      clearPageRanges: () => {},
      setFileLabel: () => {},
      showUploadStatus: (message) => statuses.push(message),
      writePageRanges: () => {},
      markUploadReady: () => {},
    },
    uploadState: { reset: () => {} },
    updateUploadState: (payload) => ({ uploadId: payload.uploadId }),
    updateAppliedPageRange: () => ({}),
    renderPageRangeSummary: () => {},
    currentPageRanges: () => "1-12",
    resetUploadedFile: () => {},
    resetUploadProgress: () => {},
    clearFileInputValue: () => {},
    setText: () => {},
    applyWorkflowMode: () => {},
    refreshSubmitControls: () => refreshCalls.push(Date.now()),
    refreshDeepSeekBalance: async () => {
      if (balanceRejects) throw new Error("balance down");
      return { status: balanceStatus };
    },
    configPort: createUploadConfigPort({ buildUploadUrl: () => "/api/uploads" }),
    frontMaxBytes: 1024 * 1024,
    frontMaxPageCount: 0,
    defaultFileLabel: "选择 PDF",
    collectUploadFormData: () => ({}),
    submitUploadRequest: async () => ({
      upload_id: "upload-1",
      filename: "book.pdf",
      page_count: 12,
      bytes: 1024,
    }),
  });
  return { handler, statuses, refreshCalls };
}

function stubWindowTimers() {
  const previous = globalThis.window;
  globalThis.window = {
    ...(previous ?? {}),
    setTimeout: (fn, ms, ...rest) => setTimeout(fn, ms, ...rest),
    clearTimeout: (id) => clearTimeout(id),
  };
  return () => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  };
}

const DONE_STATUS = "上传完成：请选择仅收藏、仅 OCR 或翻译。";

test("上传完成文案稳定：余额正常时不再覆盖成功态", async () => {
  const restore = stubWindowTimers();
  try {
    const { handler, statuses } = createUploadHandler({ balanceStatus: "ok" });
    await handler.handleFileSelected();
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.deepEqual(statuses, ["正在上传…", DONE_STATUS]);
  } finally {
    restore();
  }
});

test("上传完成文案稳定：余额缺失时只追加一句", async () => {
  const restore = stubWindowTimers();
  try {
    const { handler, statuses } = createUploadHandler({ balanceStatus: "missing_key" });
    await handler.handleFileSelected();
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(statuses[0], "正在上传…");
    assert.equal(statuses[1], DONE_STATUS);
    assert.equal(statuses.length, 3);
    assert.ok(statuses[2].startsWith(DONE_STATUS), "失败追加句保留成功态前缀");
    assert.match(statuses[2], /提交前会再次检查/);
    assert.ok(!statuses.some((text) => text.includes("正在检查")), "不再出现中间态");
    assert.ok(!statuses.some((text) => text.includes("可以开始任务")), "不再覆盖成功态");
  } finally {
    restore();
  }
});

test("上传完成文案稳定：余额检测抛错时只追加一句", async () => {
  const restore = stubWindowTimers();
  try {
    const { handler, statuses } = createUploadHandler({ balanceRejects: true });
    await handler.handleFileSelected();
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(statuses[1], DONE_STATUS);
    assert.equal(statuses.length, 3);
    assert.ok(statuses[2].startsWith(DONE_STATUS));
  } finally {
    restore();
  }
});
