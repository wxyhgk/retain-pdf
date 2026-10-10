// 多用户按页额度：402 显示后端原话、账目说人话、账户页的余额和账目、管理员发放 / 扣减页数。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { makeDom as makeDomWith } from "../helpers/dom.mjs";
import { setApiAuthMode, setApiUnauthorizedHandler } from "../../../packages/api/src/internal/runtime.ts";
import { isPageQuotaError, submitJson } from "../../../packages/api/src/http.ts";
import { translateDocument } from "../../../packages/api/src/documents.ts";
import { formatPageDelta, pageAdjustProblem, pageLedgerLabel, pageLedgerNote } from "../../src/features/auth/domain/page-ledger.ts";

const QUOTA_MESSAGE = "页数额度不够：这次要 12 页，还剩 3 页，请联系管理员";
const QUOTA_BODY = {
  code: "PAGE_QUOTA_EXCEEDED",
  message: QUOTA_MESSAGE,
  error: { code: "PAGE_QUOTA_EXCEEDED", http_status: 402, details: { required_pages: 12, balance: 3 } },
};

async function withFetch(response, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(response.body), { status: response.status, headers: { "content-type": "application/json" } });
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("402 额度不够：message 原样是后端的中文，带上要扣和剩余的页数；不当成登录失效", async () => {
  let unauthorized = 0;
  setApiAuthMode("multi");
  setApiUnauthorizedHandler(() => { unauthorized += 1; });
  try {
    await withFetch({ status: 402, body: QUOTA_BODY }, async () => {
      const err = await submitJson("/api/v1/jobs", { workflow: "translate", source: { upload_id: "up-1" } }).catch((e) => e);
      assert.ok(isPageQuotaError(err));
      assert.equal(err.message, QUOTA_MESSAGE, "不加「提交失败: 402」前缀和请求摘要");
      assert.equal(err.status, 402);
      assert.equal(err.requiredPages, 12);
      assert.equal(err.balance, 3);

      const docErr = await translateDocument("/api/v1", "doc-1", {}).catch((e) => e);
      assert.ok(isPageQuotaError(docErr), "书库发起翻译同样识别");
      assert.equal(docErr.message, QUOTA_MESSAGE, "不加「(402)」后缀");
    });
    // 别的 4xx 还是原来的报错
    await withFetch({ status: 400, body: { code: "BAD", message: "参数不对" } }, async () => {
      const err = await submitJson("/api/v1/jobs", {}).catch((e) => e);
      assert.ok(!isPageQuotaError(err));
      assert.match(err.message, /^提交失败: 400 参数不对/);
    });
    assert.equal(unauthorized, 0);
  } finally {
    setApiAuthMode("single");
    setApiUnauthorizedHandler(null);
  }
});

test("各提交入口：额度不够原样显示后端的话——上传页不出诊断，书库翻译 / OCR 不改写", async () => {
  const { pageQuotaErrorFromPayload } = await import("../../../packages/api/src/http.ts");
  const { reportSubmitError } = await import("../../src/features/ingest/domain/actions/submit/errors.ts");
  const { createDocumentSubmitActions } = await import("../../src/features/library/domain/documents/submit-actions.ts");
  const quota = () => pageQuotaErrorFromPayload(402, QUOTA_BODY);

  const texts = [];
  reportSubmitError({ err: quota(), workflow: "book", apiPrefix: "/api/v1", uploadId: "up-1", setText: (id, text) => texts.push([id, text]) });
  assert.deepEqual(texts, [["error-box", QUOTA_MESSAGE]]);

  const actions = createDocumentSubmitActions({
    promoteDocumentToJob: () => {},
    translateDocumentApi: async () => { throw quota(); },
    ocrDocumentApi: async () => { throw quota(); },
  });
  for (const run of [() => actions.translateDocument("doc-1"), () => actions.ocrDocument("doc-1")]) {
    const err = await run().catch((e) => e);
    assert.ok(isPageQuotaError(err), "保留错误码");
    assert.equal(err.message, QUOTA_MESSAGE);
  }
});

