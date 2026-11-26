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
