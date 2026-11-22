import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { PROJECT_ROOT, readSource, walkSourceFiles } from "./helpers/source-scan.mjs";

// `@utility xxx` 只有在 Tailwind 从源码里扫到 `xxx` 这个词时才生成。
// 写成 `xxx${…}`（类名后面紧跟插值）扫不出来——「翻译选项」的页码范围就因为
// `translation-options-range${hidePageRange ? " hidden" : ""}` 整块样式没生成，
// 图标、标签、输入框全是浏览器默认样子（2026-11-22 修）。
// 规则：一个工具类名如果在源码里出现过「紧贴 ${」的写法，它在别处至少还要
// 单独出现一次（引号、空格、反引号包着的完整词），或者登记在入口样式的
// `@source inline(...)` 里，否则就是没生成。新写法优先把类名单独写全。

function cssFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (name.endsWith(".css")) out.push(full);
  }
  return out;
}

const CSS = cssFiles(join(PROJECT_ROOT, "src")).map((file) => readFileSync(file, "utf8"));
const UTILITIES = new Set(CSS.flatMap((css) => [...css.matchAll(/^@utility\s+([a-z0-9-]+)\s*\{/gm)].map((match) => match[1])));
// 入口样式里 `@source inline("a b c")` 登记过的类名（专门给这种写法兜底）也算扫到了。
const SAFELISTED = new Set(
  CSS.flatMap((css) => [...css.matchAll(/@source\s+inline\("([^"]*)"\)/g)].flatMap((match) => match[1].split(/\s+/))),
);

test("工具类名不能只以「紧贴 ${」的写法出现（Tailwind 扫不出来就不生成）", () => {
  assert.ok(UTILITIES.size > 100, `前提：扫到了 @utility 定义（实际 ${UTILITIES.size} 个）`);
  const glued = new Map();
  const standalone = new Set();
  for (const file of walkSourceFiles()) {
    const source = readSource(file);
    for (const match of source.matchAll(/([a-z][a-z0-9-]*[a-z0-9])\$\{/g)) {
      if (!UTILITIES.has(match[1])) continue;
      const line = source.slice(0, match.index).split("\n").length;
      if (!glued.has(match[1])) glued.set(match[1], []);
      glued.get(match[1]).push(`${file}:${line}`);
    }
    for (const match of source.matchAll(/(?<![a-z0-9-])([a-z][a-z0-9-]*[a-z0-9])(?![a-z0-9-]|\$\{)/g)) {
      if (UTILITIES.has(match[1])) standalone.add(match[1]);
    }
  }
  const missing = [...glued].filter(([name]) => !standalone.has(name) && !SAFELISTED.has(name)).map(([name, where]) => `${name}（${where.join("、")}）`);
  assert.deepEqual(missing, [], "这些类名只写成了 `类名${…}`，请把类名单独写全，例如 cond ? \"a hidden\" : \"a\"");
});
