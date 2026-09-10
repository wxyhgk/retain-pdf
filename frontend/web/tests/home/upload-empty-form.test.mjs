import test from "node:test";
import assert from "node:assert/strict";

import { createTranslationWorkflowDialogRuntime } from "../../src/features/ingest/domain/translation-workflow-dialog-runtime.js";
import { createUploadStatePort } from "../../src/features/ingest/domain/upload/state.js";
import { createLegacyStateFixture } from "../helpers/legacy-state-fixture.mjs";
import { resolveSubmitControlState } from "../../src/features/ingest/domain/workflow/submit-controls.js";
import { SUBMIT_BLOCK_REASONS } from "@/platform/contracts/submit-readiness-contract.js";

const workflowNeedsUpload = (workflow) => workflow !== "render";
const workflowNeedsCredentials = (workflow) => workflow !== "render";
const workflowSubmitLabel = (workflow) => (workflow === "render" ? "开始渲染" : "直接翻译");

function createDialogHarness(uploadPort) {
  let resets = 0;
  let openMode = "";
  let open = false;
  const runtime = createTranslationWorkflowDialogRuntime({
    dialogStatePort: {
      getSnapshot: () => ({ open }),
      open: (mode) => {
        open = true;
        openMode = mode;
      },
      close: () => {
        open = false;
      },
      setMode: (mode) => {
        openMode = mode;
      },
    },
    statusAreaPort: { hide: () => {}, isVisible: () => false },
    uploadSessionPort: {
      resetUploadSession: () => {
        resets += 1;
        uploadPort.reset();
      },
    },
    documentRef: {
      getElementById: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    },
  });
  return { runtime, getResets: () => resets, getOpenMode: () => openMode };
}

function selectFile(uploadPort) {
  uploadPort.setUpload({
    uploadId: "upload-1",
    uploadedFileName: "book.pdf",
    uploadedPageCount: 12,
    uploadedBytes: 1024,
  });
  uploadPort.setAppliedPageRange("2-8");
}

test("upload empty form: open -> select file -> close -> reopen is empty", () => {
  const uploadPort = createUploadStatePort(createLegacyStateFixture());
  const { runtime, getResets } = createDialogHarness(uploadPort);

  // 打开是空表单
  runtime.openUpload();
  assert.equal(getResets(), 1);
  assert.equal(uploadPort.getSnapshot().uploadId, "");

  // 选文件后有上传态
  selectFile(uploadPort);
  assert.equal(uploadPort.getSnapshot().uploadId, "upload-1");
  assert.equal(uploadPort.getSnapshot().appliedPageRange, "2-8");

  // 关闭再打开：无条件 reset，回到空表单
  runtime.close();
  runtime.openUpload();
  assert.equal(getResets(), 2);
  assert.equal(uploadPort.getSnapshot().uploadId, "");
  assert.equal(uploadPort.getSnapshot().uploadedPageCount, 0);
  assert.equal(uploadPort.getSnapshot().appliedPageRange, "");
});

test("upload empty form: reopen resets even without intermediate file selection", () => {
  const uploadPort = createUploadStatePort(createLegacyStateFixture());
  const { runtime, getResets } = createDialogHarness(uploadPort);

  runtime.openUpload();
  runtime.close();
  runtime.openUpload();
  assert.equal(getResets(), 2);
  assert.equal(uploadPort.getSnapshot().uploadId, "");
});

test("upload submit blocked without credentials: button disabled with notice reason", () => {
  const state = resolveSubmitControlState({
    workflow: "book",
    isMock: false,
    desktopMode: false,
    uploadId: "upload-1",
    renderSourceJobId: "",
    hasBrowserCredentials: false,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.readiness.credentialsMissing, true);
  assert.equal(state.readiness.reason, SUBMIT_BLOCK_REASONS.MISSING_CREDENTIALS);
});

test("upload submit blocked when budget exceeded: button disabled with notice reason", () => {
  const state = resolveSubmitControlState({
    workflow: "book",
    isMock: false,
    desktopMode: false,
    uploadId: "upload-1",
    renderSourceJobId: "",
    hasBrowserCredentials: true,
    budgetBlocking: true,
    workflowNeedsUpload,
    workflowNeedsCredentials,
    workflowSubmitLabel,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.readiness.reason, SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING);
});
