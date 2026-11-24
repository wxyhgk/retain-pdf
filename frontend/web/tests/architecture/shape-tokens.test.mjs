/** 形状变量登记表的门禁（主题完全可自定义第 2 步）。
 *
 * 登记表在 frontend/packages/ui/src/theme/shape-tokens/，一个模块一个文件。以后自定义主题的白名单
 * 从它来，所以要守住三件事：名字不重复、前缀归对模块、登记了就真的有地方用（不囤「以后可能用」的）。
 * 方案：docs/ops/planning/theme-customization/20261124-主题完全可自定义.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  ALL_SHAPE_TOKENS,
  SHAPE_TOKEN_MODULES,
} from "../../../packages/ui/src/theme/shape-tokens/index.ts";

const FRONTEND = join(process.cwd(), "..");
const SCAN_ROOTS = [
  "web/src",
  "packages/ui/styles",
  "packages/ui/src",
  "packages/reader/styles",
  "packages/reader/src",
].map((p) => join(FRONTEND, p));

function sourceText() {
  const chunks = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === "shape-tokens" || name === "node_modules" || name === "dist") continue;
        walk(full);
      } else if (/\.(css|tsx?)$/.test(name)) {
        chunks.push(readFileSync(full, "utf8"));
      }
    }
  };
  for (const root of SCAN_ROOTS) walk(root);
  return chunks.join("\n");
}

test("形状变量名不重复", () => {
  const seen = new Set();
  const dupes = [];
  for (const token of ALL_SHAPE_TOKENS) {
    if (seen.has(token.name)) dupes.push(token.name);
    seen.add(token.name);
  }
  assert.deepEqual(dupes, []);
});

test("每个变量的前缀归它自己的模块，前缀也不在两个模块里重复", () => {
  const owner = new Map();
  for (const module of SHAPE_TOKEN_MODULES) {
    for (const prefix of module.prefixes) {
      assert.ok(!owner.has(prefix), `前缀 ${prefix} 同时登记在 ${owner.get(prefix)} 和 ${module.id}`);
      owner.set(prefix, module.id);
    }
  }
  const wrong = [];
  for (const module of SHAPE_TOKEN_MODULES) {
    for (const token of module.tokens) {
      if (!module.prefixes.some((prefix) => token.name.startsWith(prefix))) {
        wrong.push(`${module.id}: ${token.name}`);
      }
    }
  }
  assert.deepEqual(wrong, [], "变量名前缀和所在模块对不上");
});

test("登记了的变量都有地方在用", () => {
  const text = sourceText();
  // 全局旋钮由各模块引用；等每个模块都登记了自己的变量（第 2 步做完）才开始查它们。
  const modulesReady = SHAPE_TOKEN_MODULES
    .filter((module) => module.id !== "global")
    .every((module) => module.tokens.length > 0);
  const unused = [];
  for (const module of SHAPE_TOKEN_MODULES) {
    if (module.id === "global" && !modulesReady) continue;
    for (const token of module.tokens) {
      const used = new RegExp(`var\\(\\s*${token.name.replace(/[-]/g, "\\-")}(?![\\w-])`).test(text);
      if (!used) unused.push(token.name);
    }
  }
  assert.deepEqual(unused, [], "这些变量登记了但没有任何 var(...) 用到它");
});

test("每个变量都写了说明和兜底值", () => {
  const missing = ALL_SHAPE_TOKENS
    .filter((token) => !token.description.trim() || !token.fallback.trim())
    .map((token) => token.name);
  assert.deepEqual(missing, []);
});
