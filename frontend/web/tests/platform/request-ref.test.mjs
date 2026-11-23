/** 请求出错时带上后端日志里的编号（@retainpdf/api 的 attachRequestRef）。
 *
 * issue #156 只有一句「读取术语表失败」，没法在后端日志里找到那次请求。后端每个回应都带 X-Request-ID，
 * 500 时信封里还有 error.details.error_id；后端出错（5xx）时把编号接在提示后面，用户截图、复制就带着它。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { attachRequestRef, requestRefOf } from "../../../packages/api/src/http.ts";
import { request } from "../../../packages/api/src/request.ts";

const headers = (map) => ({ get: (name) => map[name.toLowerCase()] ?? null });

test("编号：500 用信封里的 error_id，别的用回应头 X-Request-ID", () => {
  assert.equal(requestRefOf({ headers: headers({ "x-request-id": "req-1" }) }, { error: { details: { error_id: "err-9" } } }), "err-9");
  assert.equal(requestRefOf({ headers: headers({ "x-request-id": "req-1" }) }, { error: { code: "NOT_FOUND" } }), "req-1");
  assert.equal(requestRefOf(null, null), "");
});

test("5xx 把编号接在提示后面；4xx 只挂在 requestRef 上，不改提示", () => {
  const server = attachRequestRef(new Error("读取术语表失败，请稍后重试。(500)"), { status: 500, headers: headers({ "x-request-id": "abc123" }) }, null);
  assert.equal(server.message, "读取术语表失败，请稍后重试。(500)（编号 abc123）");
  assert.equal(server.requestRef, "abc123");
  const client = attachRequestRef(new Error("glossary not found(404)"), { status: 404, headers: headers({ "x-request-id": "def456" }) }, null);
  assert.equal(client.message, "glossary not found(404)");
  assert.equal(client.requestRef, "def456");
  const again = attachRequestRef(server, { status: 500, headers: headers({ "x-request-id": "abc123" }) }, null);
  assert.equal(again.message, "读取术语表失败，请稍后重试。(500)（编号 abc123）", "不重复接");
});

test("生成的请求函数出错时带上编号（后端 message 里已经有编号时不再重复接）", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ code: 50000, message: "internal server error (ref e-77)", error: { code: "INTERNAL", details: { error_id: "e-77" } } }), {
    status: 500,
    headers: { "content-type": "application/json", "x-request-id": "r-1" },
  });
  await assert.rejects(
    request({ apiPrefix: "/api/v1", method: "GET", path: "glossaries", options: { fetchImpl } }),
    (error) => error.status === 500 && error.requestRef === "e-77" && (error.message.match(/e-77/g) || []).length === 1,
  );
});
