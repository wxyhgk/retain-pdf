// 设置弹窗的分栏表（docs/ops/planning/frontend-migration/20261112-功能登记表.md）。
//
// 外壳 SettingsDialog 不知道有哪些分栏，分栏由各功能登记、装配层 app/home/shell/settings-sections.tsx 列表。
// 这里守两件事：
//   1. 外壳里不出现具体分栏的名字——以前 TABS、PANE_HEADS、九个 *PanelSlot 都写在外壳里，每加一个功能就改一次；
//      防止又写回去。
//   2. 功能登记的分栏 id、order 不重复，图标和内容都给了（重名会让两栏共用一个 data-settings-tab，点哪个都乱）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("设置外壳里不写具体分栏", () => {
  const shell = read("../../src/features/settings/ui/SettingsDialog.tsx")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const ids = ["account", "admin", "api", "glossary", "usage", "sync", "lan-share", "backup", "notify", "appearance", "update"];
  const leaked = ids.filter((id) => new RegExp(`["'\`]${id}["'\`]`).test(shell) && id !== "api");
  assert.deepEqual(leaked, [], `外壳里又写了分栏名：${leaked.join(", ")}（加到功能的 settings-section 和装配层的表里）`);
  assert.doesNotMatch(shell, /PanelSlot|PANE_HEADS|\bTABS\b/, "外壳里又出现了按分栏写死的参数或列表");
  // api 只允许作为「打开时没指定分栏就停在接口设置」的默认值出现。
  assert.equal((shell.match(/["']api["']/g) || []).length, 2, "\"api\" 只该出现在打开时的默认分栏");
});

test("功能登记的分栏：id、order 不重复，图标和内容都有", async () => {
  const sections = [
    (await import("../../src/features/sync/index.js")).syncSettingsSection,
    (await import("../../src/features/lan-share/index.js")).lanShareSettingsSection,
    (await import("../../src/features/backup/index.js")).backupSettingsSection,
    (await import("../../src/features/usage/index.js")).usageSettingsSection,
    (await import("../../src/features/notify/index.js")).notifySettingsSection,
    (await import("../../src/features/settings/index.js")).appearanceSettingsSection,
  ];
  for (const section of sections) {
    assert.ok(section?.id && section.label, "分栏要有 id 和 label");
    assert.equal(typeof section.Icon, "function", `${section.id} 没有图标`);
    assert.equal(typeof section.render, "function", `${section.id} 没有内容`);
    assert.ok(Number.isFinite(section.order), `${section.id} 没有 order`);
  }
  // 装配层自己拼的那几栏占用的 id、order（settings-sections.tsx）。
  const appIds = ["account", "admin", "api", "glossary", "update"];
  const appOrders = [10, 20, 30, 40, 100];
  const ids = [...appIds, ...sections.map((s) => s.id)];
  const orders = [...appOrders, ...sections.map((s) => s.order)];
  assert.equal(new Set(ids).size, ids.length, `分栏 id 重复：${ids}`);
  assert.equal(new Set(orders).size, orders.length, `分栏 order 重复：${orders}`);
  const table = read("../../src/app/home/shell/settings-sections.tsx");
  for (const section of sections) {
    const name = `${section.id.replace(/-(\w)/g, (_, c) => c.toUpperCase())}SettingsSection`;
    assert.match(table, new RegExp(`\\b${name}\\b`), `${name} 没列进 settings-sections.tsx 的表`);
  }
  for (const [id, order] of appIds.map((id, i) => [id, appOrders[i]])) {
    assert.match(table, new RegExp(`id: "${id}",[\\s\\S]{0,200}?order: ${order},`), `装配层的 ${id} 分栏 order 变了，同步改这条测试`);
  }
});
