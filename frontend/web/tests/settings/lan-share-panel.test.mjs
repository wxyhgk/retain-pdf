/** 设置 → 局域网共享（桌面版）：面板经桌面 IPC 读状态、开关、重置访问码。
 *
 * 用假的 window.retainPdfDesktop 扮演主进程（frontend/desktop/src/main/lan-share.js 的真实形状），
 * 走一遍：关着 → 勾选打开 → 显示地址、二维码、复制完整链接 → 重置访问码 → 关掉。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { click, makeDom } from "../helpers/dom.mjs";

// 桌面桥在 host.js 加载时就解析：先装好 DOM 和假的主进程，再 import 任何前端模块。
const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "Event", "MouseEvent", "Node", "MutationObserver", "URL"] });
const main = fakeMainProcess(dom.window);
const copied = [];
Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "node", clipboard: { writeText: async (text) => copied.push(text) } },
  configurable: true,
});

const { normalizeLanShareStatus } = await import("../../src/platform/desktop/host.js");
const { lanShareHeadline } = await import("../../src/features/lan-share/index.js");

test("主进程给的状态收成固定形状；旧桌面壳 / 外部后端当不支持", () => {
  assert.equal(normalizeLanShareStatus(null).supported, false);
  assert.equal(normalizeLanShareStatus({ supported: false }).supported, false);
  const status = normalizeLanShareStatus({
    enabled: true,
    running: true,
    port: "40100",
    urls: [{ name: "en0", url: "http://192.168.1.20:40100/?k=abc", display: "http://192.168.1.20:40100", qrSvg: "<svg/>" }, { name: "x" }, "bad"],
  });
  assert.equal(status.supported, true);
  assert.equal(status.port, 40100);
  assert.deepEqual(status.urls.map((item) => item.display), ["http://192.168.1.20:40100"], "没有链接的项丢掉");
});

test("状态说明：关着、开着没地址、开着有地址", () => {
  assert.match(lanShareHeadline({ enabled: false, running: false, urls: [] }), /未开启/);
  assert.match(lanShareHeadline({ enabled: true, running: false, urls: [] }), /没能启动/);
  assert.match(lanShareHeadline({ enabled: true, running: true, urls: [] }), /等这台电脑连上局域网/);
  assert.match(lanShareHeadline({ enabled: true, running: true, urls: [{}, {}] }), /2 个地址/);
});

function fakeMainProcess(window) {
  const state = { enabled: false, token: "t1" };
  const calls = [];
  const status = () => ({
    enabled: state.enabled,
    running: state.enabled,
    port: state.enabled ? 40100 : 0,
    urls: state.enabled
      ? [{ name: "en0", url: `http://192.168.1.20:40100/?k=${state.token}`, display: "http://192.168.1.20:40100", qrSvg: `<svg data-k="${state.token}"/>` }]
      : [],
  });
  window.retainPdfDesktop = {
    platform: "darwin",
    async invoke(command, args = {}) {
      calls.push([command, args]);
      if (command === "lan_share_status") return status();
      if (command === "lan_share_set_enabled") {
        state.enabled = Boolean(args.enabled);
        return status();
      }
      if (command === "lan_share_reset_token") {
        state.token = "t2";
        return status();
      }
      throw new Error(`unexpected ${command}`);
    },
  };
  return { state, calls };
}

test("打开 → 地址和二维码 → 复制完整链接 → 重置访问码 → 关掉", async () => {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { LanSharePanel } = await import("../../src/features/lan-share/index.js");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(LanSharePanel));
  await wait(50);

  const text = () => host.textContent;
  const toggle = () => host.querySelector('[data-lan-share-action="toggle"] input') || host.querySelector('input[type="checkbox"]');
  await waitFor(() => text().includes("未开启"));
  assert.equal(host.querySelector(".lan-share-qr"), null);
  assert.equal(host.querySelector('[data-lan-share-action="reset"]'), null, "关着时不显示重置");

  click(dom, toggle());
  await waitFor(() => main.state.enabled && text().includes("http://192.168.1.20:40100"));
  assert.match(text(), /已开启/);
  assert.match(text(), /只发给信任的设备/);
  assert.equal(text().includes("?k="), false, "访问码不直接显示在界面上");
  const qr = host.querySelector(".lan-share-qr");
  assert.match(decodeURIComponent(qr.getAttribute("src")), /data-k="t1"/);

  click(dom, host.querySelector('[data-lan-share-action="copy"]'));
  await waitFor(() => copied.length === 1);
  assert.equal(copied[0], "http://192.168.1.20:40100/?k=t1");

  click(dom, host.querySelector('[data-lan-share-action="reset"]'));
  await waitFor(() => decodeURIComponent(host.querySelector(".lan-share-qr").getAttribute("src")).includes('data-k="t2"'));

  click(dom, toggle());
  await waitFor(() => !main.state.enabled && text().includes("未开启"));
  assert.equal(host.querySelector(".lan-share-qr"), null);
  assert.deepEqual(main.calls.map(([command]) => command), [
    "lan_share_status", "lan_share_set_enabled", "lan_share_reset_token", "lan_share_set_enabled",
  ]);
  root.unmount();
});
