import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// GlossariesDialog(Phase 3 dialogs 群,蓝图 §3)组件级测试。
// 校验:契约 id、列表加载/选中/新建草稿、保存的名称回退与
// "固定/偏好译法缺译文"校验、CSV 导入解析、CSV 导出、refreshWorkflowGlossaries
// 反向回调断言(mock workflow 域)、handlers.reload 直调刷新。

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/index.html" });
for (const key of ["window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement", "HTMLFormElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "CustomEvent", "Event", "KeyboardEvent", "MouseEvent", "Node", "MutationObserver", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key] ?? dom.window,
    writable: true,
    configurable: true,
  });
}
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
// Radix Presence/Tabs(阶段 B 引入)在 jsdom 下需要 cancelAnimationFrame
// (TabsContent 的 mount 动画计时器清理)和 getComputedStyle(Presence 读取
// animation-name 判断退场动画是否结束)——jsdom 的 window 上有实现,只是没有
// 像 requestAnimationFrame 一样被复制到裸 global 上,这里一并补上。
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

// HomeApp.jsx 渲染 <download-toast></download-toast> 占位(蓝图 §7
// artifact-downloads 域,不在本 agent 范围),真正的自定义元素类
// (src/js/components/feedback/download-toast.js)属旧世界 js/components/**,
// architecture-boundaries 门禁禁止 src/app/** import——组件本身尚未在
// React 世界注册。这里注册一个最小 stub(仅 setState/hide 两个公开方法,
// 与真实实现的公开契约一致),隔离本域(CSV 导出)的测试,不代表已解决
// artifact-downloads 域的接线缺口(见测试文件末尾的发现说明)。
if (!dom.window.customElements.get("download-toast")) {
  dom.window.customElements.define("download-toast", class extends dom.window.HTMLElement {
    setState() {}
    hide() {}
  });
}

const { createRoot } = await import("react-dom/client");
const React = await import("react");
const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
const { HomeApp } = await import("../../src/app/home/HomeApp.jsx");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

function byId(id) {
  return dom.window.document.getElementById(id);
}

function click(element) {
  element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
}

