import test from "node:test";
import assert from "node:assert/strict";
import { deferred, wait, waitFor as waitForBase } from "../helpers/async.mjs";
import { byId, click, makeDom } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";

// AppUpdateBanner(Phase 3 dialogs 群,蓝图 §5)组件级测试。
// 校验:契约 id、启动缓存命中/未命中两条路径、手动检查
// loading/成功/失败三态、formatReleaseNotes 渲染断言、SettingsDialog
// "更新"tab 的按钮 + 详情 dialog 合并挂载、AppShellHeader 不再残留旧模板。

const dom = makeDom();
globalThis.localStorage = dom.window.localStorage;

const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");

// 本文件原来的 waitFor 就是 3 秒超时，迁到共用 helper 后保持不变。
const waitFor = (predicate, description) => waitForBase(predicate, description, 3000);

function memoryCachePort(initial = { info: null, fresh: false }) {
  let value = initial;
  return {
    read: () => value,
    write: (info) => { value = { info, fresh: true }; },
  };
}

// 阶段 C(shadcn 改造):SettingsDialog/AppUpdateBanner 详情 dialog 换成
// Radix Dialog 后不 forceMount Content,关闭态下整个内容都不挂载(不再是
// 原生 <dialog>.open 布尔属性),下面全部改用"是否挂载"判断打开态。
async function openUpdateTab() {
  click(dom, byId(dom, "app-settings-btn"));
  await waitFor(() => byId(dom, "app-settings-dialog") !== null, "设置对话框打开");
  click(dom, dom.window.document.querySelector('[data-settings-tab="update"]'));
  await wait(0);
}

async function openUpdateDialog() {
  await openUpdateTab();
  click(dom, byId(dom, "app-update-btn"));
  await waitFor(() => byId(dom, "app-update-dialog") !== null, "更新详情对话框打开");
}

