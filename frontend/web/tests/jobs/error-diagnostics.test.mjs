import test from "node:test";
import assert from "node:assert/strict";

import {
  buildErrorDiagnostic,
  messageForErrorBox,
} from "@/platform/utils/error-diagnostics.js";

test("buildErrorDiagnostic formats copyable frontend diagnostics", () => {
  const error = new Error("backend unavailable");
  error.status = 503;
  error.url = "/api/v1/jobs/job-1/pdf";

  const diagnostic = buildErrorDiagnostic(error, {
    operation: "下载译文 PDF",
    jobId: "job-1",
    now: () => "2026-06-18T12:00:00.000Z",
    details: {
      workflow: "book",
      api_key: "should-not-appear",
    },
    includeStack: false,
  });

  assert.equal(diagnostic.kind, "error-diagnostic");
  assert.equal(diagnostic.summary, "下载译文 PDF失败：backend unavailable");
  assert.match(diagnostic.diagnostic, /时间: 2026-06-18T12:00:00\.000Z/);
  assert.match(diagnostic.diagnostic, /前端版本: /);
  assert.match(diagnostic.diagnostic, /操作: 下载译文 PDF/);
  assert.match(diagnostic.diagnostic, /job_id: job-1/);
  assert.match(diagnostic.diagnostic, /HTTP 状态码: 503/);
  assert.match(diagnostic.diagnostic, /URL: \/api\/v1\/jobs\/job-1\/pdf/);
  assert.match(diagnostic.diagnostic, /workflow: book/);
  assert.doesNotMatch(diagnostic.diagnostic, /should-not-appear/);
});

test("messageForErrorBox preserves normal strings and summarizes diagnostics", () => {
  assert.equal(messageForErrorBox("-"), "-");
  assert.equal(messageForErrorBox("plain"), "plain");
  assert.equal(messageForErrorBox({
    kind: "error-diagnostic",
    summary: "上传 PDF 文件失败：HTTP 500",
    diagnostic: "full details",
  }), "上传 PDF 文件失败：HTTP 500");
});
