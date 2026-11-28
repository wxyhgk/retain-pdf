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

/** 提问窗样式（2026-11-27 起按组件拆在 styles/ask/ 下，styles/ask.css 只按顺序 @import）。 */
const ASK_STYLE_DIR = new URL("../../../packages/ask/styles/ask/", import.meta.url);

function askStyleFiles() {
  return readdirSync(ASK_STYLE_DIR).filter((name) => name.endsWith(".css")).sort()
    .map((name) => ({ name, css: readFileSync(new URL(name, ASK_STYLE_DIR), "utf8").replace(/\/\*[\s\S]*?\*\//g, "") }));
}

/** 顶层（不在 @media 里）的规则：选择器 → 次数。 */
function topLevelPreludes(css) {
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
  return seen;
}

test("ask.css 只按顺序引入 styles/ask/ 下的几份，ask/ 下每一份都被引入了", () => {
  const index = readFileSync(new URL("../../../packages/ask/styles/ask.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const imported = [...index.matchAll(/@import "\.\/ask\/([\w-]+\.css)";/g)].map((match) => match[1]);
  assert.equal(index.replace(/@import "[^"]+";/g, "").trim(), "", "ask.css 里只放 @import，规则写进 ask/ 下对应的那份");
  assert.deepEqual([...imported].sort(), askStyleFiles().map((file) => file.name), "ask/ 下有没被引入的，或引了不存在的");
});

test("提问窗每个组件的类名只在自己那一份里当主角（2026-11-27：以前一整份，别的组件的样式顺手写在一起，靠先后顺序互相覆盖）", () => {
  // 「主角」= 选择器最后那一段里的类（.ask-panel .aui-md-p 里 .ask-panel 只是范围，不算）。
  const owner = new Map();
  for (const { name, css } of askStyleFiles()) {
    for (const match of css.matchAll(/([^{}@;]+)\{/g)) {
      const prelude = match[1].trim();
      if (/^(from|to|\d+%)/.test(prelude)) continue;
      for (const selector of prelude.split(",")) {
        const parts = selector.trim().split(/\s*[>+~\s]\s*/).filter(Boolean);
        for (const klass of (parts.at(-1) || "").match(/\.[a-zA-Z][\w-]*/g) || []) {
          if (!owner.has(klass)) owner.set(klass, new Set());
          owner.get(klass).add(name);
        }
      }
    }
  }
  const shared = [...owner].filter(([, files]) => files.size > 1).map(([klass, files]) => `${klass}（${[...files].join("、")}）`);
  assert.deepEqual(shared, [], `这些类在几份里都当主角，挪到它组件的那一份：${shared.join("；")}`);
});

test("提问窗每一份样式顶层没有写两处的选择器（2026-11-27：加功能往文件末尾追加同一个选择器，靠先后顺序覆盖，出过 dock 被思考发光盖掉、整段规则被复制一份）", () => {
  for (const { name, css } of askStyleFiles()) {
    const twice = [...topLevelPreludes(css)].filter(([, count]) => count > 1).map(([prelude]) => prelude);
    assert.deepEqual(twice, [], `${name} 里这些选择器写了不止一处，并到一处：${twice.join("、")}`);
  }
});

test("提问窗的样式不从外面改照搬组件（2026-11-27）：不写 .aui-*（自己的思考滑块 .aui-effort-* 除外）、[data-slot]、[cmdk-*]、Radix 弹层外壳、Tailwind 工具类、!important", () => {
  const banned = [
    [/\.aui-(?!effort)[a-z]/, ".aui-*（照搬的 assistant-ui 组件的类名：改它的 className）"],
    [/\[data-slot/, "[data-slot]（照搬组件的内部标记）"],
    [/\[cmdk-/, "[cmdk-*]（cmdk 的内部标记）"],
    [/data-radix-popper/, "Radix 弹层外壳（z-index 写在我们自己的弹层类上，Radix 会照着设外壳）"],
    [/\.text-muted-foreground|\.bg-accent/, "Tailwind 工具类当选择器"],
    [/!important/, "!important"],
  ];
  const found = [];
  for (const { name, css } of askStyleFiles()) {
    for (const [pattern, why] of banned) if (pattern.test(css)) found.push(`${name}：${why}`);
  }
  assert.deepEqual(found, [], `提问窗的样式又伸进照搬组件里了：${found.join("；")}`);
});

test("提问窗不认识宿主的层级（2026-11-27）：z-index 只写 var(--ask-z-*, 默认)，阅读页在 ask-host.css 里设", () => {
  for (const { name, css } of askStyleFiles()) {
    for (const match of css.matchAll(/z-index:\s*([^;]+);/g)) {
      const value = match[1].trim();
      assert.ok(/^var\(--ask-z-[a-z]+, \d+\)$/.test(value) || /^-?\d$/.test(value), `${name} 的 z-index: ${value}（窗口、弹层的层级要走 --ask-z-*；组件里面的 0 / 1 / 2 这种可以）`);
      assert.doesNotMatch(value, /--z-hud|--z-chrome/, `${name} 用了宿主的层级变量`);
    }
  }
  const host = readFileSync(new URL("../../../packages/reader/styles/ask-host.css", import.meta.url), "utf8");
  for (const name of ["--ask-z-float", "--ask-z-dock", "--ask-z-popover"]) assert.match(host, new RegExp(`${name}:`), `阅读页没设 ${name}`);
});

test("阅读页不写提问窗的类名（2026-11-27）：要用的东西从 @retainpdf/ask/window 拿组件（AskHeadMenuItem、AskSpinner），自己的样式用 reader-ask-*", () => {
  const owned = new Set();
  for (const { css } of askStyleFiles()) for (const match of css.matchAll(/\.(ask-[a-z][\w-]*)/g)) owned.add(match[1]);
  const readerRoot = new URL("../../../packages/reader/src/", import.meta.url);
  const used = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) {
        const source = readFileSync(full, "utf8");
        for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
          for (const klass of (match[1] || match[2] || "").split(/\s+/)) if (owned.has(klass)) used.push(`${relative(fileURLToPath(readerRoot), full)}：${klass}`);
        }
      }
    }
  };
  walk(fileURLToPath(readerRoot));
  assert.deepEqual(used, [], `阅读页直接写了提问窗的类名：${used.join("；")}`);
});
