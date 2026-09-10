import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveReaderDocumentId,
  resolveReaderJobId,
} from "../../src/features/reader/domain.js";
import { createReaderDialogConfigPort } from "../../src/features/reader/domain.js";

// 馆藏文档"读原文"(F4):无 job、只有 document_id 时,阅读器走只读源文档分支。

test("resolveReaderJobId:带 document_id 时不回退到 mock job", () => {
  // 关键回归:mock 模式下 resolveReaderJobId 本来会兜底返回 mock job id——
  // 源文档阅读器若拿到这个 id 会去挂 mock 任务的译文,整条只读链路就串了。
  const jobId = resolveReaderJobId({
    search: "?document_id=doc-abc",
    isMock: () => true,
    mockJobId: () => "mock-job-1",
  });
  assert.equal(jobId, "", "有 document_id 时不返回 mock job");
});

test("resolveReaderJobId:job_id 优先,无 job_id/document_id 时 mock 兜底不变", () => {
  assert.equal(
    resolveReaderJobId({ search: "?job_id=j1&document_id=doc-abc", isMock: () => true, mockJobId: () => "m" }),
    "j1",
    "job_id 仍然优先",
  );
  assert.equal(
    resolveReaderJobId({ search: "", isMock: () => true, mockJobId: () => "mock-job-1" }),
    "mock-job-1",
    "两个都没有时保持原 mock 兜底行为",
  );
  assert.equal(
    resolveReaderJobId({ search: "", isMock: () => false, mockJobId: () => "mock-job-1" }),
    "",
  );
});

test("resolveReaderDocumentId:从 URL 读取 document_id", () => {
  assert.equal(resolveReaderDocumentId({ search: "?document_id=doc-abc" }), "doc-abc");
  assert.equal(resolveReaderDocumentId({ search: "?job_id=j1" }), "");
  assert.equal(resolveReaderDocumentId({ search: "" }), "");
});

test("buildReaderDocumentPageUrl:用 document_id 打开 reader.html,透传 mock 场景与锚点", () => {
  const port = createReaderDialogConfigPort({
    buildPageUrl: (path, params) => `${path}?${new URLSearchParams(params).toString()}`,
    mockScenarioProvider: () => "parallel",
  });
  const url = port.buildReaderDocumentPageUrl("doc-abc");
  assert.ok(url.startsWith("./reader.html?"), "指向 reader.html");
  const params = new URLSearchParams(url.split("?")[1]);
  assert.equal(params.get("document_id"), "doc-abc");
  assert.equal(params.get("job_id"), null, "不带 job_id");
  assert.equal(params.get("mock"), "parallel", "iframe 是独立文档,mock 场景要透传");

  const anchored = port.buildReaderDocumentPageUrl("doc-abc", { pageIdx: 3, blockId: "b-1" });
  const anchoredParams = new URLSearchParams(anchored.split("?")[1]);
  assert.equal(anchoredParams.get("page_idx"), "3");
  assert.equal(anchoredParams.get("block_id"), "b-1");
});

test("buildReaderDocumentPageUrl:空 document_id 返回空串(不误开阅读器)", () => {
  const port = createReaderDialogConfigPort({
    buildPageUrl: (path, params) => `${path}?${new URLSearchParams(params).toString()}`,
    mockScenarioProvider: () => "",
  });
  assert.equal(port.buildReaderDocumentPageUrl(""), "");
  assert.equal(port.buildReaderDocumentPageUrl(null), "");
});
