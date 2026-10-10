// 管理后台：排序切换、批量操作谁跳过、逐个执行不中断；账号列表的搜索 / 排序 / 批量发页数；
// 单个账号的统计、删除（软删除、取消任务）、恢复、自己的账号不能删、任务和账目不给链接。
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { waitFor } from "../helpers/async.mjs";
import {
  bulkSkipReason,
  formatBytes,
  nextSort,
  planBulk,
  runBulk,
  userStatusLabel,
} from "../../src/features/admin/domain/admin-users.ts";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/admin.html" });
for (const key of ["window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "Node", "MutationObserver", "NodeFilter", "CustomEvent", "Event", "MouseEvent", "KeyboardEvent", "getComputedStyle", "navigator"]) {
  Object.defineProperty(globalThis, key, {
    value: key === "getComputedStyle" ? dom.window.getComputedStyle.bind(dom.window) : (dom.window[key] ?? dom.window),
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const doc = dom.window.document;

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true, button: 0 }));
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, button: 0 }));
}

function typeInto(input, value) {
  const proto = input.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(input, value);
  input.dispatchEvent(new dom.window.Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}

const user = (id, name, extra = {}) => ({
  user_id: id, username: name, role: "user", status: "active", must_change_password: false,
  created_at: "2026-10-01T00:00:00Z", last_login_at: null, deleted_at: "", page_balance: 0, ...extra,
});
const ADMIN = user("u-admin", "boss", { role: "admin", page_balance: null });

async function mount(element) {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const host = doc.createElement("div");
  doc.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(element.type, element.props));
  return { host, unmount: () => { root.unmount(); host.remove(); } };
}

test("排序：同一列切换升降序，换列时用户名升序、其余降序", () => {
  assert.deepEqual(nextSort({ sort: "created_at", order: "asc" }, "created_at"), { sort: "created_at", order: "desc" });
  assert.deepEqual(nextSort({ sort: "created_at", order: "asc" }, "username"), { sort: "username", order: "asc" });
  assert.deepEqual(nextSort({ sort: "username", order: "asc" }, "page_balance"), { sort: "page_balance", order: "desc" });
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(250 * 1024 * 1024), "250 MB");
  assert.equal(userStatusLabel({ status: "active", must_change_password: true }), "待改密码");
  assert.equal(userStatusLabel({ status: "deleted", must_change_password: true }), "已删除");
});

test("批量：管理员不发页数、不能停用 / 删除自己、已删除的只能恢复；逐个执行，失败不中断", async () => {
  const li = user("u-li", "li");
  const gone = user("u-gone", "gone", { status: "deleted" });
  const off = user("u-off", "off", { status: "disabled" });
  assert.equal(bulkSkipReason("grant", ADMIN, "u-admin"), "管理员不限额");
  assert.equal(bulkSkipReason("grant", gone, "u-admin"), "已删除");
  assert.equal(bulkSkipReason("disable", ADMIN, "u-admin"), "不能停用自己");
  assert.equal(bulkSkipReason("delete", ADMIN, "u-admin"), "不能删除自己");
  assert.equal(bulkSkipReason("enable", off, "u-admin"), "");
  assert.equal(bulkSkipReason("enable", li, "u-admin"), "已经是正常");
  assert.equal(bulkSkipReason("restore", gone, "u-admin"), "");
  assert.equal(bulkSkipReason("restore", li, "u-admin"), "没有删除");
  const plan = planBulk("grant", [ADMIN, li, gone, off], "u-admin");
  assert.deepEqual(plan.eligible.map((u) => u.username), ["li", "off"]);
  assert.deepEqual(plan.skipped.map((s) => s.user.username), ["boss", "gone"]);

  const seen = [];
  const progress = [];
  const result = await runBulk([li, off, gone], async (u) => {
    seen.push(u.username);
    if (u.username === "off") throw new Error("出错了");
  }, (e) => e.message, (done, total) => progress.push(`${done}/${total}`));
  assert.deepEqual(seen, ["li", "off", "gone"], "失败了也接着做后面的");
  assert.deepEqual(result.succeeded.map((u) => u.username), ["li", "gone"]);
  assert.deepEqual(result.failed, [{ user: off, message: "出错了" }]);
  assert.deepEqual(progress, ["1/3", "2/3", "3/3"]);
});