test("账目说人话：发放 / 扣减看正负，退回按原因，备注只显示管理员写的", () => {
  assert.equal(pageLedgerLabel({ kind: "grant", delta: 300, note: "内测" }), "管理员发放");
  assert.equal(pageLedgerLabel({ kind: "grant", delta: -50, note: "" }), "管理员扣减");
  assert.equal(pageLedgerLabel({ kind: "charge", delta: -12, note: "" }), "任务扣页");
  assert.equal(pageLedgerLabel({ kind: "refund", delta: 12, note: "failed" }), "任务失败退回");
  assert.equal(pageLedgerLabel({ kind: "refund", delta: 12, note: "canceled" }), "取消退回");
  assert.equal(pageLedgerLabel({ kind: "refund", delta: 12, note: "deleted" }), "删除退回");
  assert.equal(pageLedgerLabel({ kind: "refund", delta: 12, note: "submit_failed" }), "提交失败退回");
  assert.equal(pageLedgerNote({ kind: "grant", note: " 内测 " }), "内测");
  assert.equal(pageLedgerNote({ kind: "refund", note: "failed" }), "");
  assert.equal(formatPageDelta(300), "+300");
  assert.equal(formatPageDelta(-12), "−12");
  assert.equal(pageAdjustProblem("", ""), "页数要填正整数。");
  assert.equal(pageAdjustProblem("0", ""), "页数要填正整数。");
  assert.equal(pageAdjustProblem("-5", ""), "页数要填正整数。");
  assert.equal(pageAdjustProblem("1.5", ""), "页数要填正整数。");
  assert.match(pageAdjustProblem("1000001", ""), /最多调整/);
  assert.match(pageAdjustProblem("10", "字".repeat(201)), /备注最多 200 字/);
  assert.equal(pageAdjustProblem(" 300 ", "内测"), "");
});

const makeDom = () => makeDomWith("", {
  html: "<!doctype html><html><body><div id='root'></div></body></html>",
  keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLSelectElement", "HTMLFormElement", "Element", "Event", "MouseEvent", "SubmitEvent", "Node", "MutationObserver", "navigator"],
});

function typeInto(dom, input, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

const ENTRIES = [
  { entry_id: 4, delta: 12, kind: "refund", job_id: "job-gone", note: "deleted", actor_user_id: "", created_at: "2026-10-10T13:00:00Z" },
  { entry_id: 3, delta: -12, kind: "charge", job_id: "job-1", note: "", actor_user_id: "", created_at: "2026-10-10T12:00:00Z" },
  { entry_id: 1, delta: 300, kind: "grant", job_id: "", note: "内测", actor_user_id: "u-admin", created_at: "2026-10-10T11:00:00Z" },
];

test("账户页：显示剩余页数和账目，任务扣页能点到任务，删除退回不给链接；不限额不显示账目", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { AccountPanel } = await import("../../src/features/auth/ui/AccountPanel.jsx");
  const doc = dom.window.document;
  let root = createRoot(doc.getElementById("root"));
  let loads = 0;
  const loadPages = async () => { loads += 1; return { unlimited: false, balance: 288, entries: ENTRIES }; };
  root.render(React.createElement(AccountPanel, { loadPages, doLogout: async () => {}, afterLogout: () => {} }));
  await waitFor(() => doc.querySelector("[data-page-balance]")?.textContent === "288 页", "剩余页数");
  const rows = [...doc.querySelectorAll("[data-page-ledger] tbody tr")];
  assert.deepEqual(rows.map((r) => r.children[1].textContent), ["删除退回", "任务扣页", "管理员发放"]);
  assert.deepEqual(rows.map((r) => r.children[2].textContent), ["+12", "−12", "+300"]);
  assert.equal(rows[0].querySelector("a"), null, "删除退回的任务不给链接");
  assert.equal(rows[1].querySelector("a").getAttribute("href"), "./detail.html?job_id=job-1");
  assert.match(rows[2].textContent, /内测/);
  assert.equal(loads, 1, "只请求一次");
  root.unmount();

  root = createRoot(doc.getElementById("root"));
  root.render(React.createElement(AccountPanel, { loadPages: async () => ({ unlimited: true, balance: null, entries: [] }), doLogout: async () => {}, afterLogout: () => {} }));
  await waitFor(() => doc.querySelector("[data-page-balance]")?.textContent === "不限额", "不限额");
  assert.equal(doc.querySelector("[data-page-account]"), null);
  root.unmount();
});
