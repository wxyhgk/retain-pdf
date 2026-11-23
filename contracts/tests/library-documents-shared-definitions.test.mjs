import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// library-documents.v1 里抄来的定义（第 1b 期，2026-10-22）。$ref 不能跨文件，前端生成器也只读同一份契约的
// definitions，所以书的翻译 / OCR 请求体、书的任务列表、建任务回包要用的定义原样抄了一份；这里锁住它们和源头一致。
// 要改先改源头（create-job.v1、job-status.v1），再照抄过来。
const read = (name) => JSON.parse(readFileSync(resolve(name), "utf8"));
const documents = read("library-documents.v1.schema.json").definitions;

// 从 create-job.v1 抄来：POST /documents/:id/translate、/ocr 的请求体就是 POST /jobs 的 CreateJobInput。
const FROM_CREATE_JOB = [
  "CreateJobInput",
  "GlossaryEntryInput",
  "JobSourceInput",
  "JsonValue",
  "ModelConnection",
  "OcrInput",
  "RenderInput",
  "RuntimeInput",
  "TranslationInput",
];

// 从 job-status.v1 抄来：任务列表条目（和 GET /jobs 同形）和建任务回包的链接、操作。
const FROM_JOB_STATUS = [
  "ActionLinkView",
  "InvocationSummaryView",
  "JobActionsView",
  "JobFailureBriefView",
  "JobFailureUpstream",
  "JobLinksView",
  "JobListInvocationSummaryView",
  "JobListItemView",
  "JobProgressView",
  "JobStageRuntimeView",
  "JobStageSnapshotView",
  "JobStageStateView",
  "JobStagesView",
  "UpstreamWaitView",
];

// 第 0 期就在 library-documents.v1 里的两个枚举，说明文字不一样，值要一样。
const SHARED_ENUMS = ["JobStatusKind", "WorkflowKind"];

function withoutDescriptions(value) {
  if (Array.isArray(value)) return value.map(withoutDescriptions);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "description")
      .map(([key, nested]) => [key, withoutDescriptions(nested)]),
  );
}

function refsOf(value, refs = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) refsOf(item, refs);
  } else if (value && typeof value === "object") {
    if (typeof value.$ref === "string") refs.add(value.$ref.replace("#/definitions/", ""));
    for (const nested of Object.values(value)) refsOf(nested, refs);
  }
  return refs;
}

for (const [source, names] of [["create-job.v1.schema.json", FROM_CREATE_JOB], ["job-status.v1.schema.json", FROM_JOB_STATUS]]) {
  test(`library-documents.v1 copies of ${source} definitions are identical to the source`, () => {
    const upstream = read(source).definitions;
    for (const name of names) {
      assert.ok(Object.hasOwn(upstream, name), `${source} no longer has ${name}`);
      assert.deepEqual(documents[name], upstream[name], `${name} drifted between ${source} and library-documents.v1`);
    }
    // 抄的是闭包：抄来的定义引用的东西也都在名单（或共用的枚举）里，不会漏抄一层。
    const allowed = new Set([...names, ...SHARED_ENUMS]);
    for (const name of names) {
      for (const ref of refsOf(upstream[name])) {
        assert.ok(allowed.has(ref), `${name} refers to ${ref}, which is not copied`);
      }
    }
  });
}

test("library-documents.v1 job enums match create-job.v1 and job-status.v1", () => {
  for (const source of ["create-job.v1.schema.json", "job-status.v1.schema.json"]) {
    const upstream = read(source).definitions;
    for (const name of SHARED_ENUMS) {
      if (!Object.hasOwn(upstream, name)) continue;
      assert.deepEqual(withoutDescriptions(documents[name]), withoutDescriptions(upstream[name]), `${name} drifted from ${source}`);
    }
  }
});