function makeApi(initialUsers) {
  let users = initialUsers.map((u) => ({ ...u }));
  const calls = [];
  const api = {
    list: async (query) => {
      calls.push(["list", query]);
      let list = users.filter((u) => (query.status ? u.status === query.status : u.status !== "deleted"));
      if (query.q) list = list.filter((u) => u.username.includes(query.q));
      return { users: list, total: list.length };
    },
    detail: async (id) => {
      const u = users.find((x) => x.user_id === id);
      return {
        user: u,
        page_balance: u.page_balance ?? null,
        stats: { jobs_total: 3, jobs_by_status: { running: 1, succeeded: 2 }, documents: 2, uploads: 2, upload_bytes: 3 * 1024 * 1024, pages_charged: 40, pages_reserved: 12, last_submitted_at: "2026-10-10T12:00:00Z" },
      };
    },
    jobs: async () => ({ jobs: [{ job_id: "job-1", workflow: "book", status: "running", title: "论文.pdf", document_pages: 12, charged_pages: 12, charge_status: "reserved", created_at: "2026-10-10T12:00:00Z", finished_at: null }], total: 1 }),
    create: async () => { throw new Error("unused"); },
    reset: async () => ({ initial_password: "Kp7-xQ2m" }),
    setEnabled: async (id, enabled) => { calls.push(["setEnabled", id, enabled]); users = users.map((u) => (u.user_id === id ? { ...u, status: enabled ? "active" : "disabled" } : u)); return { user: users.find((u) => u.user_id === id) }; },
    setRole: async (id, role) => { calls.push(["setRole", id, role]); return { user: users.find((u) => u.user_id === id) }; },
    remove: async (id) => { calls.push(["remove", id]); users = users.map((u) => (u.user_id === id ? { ...u, status: "deleted", deleted_at: "2026-10-10T13:00:00Z" } : u)); return { user: users.find((u) => u.user_id === id), canceled_jobs: ["job-1"] }; },
    restore: async (id) => { calls.push(["restore", id]); users = users.map((u) => (u.user_id === id ? { ...u, status: "active", deleted_at: "" } : u)); return { user: users.find((u) => u.user_id === id) }; },
    pages: async (id) => ({ unlimited: false, balance: users.find((u) => u.user_id === id)?.page_balance ?? 0, entries: [{ entry_id: 2, delta: -12, kind: "charge", job_id: "job-1", note: "", actor_user_id: "", created_at: "2026-10-10T12:00:00Z" }] }),
    adjustPages: async (id, delta, note) => {
      calls.push(["adjustPages", id, delta, note]);
      if (id === "u-zhang") throw Object.assign(new Error("扣完余额会变成负数：现在只有 0 页"), { status: 400, code: "PAGE_BALANCE_NEGATIVE" });
      users = users.map((u) => (u.user_id === id ? { ...u, page_balance: (u.page_balance || 0) + delta } : u));
      return { balance: users.find((u) => u.user_id === id).page_balance };
    },
  };
  return { api, calls };
}

test("账号列表：搜索带上 q、点表头按列排序；勾选后批量发页数，管理员跳过，失败的单独列出", async () => {
  const React = await import("react");
  const { AdminUsersView } = await import("../../src/features/admin/ui/AdminUsersView.jsx");
  const { api, calls } = makeApi([ADMIN, user("u-li", "li", { page_balance: 10 }), user("u-zhang", "zhang")]);
  const opened = [];
  const { host, unmount } = await mount(React.createElement(AdminUsersView, { api, currentUserId: "u-admin", onOpenUser: (id) => opened.push(id) }));
  await waitFor(() => host.querySelector('[data-auth-user="li"]'), "账号列表");
  assert.equal(host.querySelector('[data-auth-user="boss"] [data-page-balance]').textContent, "不限额");
  assert.equal(host.querySelector('[data-auth-user="li"] [data-page-balance]').textContent, "10 页");
  assert.deepEqual(calls[0][1], { q: undefined, status: undefined, role: undefined, sort: "created_at", order: "asc", limit: 50, offset: 0 });

  typeInto(host.querySelector(".admin-search"), "zh");
  await waitFor(() => calls.some(([name, q]) => name === "list" && q.q === "zh"), "搜索防抖后带上 q");
  await waitFor(() => !host.querySelector('[data-auth-user="li"]') && host.querySelector('[data-auth-user="zhang"]'), "只剩 zhang");
  typeInto(host.querySelector(".admin-search"), "");
  await waitFor(() => host.querySelector('[data-auth-user="li"]'), "清空搜索");

  click(host.querySelector('[data-admin-sort="page_balance"]'));
  await waitFor(() => calls.some(([name, q]) => name === "list" && q.sort === "page_balance" && q.order === "desc"), "按剩余页数降序");

  click(host.querySelector('[data-admin-open="u-li"]'));
  assert.deepEqual(opened, ["u-li"]);

  // 全选本页 → 批量发放 20 页
  const selectAll = await waitFor(() => host.querySelector('input[aria-label="全选本页"]'), "全选");
  click(selectAll);
  await waitFor(() => host.querySelector("[data-admin-bulkbar]"), "批量条");
  assert.match(host.querySelector("[data-admin-bulkbar]").textContent, /已选 3 个/);
  click(host.querySelector('[data-admin-bulk="grant"]'));
  const body = await waitFor(() => doc.querySelector('[data-admin-bulk-dialog="grant"]'), "批量弹窗");
  assert.match(body.textContent, /将对 2 个账号发放页数，跳过 1 个/);
  assert.match(body.textContent, /boss：管理员不限额/);
  const [amount] = body.querySelectorAll("input");
  click(doc.getElementById("admin-bulk-dialog-confirm"));
  await waitFor(() => doc.querySelector('[data-admin-bulk-dialog] .auth-error')?.textContent === "页数要填正整数。", "页数没填");
  typeInto(amount, "20");
  click(doc.getElementById("admin-bulk-dialog-confirm"));
  const report = await waitFor(() => host.querySelector("[data-admin-bulk-report]"), "批量结果");
  assert.match(report.textContent, /发放页数：成功 1 个，失败 1 个，跳过 1 个/);
  assert.match(report.textContent, /zhang：扣完余额会变成负数/);
  assert.deepEqual(calls.filter(([n]) => n === "adjustPages").map(([, id, delta]) => [id, delta]), [["u-li", 20], ["u-zhang", 20]]);
  await waitFor(() => host.querySelector('[data-auth-user="li"] [data-page-balance]')?.textContent === "30 页", "列表刷新");
  unmount();
});

