/** @retainpdf/ui 的基础组件：Button、IconButton、Field、Select、Badge、Panel、Menu、Sheet。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { waitFor } from "../helpers/async.mjs";
import { DOM_GLOBAL_KEYS, makeDom } from "../helpers/dom.mjs";

// 先装 DOM 再引组件：radix 在模块载入时判断有没有 document（没有就不跑 layout effect，Portal 永远不出来）。
// Menu 的定位（radix Popper）还要 Element 和 ResizeObserver；jsdom 没有 ResizeObserver，给个空的。
makeDom("", { keys: [...DOM_GLOBAL_KEYS, "Element", "HTMLSelectElement", "DOMRect"] });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
const { Badge, Button, Field, IconButton, Input, Menu, Panel, Select, Sheet, Textarea } = await import("@retainpdf/ui");

const html = (element) => renderToStaticMarkup(element);

test("Button 不给 variant：原样一个 type=button 的 <button>，样子全由调用方的类名决定（迁移期）", () => {
  assert.equal(html(h(Button, { className: "app-button secondary", id: "save" }, "保存")),
    '<button type="button" class="app-button secondary" id="save">保存</button>');
});

test("Button 给了 variant：ui-button + data-variant/data-size；pending 时转圈、禁用、aria-busy", () => {
  const plain = html(h(Button, { variant: "primary" }, "保存"));
  assert.match(plain, /class="ui-button"/);
  assert.match(plain, /data-variant="primary"/);
  assert.match(plain, /data-size="md"/);
  assert.doesNotMatch(plain, /disabled|aria-busy|ui-button-spinner/);
  const busy = html(h(Button, { variant: "danger", size: "sm", pending: true }, "删除"));
  assert.match(busy, /data-size="sm"/);
  assert.match(busy, /disabled=""/);
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /ui-button-spinner/);
  assert.match(html(h(Button, { variant: "secondary", type: "submit" }, "提交")), /type="submit"/);
});

test("IconButton：label 变成 aria-label 和悬停提示，默认 ghost", () => {
  const out = html(h(IconButton, { label: "关闭" }, h("svg")));
  assert.match(out, /class="ui-icon-button"/);
  assert.match(out, /aria-label="关闭"/);
  assert.match(out, /title="关闭"/);
  assert.match(out, /data-variant="ghost"/);
});

test("Field：标题 for 到控件，说明和错误接上 aria-describedby，有错时 aria-invalid", () => {
  const out = html(h(Field, { label: "名称", hint: "最多 120 字", error: "不能为空" }, h(Input, { placeholder: "例如" })));
  const id = out.match(/<input[^>]* id="([^"]+)"/)[1];
  assert.match(out, new RegExp(`<label class="ui-field-label" for="${id}">名称</label>`));
  const describedBy = out.match(/aria-describedby="([^"]+)"/)[1].split(" ");
  assert.equal(describedBy.length, 2);
  for (const part of describedBy) assert.match(out, new RegExp(`id="${part}"`));
  assert.match(out, /aria-invalid="true"/);
  assert.match(out, /role="alert">不能为空</);

  const own = html(h(Field, { label: "备注" }, h(Textarea, { id: "note", "aria-describedby": "outside" })));
  assert.match(own, /for="note"/);
  assert.match(own, /aria-describedby="outside"/);
  assert.doesNotMatch(own, /aria-invalid/);
});

test("Select：原生 <select> 加箭头；className 给外层，其余属性落在 <select> 上", () => {
  const out = html(h(Select, { className: "engine-picker", id: "engine", value: "a", onChange() {}, size: "sm" },
    h("option", { value: "a" }, "默认"), h("option", { value: "b" }, "Typst")));
  assert.match(out, /^<span class="ui-select engine-picker" data-size="sm"><select id="engine">/);
  assert.match(out, /ui-select-arrow/);
  assert.match(out, /aria-hidden="true"/);
});

test("Badge 和 Panel", () => {
  assert.equal(html(h(Badge, null, "未开始")), '<span class="ui-badge" data-tone="muted">未开始</span>');
  assert.match(html(h(Badge, { tone: "danger" }, "失败")), /data-tone="danger"/);
  const panel = html(h(Panel, { title: "备份", description: "导出全部数据", actions: h(Button, { variant: "secondary" }, "导出"), titleAs: "h2" }, h("p", null, "正文")));
  assert.match(panel, /^<section class="ui-panel"><header class="ui-panel-head">/);
  assert.match(panel, /<h2 class="ui-panel-title">备份<\/h2>/);
  assert.match(panel, /<p class="ui-panel-description">导出全部数据<\/p>/);
  assert.match(panel, /<div class="ui-panel-actions"><button/);
  assert.equal(html(h(Panel, null, "只有正文")), '<section class="ui-panel">只有正文</section>');
});

async function mount(element) {
  const { createRoot } = await import("react-dom/client");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(element);
  return { host, root, unmount: () => { root.unmount(); host.remove(); } };
}

test("Menu：打开后列出各项，选中一项调它的 onSelect；禁用的、删除的有标记", async () => {
  const picked = [];
  const { unmount } = await mount(h(Menu, {
    open: true,
    label: "批量操作",
    trigger: h(Button, { variant: "secondary" }, "更多"),
    items: [
      { key: "move", label: "移到书单", onSelect: () => picked.push("move") },
      { key: "off", label: "不可用", onSelect: () => picked.push("off"), disabled: true },
      { key: "delete", label: "删除", onSelect: () => picked.push("delete"), danger: true },
    ],
  }));
  try {
    const menu = await waitFor(() => document.querySelector(".ui-menu"), "菜单打开");
    assert.equal(menu.getAttribute("aria-label"), "批量操作");
    const items = [...menu.querySelectorAll(".ui-menu-item")];
    assert.deepEqual(items.map((item) => item.textContent), ["移到书单", "不可用", "删除"]);
    assert.equal(items[1].hasAttribute("data-disabled"), true);
    assert.equal(items[2].dataset.danger, "true");
    items[0].click();
    await waitFor(() => picked.length === 1, "选中第一项");
    assert.deepEqual(picked, ["move"]);
  } finally {
    unmount();
  }
});

test("Sheet：打开后有标题和「关闭」按钮，点关闭调 onOpenChange(false)", async () => {
  const changes = [];
  const { unmount } = await mount(h(Sheet, { open: true, onOpenChange: (open) => changes.push(open), title: "目录", side: "left", id: "toc" }, h("p", null, "第一章")));
  try {
    const sheet = await waitFor(() => document.querySelector("#toc.ui-sheet"), "抽屉打开");
    assert.equal(sheet.dataset.side, "left");
    assert.equal(sheet.querySelector(".ui-sheet-title").textContent, "目录");
    assert.equal(sheet.querySelector(".ui-sheet-body").textContent, "第一章");
    sheet.querySelector('button[aria-label="关闭"]').click();
    await waitFor(() => changes.length === 1, "关闭");
    assert.deepEqual(changes, [false]);
  } finally {
    unmount();
  }
});
