/** 失败卡片上服务商错误码目录的那条提示（GET /providers/error-codes）。
 *
 * - 哪家、哪个码：失败里有 upstream 用它；没有时 OCR 阶段用建任务时的 ocr.provider + 失败里的 provider_code。
 * - 只有状态码时只认唯一一条（同一个 429 可能是限流也可能是欠费）。
 * - 卡片查到就在后端说法上面加一行「智谱 GLM-OCR 1113 智谱账号余额……」，查不到不画。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { pickFailureFacts } from "../../src/features/book-detail/domain/job-failure-detail.ts";
import { fetchProviderErrorHint } from "../../../packages/api/src/providers.ts";
import { makeDom } from "../helpers/dom.mjs";
import { waitFor } from "../helpers/async.mjs";

test("哪家哪个码：有 upstream 用它；没有时 OCR 用 ocr.provider + provider_code；翻译对不上就不查", () => {
  const ocr = pickFailureFacts({ failure: { failed_stage: "ocr", provider: "ocr", provider_code: "1113" }, request_payload: { ocr: { provider: "glm_ocr" } } });
  assert.deepEqual([ocr.upstreamVendor, ocr.upstreamCode, ocr.upstreamHttpStatus], ["glm_ocr", "1113", null]);
  const upstream = pickFailureFacts({ failure: { failed_stage: "translation", provider: "translation", upstream: { provider: "openai", http_status: 429, code: "insufficient_quota" } } });
  assert.deepEqual([upstream.upstreamVendor, upstream.upstreamCode, upstream.upstreamHttpStatus], ["openai", "insufficient_quota", 429]);
  const translation = pickFailureFacts({ failure: { failed_stage: "translation", provider: "translation", upstream_host: "api.openai.com" }, request_payload: { ocr: { provider: "paddle" } } });
  assert.equal(translation.upstreamVendor, "", "翻译阶段没有 upstream 时不拿 OCR 的厂商去查");
});

function catalogue(entries) {
  return async (url) => {
    const query = new URL(`${url}`, "http://x").searchParams;
    const vendor = { id: query.get("provider"), label: "智谱 GLM-OCR", kind: "ocr", hosts: [], entries };
    return new Response(JSON.stringify({ code: 0, data: { schema: "provider-error-codes.v1", categories: [], failure_codes: [], vendors: [vendor] } }), { status: 200 });
  };
}
const entry = (code, status, hint) => ({ id: `x-${code}`, code, aliases: [], http_status: [status], category: "quota", retryable: false, meaning_zh: "余额不足", user_hint_zh: hint, source_url: "https://example.com" });

test("按码查：查到给提示；只有状态码时只认唯一一条；没厂商不查", async () => {
  const hint = await fetchProviderErrorHint("/api/v1", { vendor: "glm_ocr", code: "1113" }, { fetchImpl: catalogue([entry("1113", 429, "充值后再试")]) });
  assert.deepEqual([hint.vendorLabel, hint.code, hint.hint, hint.meaning], ["智谱 GLM-OCR", "1113", "充值后再试", "余额不足"]);
  const two = await fetchProviderErrorHint("/api/v1", { vendor: "openai", httpStatus: 429 }, { fetchImpl: catalogue([entry("rate_limit", 429, "等等再试"), entry("insufficient_quota", 429, "去充值")]) });
  assert.equal(two, null, "同一个 429 有两种意思，不猜");
  const one = await fetchProviderErrorHint("/api/v1", { vendor: "deepseek", httpStatus: 402 }, { fetchImpl: catalogue([entry(null, 402, "余额不足，去充值")]) });
  assert.equal(one.hint, "余额不足，去充值");
  assert.equal(await fetchProviderErrorHint("/api/v1", { vendor: "", code: "1113" }), null);
});

test("失败卡片：查到就显示那一行，查不到不画", async () => {
  const dom = makeDom("");
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { JobFailureCard } = await import("../../src/features/book-detail/ui/panels/processing/JobFailureCard.tsx");
  const failure = { category: "billing", stage: "ocr", retryable: false, summary: "上游账户余额或额度不足" };
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const hint = { vendor: "glm_ocr", vendorLabel: "智谱 GLM-OCR", code: "1113", meaning: "余额不足", hint: "智谱账号余额或资源包不足，请充值后再试", sourceUrl: "" };
  root.render(React.createElement(JobFailureCard, { failure, jobId: "job-1", loadHint: async () => hint }));
  const line = await waitFor(() => host.querySelector('[data-failure-provider-hint="glm_ocr"]'), "服务商提示那一行");
  assert.match(line.textContent, /智谱 GLM-OCR 1113/);
  assert.match(line.textContent, /请充值后再试/);
  assert.equal(line.getAttribute("title"), "余额不足");

  root.render(React.createElement(JobFailureCard, { failure, jobId: "job-2", loadHint: async () => null }));
  await waitFor(() => !host.querySelector("[data-failure-provider-hint]"), "查不到就不画");
  root.unmount();
  dom.window.close();
});
