/** 回答里的互动块（OpenUI）：给后端的分层说明（contracts/openui/）是最新的、分得对；去掉的组件真去掉了；检查器能报错。
 * 方案：docs/ops/planning/reader-ask/20261126-互动块分层提示词.md。 */
process.env.OPENUI_TELEMETRY_DISABLED = "1";
process.env.DO_NOT_TRACK = "1";

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { buildOpenUISpec, serialize, PROMPT_FILE, LIBRARY_FILE, REMOVED } = await import("../../../packages/ask/scripts/openui-spec.mjs");
const { askOpenUILibrary, OPENUI_REMOVED_COMPONENTS } = await import("../../../packages/ask/src/openui/library.ts");
const { createParser } = await import("@openuidev/lang-core");

test("contracts/openui/ 的两份说明是最新的（改了组件库、升级了 OpenUI 要 npm run generate:openui --workspace @retainpdf/ask）", async () => {
  const { prompt, library } = await buildOpenUISpec();
  assert.equal(readFileSync(PROMPT_FILE, "utf8"), serialize(prompt));
  assert.equal(readFileSync(LIBRARY_FILE, "utf8"), serialize(library));
});

test("去掉的组件：前端画的组件库和给后端的说明是同一份名单，说明里一个字都不提", async () => {
  assert.deepEqual([...OPENUI_REMOVED_COMPONENTS], REMOVED);
  for (const name of REMOVED) assert.equal(name in askOpenUILibrary.components, false, `${name} 还在组件库里`);
  assert.ok("HtmlView" in askOpenUILibrary.components, "HtmlView 留着（用户定）");
  const prompt = JSON.parse(readFileSync(PROMPT_FILE, "utf8"));
  const all = [prompt.intro, ...prompt.sections.map((section) => section.text)].join("\n");
  assert.doesNotMatch(all, /\bImage\(|YouTube/);
});

test("分层：L0 短、每段都在目录里、第一段是 core、id 没空格；普通问答只带 L0", () => {
  const prompt = JSON.parse(readFileSync(PROMPT_FILE, "utf8"));
  assert.equal(prompt.fence, "openui-lang");
  assert.equal(prompt.sections[0].id, "core");
  assert.ok(prompt.intro.length < 2500, "L0 每个会话都带，要短");
  for (const section of prompt.sections) {
    assert.match(section.id, /^[a-z]+(:[a-z0-9]+)?$/);
    assert.ok(section.text.length > 100, `${section.id} 是空的`);
    assert.ok(prompt.intro.includes(`\`${section.id}\``), `目录里没有 ${section.id}`);
  }
  const total = prompt.sections.reduce((sum, section) => sum + section.text.length, 0);
  assert.ok(total > prompt.intro.length * 10, "说明大头在按需取的段里");
});

test("后端的 openui_check 用的规格：对的程序没错；写错组件名、用了去掉的 Image 都报 unknown-component", () => {
  const { schema, root } = JSON.parse(readFileSync(LIBRARY_FILE, "utf8"));
  const parser = createParser(schema, root);
  const good = 'root = Col([t, s, v])\n$n = 3\nt = Title("迭代", "md")\ns = Slider($n, 1, 10)\nv = Text("第 " + $n + " 次")';
  assert.deepEqual(parser.parse(good).meta.errors, []);
  const bad = parser.parse('root = Col([t, x])\nt = Titel("迭代")\nx = Image("http://a/b.png", "a")').meta.errors;
  assert.deepEqual(bad.map((error) => [error.code, error.component]), [["unknown-component", "Titel"], ["unknown-component", "Image"]]);
});
