import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Theme Studio 注册表一致性门禁:studio/token-registry.mjs 里登记的每个
// token 必须真实存在于 src/styles(契约演进后忘改注册表 → 这里先红,
// 而不是后台面板静默显示空值)。反向不锁:样式侧可以有注册表未收录的
// 内部变量(--decor-px 之类运行时变量)。

import { REQUIRED_TOKENS, SELECTOR_TOKEN_MAP, TOKEN_GROUPS } from "../../studio/token-registry.mjs";

const PROJECT_ROOT = process.cwd();

function allStylesText() {
  const chunks = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".css")) chunks.push(readFileSync(full, "utf8"));
    }
  };
  walk(join(PROJECT_ROOT, "src/styles"));
  return chunks.join("\n");
}

test("注册表 token 全部真实存在于 src/styles", () => {
  const css = allStylesText();
  const missing = [];
  for (const group of TOKEN_GROUPS) {
    for (const t of group.tokens) {
      if (!css.includes(`${t.name}:`)) missing.push(`${group.id}/${t.name}`);
    }
  }
  assert.deepEqual(missing, [], "以下注册表 token 在 src/styles 中不存在(契约漂移)");
});

test("必选清单与颜色契约组一致,点选表引用的 token 都已登记", () => {
  const registered = new Set(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name)));
  assert.equal(REQUIRED_TOKENS.length, 20, "颜色契约必选应为 20 项(_contract.css)");
  const unknown = [];
  for (const entry of SELECTOR_TOKEN_MAP) {
    for (const token of entry.tokens) {
      if (!registered.has(token)) unknown.push(`${entry.match} → ${token}`);
    }
  }
  assert.deepEqual(unknown, [], "点选解析表引用了未登记 token");
});
