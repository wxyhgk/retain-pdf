import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", {
  url: "http://localhost/reader.html",
});
for (const key of ["window", "document", "localStorage", "location"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    writable: true,
    configurable: true,
  });
}

const { setReaderAdapters } = await import("../../../../frontend/packages/reader/src/adapters.ts");
const { createReaderAskAnswerer } = await import("../../../../frontend/packages/reader/src/external.ts");

test("Reader ask factory consumes the host document and AI adapters", async () => {
  const documentCalls = [];
  const askCalls = [];
  setReaderAdapters({
    credentialsPort: {
      getCredentials: () => ({ modelApiKey: "test-model-key" }),
    },
    fetchDocumentByJobId: async (apiPrefix, jobId) => {
      documentCalls.push({ apiPrefix, jobId });
      return { document_id: "doc-1" };
    },
    askDocumentAi: async (options) => {
      askCalls.push(options);
      return { answer: "ok", citations: [], conversationId: "conversation-1" };
    },
  });

  const answerer = createReaderAskAnswerer({ jobId: "job-1" });
  assert.equal(await answerer.ensureLoaded(), true);
  const result = await answerer.answer({ question: "结论是什么？" });

  assert.deepEqual(documentCalls, [{ apiPrefix: "/api/v1", jobId: "job-1" }]);
  assert.equal(askCalls.length, 1);
  assert.equal(askCalls[0].documentId, "doc-1");
  assert.equal(askCalls[0].jobId, "");
  assert.equal(askCalls[0].llmApiKey, "test-model-key");
  assert.equal(result.answer, "ok");
  setReaderAdapters(null);
});
