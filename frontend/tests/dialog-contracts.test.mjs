import test from "node:test";
import assert from "node:assert/strict";

// Ghi chú cutover: các file HTML template dialog cũ (reader/ai-assistant/app-settings/
// status-detail/glossary-manager *-dialog-template.js), features/developer/*,
// features/reader-dialog/{view.js,legacy-dom-adapter.js} đã bị xóa cùng với cutover trang home
// (cây component React thay thế). Các test case dạng "template markup chứa contract id" cũng bị xóa;
// 3 test case còn lại đo logic thuần (readerDialogLinkOpenState của reader-dialog-contract.js,
// phân tích độ tin cậy URL/thông điệp của reader-dialog/config-port.js), không liên quan DOM template, tiếp tục giữ.

import {
  READER_DIALOG_CLASSES,
  READER_DIALOG_DATASETS,
  readerDialogLinkOpenState,
} from "../src/js/components/dialogs/reader-dialog-contract.js";
import { createReaderDialogConfigPort } from "../src/js/features/reader-dialog/config-port.js";

test("reader dialog link open state uses the shared external trigger contract", () => {
  const classes = new Set([READER_DIALOG_CLASSES.disabled]);
  const link = {
    dataset: {
      [READER_DIALOG_DATASETS.url]: "./reader.html?job_id=job-reader",
    },
    disabled: false,
    classList: {
      contains(name) {
        return classes.has(name);
      },
    },
    getAttribute(name) {
      return name === "aria-disabled" ? "false" : "";
    },
  };

  assert.deepEqual(readerDialogLinkOpenState(link), {
    url: "./reader.html?job_id=job-reader",
    disabled: true,
  });

  classes.clear();
  link.disabled = true;
  assert.deepEqual(readerDialogLinkOpenState({ currentTarget: link }), {
    url: "./reader.html?job_id=job-reader",
    disabled: true,
  });
});

test("reader dialog config port owns reader URLs and message trust", () => {
  const trustCalls = [];
  const port = createReaderDialogConfigPort({
    buildPageUrl(path, params) {
      return `app://${path}?job_id=${params.job_id}`;
    },
    trustWindowMessage(event, source) {
      trustCalls.push([event.origin, source]);
      return event.origin === "app://retainpdf";
    },
    locationProvider: () => ({
      href: "http://localhost/index.html?view=reader&job_id=job-123",
    }),
  });

  assert.equal(port.buildReaderPageUrl("job-123"), "app://./reader.html?job_id=job-123");
  assert.equal(port.buildReaderPageUrl(""), "");
  assert.equal(
    port.buildReaderRouteUrl("job-456"),
    "http://localhost/index.html?view=reader&job_id=job-456",
  );
  assert.equal(port.buildReaderRouteUrl(""), "http://localhost/index.html");
  assert.equal(port.requestedReaderJobIdFromLocation(), "job-123");
  assert.equal(port.isTrustedReaderMessage({ origin: "app://retainpdf" }, "frame"), true);
  assert.deepEqual(trustCalls, [["app://retainpdf", "frame"]]);
});

test("reader dialog config port ignores location job id outside reader view", () => {
  const port = createReaderDialogConfigPort({
    locationProvider: () => ({
      href: "http://localhost/index.html?view=library&job_id=job-123",
    }),
  });

  assert.equal(port.requestedReaderJobIdFromLocation(), "");
});
