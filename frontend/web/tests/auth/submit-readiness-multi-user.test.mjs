// 多用户模式下凭证由服务器统一管：提交前不再因为「没填 OCR 凭证」拦住用户。
import test from "node:test";
import assert from "node:assert/strict";
import { setApiAuthMode } from "@retainpdf/api/http";
import { currentSubmitReadiness } from "../../src/features/ingest/domain/actions/submit/readiness.js";

const base = {
  workflow: "book",
  configPort: { isMock: () => false },
  desktopMode: false,
  desktopConfigured: true,
  uploadId: "up-1",
  hasBrowserCredentials: () => false,
  workflowNeedsUpload: () => true,
  workflowNeedsCredentials: () => true,
  currentBudgetState: () => null,
};

test("单机缺凭证照旧拦；多用户放行", () => {
  try {
    setApiAuthMode("single");
    assert.equal(currentSubmitReadiness(base).reason, "missing_credentials");
    setApiAuthMode("multi");
    assert.equal(currentSubmitReadiness(base).ok ?? !currentSubmitReadiness(base).reason, true);
  } finally {
    setApiAuthMode("single");
  }
});
