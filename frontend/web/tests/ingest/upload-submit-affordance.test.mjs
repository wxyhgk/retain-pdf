/**
 * 上传弹窗底部的两处「看起来不对」：
 *
 * 1. 未选文件时底部冒出一行 16px 无样式大字「请先选择 PDF 文件并等待上传完成，再提交任务。
 *    选择文件」，「选择文件」是浏览器默认的裸按钮 —— 全仓库没有 `.submit-hint` 的样式。
 *    缺文件这件事上方拖放区（「单个 PDF / 最大 512MB」+ 大加号）已经说清楚了，再来一行等于
 *    同一屏说两遍；所以缺文件时不再出这行，只在「文件已就绪但被凭据拦住」时出，并给它样式。
 * 2. 「直接翻译」实际 disabled，却 opacity 1、底色和可用时一样 —— 看起来能点。
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(
  new URL("../../src/features/ingest/ui/components/upload/ProcessingChoicePanel.css", import.meta.url),
  "utf8",
);

/** 取 `@utility name { ... }` 的整块（按花括号配平）。 */
function utilityBlock(name) {
  const start = css.search(new RegExp(`@utility ${name}\\s*\\{`));
  if (start < 0) return "";
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  return "";
}

/** 在一段 CSS 里取 `selector { ... }` 的直接声明（不含嵌套块）。 */
function nestedDecls(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`))?.[1] || "";
}

test("提交按钮禁用时看得出不能点：透明度降低 + not-allowed 光标", () => {
  const group = utilityBlock("upload-action-group");
  const disabled = nestedDecls(group, "& #submit-btn:disabled")
    || nestedDecls(group, "& > button:disabled");
  assert.ok(disabled, "upload-action-group 里没有任何禁用态规则");
  const opacity = Number(disabled.match(/opacity:\s*([\d.]+)/)?.[1] ?? 1);
  assert.ok(opacity < 0.7, `禁用态 opacity 是 ${opacity}，和可用时几乎一样`);
  assert.match(disabled, /cursor:\s*not-allowed/);
});

test("提示行有样式：小号灰字，动作是链接式按钮而不是裸按钮", () => {
  const hint = utilityBlock("submit-hint");
  assert.ok(hint, "没有 .submit-hint 的样式，浏览器按 16px 默认段落渲染");
  const size = Number(hint.match(/font-size:\s*([\d.]+)px/)?.[1] ?? 16);
  assert.ok(size <= 13, `提示字号 ${size}px，和正文抢视线`);
  assert.match(hint, /color:\s*var\(--muted\)/);

  const action = utilityBlock("submit-hint-action");
  assert.ok(action, "没有 .submit-hint-action 的样式，是浏览器默认灰底按钮");
  assert.match(action, /background:\s*(none|transparent)/);
  assert.match(action, /border:\s*(0|none)/);
  assert.match(action, /text-decoration(-line)?:\s*underline/);
});
