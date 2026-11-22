// 桌面端自动更新（electron-updater，2026-11-22）：Windows / Mac 打包版的「检查更新」走主进程，
// 后台下载，下好以后弹窗里给「重启并更新」；后台检查出错不打扰；Linux deb、旧版桌面壳、网页端
// （主进程说不支持或没有这条命令）照旧查 GitHub Releases。
import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor as waitForBase } from "../helpers/async.mjs";
import { byId, click, makeDom } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";

const dom = makeDom();
globalThis.localStorage = dom.window.localStorage;

const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");

const waitFor = (predicate, description) => waitForBase(predicate, description, 3000);

function fakeDesktopUpdater(initial = { supported: true, state: "idle", currentVersion: "2026.11.22" }) {
  let listener = null;
  const calls = { check: 0, install: 0 };
  let nextCheck = { ...initial, state: "latest", version: "2026.11.22" };
  return {
    calls,
    push(status) { listener?.({ ...initial, ...status }); },
    setNextCheck(status) { nextCheck = { ...initial, ...status }; },
    port: {
      status: async () => initial,
      check: async () => { calls.check += 1; return nextCheck; },
      install: async () => { calls.install += 1; return { ok: true }; },
      onStatus: (callback) => { listener = callback; return () => { listener = null; }; },
    },
  };
}

async function openUpdateDialog() {
  click(dom, byId(dom, "app-settings-btn"));
  await waitFor(() => byId(dom, "app-settings-dialog") !== null, "设置对话框打开");
  click(dom, dom.window.document.querySelector('[data-settings-tab="update"]'));
  await wait(0);
  click(dom, byId(dom, "app-update-btn"));
  await waitFor(() => byId(dom, "app-update-dialog") !== null, "更新详情对话框打开");
}

function boot(desktopUpdater, fetchLatestRelease = async () => { throw new Error("桌面自动更新接管时不该查 GitHub"); }) {
  return createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    appUpdateCachePort: { read: () => ({ info: null, fresh: false }), write: () => {} },
    fetchLatestRelease,
    desktopUpdater,
  });
}

test("桌面自动更新：检查走主进程，下载中显示进度，下好以后给「重启并更新」，点了才装", async () => {
  const updater = fakeDesktopUpdater();
  const services = boot(updater.port);
  const { host, root } = await bootHomeApp(dom, { services });
  try {
    await services.features.appUpdateFeature.desktopReady;
    await openUpdateDialog();
    assert.equal(byId(dom, "app-update-install-btn"), null, "还没下好不给安装");

    updater.setNextCheck({ state: "downloading", version: "2026.11.23", percent: 0 });
    click(dom, byId(dom, "app-update-check-btn"));
    await waitFor(() => updater.calls.check === 1, "检查交给主进程");
    updater.push({ state: "downloading", version: "2026.11.23", percent: 42 });
    await waitFor(() => /正在下载新版本 42%/.test(byId(dom, "app-update-status")?.textContent || ""), "下载进度");
    assert.equal(byId(dom, "app-update-btn").dataset.updateState, "available");

    updater.push({ state: "downloaded", version: "2026.11.23", notes: "修复若干问题" });
    await waitFor(() => byId(dom, "app-update-install-btn"), "下好以后出现「重启并更新」");
    assert.match(byId(dom, "app-update-status").textContent, /重启即可更新/);
    assert.match(byId(dom, "app-update-dialog").textContent, /2026\.11\.23/);
    assert.equal(updater.calls.install, 0, "不点不装");
    click(dom, byId(dom, "app-update-install-btn"));
    await waitFor(() => updater.calls.install === 1, "点了才装");
  } finally {
    root.unmount();
    services.dispose();
    host.remove();
  }
});

test("桌面自动更新：后台检查出错不打扰；自己点的检查出错才显示", async () => {
  const updater = fakeDesktopUpdater();
  const services = boot(updater.port);
  const { host, root } = await bootHomeApp(dom, { services });
  try {
    await services.features.appUpdateFeature.desktopReady;
    updater.push({ state: "checking" });
    updater.push({ state: "error", error: "net::ERR_INTERNET_DISCONNECTED" });
    await wait(20);
    await openUpdateDialog();
    assert.notEqual(byId(dom, "app-update-btn").dataset.updateState, "error", "后台检查失败不改按钮");
    assert.doesNotMatch(byId(dom, "app-update-dialog").textContent, /ERR_INTERNET_DISCONNECTED/);

    updater.setNextCheck({ state: "error", error: "GitHub 限流" });
    click(dom, byId(dom, "app-update-check-btn"));
    await waitFor(() => byId(dom, "app-update-btn").dataset.updateState === "error", "手动检查失败才显示");
    assert.match(byId(dom, "app-update-dialog").textContent, /GitHub 限流/);
  } finally {
    root.unmount();
    services.dispose();
    host.remove();
  }
});

test("主进程说不支持（Linux deb）或旧版桌面壳没有这条命令：照旧查 GitHub Releases", async () => {
  for (const status of [
    async () => ({ supported: false, state: "idle" }),
    async () => { throw new Error("unsupported desktop command: update_status"); },
  ]) {
    let githubCalls = 0;
    const updater = fakeDesktopUpdater();
    updater.port.status = status;
    const services = boot(updater.port, async () => {
      githubCalls += 1;
      return { tag_name: "v9999.0.0", name: "RetainPDF 9999.0.0", body: "", html_url: "https://example.com/r" };
    });
    const { host, root } = await bootHomeApp(dom, { services });
    try {
      await services.features.appUpdateFeature.desktopReady;
      await waitFor(() => githubCalls === 1, "启动后自检走 GitHub");
      assert.equal(updater.calls.check, 0);
      await openUpdateDialog();
      assert.equal(byId(dom, "app-update-install-btn"), null);
    } finally {
      root.unmount();
      services.dispose();
      host.remove();
    }
  }
});
