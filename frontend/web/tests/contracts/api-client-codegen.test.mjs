// 请求函数从契约端点表生成（方案：docs/ops/planning/api-client-codegen/）。这里守三件事：
//   1. src/generated 和契约一致——改了契约没重新生成就红；
//   2. 生成层的传输行为：地址和查询串、GET 不带 Content-Type、拆信封、报错带状态码和 reason；
//   3. packages/api 里手写发请求的地方只减不增，新接口写进契约再生成。
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const apiPackage = resolve(here, "../../../packages/api");

globalThis.window = {
  location: { protocol: "http:", hostname: "127.0.0.1" },
  __FRONT_RUNTIME_CONFIG__: { apiBase: "http://127.0.0.1:41000", xApiKey: "codegen-key" },
};

const { fetchDocumentList, fetchDocumentByJobId, patchDocument, deleteDocument } = await import("@retainpdf/api/documents");
const { listCollections, materializeCollectionWorkspace, removeDocumentFromCollection } = await import("@retainpdf/api/collections");
const { jobBoardFileUrl, listJobBoard } = await import("@retainpdf/api/ai");
const { buildUploadsEndpoint } = await import("@retainpdf/api/http");
const glossaries = await import("@retainpdf/api/glossaries");
const { searchLibrary } = await import("@retainpdf/api/search");

function respond(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function withFetch(handler, run) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: `${url}`, init });
    return handler(`${url}`, init);
  };
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
  return calls;
}

test("src/generated 和契约端点表一致（改了契约要重新生成）", () => {
  execFileSync(process.execPath, [resolve(apiPackage, "scripts/generate-client.mjs"), "--check"], { stdio: "pipe" });
});

test("GET：查询串按传入顺序、空值不发，不带 Content-Type，拆信封", async () => {
  let result;
  const calls = await withFetch(
    () => respond(200, { code: 0, message: "ok", data: { documents: [], total: 0, limit: 50, offset: 0, has_more: false } }),
    async () => { result = await fetchDocumentList("/api/v1", { q: "  量子 ", collectionId: "" }); },
  );
  assert.equal(calls[0].url, "http://127.0.0.1:41000/api/v1/documents?limit=50&offset=0&q=%E9%87%8F%E5%AD%90");
  assert.equal(calls[0].init.method, undefined);
  assert.equal(calls[0].init.headers["Content-Type"], undefined, "GET 带 Content-Type 会把每个请求变成预检");
  assert.equal(calls[0].init.headers["X-API-Key"], "codegen-key");
  assert.deepEqual(result.documents, []);
});

test("按 job 找书只发 job_id，找不到给 null", async () => {
  let found;
  const calls = await withFetch(
    () => respond(200, { code: 0, data: { documents: [], total: 0 } }),
    async () => { found = await fetchDocumentByJobId("/api/v1", "job a"); },
  );
  assert.equal(calls[0].url, "http://127.0.0.1:41000/api/v1/documents?job_id=job+a");
  assert.equal(found, null);
});

test("PATCH：路径参数编码、JSON 请求体；失败时优先用后端 message", async () => {
  const calls = await withFetch(
    () => respond(200, { code: 0, data: { document_id: "doc/1", title: "新" } }),
    () => patchDocument("/api/v1", " doc/1 ", { title: "新" }),
  );
  assert.equal(calls[0].url, "http://127.0.0.1:41000/api/v1/documents/doc%2F1");
  assert.equal(calls[0].init.method, "PATCH");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), { title: "新" });

  await withFetch(
    () => respond(400, { code: 40000, message: "unknown field `titel`" }),
    () => assert.rejects(patchDocument("/api/v1", "doc-1", { title: "x" }), { message: "unknown field `titel`(400)" }),
  );
});

test("DELETE：force 只在为 true 时发；409 保留状态码和 reason", async () => {
  const calls = await withFetch(
    () => respond(409, { code: 40900, message: "书下还有任务在跑", error: { code: "CONFLICT", details: { reason: "job_active" } } }),
    () => assert.rejects(deleteDocument("/api/v1", "doc-1"), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.reason, "job_active");
      assert.match(error.message, /书下还有任务在跑\(409\)/);
      return true;
    }),
  );
  assert.equal(calls[0].url, "http://127.0.0.1:41000/api/v1/documents/doc-1");
  assert.equal(calls[0].init.method, "DELETE");

  const forced = await withFetch(() => respond(200, { code: 0, data: { deleted: true } }), () => deleteDocument("/api/v1", "doc-1", { force: true }));
  assert.equal(forced[0].url, "http://127.0.0.1:41000/api/v1/documents/doc-1?force=true");
});

test("合集、检索：固定文案的报错，空查询不发请求", async () => {
  await withFetch(
    () => respond(500, { code: 50000, message: "boom" }),
    () => assert.rejects(listCollections("/api/v1"), { message: "读取分类失败，请稍后重试。(500)" }),
  );
  const removed = await withFetch(
    () => respond(200, { code: 0, data: { removed: true } }),
    () => removeDocumentFromCollection("/api/v1", "col 1", "doc 2"),
  );
  assert.equal(removed[0].url, "http://127.0.0.1:41000/api/v1/collections/col%201/documents/doc%202");
  const none = await withFetch(() => respond(500, {}), () => searchLibrary("/api/v1", "   "));
  assert.equal(none.length, 0);
});

