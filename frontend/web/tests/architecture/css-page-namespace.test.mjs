import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// 源码级命名空间门禁：reader/detail 源文件选择器必须带页前缀。
// 构建已按页拆包 dist/css/{home,detail,reader}.css，跨页污染风险已大幅下降；
// 本测试继续锁住「别在 reader/detail 源码里写裸全局选择器」。

const PROJECT_ROOT = process.cwd();
const STYLES_ROOT = join(PROJECT_ROOT, "src/styles");
const READER_STYLES_ROOT = join(PROJECT_ROOT, "..", "packages", "reader", "styles");

// 递归遍历样式根：此前只 readdirSync 顶层，漏掉了 core/、themes/ 等子目录
// （以及 web 侧的 entries/reader.css），子目录里的裸全局选择器可以绕过门禁。
function cssFilesUnder(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) pending.push(join(current, entry));
    } else if (current.endsWith(".css")) {
      files.push(current);
    }
  }
  return files.sort();
}

// reader 包内「主题基座 / 多页共享件」白名单：这些选择器必须作用于文档根或
// 被多页复用，无法加页前缀。逐文件登记 + 原因，避免把 html/body/* 变成
// 所有 reader 文件都能写的后门。仅对列出的文件追加 selectors。
const READER_FILE_EXEMPTIONS = [
  {
    file: "core/ambient-surface-reader.css",
    reason:
      "阅读器 bundle 的主题基座：html/body 的纸张材质、底色与对比度/降级必须作用于文档根；bundle 已按页拆包，不会污染 home/detail。",
    selectors: [/^html$/, /^body$/],
  },
  {
    file: "core/ambient-surface.css",
    reason:
      "共享氛围基座回退真值（entry 未引用）：同 reader variant 的 html/body 主题基座。",
    selectors: [/^html$/, /^body$/],
  },
  {
    file: "core/ambient-surface-home.css",
    reason:
      "主页/详情页纸台基座：页面根 #home-root/#detail-root、纸台 .home-paper-stage 与 html/body 主题底；非 reader bundle 业务类。",
    selectors: [/^html$/, /^body$/, /^#home-root$/, /^#detail-root$/, /^\.home-paper-stage$/],
  },
  {
    file: "core/tailwind-theme.css",
    reason: "Tailwind v4 base reset（v3→v4 默认边框色兼容）：* 与伪元素必须全局生效。",
    selectors: [/^\*$/, /^::/],
  },
  {
    file: "core/download-toast.css",
    reason:
      "跨页共享下载 toast 工具类（@utility 生成），类名不带 reader- 前缀以避免宿主 DOM 改名。",
    selectors: [/^\.download-toast/],
  },
  ...[
    "classic.css",
    "jiangnan.css",
    "mojia.css",
    "night.css",
    "seacliff.css",
  ].map((name) => ({
    file: `themes/${name}`,
    reason: "皮肤 token 契约：颜色/形态变量必须写在 :root/[data-theme] 上全局生效。",
    selectors: [/^\[data-theme/],
  })),
];

const READER_EXEMPTIONS = new Map(
  READER_FILE_EXEMPTIONS.map(({ file, selectors }) => [file, selectors]),
);

const GROUPS = [
  {
    name: "reader 页/阅读器组件",
    root: READER_STYLES_ROOT,
    exemptions: READER_EXEMPTIONS,
    files: [
      // 真值已迁至 @retainpdf/reader（frontend/packages/reader/styles）；
      // *-legacy.css 为冻结兼容，base.css 为页面壳归一化（元素选择器 + 通用
      // 工具类，无业务类，2026-09-10 目检），两者不纳入命名空间门禁。
      // web 侧 entries/reader.css 是薄代理入口，也纳入扫描。
      ...cssFilesUnder(READER_STYLES_ROOT).filter(
        (f) => !f.endsWith("-legacy.css") && !f.endsWith("/base.css"),
      ),
      join(STYLES_ROOT, "entries/reader.css"),
    ],
    allowed: [
      /(\.|#)reader-/,
      /\[data-reader/,
      /^reader-dialog\b/, // <reader-dialog> 自定义标签选择器
      /body\.reader/,
      /^:root$/,
    ],
  },
  {
    name: "detail 页",
    files: [
      join(STYLES_ROOT, "pages.css"),
      ...readdirSync(join(STYLES_ROOT, "pages/detail"))
        .filter((f) => f.endsWith(".css"))
        .map((f) => join(STYLES_ROOT, "pages/detail", f)),
    ],
    allowed: [
      /(\.|#)detail-/,
      /\[data-detail/,
      /\.markdown-/, // detail 页 Markdown 预览区块
      /body\.detail/,
      /^:root$/,
    ],
  },
  {
    name: "home 页",
    files: [
      ...readdirSync(join(STYLES_ROOT, "pages/home"))
        .filter((f) => f.endsWith(".css"))
        .map((f) => join(STYLES_ROOT, "pages/home", f)),
    ],
    allowed: [
      /(\.|#)home-/,
      /\[data-home/,
      /body\.home/,
      /^:root$/,
      // 旧主页域前缀(已落地文件)——新文件优先用 home- 前缀,本清单为过渡期 allowlist
      /(\.|#)status-/,
      /(\.|#)library-/,
      /(\.|#)app-/,
      /(\.|#)recent-job/,
      /(\.|#)book-detail/,
      /(\.|#)bd-/,
      /(\.|#)translation-/,
      /(\.|#)upload-/,
      /(\.|#)credential-/,
      /(\.|#)glossary/,
      /(\.|#)page/,
      /(\.|#)topbar/,
      /(\.|#)ai-assistant/,
      /(\.|#)lib-search/,
      /(\.|#)home-ask/,
      /(\.|#)collection/,
      /(\.|#)detail-/,
      /(\.|#)inline-error/,
      /(\.|#)field-/,
      /(\.|#)grid/,
      /(\.|#)vertical-actions/,
      /(\.|#)app-button/,
      /(\.|#)developer-/,
      /(\.|#)desktop-/,
      /(\.|#)dialog-/,
      /(\.|#)progress-/,
      /(\.|#)icon-button/,
      /(\.|#)theme-option/,
      /(\.|#)hidden/,
      /(\.|#)muted/,
      /(\.|#)info-/,
      /(\.|#)stage-/,
      /(\.|#)status-detail/,
      /(\.|#)soft-reader/,
      /(\.|#)categories-/,
      /(\.|#)category-card/,
      /(\.|#)favorites-/,
      /(\.|#)hero/,
      /(\.|#)book-card/,
      /(\.|#)mock-mode/,
      /(\.|#)task-toolbar/,
      /(\.|#)event-badge/,
      /(\.|#)event-payload/,
      /(\.|#)badge/,
      /(\.|#)failure-hero/,
      /(\.|#)professional-glossary/,
      /page-range/,
      /(\.|#)inline-page-range/,
      /library-search-island/,
      /:backdrop/,
      /::after/,
      /::before/,
      /::-webkit-/,
      /\[hidden\]/,
      /^\.is-/,
      /^\.mono/,
      /^#browser-credentials-dialog/,
      /^#developer-dialog/,
      /^#developer-auth-dialog/,
      /^#book-detail/,
      /^recent-jobs-dialog/,
      /^status-detail-dialog/,
      /body\./,
      /(\.|#)token-inline-status/,
      /(\.|#)token-validation/,
      /(\.|#)math-mode-inline/,
    ],
  },
];

// 解析出规则选择器,跳过 @keyframes 内部的步进选择器(0%/from/to)。
//
// Tailwind v4 迁移后,部分样式文件改用了原生 CSS 嵌套(`&:hover`/`& p`/`&.foo`)
// 和 `@utility <name> { ... }` 语法(v4 官方迁移工具的产物)。这两种写法编译后
// 等价于旧版摊平的复合选择器,但字面文本不再自带页面前缀,所以这里需要把 `&`
// 展开成最近一层的选择器上下文(`@utility <name>` 视为 `.<name>`),否则会把
// 完全合规的嵌套选择器误判成"没有命名空间"。
function ruleSelectors(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = [];
  // 每一层记录 { header, resolved }:resolved 为 null 表示这一层是透传的
  // at-rule(@media/@keyframes 等),不建立新的选择器上下文,`&` 应穿透它去找
  // 最近一层真正的选择器/`@utility` 上下文。
  const stack = [];
  let buffer = "";

  const nearestResolved = () => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].resolved) {
        return stack[i].resolved;
      }
    }
    return [""];
  };

  const resolveHeader = (header) => {
    const parents = nearestResolved();
    return header
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) =>
        part.includes("&") ? parents.map((parent) => part.split("&").join(parent)) : [part],
      );
  };

  for (const ch of noComments) {
    if (ch === "{") {
      const header = buffer.trim();
      buffer = "";
      const inKeyframes = stack.some((frame) => frame.header.startsWith("@keyframes"));

      if (/^@utility\s+/.test(header)) {
        const name = header.replace(/^@utility\s+/, "").trim();
        stack.push({ header, resolved: [`.${name}`] });
      } else if (header.startsWith("@") || inKeyframes) {
        stack.push({ header, resolved: null });
      } else {
        const resolved = resolveHeader(header);
        selectors.push(...resolved);
        stack.push({ header, resolved });
      }
    } else if (ch === "}") {
      stack.pop();
      buffer = "";
    } else if (ch === ";") {
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  return selectors;
}

for (const group of GROUPS) {
  test(`${group.name} 样式文件的选择器全部带页面命名空间`, () => {
    const violations = [];
    for (const file of group.files) {
      const exempt = group.exemptions?.get(relative(group.root, file)) ?? [];
      for (const selector of ruleSelectors(readFileSync(file, "utf8"))) {
        for (const part of selector.split(",")) {
          const trimmed = part.trim();
          if (!trimmed) {
            continue;
          }
          if (group.allowed.some((pattern) => pattern.test(trimmed))) {
            continue;
          }
          if (exempt.some((pattern) => pattern.test(trimmed))) {
            continue;
          }
          violations.push(`${relative(PROJECT_ROOT, file)}: "${trimmed}"`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      `以下选择器没有页面命名空间(应使用 reader-/detail- 前缀):\n  ${violations.join("\n  ")}`,
    );
  });
}

test("reader 门禁扫描为递归并覆盖 core/、themes/ 与 web 代理入口", () => {
  const reader = GROUPS.find((group) => group.name === "reader 页/阅读器组件");
  const rels = new Set(reader.files.map((file) => relative(READER_STYLES_ROOT, file)));
  for (const expected of [
    "core/ambient-surface-reader.css",
    "core/tailwind-theme.css",
    "themes/classic.css",
    "themes/index.css",
    "reader.utilities.css",
  ]) {
    assert.ok(rels.has(expected), `递归扫描缺少 reader/styles/${expected}`);
  }
  const webRels = new Set(reader.files.map((file) => relative(STYLES_ROOT, file)));
  assert.ok(
    webRels.has("entries/reader.css"),
    "扫描缺少 web src/styles/entries/reader.css",
  );
});

test("reader 门禁豁免清单文件存在且没有过期条目", () => {
  const reader = GROUPS.find((group) => group.name === "reader 页/阅读器组件");
  const scanned = new Set(reader.files.map((file) => relative(READER_STYLES_ROOT, file)));
  for (const { file, selectors } of READER_FILE_EXEMPTIONS) {
    assert.ok(scanned.has(file), `豁免文件不在扫描组: ${file}`);
    const stillNeeded = ruleSelectors(readFileSync(join(READER_STYLES_ROOT, file), "utf8"))
      .some((selector) =>
        selector.split(",").some((part) => {
          const trimmed = part.trim();
          if (!trimmed) return false;
          if (reader.allowed.some((pattern) => pattern.test(trimmed))) return false;
          return selectors.some((pattern) => pattern.test(trimmed));
        }),
      );
    assert.ok(stillNeeded, `豁免条目已过期（选择器已删除或已加前缀），请移除: ${file}`);
  }
});
