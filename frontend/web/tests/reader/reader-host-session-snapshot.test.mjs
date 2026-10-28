/** 宿主 loadSessionSnapshot：documents 查询和 job / manifest 并行，结果带回给 session。
 *
 * 原来 `GET /documents?job_id=` 排在 loadReaderPayload（job + manifest + regions +
 * metadata，regions 可达 544KB）之后串行发出，session 拿到 snapshot 后又原样再查一遍。
 * 这里在 fetch 层计时：job / manifest 卡住不回时，documents 必须已经发出；
 * snapshot 必须带回 linkedDocument（session 就不用再查）。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { deferred, waitFor } from "../helpers/async.mjs";
import { installReaderDom } from "../helpers/dom.mjs";

const JOB_ID = "job-host-snap";

function envelope(data) {
  return new Response(JSON.stringify({ code: 0, message: "ok", data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch(gate) {
  const requests = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input?.url ?? input);
    requests.push(url);
    if (url.includes("/documents?") && url.includes(`job_id=${JOB_ID}`)) {
      return envelope({ documents: [{ document_id: "doc-host", active_job_id: "job-other", active_version_id: "" }], total: 1 });
    }
    await gate.promise;
    if (url.includes(`/jobs/${JOB_ID}/files`)) return envelope({ job_id: JOB_ID, output: [], internal: [] });
    if (url.includes("/reader/regions")) return envelope({ items: [] });
    if (url.includes("/reader/metadata")) return envelope(null);
    if (url.includes(`/jobs/${JOB_ID}`)) return envelope({ job_id: JOB_ID, status: "succeeded", workflow: "translate" });
    return new Response("not found", { status: 404 });
  };
  return { requests, restore: () => { globalThis.fetch = previous; } };
}

test("documents 查询不等 job / manifest，snapshot 带回 linkedDocument", async () => {
  const env = installReaderDom({ url: `http://localhost/reader.html?job_id=${JOB_ID}` });
  const gate = deferred();
  const net = installFetch(gate);
  let pending = null;
  try {
    const { sessionDataPort } = await import("../../src/features/reader/domain/host/data.ts");
    pending = sessionDataPort.loadSessionSnapshot({
      jobId: JOB_ID,
      documentId: "",
      routeDocumentId: "",
      committedSource: null,
      includeOptionalArtifacts: false,
    });
    await waitFor(
      () => net.requests.some((url) => url.includes(`/jobs/${JOB_ID}`)),
      () => `job 请求没发出：${net.requests.join(", ")}`,
    );
    await waitFor(
      () => net.requests.some((url) => url.includes("/documents?")),
      () => `job / manifest 没回来时 documents 还没发出（串行）：${net.requests.join(", ")}`,
      500,
    );
    gate.resolve();
    const snapshot = await pending;
    assert.equal(snapshot.linkedDocument?.document_id, "doc-host");
    assert.equal(net.requests.filter((url) => url.includes("/documents?")).length, 1);
    // includeOptionalArtifacts:false 时不取 regions / metadata（session 另行并行取）。
    assert.equal(net.requests.some((url) => url.includes("/reader/regions")), false);
  } finally {
    gate.resolve();
    // 等它收尾再换 fetch：不然失败时残留的请求会落进下一条测试的 fetch 替身。
    await pending?.catch(() => {});
    net.restore();
    env.restore();
  }
});

test("有 route document 时不查 documents，linkedDocument 留空（undefined）让 session 自己判断", async () => {
  const env = installReaderDom({ url: `http://localhost/reader.html?job_id=${JOB_ID}&document_id=doc-route` });
  const gate = deferred();
  gate.resolve();
  const net = installFetch(gate);
  try {
    const { sessionDataPort } = await import("../../src/features/reader/domain/host/data.ts");
    const snapshot = await sessionDataPort.loadSessionSnapshot({
      jobId: JOB_ID,
      documentId: "doc-route",
      routeDocumentId: "doc-route",
      committedSource: null,
      includeOptionalArtifacts: false,
    });
    assert.equal(snapshot.linkedDocument, undefined);
    assert.equal(net.requests.some((url) => url.includes("/documents?")), false);
  } finally {
    net.restore();
    env.restore();
  }
});

test("宿主单独提供可选产物加载（regions / metadata），供 session 和 PDF 下载并行", async () => {
  const env = installReaderDom({ url: `http://localhost/reader.html?job_id=${JOB_ID}` });
  const gate = deferred();
  gate.resolve();
  const net = installFetch(gate);
  try {
    const { sessionDataPort } = await import("../../src/features/reader/domain/host/data.ts");
    assert.equal(typeof sessionDataPort.loadReaderOptionalArtifacts, "function");
    const optional = await sessionDataPort.loadReaderOptionalArtifacts(JOB_ID);
    assert.deepEqual(optional.readerErrors, { regions: null, metadata: null });
    assert.ok(net.requests.some((url) => url.includes("/reader/regions")));
    assert.ok(net.requests.some((url) => url.includes("/reader/metadata")));
    assert.equal(net.requests.some((url) => url.includes(`/jobs/${JOB_ID}`) && !url.includes("/reader/")), false,
      "可选产物不该顺带拉 job");
  } finally {
    net.restore();
    env.restore();
  }
});

test("按书编号读书、读修订分组：宿主走 API 层，阅读包不再自己拼地址", async () => {
  const env = installReaderDom({ url: "http://localhost/reader.html?document_id=doc%2F1" });
  const requests = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input?.url ?? input);
    requests.push(url);
    if (url.includes("/data/revisions")) return envelope({ dataset: "revisions", groups: [{ value: "p001-b0001", count: 2 }] });
    return envelope({ document_id: "doc/1", active_job_id: "job-9", active_version_id: "v1" });
  };
  try {
    const { sessionDataPort } = await import("../../src/features/reader/domain/host/data.ts");
    const doc = await sessionDataPort.fetchDocument("doc/1");
    assert.equal(doc.active_job_id, "job-9", "拆了信封交回书的记录");
    const groups = await sessionDataPort.fetchRevisionGroups("job 9");
    assert.deepEqual(groups.groups, [{ value: "p001-b0001", count: 2 }]);
    assert.match(requests[0], /\/api\/v1\/documents\/doc%2F1$/);
    assert.match(requests[1], /\/api\/v1\/jobs\/job%209\/data\/revisions\?group_by=reader_item_id&limit=1000$/);
  } finally {
    globalThis.fetch = previous;
    env.restore();
  }
});
