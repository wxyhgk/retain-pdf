/** 提问窗包（frontend/packages/ask，@retainpdf/ask）的边界：它能整个交给别人（或别的 AI）改，靠的是这几条。
 *
 * 1. 包里不认识宿主：不引阅读器、web、API 包，相对路径不出 src/。
 * 2. 宿主只从出口引：`@retainpdf/ask`（类型）、`/window`（窗口）、`/acp`（连 ACP）；不许伸进 src/、dist/ 的深处。
 * 3. ACP SDK 只在提问窗包里用；阅读器一行都不引，web 只许 `import type`（演示模式的假 agent 要类型）。
 * 4. 包里自己写的文件（照搬的 src/ui/ 不算）每个不超过 380 行，和 web 的模块大小门禁一样。
 * 说明见 frontend/packages/ask/README.md。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = fileURLToPath(new URL("../../../", import.meta.url));
const ASK_SRC = join(FRONTEND, "packages/ask/src");
const READER_SRC = join(FRONTEND, "packages/reader/src");
const WEB_SRC = join(FRONTEND, "web/src");
const ASK_EXPORTS = new Set(["@retainpdf/ask", "@retainpdf/ask/window", "@retainpdf/ask/acp"]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** 文件里所有 import / export from / import() 的目标，带是不是 import type。 */
function specifiers(file) {
  const source = readFileSync(file, "utf8");
  const found = [];
  for (const match of source.matchAll(/^\s*(import|export)\s+(type\s+)?[^;]*?\bfrom\s+["']([^"']+)["']/gm)) found.push({ spec: match[3], typeOnly: Boolean(match[2]) });
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) found.push({ spec: match[1], typeOnly: false });
  for (const match of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) found.push({ spec: match[1], typeOnly: false });
  return found;
}

test("提问窗包不认识宿主：不引阅读器、web、API 包，相对路径不出 src/", () => {
  const bad = [];
  for (const file of walk(ASK_SRC)) {
    for (const { spec } of specifiers(file)) {
      if (/^@retainpdf\/(reader|api|domain|whiteboard|contracts)\b/.test(spec) || spec.startsWith("@/")) bad.push(`${relative(FRONTEND, file)} → ${spec}`);
      if (spec.startsWith(".") && !resolve(dirname(file), spec).startsWith(ASK_SRC)) bad.push(`${relative(FRONTEND, file)} → ${spec}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("宿主只从出口引提问窗包（@retainpdf/ask、/window、/acp），不伸进 src/、dist/", () => {
  const bad = [];
  for (const file of [...walk(READER_SRC), ...walk(WEB_SRC)]) {
    for (const { spec } of specifiers(file)) {
      if (spec.startsWith("@retainpdf/ask") && !ASK_EXPORTS.has(spec)) bad.push(`${relative(FRONTEND, file)} → ${spec}`);
      if (spec.includes("packages/ask/")) bad.push(`${relative(FRONTEND, file)} → ${spec}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("ACP SDK 只在提问窗包里用：阅读器不引，web 只许 import type", () => {
  const bad = [];
  for (const file of walk(READER_SRC)) {
    for (const { spec } of specifiers(file)) if (spec.startsWith("@agentclientprotocol/")) bad.push(`${relative(FRONTEND, file)} → ${spec}`);
  }
  for (const file of walk(WEB_SRC)) {
    for (const { spec, typeOnly } of specifiers(file)) if (spec.startsWith("@agentclientprotocol/") && !typeOnly) bad.push(`${relative(FRONTEND, file)} → ${spec}（不是 import type）`);
  }
  assert.deepEqual(bad, []);
});

test("提问窗包里自己写的文件不超过 380 行（照搬的 src/ui/ 不算）", () => {
  const over = walk(ASK_SRC)
    .filter((file) => !file.startsWith(join(ASK_SRC, "ui")))
    .map((file) => [relative(FRONTEND, file), readFileSync(file, "utf8").split("\n").length])
    .filter(([, lines]) => lines > 380);
  assert.deepEqual(over, []);
});

// 2026-11-27 用户「ai 问答存在巨大的问题，很卡」：照搬的 shadcn 头像用了 group-has-…/avatar-group，生成 `:is(.x:has(…) *)`——
// 「某个祖先 :has() 时它下面所有元素」。有这种规则，页面任何地方加减节点浏览器都要重查整棵树：开着提问窗翻书，pdf.js 文字层每加一个字块
// 就把窗口里几千个节点重算一遍，滚动一下卡 1–2 秒（贴右边时整页重排，最长一帧 5 秒）。拿掉以后 ~80ms。
test("打出来的 CSS（dist/css/ 每一份）里没有「:has() 祖先下面所有元素」这种规则（翻书时会把提问窗整棵树重算）", () => {
  const cssDir = fileURLToPath(new URL("../../dist/css/", import.meta.url));
  const bad = readdirSync(cssDir).filter((name) => name.endsWith(".css")).flatMap((name) => {
    const css = readFileSync(join(cssDir, name), "utf8");
    return [...css.matchAll(/[^{}]*:has\([^{}]*\)\s*\*\)?[^{}]*\{/g)].map((match) => `${name}: ${match[0].trim().slice(0, 140)}`);
  });
  assert.deepEqual(bad, [], "group-has-*/…、has-[…]: 之类后面跟后代 * 的写法会生成它，换成元素自己的 data-* 属性");
  const sources = walk(ASK_SRC).filter((file) => /group-has-/.test(readFileSync(file, "utf8")));
  assert.deepEqual(sources.map((file) => relative(FRONTEND, file)), [], "源码里不写 group-has-（Tailwind 扫到类名就生成规则，没用到的组件也算）");
});

test("ask.css 顶层没有写两处的选择器（2026-11-27：加功能往文件末尾追加同一个选择器，靠先后顺序覆盖，出过 dock 被思考发光盖掉、整段规则被复制一份）", () => {
  const css = readFileSync(new URL("../../../packages/ask/styles/ask.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const seen = new Map();
  let depth = 0;
  let start = 0;
  for (let index = 0; index < css.length; index += 1) {
    if (css[index] === "{") {
      if (depth === 0) {
        const prelude = css.slice(start, index).trim().replace(/\s+/g, " ");
        if (!prelude.startsWith("@")) seen.set(prelude, (seen.get(prelude) || 0) + 1);
      }
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) start = index + 1;
    }
  }
  const twice = [...seen].filter(([, count]) => count > 1).map(([prelude]) => prelude);
  assert.deepEqual(twice, [], `这些选择器在 ask.css 顶层写了不止一处，并到一处：${twice.join("、")}`);
});
