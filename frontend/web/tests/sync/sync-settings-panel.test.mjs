/** 设置 → 同步：面板经后端接口读状态、改设置、立即同步。
 *
 * 用桩住的 fetch 扮演后端（真实形状：{code, message, data}），走一遍用户的路径：
 * 没选文件夹时开不了 → 填文件夹（失焦即保存）→ 开启 → 立即同步 → 看到结果与其它设备；
 * 后端拒绝时把原因显示出来。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { click, makeDom, typeInput } from "../helpers/dom.mjs";

const { describeSyncStatus, describePending, relativeTime } = await import("../../src/features/sync/domain/describe.js");

test("同步状态的说明文字：关着、同步过、出错、等文件", () => {
  const now = Date.parse("2026-10-09T10:00:00Z");
  assert.equal(relativeTime("2026-10-09T09:59:30Z", now), "刚刚");
  assert.equal(relativeTime("2026-10-09T09:57:00Z", now), "3 分钟前");
  assert.equal(relativeTime("2026-10-09T08:00:00Z", now), "2 小时前");
  assert.equal(describeSyncStatus({ enabled: false, folder: null }, now).detail, "选一个网盘文件夹，再开启同步。");
  const ok = describeSyncStatus({
    enabled: true,
    last_run: { ok: true, finished_at: "2026-10-09T09:57:00Z", applied: 3, exported: 1, device_renewed: true },
  }, now);
  assert.equal(ok.tone, "ok");
  assert.equal(ok.headline, "已同步 · 3 分钟前");
  assert.match(ok.detail, /收到 3 项，发出 1 项。.*作为新设备加入/);
  const failed = describeSyncStatus({ enabled: true, last_run: { ok: false, error: "无法访问同步文件夹", finished_at: "2026-10-09T09:59:59Z" } }, now);
  assert.equal(failed.tone, "error");
  assert.equal(failed.detail, "无法访问同步文件夹");
  assert.match(describePending({ pending_total: 2, pending: [{ reason: "waiting for 3 file(s), e.g. jobs/x" }, { reason: "waiting for 1 file(s), e.g. jobs/y" }] }), /等网盘把文件下载/);
  assert.equal(describePending({ pending_total: 0 }), "");
});

function fakeBackend() {
  const state = {
    enabled: false, transport: "folder", webdav_url: null, webdav_username: null, webdav_has_password: false,
    folder: null, sync_root: null, device_id: "0123456789abcdef",
    device_name: "书房的 Mac", running: false, interval_seconds: 60, last_run: null,
    pending_total: 0, pending: [], peers: [],
  };
  const calls = [];
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || "GET";
    const path = new URL(`${url}`, "http://localhost").pathname;
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path, body, key: init.headers?.["X-API-Key"] });
    if (path.endsWith("/api/v1/sync") && method === "PUT") {
      if (body.folder === "/no/such/folder") return reply(400, { code: 400, message: "文件夹不存在" });
      if (typeof body.folder === "string") {
        state.folder = body.folder;
        state.sync_root = `${body.folder}/RetainPDF-Sync`;
      }
      if (body.transport) state.transport = body.transport;
      if (typeof body.webdav_url === "string") state.webdav_url = body.webdav_url;
      if (typeof body.webdav_username === "string") state.webdav_username = body.webdav_username;
      if (typeof body.webdav_password === "string") state.webdav_has_password = Boolean(body.webdav_password);
      if (state.transport === "webdav") state.sync_root = state.webdav_url;
      if (typeof body.enabled === "boolean") state.enabled = body.enabled;
      if (typeof body.device_name === "string") state.device_name = body.device_name;
    } else if (path.endsWith("/api/v1/sync/run") && method === "POST") {
      state.last_run = {
        started_at: new Date().toISOString(), finished_at: new Date().toISOString(), ok: true, error: null,
        exported: 2, applied: 5, deleted: 0, files_uploaded: 1, files_downloaded: 9, rejected: 0,
        folder_changed: false, device_renewed: false,
      };
      state.peers = [{ device_id: "fedcba9876543210", name: "办公室的 Mac", segments_read: 4 }];
    } else if (path.endsWith("/api/v1/sync/test") && method === "POST") {
      const ok = body.webdav_password === "right" || (!body.webdav_password && state.webdav_has_password);
      return reply(200, { code: 0, message: "ok", data: ok
        ? { ok: true, location: body.webdav_url, latency_ms: 2600, error: null }
        : { ok: false, location: body.webdav_url, latency_ms: null, error: "WebDAV 账号或密码不对" } });
    } else if (!(path.endsWith("/api/v1/sync") && method === "GET")) {
      return reply(404, { code: 404, message: "not found" });
    }
    return reply(200, { code: 0, message: "ok", data: { ...state } });
  };
  return { state, calls };
}

async function mountPanel(dom) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { SyncSettingsPanel } = await import("../../src/features/sync/index.js");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(SyncSettingsPanel));
  await wait(50);
  return { root, host };
}

const blur = (dom, element) => {
  element.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
};

test("选文件夹、开启、立即同步：每一步都经后端保存，结果和其它设备显示出来", async () => {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "Event", "MouseEvent", "FocusEvent", "Node", "MutationObserver", "URL"] });
  const backend = fakeBackend();
  const { root, host } = await mountPanel(dom);
  const text = () => host.textContent;
  const toggle = () => host.querySelector('[data-sync-action="toggle"]');

  await waitFor(() => text().includes("同步未开启"));
  assert.equal(toggle().disabled, true, "no folder yet: cannot turn on");
  const input = host.querySelector('input[aria-label="同步文件夹"]');
  assert.equal(host.querySelector('input[aria-label="这台电脑的名字"]').value, "书房的 Mac");

  // 后端拒绝:原因显示出来,不改状态。
  typeInput(dom, input, "/no/such/folder");
  blur(dom, input);
  await waitFor(() => text().includes("文件夹不存在"));
  assert.equal(backend.state.folder, null);

  typeInput(dom, input, "/Users/me/Library/Mobile Documents/com~apple~CloudDocs");
  blur(dom, input);
  await waitFor(() => text().includes("RetainPDF-Sync"));
  assert.equal(backend.state.folder, "/Users/me/Library/Mobile Documents/com~apple~CloudDocs");
  assert.equal(text().includes("文件夹不存在"), false, "the old error goes away");

  await waitFor(() => toggle().disabled === false);
  click(dom, toggle());
  await waitFor(() => backend.state.enabled === true && toggle().textContent === "关闭同步");

  const run = host.querySelector('[data-sync-action="run"]');
  click(dom, run);
  await waitFor(() => text().includes("已同步"));
  assert.match(text(), /收到 5 项，发出 2 项/);
  assert.match(text(), /办公室的 Mac/);

  const saved = backend.calls.filter((c) => c.method !== "GET").map((c) => [c.method, c.path, c.body]);
  assert.deepEqual(saved.map(([m, p]) => `${m} ${p}`), [
    "PUT /api/v1/sync", "PUT /api/v1/sync", "PUT /api/v1/sync", "POST /api/v1/sync/run",
  ]);
  assert.equal(saved[1][2].transport, "folder");
  assert.deepEqual(saved[2][2], { enabled: true });
  root.unmount();
  dom.window.close();
});

test("WebDAV：填地址账号密码、测试连接、保存；密码只写不读", async () => {
  const dom = makeDom("", { keys: ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "Event", "MouseEvent", "FocusEvent", "Node", "MutationObserver", "URL"] });
  const backend = fakeBackend();
  const { root, host } = await mountPanel(dom);
  const text = () => host.textContent;
  await waitFor(() => text().includes("同步未开启"));

  click(dom, host.querySelector('[data-sync-transport="webdav"]'));
  await waitFor(() => host.querySelector('input[aria-label="WebDAV 地址"]'));
  const url = host.querySelector('input[aria-label="WebDAV 地址"]');
  const user = host.querySelector('input[aria-label="WebDAV 账号"]');
  const password = host.querySelector('input[aria-label="WebDAV 密码"]');
  assert.equal(password.type, "password");
  typeInput(dom, url, "http://100.64.0.2:5005/webdav/retainpdf");
  typeInput(dom, user, "nas-user");

  // 密码错:测试连接说清楚原因。
  typeInput(dom, password, "wrong");
  await wait(10);
  click(dom, host.querySelector('[data-sync-action="test"]'));
  await waitFor(() => text().includes("账号或密码不对"));
  typeInput(dom, password, "right");
  await wait(10);
  click(dom, host.querySelector('[data-sync-action="test"]'));
  await waitFor(() => text().includes("连接正常"));
  assert.match(text(), /2\.6 秒/);
  assert.equal(backend.state.webdav_url, null, "testing does not save");

  click(dom, host.querySelector('[data-sync-action="save-webdav"]'));
  await waitFor(() => backend.state.webdav_has_password === true);
  const put = backend.calls.filter((c) => c.method === "PUT").at(-1).body;
  assert.deepEqual(put, {
    transport: "webdav",
    webdav_url: "http://100.64.0.2:5005/webdav/retainpdf",
    webdav_username: "nas-user",
    webdav_password: "right",
  });
  // 保存后密码框清空,提示已保存;再保存不带密码(不改)。
  await waitFor(() => host.querySelector('input[aria-label="WebDAV 密码"]').value === "");
  assert.equal(host.querySelector('input[aria-label="WebDAV 密码"]').placeholder, "已保存，留空不改");
  assert.equal(text().includes("right"), false);

  const toggle = host.querySelector('[data-sync-action="toggle"]');
  await waitFor(() => toggle.disabled === false);
  click(dom, toggle);
  await waitFor(() => backend.state.enabled === true);
  root.unmount();
  dom.window.close();
});
