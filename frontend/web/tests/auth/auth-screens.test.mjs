// 登录界面、强制改密码、账号管理：表单校验、错误说人话、初始密码只显示一次。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom as makeDomWith } from "../helpers/dom.mjs";

const makeDom = () => makeDomWith("", {
  html: "<!doctype html><html><body><div id='root'></div></body></html>",
  keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLSelectElement", "HTMLFormElement", "Element", "Event", "MouseEvent", "SubmitEvent", "Node", "MutationObserver", "navigator"],
});

function typeInto(dom, input, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}
function submit(dom, form) {
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
}

test("登录：空着不发请求；密码错说人话；成功后回调", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { LoginScreen } = await import("../../src/features/auth/ui/LoginScreen.jsx");
  const calls = [];
  let ok = false;
  let succeeded = 0;
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(LoginScreen, {
    submit: async (u, p) => { calls.push([u, p]); if (!ok) throw Object.assign(new Error("x"), { status: 401, code: "INVALID_CREDENTIALS" }); },
    onSuccess: () => { succeeded += 1; },
  }));
  const doc = dom.window.document;
  const form = await waitFor(() => doc.querySelector('[data-auth-form="login"]'), "登录表单");
  submit(dom, form);
  await waitFor(() => doc.querySelector(".auth-error")?.textContent === "请填用户名和密码。", "空着提示");
  assert.equal(calls.length, 0);
  const [user, pass] = form.querySelectorAll("input");
  typeInto(dom, user, " li ");
  typeInto(dom, pass, "wrong-pass");
  submit(dom, form);
  await waitFor(() => doc.querySelector(".auth-error")?.textContent === "用户名或密码不对。", "密码错");
  assert.deepEqual(calls[0], ["li", "wrong-pass"], "用户名去掉首尾空格");
  ok = true;
  submit(dom, form);
  await waitFor(() => succeeded === 1, "登录成功");
  root.unmount();
});

test("强制改密码：新密码太短不发请求；两次一致才提交", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ForcedPasswordScreen } = await import("../../src/features/auth/ui/LoginScreen.jsx");
  const calls = [];
  let done = 0;
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(ForcedPasswordScreen, { username: "li", submit: async (c, n) => { calls.push([c, n]); }, onDone: () => { done += 1; }, onLogout: () => {} }));
  const doc = dom.window.document;
  const form = await waitFor(() => doc.querySelector('[data-auth-form="change-password"]'), "改密码表单");
  const [current, next, confirm] = form.querySelectorAll("input");
  typeInto(dom, current, "init-pass");
  typeInto(dom, next, "short");
  typeInto(dom, confirm, "short");
  submit(dom, form);
  await waitFor(() => /至少 8 位/.test(doc.querySelector(".auth-error")?.textContent || ""), "太短");
  typeInto(dom, next, "my-new-pass-1");
  typeInto(dom, confirm, "my-new-pass-1");
  submit(dom, form);
  await waitFor(() => done === 1, "提交成功");
  assert.deepEqual(calls, [["init-pass", "my-new-pass-1"]]);
  root.unmount();
});

test("账号管理：建号后显眼地给出初始密码；用户名不合规不发请求；停用自己的按钮不出现", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { AdminUsersPanel } = await import("../../src/features/auth/ui/AdminUsersPanel.jsx");
  let users = [
    { user_id: "u-admin", username: "boss", role: "admin", status: "active", must_change_password: false, created_at: "2026-10-01T00:00:00Z", last_login_at: "2026-10-10T01:00:00Z" },
    { user_id: "u-li", username: "li", role: "user", status: "active", must_change_password: true, created_at: "2026-10-02T00:00:00Z", last_login_at: null },
  ];
  const created = [];
  const toggled = [];
  const api = {
    list: async () => ({ users }),
    create: async (username, role) => { created.push([username, role]); const user = { user_id: "u-new", username, role, status: "active", must_change_password: true, created_at: "", last_login_at: null }; users = [...users, user]; return { user, initial_password: "Kp7-xQ2m-9Lw" }; },
    reset: async () => ({ initial_password: "Rt3-new-pass" }),
    setEnabled: async (id, enabled) => { toggled.push([id, enabled]); users = users.map((u) => (u.user_id === id ? { ...u, status: enabled ? "active" : "disabled" } : u)); return { user: users.find((u) => u.user_id === id) }; },
  };
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(AdminUsersPanel, { api, currentUserId: "u-admin" }));
  const doc = dom.window.document;
  await waitFor(() => doc.querySelector('[data-auth-user="li"]'), "账号列表");
  assert.match(doc.querySelector('[data-auth-user="li"]').textContent, /待改密码.*从未登录/);
  const bossRow = doc.querySelector('[data-auth-user="boss"]');
  assert.doesNotMatch(bossRow.textContent, /停用/, "不能停用自己");

  const form = doc.querySelector('[data-auth-form="create-user"]');
  typeInto(dom, form.querySelector("input"), "a b");
  submit(dom, form);
  await waitFor(() => /3～32 位/.test(doc.querySelector(".auth-error")?.textContent || ""), "用户名不合规");
  assert.equal(created.length, 0);
  typeInto(dom, form.querySelector("input"), "zhang.san");
  submit(dom, form);
  const issued = await waitFor(() => doc.querySelector("[data-auth-issued]"), "初始密码");
  assert.match(issued.textContent, /zhang\.san.*只显示这一次/);
  assert.equal(issued.querySelector(".auth-issued-password").textContent, "Kp7-xQ2m-9Lw");
  assert.deepEqual(created, [["zhang.san", "user"]]);

  const liStop = [...doc.querySelectorAll('[data-auth-user="li"] button')].find((b) => b.textContent === "停用");
  clickWithMouseDown(dom, liStop);
  await waitFor(() => doc.querySelector('[data-auth-user="li"]')?.dataset.status === "disabled", "停用后刷新列表");
  assert.deepEqual(toggled, [["u-li", false]]);
  root.unmount();
});