test("AppUpdateBanner：契约 id、AppShellHeader 不再残留重复模板", async () => {
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: false,
  });
  const { host, root } = await bootHomeApp(dom, { services });

  // "app-update-dialog"/"app-update-status"/"app-update-check-btn" 挂在
  // AppUpdateBanner 自己的详情 dialog(本地 useAppUpdateDialogOpen 驱动的
  // Radix Dialog,阶段 C 换血后不 forceMount)下,只有点开"检查更新"按钮之后
  // 才存在于 DOM——用 openUpdateDialog() 而不是 openUpdateTab(),把这一层
  // 触发也做了才符合"契约 id 逐一存在"的断言前提。
  await openUpdateDialog();
  for (const id of ["app-update-btn", "app-update-dialog", "app-update-status", "app-update-check-btn"]) {
    assert.ok(byId(dom, id), `契约 id 缺失：#${id}`);
  }
  // 唯一性:AppShellHeader 旧骨架清理后,#app-update-dialog 只应存在一份
  // (蓝图 §5:重复 id 会违反视觉基线/门禁)。
  assert.equal(dom.window.document.querySelectorAll("#app-update-dialog").length, 1);
  assert.equal(dom.window.document.querySelectorAll("#app-update-btn").length, 1);

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner：composition 默认关闭自动检查(测试隔离,不真连网络)", async () => {
  let fetchCalled = false;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    // 不传 appUpdateAutoCheckEnabled——验证默认值就是安全的(false)。
    fetchLatestRelease: async () => {
      fetchCalled = true;
      return { tag_name: "v9999.0.0" };
    },
    appUpdateCachePort: memoryCachePort({ info: null, fresh: false }),
  });
  const { host, root } = await bootHomeApp(dom, { services });
  await openUpdateTab();

  await wait(1400);
  assert.equal(fetchCalled, false, "默认(未显式开启)不应触发后台自检网络请求");
  assert.equal(byId(dom, "app-update-btn").dataset.updateState, "idle");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner：启动缓存命中(fresh)直接展示,不发起网络请求", async () => {
  let fetchCalled = false;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    fetchLatestRelease: async () => {
      fetchCalled = true;
      return { tag_name: "v9999.0.0" };
    },
    appUpdateCachePort: memoryCachePort({
      fresh: true,
      info: {
        checkedAt: Date.now(),
        currentVersion: "1.0.0",
        latestVersion: "9.9.9",
        hasUpdate: true,
        title: "RetainPDF 9.9.9",
        body: "## 新版本\n- 修复已知问题",
        htmlUrl: "https://example.com/releases/9.9.9",
      },
    }),
  });
  const { host, root } = await bootHomeApp(dom, { services });
  await openUpdateTab();

  await waitFor(() => byId(dom, "app-update-btn").dataset.updateState === "available", "缓存命中直接展示 available 态");
  assert.equal(byId(dom, "app-update-btn").classList.contains("has-update"), true);

  click(dom, byId(dom, "app-update-btn"));
  await waitFor(() => byId(dom, "app-update-dialog") !== null, "打开详情对话框");
  assert.match(byId(dom, "app-update-dialog").querySelector("h2").textContent, /RetainPDF 9\.9\.9/);
  assert.equal(byId(dom, "app-update-dialog").querySelector("p").textContent, "当前 1.0.0 · 最新 9.9.9");
  assert.equal(byId(dom, "app-update-dialog").querySelector(".app-update-link").classList.contains("hidden"), false);

  await wait(1400);
  assert.equal(fetchCalled, false, "缓存新鲜时跳过后台自检网络请求");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner：启动缓存未命中,1200ms 后台自检并落存 store", async () => {
  const cachePort = memoryCachePort({ info: null, fresh: false });
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    fetchLatestRelease: async () => ({ tag_name: "v0.0.1", name: "RetainPDF 0.0.1", body: "patch", html_url: "https://example.com/releases/0.0.1" }),
    appUpdateCachePort: cachePort,
  });
  const { host, root } = await bootHomeApp(dom, { services });
  await openUpdateTab();

  assert.equal(byId(dom, "app-update-btn").dataset.updateState, "idle", "后台定时器触发前维持 idle 态");
  await waitFor(() => byId(dom, "app-update-btn").dataset.updateState !== "idle", "1200ms 后台自检完成状态迁移");
  assert.equal(cachePort.read().fresh, true, "自检结果写回缓存");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner：手动检查 loading → 成功(available/latest)三态与 formatReleaseNotes 渲染", async () => {
  const check1 = deferred();
  let callCount = 0;
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    // fresh 缓存跳过后台自检定时器,只测手动点击路径。
    appUpdateCachePort: memoryCachePort({ fresh: true, info: { checkedAt: Date.now(), currentVersion: "1.0.0", latestVersion: "1.0.0", hasUpdate: false } }),
    fetchLatestRelease: async () => {
      callCount += 1;
      return check1.promise;
    },
  });
  const { host, root } = await bootHomeApp(dom, { services });
  await openUpdateDialog();

  click(dom, byId(dom, "app-update-check-btn"));
  await waitFor(() => byId(dom, "app-update-btn").dataset.updateState === "checking", "手动检查进入 loading 态");
  assert.equal(byId(dom, "app-update-status").classList.contains("hidden"), false);
  assert.equal(byId(dom, "app-update-status").textContent, "正在检查 GitHub Releases...");
  assert.equal(byId(dom, "app-update-dialog").querySelector("h2").textContent, "正在检查更新");

  check1.resolve({
    // Keep this fixture newer than the generated local build version（版本号 2026-11-22 起按日期，99.0.0 已经比它旧）。
    tag_name: "v9999.0.0",
    name: "RetainPDF 9999.0.0",
    body: "## 新版本说明\n- 修复状态显示\n**重要**：请升级\n`fix-1`",
    html_url: "https://example.com/releases/9999.0.0",
  });
  await waitFor(() => byId(dom, "app-update-btn").dataset.updateState === "available", "解析后进入 available 态");
  assert.equal(byId(dom, "app-update-btn").classList.contains("has-update"), true);
  assert.equal(callCount, 1);

  // formatReleaseNotes 渲染断言:标题井号剥离、列表项转 •、粗体/代码去标记。
  const notesText = byId(dom, "app-update-dialog").querySelector(".app-update-notes").textContent;
  assert.equal(notesText, "新版本说明\n• 修复状态显示\n重要：请升级\nfix-1");

  root.unmount();
  services.dispose();
  host.remove();
});

test("AppUpdateBanner：手动检查失败态展示错误信息", async () => {
  const check1 = deferred();
  const services = createHomeComposition({
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
    appUpdateAutoCheckEnabled: true,
    appUpdateCachePort: memoryCachePort({ fresh: true, info: { checkedAt: Date.now(), currentVersion: "1.0.0", latestVersion: "1.0.0", hasUpdate: false } }),
    fetchLatestRelease: async () => check1.promise,
  });
  const { host, root } = await bootHomeApp(dom, { services });
  await openUpdateDialog();

  click(dom, byId(dom, "app-update-check-btn"));
  await waitFor(() => byId(dom, "app-update-btn").dataset.updateState === "checking", "手动检查进入 loading 态");

  check1.reject(new Error("网络不可达"));
  await waitFor(() => byId(dom, "app-update-btn").dataset.updateState === "error", "失败后进入 error 态");
  assert.equal(byId(dom, "app-update-btn").classList.contains("has-update"), false);
  assert.equal(byId(dom, "app-update-status").textContent, "检查失败");
  assert.equal(byId(dom, "app-update-dialog").querySelector(".app-update-notes").textContent, "网络不可达");

  root.unmount();
  services.dispose();
  host.remove();
});
