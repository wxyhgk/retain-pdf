import assert from "node:assert/strict";
import test from "node:test";

import {
  hasMarkdownContent,
  loadMarkdownPayloadWithFallback,
  normalizeMarkdownPayload,
  resolveLinkedMarkdownJobId,
} from "../../../../frontend/packages/reader/src/shared/data/markdown-payload.ts";
import { createReaderDataPort } from "../../../../frontend/packages/reader/src/shared/data/data-port.ts";


test("normalizeMarkdownPayload accepts structured, legacy, and envelope payloads", () => {
  assert.deepEqual(
    normalizeMarkdownPayload({
      ready: true,
      content_with_absolute_image_urls: "# Structured",
      images_base_url: "/images/",
    }),
    {
      payload: {
        ready: true,
        content_with_absolute_image_urls: "# Structured",
        images_base_url: "/images/",
      },
      content: "# Structured",
      imagesBaseUrl: "/images/",
      ready: true,
    },
  );
  assert.equal(normalizeMarkdownPayload({ markdown: "# Legacy" }).content, "# Legacy");
  assert.equal(normalizeMarkdownPayload({ data: { content: "# Envelope" } }).content, "# Envelope");
  assert.equal(hasMarkdownContent({ ready: true, content: "   " }), false);
});


test("empty structured Markdown falls back to the legacy endpoint", async () => {
  const calls = [];
  const payload = await loadMarkdownPayloadWithFallback(
    async () => {
      calls.push("document");
      return { ready: false, content: "" };
    },
    async () => {
      calls.push("legacy");
      return { markdown: "# Recovered" };
    },
  );

  assert.deepEqual(calls, ["document", "legacy"]);
  assert.equal(normalizeMarkdownPayload(payload).content, "# Recovered");
});


test("non-empty structured Markdown avoids a redundant legacy request", async () => {
  let legacyCalls = 0;
  const payload = await loadMarkdownPayloadWithFallback(
    async () => ({ content: "# Current" }),
    async () => {
      legacyCalls += 1;
      return { content: "# Old" };
    },
  );

  assert.equal(normalizeMarkdownPayload(payload).content, "# Current");
  assert.equal(legacyCalls, 0);
});

test("resolveLinkedMarkdownJobId accepts the public OCR reuse fields", () => {
  assert.equal(
    resolveLinkedMarkdownJobId({ source_artifact_job_id: "ocr-source" }, "translation-job"),
    "ocr-source",
  );
  assert.equal(
    resolveLinkedMarkdownJobId({ request_payload: { source: { artifact_job_id: "ocr-nested" } } }),
    "ocr-nested",
  );
  assert.equal(
    resolveLinkedMarkdownJobId({ source_artifact_job_id: "same-job" }, "same-job"),
    "",
  );
});

test("Reader Markdown follows the source OCR job when translation reused artifacts", async () => {
  const calls = [];
  const port = createReaderDataPort({
    loadJob: async (jobId) => {
      calls.push(`job:${jobId}`);
      return { source_artifact_job_id: "ocr-source" };
    },
    loadMarkdownDocument: async (jobId) => {
      calls.push(`document:${jobId}`);
      return jobId === "ocr-source" ? { content: "# OCR Markdown" } : null;
    },
    loadMarkdown: async (jobId) => {
      calls.push(`legacy:${jobId}`);
      return null;
    },
  });

  const payload = await port.loadMarkdownPayload("translation-job");

  assert.equal(normalizeMarkdownPayload(payload).content, "# OCR Markdown");
  assert.deepEqual(calls, [
    "document:translation-job",
    "legacy:translation-job",
    "job:translation-job",
    "document:ocr-source",
  ]);
});
