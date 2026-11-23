import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// job-actions.v1、job-reports.v1 里抄自 job-status.v1 的定义（契约只许本文件内 $ref，只能抄），
// 以及这两份之间共用的定义：同名就得结构一致（说明文字可以不同）。
const read = (name) => JSON.parse(readFileSync(resolve(name), "utf8"));
const jobStatus = read("job-status.v1.schema.json");
const jobActions = read("job-actions.v1.schema.json");
const jobReports = read("job-reports.v1.schema.json");

function withoutDescriptions(value) {
  if (Array.isArray(value)) return value.map(withoutDescriptions);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "description")
      .map(([key, nested]) => [key, withoutDescriptions(nested)]),
  );
}

function assertShared(left, right, expected, label) {
  const shared = Object.keys(left.definitions)
    .filter((name) => Object.hasOwn(right.definitions, name))
    .sort();
  // 名单写死：新抄一份或者起了同名的新定义，都要在这里过一遍眼。
  assert.deepEqual(shared, expected, `${label} 共有的定义变了`);
  for (const name of shared) {
    assert.deepEqual(
      withoutDescriptions(left.definitions[name]),
      withoutDescriptions(right.definitions[name]),
      `${name} drifted between ${label}`,
    );
  }
}

test("job-actions copies of job-status definitions stay structurally identical", () => {
  assertShared(jobActions, jobStatus, [
    "ActionLinkView",
    "JobActionsView",
    "JobLinksView",
    "JobProgressView",
    "JobStageRuntimeView",
    "JobStageStateView",
    "JobStagesView",
    "JobStatusKind",
    "JsonValue",
    "WorkflowKind",
  ], "job-actions and job-status");
});

test("job-reports copies of job-status definitions stay structurally identical", () => {
  assertShared(jobReports, jobStatus, [
    "JobFailureUpstream",
    "JsonValue",
    "TranslationRequestRecoveryView",
  ], "job-reports and job-status");
});

test("definitions shared by job-actions and job-reports stay structurally identical", () => {
  assertShared(jobActions, jobReports, [
    "JsonValue",
    "OcrAmbiguityResolutionKind",
  ], "job-actions and job-reports");
});

test("job-actions and library-documents copies (job submission and its links) stay structurally identical", () => {
  // 两个 1b 分支各抄了一份 JobSubmissionView（续跑、取消和书的翻译、OCR 回的是同一个 Rust 类型）。
  assertShared(jobActions, read("library-documents.v1.schema.json"), [
    "ActionLinkView",
    "JobActionsView",
    "JobLinksView",
    "JobProgressView",
    "JobStageRuntimeView",
    "JobStageStateView",
    "JobStagesView",
    "JobStatusKind",
    "JobSubmissionView",
    "JsonValue",
    "WorkflowKind",
  ], "job-actions and library-documents");
});
