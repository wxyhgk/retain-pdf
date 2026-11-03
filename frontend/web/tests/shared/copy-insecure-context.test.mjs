// 用局域网 IP 的 http 打开页面时不是安全上下文，浏览器不给 navigator.clipboard。
// 主页「复制回答」和管理后台复制初始密码以前只调 navigator.clipboard，点了没反应；
// 现在都走平台的 copyText，退到 execCommand("copy")。
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://192.168.1.20:40001/" });
for (const key of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "navigator"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(dom.window, "isSecureContext", { value: false, configurable: true });
assert.equal(dom.window.navigator.clipboard, undefined, "前提：没有 navigator.clipboard");

const copied = [];
dom.window.document.execCommand = (command) => {
  if (command !== "copy") return false;
  copied.push(dom.window.document.activeElement?.value);
  return true;
};

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { copyText } = await import("../../src/features/admin/ui/admin-shared.jsx");

test("管理后台复制初始密码：非安全上下文下退到 execCommand", async () => {
  copied.length = 0;
  assert.equal(await copyText("Init-Pass-123"), true);
  assert.deepEqual(copied, ["Init-Pass-123"]);
});
