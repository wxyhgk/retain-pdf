/** keepMounted 的面板切走 tab 时不能被卸载。
 *
 * ## 这个 bug 长什么样
 *
 * 用户报的是「从终端切换到画板会暂停对话」。实际是**整条链断在中间**：
 *
 *     keepMounted: true  →  ReaderHostPanelShell 留在树上        ✓
 *                        →  但传 open={false} 给 ReaderPanelShell
 *                        →  ReaderPanelShell 里 `if (!open) return null`  ✗
 *                        →  FxTerminal 卸载 → WebSocket 关 → PTY 被杀
 *
 * 也就是说 `keepMounted` 只让**壳组件**留在树上，壳内部又把子树整个摘了 ——
 * 终端里 `hidden={!open}` 那行和「卸载会杀掉 PTY」的注释根本没机会生效，
 * 这个字段一直是个摆设。
 *
 * 表现之所以是「暂停」而不是「消失」，是因为会话恢复会在切回来时把历史拉回来，
 * 但**正在生成的那一轮回答丢了**。
 *
 * 2026-11-03 终端（宿主槽位面板）随 RetainPDF 自己的 AI 删了，壳的 keepMounted 还在，这里守的是壳本身。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PKG = new URL("../../../packages/reader/src/", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, PKG), "utf8");

test("壳不再无条件卸载 —— keepMounted 的面板关着也留在树上", () => {
  const shell = read("components/react-pdf/ReaderPanelShell.tsx");
  assert.match(shell, /if \(!open && !keepMounted\) return null;/);
  // 无条件那行必须消失，否则里层照样推翻外层。
  assert.doesNotMatch(shell, /\n\s*if \(!open\) return null;/);
});

test("组件把 data-hidden 打上去了 —— CSS 那半边由层叠门禁守", () => {
  // 这里只管「属性有没有打上去」。**规则有没有赢下层叠是另一回事**，那条在
  // reader-hidden-panel-cascade.test.mjs 里真算层叠。
  //
  // 原来这条测试是 `css.indexOf(".reader-notes-panel[data-hidden]")` 然后对那
  // 200 个字符做正则 —— 它只证明「有人写过这条规则」。而那条规则的特异性
  // (0,2,0) 被 panel-shell.css 里同为 (0,2,0) 且排在后面的
  // `.reader-notes-panel--workspace.is-pane-right` 顶掉了，**这套隐藏从来没
  // 生效过**，而这条测试一直是绿的。和圆钮那次一模一样。
  const shell = read("components/react-pdf/ReaderPanelShell.tsx");
  assert.match(shell, /data-hidden=\{!open \? "" : undefined\}/);
});

test("藏起来的面板不参与 Tab、不被读屏念出来", () => {
  const shell = read("components/react-pdf/ReaderPanelShell.tsx");
  assert.match(shell, /inert=\{!open \? true : undefined\}/);
  assert.match(shell, /aria-hidden=\{!open \? true : undefined\}/);
});