test("单个账号：统计、任务和账目不给链接；删除要确认，提示取消了几个任务；删除后只剩恢复", async () => {
  const React = await import("react");
  const { AdminUserDetailView } = await import("../../src/features/admin/ui/AdminUserDetailView.jsx");
  const { api, calls } = makeApi([ADMIN, user("u-li", "li", { page_balance: 288 })]);
  let changed = 0;
  const { host, unmount } = await mount(React.createElement(AdminUserDetailView, { api, userId: "u-li", currentUserId: "u-admin", onBack: () => {}, onChanged: () => { changed += 1; } }));
  await waitFor(() => host.querySelector('[data-admin-user-detail="li"]'), "账号详情");
  const facts = host.querySelector(".admin-facts").textContent;
  assert.match(facts, /剩余页数288 页/);
  assert.match(facts, /累计扣页40 页其中 12 页预扣中/);
  assert.match(facts, /运行中 1 · 已完成 2/);
  assert.match(facts, /3\.0 MB/);
  await waitFor(() => host.querySelector('[data-admin-job="job-1"]'), "任务列表");
  assert.match(host.querySelector('[data-admin-job="job-1"]').textContent, /论文\.pdf整本翻译运行中12 页预扣中/);
  assert.equal(host.querySelector("[data-admin-jobs] a"), null, "任务不给链接");
  await waitFor(() => host.querySelector("[data-page-ledger] tbody tr"), "账目");
  assert.equal(host.querySelector("[data-page-ledger] a"), null, "账目不给链接");

  click(host.querySelector('[data-admin-action="delete"]'));
  await waitFor(() => doc.getElementById("admin-user-confirm"), "删除确认");
  assert.match(doc.getElementById("admin-user-confirm").textContent, /还有 1 个排队中 \/ 运行中的任务，会被取消/);
  assert.ok(!calls.some(([n]) => n === "remove"), "确认前不删");
  click(doc.getElementById("admin-user-confirm-confirm"));
  await waitFor(() => /已删除，取消了 1 个/.test(host.querySelector(".auth-ok")?.textContent || ""), "删除结果");
  await waitFor(() => host.querySelector('[data-admin-action="restore"]'), "删除后只剩恢复");
  assert.equal(host.querySelector('[data-admin-action="toggle"]'), null);
  assert.equal(host.querySelector('[data-auth-form="adjust-pages"]'), null, "删了不能发页数");
  click(host.querySelector('[data-admin-action="restore"]'));
  await waitFor(() => host.querySelector('[data-admin-action="delete"]'), "恢复后能操作");
  assert.deepEqual(calls.filter(([n]) => n === "remove" || n === "restore"), [["remove", "u-li"], ["restore", "u-li"]]);
  assert.ok(changed >= 2, "通知列表刷新");
  unmount();
});

test("单个账号：自己的账号没有停用 / 删除 / 改身份；管理员不限额、不能发页数", async () => {
  const React = await import("react");
  const { AdminUserDetailView } = await import("../../src/features/admin/ui/AdminUserDetailView.jsx");
  const { api } = makeApi([ADMIN]);
  const { host, unmount } = await mount(React.createElement(AdminUserDetailView, { api, userId: "u-admin", currentUserId: "u-admin", onBack: () => {}, onChanged: () => {} }));
  await waitFor(() => host.querySelector('[data-admin-user-detail="boss"]'), "自己的详情");
  assert.ok(host.querySelector('[data-admin-action="reset"]'), "能重置自己的密码");
  for (const action of ["toggle", "role", "delete"]) assert.equal(host.querySelector(`[data-admin-action="${action}"]`), null, action);
  assert.match(host.textContent, /这是你自己的账号/);
  assert.equal(host.querySelector('[data-page-balance]').textContent, "不限额");
  assert.equal(host.querySelector('[data-auth-form="adjust-pages"]'), null);
  unmount();
});
