import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const generatedJobStatus = readFileSync(resolve("src/job-status.ts"), "utf8");
const generatedLibraryBooks = readFileSync(resolve("src/library-books.ts"), "utf8");
const RAW_SCHEMA_EXPORTS = [
  "./ai-ask.v1.schema.json",
  "./agent-calculation.v1.schema.json",
  "./ai-conversations.v1.schema.json",
  "./job-status.v1.schema.json",
  "./jobs-control.v1.schema.json",
  "./library-books.v1.schema.json",
  "./pipeline-stdout.v1.schema.json",
  "./public-document-operation.v1.schema.json",
  "./runtime-config.v1.schema.json",
];

test("package exposes only explicit DTO and raw schema subpaths", () => {
  assert.deepEqual(
    Object.keys(manifest.exports).sort(),
    ["./job-status", "./library-books", ...RAW_SCHEMA_EXPORTS].sort(),
  );
  assert.equal(Object.hasOwn(manifest.exports, "."), false);
  assert.equal(Object.keys(manifest.exports).some((key) => key.includes("*")), false);
});

test("package has no runtime dependencies", () => {
  assert.deepEqual(manifest.dependencies, {});
});

test("generated DTO entries expose the stable consumer type names", () => {
  for (const typeName of [
    "ArtifactDisplayItemView",
    "BookSummaryView",
    "JobDetailView",
    "JobEventListView",
    "JobEventRecord",
    "JobFailureInfo",
    "JobListItemView",
    "JobListView",
    "JobRuntimeInfo",
    "NormalizationSummaryView",
    "OcrProviderDiagnostics",
    "PublicResolvedJobSpec",
  ]) {
    assert.match(generatedJobStatus, new RegExp(`export (?:interface|type) ${typeName}\\b`));
  }
  for (const typeName of [
    "ArtifactDisplayItemView",
    "JobListItemView",
    "JobListView",
    "LibraryBookDetailView",
    "LibraryBookListItemView",
    "LibraryBookListView",
  ]) {
    assert.match(generatedLibraryBooks, new RegExp(`export (?:interface|type) ${typeName}\\b`));
  }
});

test("generated job DTOs keep request and event records structurally typed", () => {
  assert.match(generatedJobStatus, /request_payload: PublicResolvedJobSpec;/);
  assert.match(generatedJobStatus, /items: JobEventRecord\[\];/);
  assert.doesNotMatch(generatedJobStatus, /request_payload: \{\};/);
  assert.doesNotMatch(generatedJobStatus, /items: \{\}\[\];/);
  assert.doesNotMatch(generatedJobStatus, /\?: \{\} \| null;/);
});
