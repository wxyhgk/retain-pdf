import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// Unit test cho useAppEvent(APP_EVENTS → React adapter hook):
// vòng đời đăng ký, cập nhật handler ref không đăng ký lại, gỡ khi unmount, target tùy chỉnh.

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
for (const key of ["window", "document", "HTMLElement", "CustomEvent", "Event", "Node"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs (giai đoạn B) dưới jsdom cần cancelAnimationFrame
// (dọn timer mount animation của TabsContent) và getComputedStyle (Presence đọc
// animation-name để xác định animation thoát có kết thúc chưa) — window của jsdom có cài đặt,
// chỉ là không được copy lên bare global như requestAnimationFrame, ở đây bổ sung thêm.
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { useAppEvent } = await import("../src/shared/react/use-app-event.js");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(10);
  }
  assert.fail(`等待超时：${description}`);
}

function Probe({ eventName, handler, target }) {
  useAppEvent(eventName, handler, { target });
  return null;
}

test("useAppEvent：订阅 document 事件并随卸载解绑", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const calls = [];
  const root = createRoot(host);

  root.render(React.createElement(Probe, {
    eventName: "retainpdf-test:ping",
    handler: (event) => calls.push(event.detail),
  }));
  await waitFor(() => {
    dom.window.document.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:ping", { detail: "a" }));
    return calls.length > 0;
  }, "首个事件送达");
  assert.equal(calls[calls.length - 1], "a");

  const seen = calls.length;
  root.unmount();
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:ping", { detail: "b" }));
  await wait(20);
  assert.equal(calls.length, seen, "卸载后不应再收到事件");
  host.remove();
});

test("useAppEvent：handler 引用漂移不重订阅,始终调用最新 handler", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);

  const doc = dom.window.document;
  const originalAdd = doc.addEventListener.bind(doc);
  let addCount = 0;
  doc.addEventListener = (name, listener, options) => {
    if (name === "retainpdf-test:swap") {
      addCount += 1;
    }
    return originalAdd(name, listener, options);
  };

  const calls = [];
  const root = createRoot(host);
  root.render(React.createElement(Probe, {
    eventName: "retainpdf-test:swap",
    handler: () => calls.push("first"),
  }));
  await waitFor(() => {
    doc.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:swap"));
    return calls.length > 0;
  }, "初始 handler 生效");
  assert.equal(calls[calls.length - 1], "first");

  // Thay handler mới (reference mới) rồi re-render: không được gọi addEventListener lần nữa
  root.render(React.createElement(Probe, {
    eventName: "retainpdf-test:swap",
    handler: () => calls.push("second"),
  }));
  await waitFor(() => {
    doc.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:swap"));
    return calls[calls.length - 1] === "second";
  }, "新 handler 生效");
  assert.equal(addCount, 1, "handler 引用变化不应重建订阅");

  doc.addEventListener = originalAdd;
  root.unmount();
  host.remove();
});

test("useAppEvent：支持自定义 target", async () => {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const target = dom.window.document.createElement("section");
  const calls = [];
  const root = createRoot(host);
  root.render(React.createElement(Probe, {
    eventName: "retainpdf-test:scoped",
    handler: () => calls.push(1),
    target,
  }));
  await waitFor(() => {
    target.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:scoped"));
    return calls.length > 0;
  }, "target 事件送达");

  const seen = calls.length;
  dom.window.document.dispatchEvent(new dom.window.CustomEvent("retainpdf-test:scoped"));
  await wait(20);
  assert.equal(calls.length, seen, "document 上的同名事件不应触发 target 订阅");

  root.unmount();
  host.remove();
});