test("契约里还没有的几条借 request() 发：物化文件夹工作区用 POST，画板列表和文件地址转义 job id", async () => {
  const calls = await withFetch(
    () => respond(200, { code: 0, data: { books: [{ job_id: "job-1" }] } }),
    async () => assert.deepEqual(await materializeCollectionWorkspace("/api/v1", "col/1"), { books: [{ job_id: "job-1" }] }),
  );
  assert.equal(calls[0].url, "http://127.0.0.1:41000/api/v1/collections/col%2F1/agent-workspace");
  assert.equal(calls[0].init.method, "POST", "物化会重建磁盘目录，GET 是后端标了旧地址的写法");
  assert.equal(calls[0].init.headers["X-API-Key"], "codegen-key");
  // 文件夹被删了是 404，终端作用域条靠 status 说「这个文件夹已经不存在了」。
  await withFetch(
    () => respond(404, { code: 40400, message: "not found" }),
    () => assert.rejects(materializeCollectionWorkspace("/api/v1", "col-1"), (error) => error.status === 404),
  );

  const board = await withFetch(
    () => respond(200, { code: 0, data: { schema: "retainpdf_ai_board_v1", items: [] } }),
    async () => assert.deepEqual((await listJobBoard("/api/v1", "job 1")).items, []),
  );
  assert.equal(board[0].url, "http://127.0.0.1:41000/api/v1/jobs/job%201/ai/board");
  assert.equal(jobBoardFileUrl("/api/v1", "job 1", "a b.html"), "http://127.0.0.1:41000/api/v1/jobs/job%201/ai/board/a%20b.html");
  assert.equal(buildUploadsEndpoint("/api/v1"), "http://127.0.0.1:41000/api/v1/uploads");
});

test("术语表走生成的函数：地址、方法、请求体，报错文案和以前一样", async () => {
  const list = await withFetch(
    () => respond(200, { code: 0, data: { items: [{ glossary_id: "g-1", name: "术语" }] } }),
    async () => assert.equal((await glossaries.fetchGlossaries("/api/v1")).items[0].glossary_id, "g-1"),
  );
  assert.equal(list[0].url, "http://127.0.0.1:41000/api/v1/glossaries");
  assert.equal(list[0].init.method, undefined);

  const put = await withFetch(
    () => respond(200, { code: 0, data: { glossary_id: "g/1" } }),
    () => glossaries.updateGlossary("/api/v1", " g/1 ", { name: "新", entries: [] }),
  );
  assert.equal(put[0].url, "http://127.0.0.1:41000/api/v1/glossaries/g%2F1");
  assert.equal(put[0].init.method, "PUT");
  assert.deepEqual(JSON.parse(put[0].init.body), { name: "新", entries: [] });

  const csv = await withFetch(
    () => respond(200, { code: 0, data: { entries: [] } }),
    () => glossaries.parseGlossaryCsv("/api/v1", "source,target"),
  );
  assert.equal(csv[0].url, "http://127.0.0.1:41000/api/v1/glossaries/parse-csv");
  assert.equal(csv[0].init.method, "POST");
  assert.deepEqual(JSON.parse(csv[0].init.body), { csv_text: "source,target" });

  await withFetch(
    () => respond(400, { code: 40000, message: "entries[0].target 不能为空" }),
    async () => {
      await assert.rejects(glossaries.updateGlossary("/api/v1", "g-1", {}), { message: "保存术语表失败: 400 entries[0].target 不能为空" });
      await assert.rejects(glossaries.deleteGlossary("/api/v1", "g-1"), { message: "删除术语表失败: 400 entries[0].target 不能为空" });
      await assert.rejects(glossaries.createGlossary("/api/v1", {}), { message: "提交失败: 400 entries[0].target 不能为空" });
      await assert.rejects(glossaries.fetchGlossaries("/api/v1"), { message: "读取术语表失败，请稍后重试。(400)" });
    },
  );
  const none = await withFetch(() => respond(200, {}), () => assert.rejects(glossaries.fetchGlossary("  "), { message: "读取术语表失败: 缺少 glossary_id" }));
  assert.equal(none.length, 0, "没有编号不发请求");
});

// 手写发请求：apiFetch(、submitJson(、fetchImpl(、submitUploadRequest(、XHR。函数定义那一行不算；
// 生成层走 request.ts 的 (options.fetchImpl || apiFetch)(…)，不在数里。
const HAND_WRITTEN_REQUEST = /apiFetch\(|submitJson\(|fetchImpl\(|submitUploadRequest\(|new XMLHttpRequest/g;

test("packages/api 里手写发请求的地方只减不增，新接口走生成的函数", () => {
  // 第 0 期前 66 处，第 1 期换完 36 处，第 2 期删掉没人调的封装后 34 处，术语表换完 28 处
  // （剩下的是设置类其余几组、AI、多用户和文件上传、下载）。
  const BASELINE = 28;
  const srcRoot = resolve(apiPackage, "src");
  let count = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "generated") walk(full);
      } else if (entry.name.endsWith(".ts")) {
        for (const line of readFileSync(full, "utf8").split("\n")) {
          if (/^\s*export (async )?function /.test(line)) continue;
          count += (line.match(HAND_WRITTEN_REQUEST) || []).length;
        }
      }
    }
  };
  walk(srcRoot);
  assert.ok(count <= BASELINE, `手写发请求有 ${count} 处，超过棘轮 ${BASELINE}：新接口请写进契约端点表并重新生成`);
  assert.equal(count, BASELINE, `手写发请求减到了 ${count} 处，把这里的 BASELINE 拧紧到 ${count}`);
});
