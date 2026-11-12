/** 阅读器 z-index 层级契约。
 *
 * 起因：`--z-dialog` 是 40，而批注浮卡（当时的 `--z-notes-float`）是 48 —— 致命错误提示
 * （.reader-react-error）、产物失败提示（.reader-error-notice）和启动遮罩
 * （.reader-boot-loading）全都被任何一个开着的浮窗盖住。用户看到的是界面不动
 * 了，而不是不动的原因。
 *
 * 更说明问题的是 fallback：同一个 token，react-pdf.css 写 `var(--z-dialog, 50)`
 * （作者显然想要 50，想压住浮窗），chrome.css 写 `var(--z-dialog, 40)`。两个数
 * 字互相矛盾，而且因为 token 有定义，**两个都不生效** —— 谁也没发现。
 *
 * 所以这里断言的是**数值关系**，不是某个字符串在不在：
 * - 告知层必须严格大于所有浮层（从 tokens.css 解析出真实数值来比）；
 * - 那三个选择器必须真的消费 --z-dialog，否则上面那条关系守了个寂寞；
 * - 每个 `var(--z-*, F)` 的 F 必须等于 token 定义值，且 token 必须真的存在
 *   （--z-popover / --z-float-ai-* 曾经被用却从未定义）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const READER_STYLES = fileURLToPath(
  new URL("../../../../frontend/packages/reader/styles/", import.meta.url),
);

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

function readStyle(name) {
  return stripComments(readFileSync(join(READER_STYLES, name), "utf8"));
}

function allStyleFiles() {
  return readdirSync(READER_STYLES).filter((name) => name.endsWith(".css")).sort();
}

/** tokens.css 里 `--z-xxx: N;` → 数值。 */
function zTokens() {
  const css = readStyle("tokens.css");
  const out = new Map();
  for (const [, name, value] of css.matchAll(/(--z-[a-z-]+)\s*:\s*(\d+)\s*;/g)) {
    out.set(name, Number(value));
  }
  return out;
}

/** 顶层规则（不含 @media 等 at-rule 内部）：选择器 → 声明块文本。 */
function topLevelRules(css) {
  const rules = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") {
      if (depth === 0) {
        const prelude = css.slice(start, i).trim();
        if (!prelude.startsWith("@")) rules.push({ prelude, bodyStart: i + 1 });
        else rules.push({ prelude, bodyStart: i + 1, atRule: true });
      }
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const rule = rules[rules.length - 1];
        rule.body = css.slice(rule.bodyStart, i);
        start = i + 1;
      }
    }
  }
  return rules.filter((rule) => !rule.atRule && rule.body !== undefined);
}

/** 选择器命中的规则里，最后一条 `z-index` 声明。 */
function zIndexFor(selector) {
  let found = null;
  for (const file of allStyleFiles()) {
    for (const rule of topLevelRules(readStyle(file))) {
      const selectors = rule.prelude.split(",").map((part) => part.trim());
      if (!selectors.includes(selector)) continue;
      const declarations = [...rule.body.matchAll(/z-index\s*:\s*([^;]+);/g)];
      if (declarations.length > 0) found = declarations[declarations.length - 1][1].trim();
    }
  }
  return found;
}

const TOKENS = zTokens();

/** 会盖在内容之上的浮层 —— 告知层必须压过它们每一个。
 *
 * 批注卡和圆钮那两层不在这里了：可拖动浮窗和可拖动圆钮整套删除，面板进了
 * dock（z-index 24，在 chrome 之下），那两个 token 没有消费者也没有定义。 */
const FLOATING_LAYERS = [
  "--z-popover",
  "--z-region-popover",
  "--z-citation-hover",
];

test("告知层压住所有浮层 —— 致命错误不能被浮窗盖住", () => {
  const dialog = TOKENS.get("--z-dialog");
  assert.ok(typeof dialog === "number", "tokens.css 里没有 --z-dialog");
  for (const layer of FLOATING_LAYERS) {
    const value = TOKENS.get(layer);
    assert.ok(typeof value === "number", `tokens.css 里没有 ${layer}`);
    // 40 < 48 就是这条缺陷本身：批注浮卡盖住致命错误。
    assert.ok(
      dialog > value,
      `--z-dialog(${dialog}) 没压住 ${layer}(${value})：这一层是「出事了」，被浮层盖住等于没有`,
    );
  }
});

test("那三个选择器真的消费 --z-dialog —— 否则上面那条关系守了个寂寞", () => {
  // 先断言「存在」再断言关系：光比 token 数值的话，实现把 z-index 改成写死的
  // 40、或者干脆换个 token，上面那条测试照样绿。
  for (const selector of [
    ".reader-react-error",
    ".reader-error-notice",
    ".reader-boot-loading",
  ]) {
    const value = zIndexFor(selector);
    assert.ok(value, `${selector} 没有 z-index 声明`);
    assert.match(
      value,
      /var\(--z-dialog[,)]/,
      `${selector} 的 z-index 是 ${value}，没走告知层 token`,
    );
  }
});

test("每个 var(--z-*) 都有定义，且 fallback 等于定义值", () => {
  const problems = [];
  let seen = 0;
  for (const file of allStyleFiles()) {
    const css = readStyle(file);
    for (const [, name, fallback] of css.matchAll(/var\((--z-[a-z-]+)\s*(?:,\s*([^)]+))?\)/g)) {
      seen += 1;
      const defined = TOKENS.get(name);
      if (defined === undefined) {
        // --z-popover / --z-float-ai-bar / --z-float-ai-dropdown 曾经是这样：
        // 看着像进了层级契约，实际全靠 fallback 在撑。
        problems.push(`${file}: ${name} 从未在 tokens.css 定义`);
        continue;
      }
      if (fallback === undefined) continue;
      if (Number(fallback.trim()) !== defined) {
        problems.push(
          `${file}: var(${name}, ${fallback.trim()}) 的 fallback 和定义值 ${defined} 不一致`,
        );
      }
    }
  }
  // 2026-11-12 删了选中菜单和 AI 批注的样式，剩 8 处；下限只为发现正则失效，不是要求这么多。
  assert.ok(seen >= 6, `只扫到 ${seen} 处 var(--z-*)，正则八成没匹配上`);
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("两份 tokens.css 的 z 层级不打架", () => {
  // frontend/web/src/styles/tokens.css 自称与 reader 那份同步。同名不同值的话，
  // 主页域和阅读器对「哪层压哪层」的理解就分叉了。
  const web = stripComments(
    readFileSync(
      fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url)),
      "utf8",
    ),
  );
  const webTokens = new Map(
    [...web.matchAll(/(--z-[a-z-]+)\s*:\s*(\d+)\s*;/g)].map(([, n, v]) => [n, Number(v)]),
  );
  assert.ok(webTokens.size > 0, "web 那份里一个 --z-* 都没解析到");
  for (const [name, value] of webTokens) {
    const reader = TOKENS.get(name);
    if (reader === undefined) continue;
    assert.equal(value, reader, `${name}: web 是 ${value}，reader 是 ${reader}`);
  }
});