function typeInput(element, value) {
  const proto = element.tagName === "TEXTAREA" ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function selectOption(element, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

function mockGlossaryApi(overrides = {}) {
  const calls = {
    fetchGlossaries: [],
    fetchGlossary: [],
    createGlossary: [],
    updateGlossary: [],
    deleteGlossary: [],
    exportGlossaryCsv: [],
    parseGlossaryCsv: [],
    refreshWorkflowGlossaries: [],
  };
  const state = {
    items: [{ glossary_id: "g-1", name: "量子化学术语", entry_count: 2 }],
    detail: {
      glossary_id: "g-1",
      name: "量子化学术语",
      entries: [
        { source: "Hartree-Fock", target: "", level: "preserve", match_mode: "case_insensitive", context: "", note: "保留英文" },
        { source: "density functional theory", target: "密度泛函理论", level: "canonical", match_mode: "case_insensitive", context: "", note: "" },
      ],
    },
  };
  const api = {
    fetchGlossaries: async () => {
      calls.fetchGlossaries.push(true);
      return { items: state.items };
    },
    fetchGlossary: async (glossaryId) => {
      calls.fetchGlossary.push(glossaryId);
      return state.detail;
    },
    createGlossary: async (_apiPrefix, payload) => {
      calls.createGlossary.push(payload);
      const glossary_id = "g-new";
      state.items = [...state.items, { glossary_id, name: payload.name, entry_count: payload.entries.length }];
      return { glossary_id, ...payload };
    },
    updateGlossary: async (_apiPrefix, glossaryId, payload) => {
      calls.updateGlossary.push({ glossaryId, payload });
      return { glossary_id: glossaryId, ...payload };
    },
    deleteGlossary: async (_apiPrefix, glossaryId) => {
      calls.deleteGlossary.push(glossaryId);
      state.items = state.items.filter((item) => item.glossary_id !== glossaryId);
      return { glossary_id: glossaryId, deleted: true };
    },
    exportGlossaryCsv: async (_apiPrefix, glossaryId) => {
      calls.exportGlossaryCsv.push(glossaryId);
      return {
        headers: { get: (name) => (name === "content-disposition" ? `attachment; filename="${glossaryId}.csv"` : null) },
        body: undefined,
        blob: async () => ({ size: 42, kind: "csv-blob" }),
      };
    },
    parseGlossaryCsv: async (_apiPrefix, csvText) => {
      calls.parseGlossaryCsv.push(csvText);
      return {
        entry_count: 1,
        entries: [{ source: "parsed-term", target: "解析术语", level: "canonical", match_mode: "case_insensitive", context: "", note: "" }],
      };
    },
    refreshWorkflowGlossaries: async (options) => {
      calls.refreshWorkflowGlossaries.push(options);
    },
    ...overrides,
  };
  return { api, calls, state };
}

function createServices({ glossaryOverrides = {} } = {}) {
  const { api, calls, state } = mockGlossaryApi(glossaryOverrides);
  const services = createHomeComposition({
    fetchGlossaries: api.fetchGlossaries,
    fetchGlossary: api.fetchGlossary,
    createGlossary: api.createGlossary,
    updateGlossary: api.updateGlossary,
    deleteGlossary: api.deleteGlossary,
    exportGlossaryCsv: api.exportGlossaryCsv,
    parseGlossaryCsv: api.parseGlossaryCsv,
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  // refreshWorkflowGlossaries 是 workflow 域的反向回调,composition.js 内部接的是
  // features.workflowFeature.loadGlossaryOptions——这里直接替换该函数,断言
  // GlossariesDialog 保存/删除后确实调用了它(蓝图 §3/§8 依赖矩阵的耦合点)。
  services.features.workflowFeature.loadGlossaryOptions = api.refreshWorkflowGlossaries;
  return { services, calls, state };
}

async function mountHome(services) {
  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);
  services.initialize();
  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => byId("app-shell"), "HomeApp 首帧渲染");
  await wait(0);
  return { host, root };
}

// 3a workflow 域启动时也会调 fetchGlossaries(填充术语表下拉,composition.js
// 共用同一个注入口)——本域"打开对话框触发一次列表加载"类断言不能用绝对值
// 1,要先等 workflow 那次初始加载稳定,记一个基线,后续断言用基线 +1 的相对值,
// 避免两处调用时序竞态导致断言假失败/假通过。
async function settle(services, calls) {
  const { host, root } = await mountHome(services);
  await waitFor(() => calls.fetchGlossaries.length >= 1, "workflow 域启动时的初始术语表加载稳定");
  await wait(30);
  return { host, root, glossariesBaseline: calls.fetchGlossaries.length };
}

async function openGlossariesDialog() {
  // 阶段 C(shadcn 改造):SettingsHubDialog/GlossariesDialog 换成 Radix Dialog
  // 后不 forceMount Content,关闭态下整个内容都不挂载(不再是原生
  // <dialog>.open 布尔属性),这里改用"是否挂载"判断打开态。
  click(byId("app-settings-btn"));
  await waitFor(() => byId("app-settings-dialog") !== null, "设置对话框打开");
  click(dom.window.document.querySelector('[data-settings-tab="glossary"]'));
  await wait(0);
  click(byId("glossary-btn"));
  await waitFor(() => byId("glossary-manager-dialog") !== null, "术语表对话框打开");
}

test("GlossariesDialog：契约 id、打开即刷新列表、选中态、编辑器回填(preserve 词条译文留空)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();

  for (const id of [
    "glossary-close-btn", "glossary-new-btn", "glossary-list", "glossary-list-empty",
    "glossary-name", "glossary-add-row-btn", "glossary-import-btn", "glossary-export-btn",
    "glossary-delete-btn", "glossary-entries", "glossary-entries-empty", "glossary-import-panel",
    "glossary-csv-text", "glossary-import-apply-btn", "glossary-import-cancel-btn",
    "glossary-status", "glossary-save-btn",
  ]) {
    assert.ok(byId(id), `契约 id 缺失：#${id}`);
  }

  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "打开对话框触发一次列表加载");
  await waitFor(() => byId("glossary-name").value === "量子化学术语", "自动选中首条并回填编辑器");
  assert.equal(calls.fetchGlossary.length, 1, "自动选中触发一次详情加载");

  const listButtons = byId("glossary-list").querySelectorAll("button");
  assert.equal(listButtons.length, 1);
  assert.equal(listButtons[0].classList.contains("is-active"), true, "首条自动选中态");

  // preserve 词条(Hartree-Fock)的译文输入框应保持"留空"展示(不是自动回填
  // source),回填语义只发生在保存时的读取阶段——见 glossaries-store.js 头注释
  // readEditorPayloadFromDraft,抄自 src/js/features/glossaries/view.js:165。
  const sourceInputs = byId("glossary-entries").querySelectorAll(".glossary-entry-source");
  const targetInputs = byId("glossary-entries").querySelectorAll(".glossary-entry-target");
  assert.equal(sourceInputs[0].value, "Hartree-Fock");
  assert.equal(targetInputs[0].value, "", "preserve 词条译文展示态留空,不提前回填 source");
  assert.equal(targetInputs[1].value, "密度泛函理论");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog：新建草稿 + preserve 保存时用 source 回填空译文(风险 1 语义)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "打开对话框触发一次列表加载");

  click(byId("glossary-new-btn"));
  await waitFor(() => byId("glossary-name").value === "未命名术语表", "新建草稿回填默认名称");

  const sourceInput = byId("glossary-entries").querySelector(".glossary-entry-source");
  assert.ok(sourceInput, "新建草稿自动带一行空白词条");
  typeInput(sourceInput, "Hartree-Fock");
  // level 默认已是 preserve,不需要切换 select。

  click(byId("glossary-save-btn"));
  await waitFor(() => calls.createGlossary.length === 1, "保存触发 createGlossary");
  assert.deepEqual(calls.createGlossary[0].entries, [{
    source: "Hartree-Fock",
    target: "Hartree-Fock",
    level: "preserve",
    match_mode: "case_insensitive",
    context: "",
    note: "",
  }], "preserve 词条译文留空时,保存时用 source 回填(抄自 view.js:165)");

  await waitFor(() => calls.refreshWorkflowGlossaries.length === 1, "保存后回调 workflow 域刷新");
  assert.equal(calls.refreshWorkflowGlossaries[0].force, true);

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog：非 preserve 词条缺译文时保存被拦截(校验)", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "打开对话框触发一次列表加载");

  click(byId("glossary-new-btn"));
  await waitFor(() => byId("glossary-name").value === "未命名术语表", "新建草稿");

  const sourceInput = byId("glossary-entries").querySelector(".glossary-entry-source");
  const levelSelect = byId("glossary-entries").querySelector(".glossary-entry-level");
  typeInput(sourceInput, "density functional theory");
  selectOption(levelSelect, "canonical");
  // 译文(target)保持留空。

  click(byId("glossary-save-btn"));
  await waitFor(() => byId("glossary-status").textContent === "固定译法/偏好译法需要填写译文。", "校验拦截提示");
  assert.equal(byId("glossary-status").classList.contains("is-error"), true);
  assert.equal(calls.createGlossary.length, 0, "校验未通过不应调用保存接口");

  const targetInput = byId("glossary-entries").querySelector(".glossary-entry-target");
  typeInput(targetInput, "密度泛函理论");
  click(byId("glossary-save-btn"));
  await waitFor(() => calls.createGlossary.length === 1, "补齐译文后保存成功");
  assert.equal(calls.createGlossary[0].entries[0].target, "密度泛函理论");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog：CSV 导入解析替换草稿词条", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "打开对话框触发一次列表加载");
  await waitFor(() => byId("glossary-name").value === "量子化学术语", "自动选中首条");

  click(byId("glossary-import-btn"));
  await waitFor(() => byId("glossary-import-panel").classList.contains("hidden") === false, "导入面板打开");

  typeInput(byId("glossary-csv-text"), "parsed-term,解析术语,canonical,case_insensitive,");
  click(byId("glossary-import-apply-btn"));

  await waitFor(() => calls.parseGlossaryCsv.length === 1, "触发 CSV 解析");
  await waitFor(() => byId("glossary-import-panel").classList.contains("hidden") === true, "解析成功后导入面板收起");
  await waitFor(() => byId("glossary-entries").querySelectorAll(".glossary-entry-row").length === 1, "词条替换为解析结果");
  assert.equal(byId("glossary-entries").querySelector(".glossary-entry-source").value, "parsed-term");
  assert.equal(byId("glossary-csv-text").value, "", "解析成功后清空 CSV 文本框");
  assert.match(byId("glossary-status").textContent, /已解析 1 条/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog：CSV 导出调用 exportGlossaryCsv 并提示成功", async () => {
  const previousURL = globalThis.URL;
  globalThis.URL = class extends previousURL {
    static createObjectURL() { return "blob:mock-glossary-export"; }
    static revokeObjectURL() {}
  };

  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "打开对话框触发一次列表加载");
  await waitFor(() => byId("glossary-name").value === "量子化学术语", "自动选中首条");

  click(byId("glossary-export-btn"));
  await waitFor(() => calls.exportGlossaryCsv.length === 1, "触发导出请求");
  assert.equal(calls.exportGlossaryCsv[0], "g-1");
  await waitFor(() => /^已导出 g-1\.csv。$/.test(byId("glossary-status").textContent), "导出成功提示");
  assert.equal(byId("glossary-status").classList.contains("is-valid"), true);

  root.unmount();
  services.dispose();
  host.remove();
  globalThis.URL = previousURL;
});

test("GlossariesDialog：直接调 handlers.reload 触发列表重新加载", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "打开对话框触发一次列表加载");

  // refreshGlossaries 事件已删（0 生产派发）：外部刷新直调 handlers.reload()
  await services.glossaries.view.handlersRef.current.reload();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 2, "handlers.reload 触发重新加载");

  root.unmount();
  services.dispose();
  host.remove();
});

test("GlossariesDialog：删除当前术语表回调 workflow 域刷新", async () => {
  const { services, calls } = createServices();
  const { host, root, glossariesBaseline } = await settle(services, calls);

  await openGlossariesDialog();
  await waitFor(() => calls.fetchGlossaries.length === glossariesBaseline + 1, "打开对话框触发一次列表加载");
  await waitFor(() => byId("glossary-name").value === "量子化学术语", "自动选中首条");

  click(byId("glossary-delete-btn"));
  await waitFor(() => calls.deleteGlossary.length === 1, "触发删除请求");
  assert.equal(calls.deleteGlossary[0], "g-1");
  await waitFor(() => calls.refreshWorkflowGlossaries.some((options) => options.selectedId === ""), "删除后回调 workflow 域刷新(selectedId 清空)");

  root.unmount();
  services.dispose();
  host.remove();
});
