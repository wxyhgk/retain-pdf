import test from "node:test";
import assert from "node:assert/strict";

import { createDocumentAutoNaming } from "../../src/features/library/domain/documents/document-auto-naming.js";

test("成功 OCR 任务创建并自动应用标题建议", async () => {
  const calls = [];
  const applied = [];
  const autoNaming = createDocumentAutoNaming({
    fetchDocumentByJobId: async () => ({ document_id: "doc-1" }),
    fetchSuggestions: async (documentId) => {
      calls.push(["list", documentId]);
      return [];
    },
    createSuggestion: async (documentId, payload) => {
      calls.push(["create", documentId, payload]);
      return { suggestion_id: "suggestion-1", applied: true };
    },
    onApplied: (value) => applied.push(value),
  });

  await autoNaming.run({ job_id: "ocr-1", workflow: "ocr", status: "succeeded" });
  assert.deepEqual(calls, [
    ["list", "doc-1"],
    ["create", "doc-1", {
      job_id: "ocr-1",
      fields: ["title"],
      apply_if_default: true,
    }],
  ]);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].documentId, "doc-1");
});

test("同一成功任务并发通知只请求一次，已持久化建议不重复创建", async () => {
  let listCount = 0;
  let createCount = 0;
  const autoNaming = createDocumentAutoNaming({
    fetchDocumentByJobId: async () => ({ document_id: "doc-2" }),
    fetchSuggestions: async () => {
      listCount += 1;
      return [{ source_job_id: "book-2", fields: ["title"], applied: false }];
    },
    createSuggestion: async () => {
      createCount += 1;
      return { applied: false };
    },
  });
  const job = { job_id: "book-2", workflow: "book", status: "succeeded" };

  await Promise.all([autoNaming.run(job), autoNaming.run(job)]);
  await autoNaming.run(job);
  assert.equal(listCount, 1);
  assert.equal(createCount, 0);
});

test("运行中、失败和 render-only 任务不会触发标题建议", async () => {
  let calls = 0;
  const autoNaming = createDocumentAutoNaming({
    fetchDocumentByJobId: async () => {
      calls += 1;
      return { document_id: "doc-3" };
    },
    fetchSuggestions: async () => [],
    createSuggestion: async () => ({ applied: false }),
  });

  await autoNaming.run({ job_id: "ocr-running", workflow: "ocr", status: "running" });
  await autoNaming.run({ job_id: "ocr-failed", workflow: "ocr", status: "failed" });
  await autoNaming.run({ job_id: "render-done", workflow: "render", status: "succeeded" });
  assert.equal(calls, 0);
});
