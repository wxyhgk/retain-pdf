// 四层依赖方向门禁（批次 5C 的 C3）。
//
//     app  ──►  features  ──►  platform
//                  │              ▲
//                  └──► ui ───────┘
//
// 批次 5 之前这套方向约束**从未被实现过**：架构测试里只有「新世界不得
// import 旧世界」这类防回弹规则，没有任何一条检查层与层之间的方向。
// 蓝图 §5.1 写了规则，代码里没有对应的门禁。
//
// 本文件补上四条。每条都先实测过当前违规数，确认为 0（或已在本批次修零）
// 才上棘轮，不是先放宽再收紧。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const LAYERS = {
  app: "src/app",
  features: "src/features",
  ui: "src/ui",
  platform: "src/platform",
};

/** 允许的下游层。app 在最上，platform 在最下。 */
const ALLOWED_TARGETS = {
  app: new Set(["app", "features", "ui", "platform"]),
  features: new Set(["features", "ui", "platform"]),
  ui: new Set(["ui", "platform"]),
  platform: new Set(["platform"]),
};

// features 引用 app 的唯一例外：主页装配出来的 DI 容器。
// 为什么消不掉、以及只减不增的清单，见 architecture-boundaries.test.mjs 里
// 「features 引用 app 层仅限主页 DI 容器」那条。
const APP_DI_ENTRY = "@/app/home/home-services-context.js";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function scanLayer(name) {
  const root = join(PROJECT_ROOT, LAYERS[name]);
  assert.ok(existsSync(root), `层目录不存在，门禁已失效: ${LAYERS[name]}`);
  const files = walk(root);
  assert.ok(files.length > 0, `层目录为空，门禁已失效: ${LAYERS[name]}`);
  return files;
}

const ALIAS_IMPORT = /(?:from\s+|import\s*\(\s*|import\s+)["'](@\/(app|features|ui|platform)\/[^"']+)["']/g;

test("四层依赖方向：app → features → platform，ui 旁挂", () => {
  const violations = [];
  for (const layer of Object.keys(LAYERS)) {
    for (const file of scanLayer(layer)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(ALIAS_IMPORT)) {
        const [, specifier, target] = match;
        if (ALLOWED_TARGETS[layer].has(target)) continue;
        if (layer === "features" && specifier === APP_DI_ENTRY) continue;
        violations.push(`${relative(PROJECT_ROOT, file).replace(/\\/g, "/")} → ${specifier}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    "违反四层方向：app 可引用全部，features 不得引用 app（唯一例外是主页 DI 容器），"
      + "ui 只能引用 ui/platform，platform 只能引用 platform",
  );
});

test("跨功能引用只经对方 index.js 或 domain.js", () => {
  const violations = [];
  for (const file of scanLayer("features")) {
    const own = relative(join(PROJECT_ROOT, "src/features"), file).split(/[\\/]/)[0];
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/["'](@\/features\/([a-z-]+)\/([^"']+))["']/g)) {
      const [, specifier, feature, rest] = match;
      if (feature === own) continue;
      if (rest === "index.js" || rest === "domain.js") continue;
      violations.push(`${relative(PROJECT_ROOT, file).replace(/\\/g, "/")} → ${specifier}`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    "跨功能只能消费对方的 index.js（完整能力）或 domain.js（纯逻辑窄口），不得深入内部",
  );
});

test("功能的 domain 层不得 import React", () => {
  // 蓝图 §5.1 写了这条，但直到本批次都没有对应的门禁。
  // 意义：阅读器包（非 React 宿主）与命令式调用方要能复用同一份领域逻辑。
  const violations = [];
  const featuresRoot = join(PROJECT_ROOT, "src/features");
  const domainFiles = scanLayer("features").filter((file) => {
    const rel = relative(featuresRoot, file).replace(/\\/g, "/");
    return /^[a-z-]+\/domain(?:\/|\.ts$)/.test(rel);
  });
  assert.ok(domainFiles.length > 0, "没扫到任何 domain 文件，门禁已失效");
  for (const file of domainFiles) {
    const rel = relative(PROJECT_ROOT, file).replace(/\\/g, "/");
    if (file.endsWith(".tsx")) {
      violations.push(`${rel} （domain 层不应有 .tsx）`);
      continue;
    }
    const source = readFileSync(file, "utf8");
    if (/(?:from\s+|import\s*\(\s*)["'](?:react|react-dom)(?:\/[^"']*)?["']/.test(source)) {
      violations.push(`${rel} → react`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    "domain/ 必须保持无 React：阅读器包与命令式调用方要复用同一份领域逻辑",
  );
});

test("Tailwind @source 指向的目录必须存在", () => {
  // 批次 5 之前 30 条 @source 里有 16 条指向已删除目录（js/ pages/ shared/
  // components/ lib/ islands/ partials/），且部分后缀还写着 *.js / *.jsx——
  // 代码库早已全量 TS。全靠 v4 的自动来源探测兜住才没出事，所以一直没人发现。
  // 加这条防止再腐烂。
  const cssFiles = [];
  (function collect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (entry.name.endsWith(".css")) cssFiles.push(full);
    }
  })(join(PROJECT_ROOT, "src/styles"));
  assert.ok(cssFiles.length > 0, "没扫到任何 CSS，门禁已失效");

  const missing = [];
  for (const file of cssFiles) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (line.includes("inline(")) return;
      const match = /@source\s+["']([^"']+)["']/.exec(line);
      if (!match) return;
      const root = match[1].split("/**")[0].split("/*")[0];
      const resolved = join(dirname(file), root);
      if (!existsSync(resolved)) {
        missing.push(`${relative(PROJECT_ROOT, file).replace(/\\/g, "/")}:${index + 1} → ${match[1]}`);
      }
    });
  }
  assert.deepEqual(missing, [], "@source 指向了不存在的目录（Tailwind 不会报错，只会静默少扫）");
});
