import test from "node:test";
import assert from "node:assert/strict";

import { mountUploadFeature } from "../../src/features/ingest/domain/upload/controller.js";
import { createUploadConfigPort } from "../../src/features/ingest/domain/upload/config-port.js";
import { createUploadStatePort } from "../../src/features/ingest/domain/upload/state.js";
import { createLegacyStateFixture } from "../helpers/legacy-state-fixture.mjs";

function createClassList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
    toggle(name, force) {
      if (force) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function createElement(overrides = {}) {
  return {
    classList: createClassList(),
    dataset: {},
    files: [],
    style: {},
    textContent: "",
    title: "",
    value: "",
    closest() {
      return null;
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    ...overrides,
  };
}

test("upload config port owns upload endpoint url", () => {
  const calls = [];
  const port = createUploadConfigPort({
    buildEndpoint(prefix, path) {
      calls.push([prefix, path]);
      return `api://${prefix}/${path}`;
    },
  });

  assert.equal(port.buildUploadUrl("api/v1"), "api://api/v1/uploads");
  assert.deepEqual(calls, [["api/v1", "uploads"]]);
});

test("upload controller submits to config port upload url", async () => {
  const file = { name: "book.pdf", size: 1024 };
  const submittedUrls = [];
  const viewCalls = [];
  let pageRangeInputs = { start: "", end: "" };
  const state = createLegacyStateFixture();
  const uploadStatePort = createUploadStatePort(state);
  const feature = mountUploadFeature({
    state,
    uploadStatePort,
    apiPrefix: "api/v1",
    frontMaxBytes: 1024 * 1024,
    frontMaxPageCount: 999,
    countPdfPages: async () => 12,
    defaultFileLabel: "选择 PDF",
    collectUploadFormData: (input) => ({ fileName: input.name }),
    submitUploadRequest: async (url) => {
      submittedUrls.push(url);
      return {
        upload_id: "upload-1",
        filename: "book.pdf",
        page_count: 12,
        bytes: 1024,
      };
    },
    resetUploadedFile() {},
    resetUploadProgress() {},
    setUploadProgress() {},
    clearFileInputValue() {},
    setText() {},
    applyWorkflowMode() {},
    refreshSubmitControls() {},
    workflowNeedsUpload: () => true,
    configPort: createUploadConfigPort({
      buildEndpoint(prefix, path) {
        return `https://api.example/${prefix}/${path}`;
      },
    }),
    viewPort: {
      clearPageRanges: () => {
        pageRangeInputs = { start: "", end: "" };
        viewCalls.push(["clear-ranges"]);
      },
      closePageRangeDialog: () => viewCalls.push(["close-range-dialog"]),
      markUploadReady: (ready) => viewCalls.push(["ready", ready]),
      openPageRangeDialog: (options) => viewCalls.push(["open-range-dialog", options]),
      readPageRanges: () => pageRangeInputs,
      selectedFile: () => file,
      setFileLabel: (selected, fallback) => viewCalls.push(["file-label", selected?.name || "", fallback]),
      setInlinePageRangeVisible: (visible) => viewCalls.push(["inline-range", visible]),
      showUploadStatus: (message) => viewCalls.push(["status", message]),
      writePageRanges: (values) => {
        pageRangeInputs = values;
        viewCalls.push(["write-ranges", values]);
      },
    },
  });

  await feature.handleFileSelected();
  assert.deepEqual(submittedUrls, ["https://api.example/api/v1/uploads"]);
  assert.equal(uploadStatePort.getSnapshot().uploadId, "upload-1");
  assert.equal(uploadStatePort.getSnapshot().uploadedPageCount, 12);
  assert.deepEqual(pageRangeInputs, { start: "1", end: "12" });
  assert.equal(viewCalls.some(([kind]) => kind === "write-ranges"), true);
  assert.equal(viewCalls.some(([kind, ready]) => kind === "ready" && ready === true), true);
});

test("upload controller reads and writes upload state through upload state port", async () => {
  const calls = [];
  const file = { name: "book.pdf", size: 1024 };
  let snapshot = {
    uploadId: "",
    uploadedFileName: "",
    uploadedPageCount: 0,
    uploadedBytes: 0,
    appliedPageRange: "",
  };
  let pageRangeInputs = { start: "", end: "" };
  const feature = mountUploadFeature({
    state: {
      uploadId: "legacy-upload",
      uploadedPageCount: 1,
    },
    uploadStatePort: {
      clearAppliedPageRange: () => {
        calls.push(["clearAppliedPageRange"]);
        snapshot = { ...snapshot, appliedPageRange: "" };
        return snapshot;
      },
      getSnapshot: () => {
        calls.push(["getSnapshot"]);
        return snapshot;
      },
      setAppliedPageRange: (value) => {
        calls.push(["setAppliedPageRange", value]);
        snapshot = { ...snapshot, appliedPageRange: value };
        return snapshot;
      },
      setUpload: (payload) => {
        calls.push(["setUpload", payload.uploadId, payload.uploadedPageCount]);
        snapshot = { ...snapshot, ...payload };
        return snapshot;
      },
    },
    apiPrefix: "api/v1",
    frontMaxBytes: 1024 * 1024,
    frontMaxPageCount: 999,
    countPdfPages: async () => 8,
    defaultFileLabel: "选择 PDF",
    collectUploadFormData: () => ({}),
    submitUploadRequest: async () => ({
      upload_id: "upload-port",
      filename: "book.pdf",
      page_count: 8,
      bytes: 1024,
    }),
    resetUploadedFile: () => calls.push(["resetUploadedFile"]),
    resetUploadProgress: () => calls.push(["resetUploadProgress"]),
    setUploadProgress() {},
    clearFileInputValue: () => calls.push(["clearFileInputValue"]),
    setText: (id, text) => calls.push(["text", id, text]),
    applyWorkflowMode: () => calls.push(["workflow"]),
    refreshSubmitControls: () => calls.push(["refreshSubmit"]),
    workflowNeedsUpload: () => true,
    configPort: createUploadConfigPort({
      buildEndpoint: () => "/api/uploads",
    }),
    viewPort: {
      clearPageRanges: () => {
        pageRangeInputs = { start: "", end: "" };
      },
      closePageRangeDialog: () => {},
      markUploadReady: (ready) => calls.push(["ready", ready]),
      openPageRangeDialog: () => {},
      readPageRanges: () => pageRangeInputs,
      selectedFile: () => file,
      setFileLabel: () => {},
      setInlinePageRangeVisible: (visible) => calls.push(["inline", visible]),
      showUploadStatus: (message) => calls.push(["status", message]),
      writePageRanges: (values) => {
        pageRangeInputs = values;
      },
    },
  });

  await feature.handleFileSelected();

  assert.equal(snapshot.uploadId, "upload-port");
  assert.equal(snapshot.uploadedPageCount, 8);
  assert.equal(snapshot.appliedPageRange, "1-8");
  assert.ok(calls.some((call) => call[0] === "setUpload" && call[1] === "upload-port"));
  assert.ok(calls.some((call) => call[0] === "setAppliedPageRange" && call[1] === "1-8"));
  assert.ok(calls.some((call) => call[0] === "ready" && call[1] === true));
});

test("upload controller resetUploadSession clears stale upload and page range state", () => {
  const calls = [];
  let snapshot = {
    uploadId: "old-upload",
    uploadedFileName: "old.pdf",
    uploadedPageCount: 12,
    uploadedBytes: 4096,
    appliedPageRange: "2-8",
    submitBusy: false,
  };
  let pageRangeInputs = { start: "2", end: "8" };
  const feature = mountUploadFeature({
    state: {},
    uploadStatePort: {
      getSnapshot: () => snapshot,
      reset: () => {
        calls.push(["reset"]);
        snapshot = {
          uploadId: "",
          uploadedFileName: "",
          uploadedPageCount: 0,
          uploadedBytes: 0,
          appliedPageRange: "",
          submitBusy: false,
        };
        return snapshot;
      },
    },
    frontMaxBytes: 1024 * 1024,
    frontMaxPageCount: 999,
    resetUploadedFile: () => calls.push(["reset-file"]),
    resetUploadProgress: () => calls.push(["reset-progress"]),
    clearFileInputValue: () => calls.push(["clear-input"]),
    setText() {},
    applyWorkflowMode() {},
    refreshSubmitControls: () => calls.push(["submit-controls"]),
    workflowNeedsUpload: () => true,
    viewPort: {
      clearPageRanges: () => {
        pageRangeInputs = { start: "", end: "" };
        calls.push(["clear-ranges"]);
      },
      closePageRangeDialog() {},
      markUploadReady: (ready) => calls.push(["ready", ready]),
      openPageRangeDialog() {},
      readPageRanges: () => pageRangeInputs,
      selectedFile: () => null,
      setFileLabel() {},
      setInlinePageRangeVisible: (visible) => calls.push(["inline-range", visible]),
      showUploadStatus() {},
      writePageRanges() {},
    },
  });

  const resetSnapshot = feature.resetUploadSession();

  assert.deepEqual(resetSnapshot, snapshot);
  assert.equal(snapshot.uploadId, "");
  assert.equal(snapshot.uploadedPageCount, 0);
  assert.equal(snapshot.appliedPageRange, "");
  assert.deepEqual(pageRangeInputs, { start: "", end: "" });
  assert.deepEqual(calls, [
    ["reset"],
    ["reset-file"],
    ["reset-progress"],
    ["clear-input"],
    ["clear-ranges"],
    ["ready", false],
    ["inline-range", false],
    ["submit-controls"],
  ]);
});

test("upload controller clears stale upload state before selecting a new file", async () => {
  const calls = [];
  const file = { name: "new.pdf", size: 2048 };
  let snapshot = {
    uploadId: "old-upload",
    uploadedFileName: "old.pdf",
    uploadedPageCount: 12,
    uploadedBytes: 4096,
    appliedPageRange: "2-8",
    submitBusy: false,
  };
  let pageRangeInputs = { start: "2", end: "8" };
  const feature = mountUploadFeature({
    state: {},
    uploadStatePort: {
      getSnapshot: () => snapshot,
      reset: () => {
        calls.push(["reset"]);
        snapshot = {
          uploadId: "",
          uploadedFileName: "",
          uploadedPageCount: 0,
          uploadedBytes: 0,
          appliedPageRange: "",
          submitBusy: false,
        };
        return snapshot;
      },
    },
    frontMaxBytes: 1024 * 1024,
    frontMaxPageCount: 999,
    countPdfPages: async () => {
      assert.equal(snapshot.uploadId, "");
      assert.equal(snapshot.uploadedPageCount, 0);
      assert.deepEqual(pageRangeInputs, { start: "", end: "" });
      throw new Error("stop before upload");
    },
    resetUploadedFile: () => calls.push(["reset-file"]),
    resetUploadProgress: () => calls.push(["reset-progress"]),
    clearFileInputValue: () => calls.push(["clear-input"]),
    setText: (id, text) => calls.push(["text", id, text]),
    applyWorkflowMode: () => calls.push(["mode"]),
    refreshSubmitControls: () => calls.push(["submit-controls"]),
    workflowNeedsUpload: () => true,
    viewPort: {
      clearPageRanges: () => {
        pageRangeInputs = { start: "", end: "" };
        calls.push(["clear-ranges"]);
      },
      closePageRangeDialog() {},
      markUploadReady: (ready) => calls.push(["ready", ready]),
      openPageRangeDialog() {},
      readPageRanges: () => pageRangeInputs,
      selectedFile: () => file,
      setFileLabel() {},
      setInlinePageRangeVisible: (visible) => calls.push(["inline-range", visible]),
      showUploadStatus: (message) => calls.push(["status", message]),
      writePageRanges() {},
    },
  });

  await feature.handleFileSelected();

  assert.equal(snapshot.uploadId, "");
  assert.equal(snapshot.uploadedPageCount, 0);
  assert.equal(snapshot.appliedPageRange, "");
  assert.ok(calls.some((call) => call[0] === "reset"));
  assert.ok(calls.some((call) => call[0] === "clear-input"));
  const errorCall = calls.find((call) => call[0] === "text" && call[1] === "error-box");
  assert.equal(errorCall[2].kind, "error-diagnostic");
  assert.equal(errorCall[2].summary, "校验 PDF 文件失败：stop before upload");
  assert.match(errorCall[2].diagnostic, /file_name: new\.pdf/);
});

test("upload controller opens page range dialog with uploaded PDF page count", () => {
  const calls = [];
  const feature = mountUploadFeature({
    state: {},
    uploadStatePort: {
      getSnapshot: () => ({
        uploadId: "upload-1",
        uploadedPageCount: 12,
        appliedPageRange: "2-8",
      }),
    },
    frontMaxBytes: 1024 * 1024,
    frontMaxPageCount: 999,
    resetUploadedFile() {},
    resetUploadProgress() {},
    clearFileInputValue() {},
    setText() {},
    applyWorkflowMode() {},
    refreshSubmitControls() {},
    workflowNeedsUpload: () => true,
    viewPort: {
      clearPageRanges() {},
      closePageRangeDialog() {},
      markUploadReady() {},
      openPageRangeDialog: (options) => calls.push(["open-range-dialog", options]),
      readPageRanges: () => ({ start: "2", end: "8" }),
      selectedFile: () => null,
      setFileLabel() {},
      setInlinePageRangeVisible() {},
      showUploadStatus() {},
      writePageRanges() {},
    },
  });

  feature.openPageRangeDialog();

  assert.deepEqual(calls, [
    ["open-range-dialog", { applied: "2-8", maxPage: 12 }],
  ]);
});

test("upload controller constrains page ranges to current PDF bounds", () => {
  const calls = [];
  let snapshot = {
    uploadId: "upload-1",
    uploadedPageCount: 12,
    appliedPageRange: "",
  };
  let pageRangeInputs = { start: "14", end: "20" };
  const feature = mountUploadFeature({
    state: {},
    uploadStatePort: {
      getSnapshot: () => snapshot,
      setAppliedPageRange: (value) => {
        calls.push(["applied", value]);
        snapshot = { ...snapshot, appliedPageRange: value };
        return snapshot;
      },
    },
    frontMaxBytes: 1024 * 1024,
    frontMaxPageCount: 999,
    resetUploadedFile() {},
    resetUploadProgress() {},
    clearFileInputValue() {},
    setText() {},
    applyWorkflowMode() {},
    refreshSubmitControls: () => calls.push(["refresh-submit"]),
    workflowNeedsUpload: () => true,
    viewPort: {
      clearPageRanges() {},
      closePageRangeDialog() {},
      markUploadReady() {},
      openPageRangeDialog() {},
      readPageRanges: () => pageRangeInputs,
      selectedFile: () => null,
      setFileLabel() {},
      setInlinePageRangeVisible() {},
      showUploadStatus() {},
      writePageRanges: (values) => {
        pageRangeInputs = values;
        calls.push(["write-ranges", values]);
      },
    },
  });

  assert.deepEqual(feature.constrainPageRanges({ source: "end" }), {
    start: "12",
    end: "12",
    maxPage: 12,
  });
  assert.equal(snapshot.appliedPageRange, "12");
  assert.deepEqual(pageRangeInputs, { start: "12", end: "12" });
  assert.deepEqual(calls, [
    ["write-ranges", { start: "12", end: "12" }],
    ["applied", "12"],
    ["refresh-submit"],
  ]);
});

test("upload controller keeps start page from exceeding end page", () => {
  const calls = [];
  let pageRangeInputs = { start: "9", end: "4" };
  const feature = mountUploadFeature({
    state: {},
    uploadStatePort: {
      getSnapshot: () => ({
        uploadId: "upload-1",
        uploadedPageCount: 12,
        appliedPageRange: "",
      }),
      setAppliedPageRange: (value) => calls.push(["applied", value]),
    },
    frontMaxBytes: 1024 * 1024,
    frontMaxPageCount: 999,
    resetUploadedFile() {},
    resetUploadProgress() {},
    clearFileInputValue() {},
    setText() {},
    applyWorkflowMode() {},
    refreshSubmitControls: () => calls.push(["refresh-submit"]),
    workflowNeedsUpload: () => true,
    viewPort: {
      clearPageRanges() {},
      closePageRangeDialog() {},
      markUploadReady() {},
      openPageRangeDialog() {},
      readPageRanges: () => pageRangeInputs,
      selectedFile: () => null,
      setFileLabel() {},
      setInlinePageRangeVisible() {},
      showUploadStatus() {},
      writePageRanges: (values) => {
        pageRangeInputs = values;
        calls.push(["write-ranges", values]);
      },
    },
  });

  assert.deepEqual(feature.constrainPageRanges({ source: "start" }), {
    start: "4",
    end: "4",
    maxPage: 12,
  });
  assert.deepEqual(pageRangeInputs, { start: "4", end: "4" });
  assert.deepEqual(calls, [
    ["write-ranges", { start: "4", end: "4" }],
    ["applied", "4"],
    ["refresh-submit"],
  ]);
});

test("upload state port preserves page range reset semantics without legacy mirror", () => {
  const state = createLegacyStateFixture();
  const port = createUploadStatePort(state);
  const notifications = [];
  port.subscribe((snapshot, meta) => {
    notifications.push([meta.action, snapshot.uploadId, snapshot.appliedPageRange, snapshot.submitBusy]);
  });

  port.setUpload({
    uploadId: "upload-1",
    uploadedFileName: "book.pdf",
    uploadedPageCount: 12,
    uploadedBytes: 1024,
  });
  port.setAppliedPageRange("2-8");
  port.setSubmitBusy(true);

  assert.equal(port.getSnapshot().uploadId, "upload-1");
  assert.equal(port.getSnapshot().appliedPageRange, "2-8");
  assert.equal(port.getSnapshot().submitBusy, true);
  // 迁移完成:store 是唯一真值,旧 state 对象不再被回写
  assert.equal(state.uploadId, "");

  port.reset({ includePageRange: false });

  assert.equal(port.getSnapshot().uploadId, "");
  assert.equal(port.getSnapshot().appliedPageRange, "2-8");
  assert.equal(port.getSnapshot().submitBusy, false);
  assert.ok(notifications.some(([action]) => action === "setSubmitBusy"));
});

test("upload state port owns normalization without legacy upload helpers", () => {
  const state = {
    uploadId: "old-upload",
    uploadedFileName: "old.pdf",
    uploadedPageCount: 7,
    uploadedBytes: 4096,
    appliedPageRange: "3-5",
    submitBusy: true,
  };
  const port = createUploadStatePort(state);

  port.setAppliedPageRange(" 4-6 ");
  assert.equal(port.getSnapshot().appliedPageRange, "4-6");
  assert.equal(state.appliedPageRange, "3-5");

  port.setUpload({ uploadId: "next-upload" });
  assert.deepEqual({
    uploadId: port.getSnapshot().uploadId,
    uploadedFileName: port.getSnapshot().uploadedFileName,
    uploadedPageCount: port.getSnapshot().uploadedPageCount,
    uploadedBytes: port.getSnapshot().uploadedBytes,
  }, {
    uploadId: "next-upload",
    uploadedFileName: "",
    uploadedPageCount: 0,
    uploadedBytes: 0,
  });

  port.reset();
  assert.deepEqual(port.getSnapshot(), {
    uploadId: "",
    uploadedFileName: "",
    uploadedPageCount: 0,
    uploadedBytes: 0,
    appliedPageRange: "",
    submitBusy: false,
  });
  // 不再回写旧对象:保持调用方传入的原值
  assert.equal(state.appliedPageRange, "3-5");
});
