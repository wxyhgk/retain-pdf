/** 设置 → 通知：开关记在本机；网页版没授权时给「允许通知」，允许了能发一条试试。 */
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { DOM_GLOBAL_KEYS, click, makeDom } from "../helpers/dom.mjs";

test("没授权 → 点「允许通知」→ 允许了能试发；关掉开关记在本机", async () => {
  const dom = makeDom("", { keys: [...DOM_GLOBAL_KEYS, "localStorage"] });
  const sent = [];
  let asked = 0;
  class FakeNotification {
    static permission = "default";
    static async requestPermission() {
      asked += 1;
      FakeNotification.permission = "granted";
      return "granted";
    }
    constructor(title, options) {
      sent.push([title, options.tag]);
    }
  }
  globalThis.Notification = FakeNotification;
  try {
    const { createRoot } = await import("react-dom/client");
    const React = await import("react");
    const { NotifySettingsPanel } = await import("../../src/features/notify/index.ts");
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    root.render(React.createElement(NotifySettingsPanel));

    await waitFor(() => host.querySelector('[data-notify-action="allow"]'));
    assert.ok(host.querySelector("[data-notify-toggle]").checked, "默认开着");
    assert.equal(host.querySelector('[data-notify-action="test"]'), null, "没授权时不给试发");
    click(dom, host.querySelector('[data-notify-action="allow"]'));
    await waitFor(() => host.querySelector('[data-notify-action="test"]'));
    assert.equal(asked, 1);
    assert.equal(host.querySelector('[data-notify-action="allow"]'), null);
    click(dom, host.querySelector('[data-notify-action="test"]'));
    assert.deepEqual(sent, [["通知能用了", "retainpdf-notify-test"]]);
    await waitFor(() => host.textContent.includes("已发出一条测试通知"));

    click(dom, host.querySelector("[data-notify-toggle]"));
    await waitFor(() => !host.querySelector("[data-notify-toggle]").checked);
    assert.equal(dom.window.localStorage.getItem("retainpdf.notify.job-finished.v1"), "0");
    assert.ok(host.querySelector('[data-notify-action="test"]').disabled, "关了就不能试发");
    root.unmount();
  } finally {
    delete globalThis.Notification;
    dom.window.close();
  }
});

test("浏览器拒绝过：告诉用户去网站设置里改", async () => {
  const dom = makeDom("", { keys: [...DOM_GLOBAL_KEYS, "localStorage"] });
  globalThis.Notification = class { static permission = "denied"; static async requestPermission() { return "denied"; } };
  try {
    const { createRoot } = await import("react-dom/client");
    const React = await import("react");
    const { NotifySettingsPanel } = await import("../../src/features/notify/index.ts");
    const host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    root.render(React.createElement(NotifySettingsPanel));
    await waitFor(() => host.querySelector('[data-notify-permission="denied"]'));
    assert.match(host.textContent, /网站设置里改成允许/);
    assert.equal(host.querySelector("[data-notify-action]"), null);
    root.unmount();
  } finally {
    delete globalThis.Notification;
    dom.window.close();
  }
});
