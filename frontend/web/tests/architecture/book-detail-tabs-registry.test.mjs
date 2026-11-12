// 书籍详情页签的登记表（docs/ops/planning/frontend-migration/20261112-功能登记表.md 第二步）。
//
// 页签外壳 BookDetailRightTabs 不知道有哪些页签，按表画。这里守：
//   1. 外壳里不写具体页签名（以前 BOOK_DETAIL_TABS 和一个页签一个参数都在外壳里）；
//   2. 书籍详情自己的页签和别的功能登记的页签，id、order 不重复（重名会两个按钮共用一个 book-detail-tab-<id>）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const code = (path) => read(path).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("页签外壳里不写具体页签", () => {
  const shell = code("../../src/features/book-detail/ui/tabs/BookDetailRightTabs.tsx");
  const leaked = ["processing", "artifacts", "quality", "terms", "history"].filter((id) => new RegExp(`["'\`]${id}["'\`]`).test(shell));
  assert.deepEqual(leaked, [], `外壳里又写了页签名：${leaked.join(", ")}`);
  assert.doesNotMatch(shell, /BOOK_DETAIL_TABS|overviewTab|processingTab|qualityTab/, "外壳里又出现了按页签写死的列表或参数");
  // "overview" 只允许作为默认停留的页签（DEFAULT_TAB 那一处）。
  assert.equal((shell.match(/["']overview["']/g) || []).length, 1, "\"overview\" 只该出现在默认页签常量");
});

test("书籍详情的页签：id、order 不重复，独立页签和别的功能登记的都列进了表", async () => {
  const { qualityBookDetailTab, termsBookDetailTab } = await import("../../src/features/book-detail/ui/tabs/standalone-tabs.jsx");
  const { EXTRA_BOOK_DETAIL_TABS } = await import("../../src/app/home/shell/book-detail-tabs.js");
  const dialog = code("../../src/features/book-detail/ui/BookDetailDialog.tsx");
  const inline = [...dialog.matchAll(/id: "([a-z-]+)", label: "[^"]+", title: "[^"]+", Icon: \w+, order: (\d+)/g)]
    .map((m) => ({ id: m[1], order: Number(m[2]) }));
  assert.deepEqual(inline.map((t) => t.id), ["overview", "processing", "artifacts", "history"], "BookDetailDialog 里就地拼的页签变了，同步改这条测试");
  const all = [...inline, qualityBookDetailTab, termsBookDetailTab, ...EXTRA_BOOK_DETAIL_TABS];
  assert.equal(new Set(all.map((t) => t.id)).size, all.length, `页签 id 重复：${all.map((t) => t.id)}`);
  assert.equal(new Set(all.map((t) => t.order)).size, all.length, `页签 order 重复：${all.map((t) => `${t.id}=${t.order}`)}`);
  assert.match(dialog, /qualityBookDetailTab,\s*termsBookDetailTab,/, "独立页签没列进 BookDetailDialog 的表");
  assert.match(dialog, /\.\.\.extraTabs/, "别的功能登记的页签没接进表");
  assert.match(read("../../src/app/home/shell/home-overlays.tsx"), /<BookDetailDialog extraTabs=\{EXTRA_BOOK_DETAIL_TABS\} \/>/, "首页没把登记表传给书籍详情");
});
