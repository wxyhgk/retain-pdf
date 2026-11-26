// 互动块（extension/openui.ts）：取说明、检查（真起后端的 openui-check）、遥测变量、注册进 pi、和读书分开的额度。
// 说明文件用仓库里前端生成的那份（contracts/openui/，只读）。
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import retainpdfBook, { RoundGuard } from "../extension/index.ts";
import {
  CHECK_CALLS_PER_TURN,
  checkEnv,
  checkResult,
  loadPromptFile,
  makeOpenUiTools,
  MAX_CHECK_OUTPUT_BYTES,
  nodeCheckRunner,
  OpenUiTools,
  SPEC_CALLS_PER_TURN,
  specResult,
} from "../extension/openui.ts";
import type { CheckRunner } from "../extension/openui.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const PROMPT = join(REPO, "contracts", "openui", "ask-openui-prompt.v1.json");
const LIBRARY = join(REPO, "contracts", "openui", "ask-openui-library.v1.json");
const CHECK_PACKAGE = join(REPO, "backend", "openui-check");
const CHECK_SCRIPT = join(CHECK_PACKAGE, "bin", "openui-check.mjs");
// 前端演示模式的那段程序（MOCK_OPENUI_BLOCK），解析器挑不出错
const GOOD = readFileSync(join(CHECK_PACKAGE, "tests", "fixtures", "good-program.txt"), "utf8");
const noChecker = existsSync(join(CHECK_PACKAGE, "node_modules", "@openuidev", "lang-core"))
  ? false
  : "需要 backend/openui-check 的依赖（npm ci --ignore-scripts --prefix backend/openui-check）";

const prompt = () => loadPromptFile(PROMPT)!;
const realChecker = () => nodeCheckRunner({ node: process.execPath, script: CHECK_SCRIPT, library: LIBRARY });

function fakeScript(body: string): CheckRunner {
  const dir = mkdtempSync(join(tmpdir(), "openui-check-"));
  const script = join(dir, "fake.mjs");
  writeFileSync(script, body);
  return nodeCheckRunner({ node: process.execPath, script, library: LIBRARY });
}

test("spec: known sections in order and once, unknown ids list what can be taken", () => {
  const loaded = prompt();
  const byId = new Map(loaded.sections.map((section) => [section.id, section.text.trim()]));
  assert.equal(specResult(loaded, ["core"]).text, byId.get("core"));
  assert.equal(specResult(loaded, ["components:inputs", "core", "components:inputs"]).text, `${byId.get("components:inputs")}\n\n${byId.get("core")}`);
  assert.equal(specResult(loaded, "rules").text, byId.get("rules"));
  const unknown = specResult(loaded, ["components:image"]);
  assert.equal(unknown.isError, true);
  assert.ok(unknown.text.startsWith("不认识的段：`components:image`。可取的段：\n- `core`："));
  const mixed = specResult(loaded, ["core", "nope"]);
  assert.equal(mixed.isError, false);
  assert.ok(mixed.text.includes("（不认识的段：`nope`，没有取。可取的段：`core`、"));
  assert.equal(specResult(loaded, []).isError, true);
});

test("check: the frontend demo block passes; a misspelt or removed component is unknown-component", { skip: noChecker }, async () => {
  assert.deepEqual(await checkResult(realChecker(), GOOD), { text: "没问题。", images: [], isError: false, summary: "没问题" });
  for (const [program, name] of [['root = Col([t])\nt = Titel("x")', "Titel"], ['root = Col([i])\ni = Image("https://example.com/a.png")', "Image"]]) {
    const result = await checkResult(realChecker(), program);
    assert.equal(result.isError, false);
    assert.ok(result.text.includes(`1. [unknown-component] ${program[16]}：Unknown component "${name}"`), result.text);
    assert.ok(result.text.includes("Available components: Col, Row"));
    assert.equal(result.summary, "1 处问题：unknown-component");
  }
});

test("check: node missing, not configured, timeout, oversized output, garbage", async () => {
  const missing = await checkResult(nodeCheckRunner({ node: "/nonexistent/node", script: CHECK_SCRIPT, library: LIBRARY }), GOOD);
  assert.ok(missing.isError && missing.text.startsWith("检查器起不来（Node.js："));
  const tools = makeOpenUiTools({ RETAIN_OPENUI_PROMPT: PROMPT, RETAIN_OPENUI_LIBRARY: LIBRARY, RETAIN_OPENUI_CHECK: CHECK_SCRIPT, RETAIN_OPENUI_NODE: "/nonexistent/node" });
  assert.ok(tools && tools.runner === null);
  assert.ok((await tools.run("openui_check", { program: GOOD })).text.startsWith("检查器用不了（没找到 Node.js）"));
  assert.equal((await tools.run("openui_spec", { sections: ["core"] })).isError, false);
  assert.equal(makeOpenUiTools({}), null);

  const slow = await checkResult(fakeScript("setTimeout(() => {}, 30000);\n"), GOOD, { timeoutMs: 300 });
  assert.ok(slow.isError && slow.text.startsWith("检查超时（0.3 秒）"));
  const big = await checkResult(fakeScript(`process.stdout.write("x".repeat(${MAX_CHECK_OUTPUT_BYTES * 2}));\n`), GOOD);
  assert.ok(big.isError && big.text.includes("输出太大"), big.text);
  const garbage = await checkResult(fakeScript('console.log("hello");\n'), GOOD);
  assert.ok(garbage.text.startsWith("检查器没有回结果（退出码 0）"));
  assert.ok((await checkResult(realChecker(), "x".repeat(40_001))).text.startsWith("程序太长"));
});

test("check: telemetry is off in the child process", async () => {
  const env = checkEnv({ OPENUI_RUNTIME_TELEMETRY_ENABLED: "1", DO_NOT_TRACK: "0", PATH: process.env.PATH });
  assert.equal(env.OPENUI_TELEMETRY_DISABLED, "1");
  assert.equal(env.DO_NOT_TRACK, "1");
  assert.ok(!("OPENUI_RUNTIME_TELEMETRY_ENABLED" in env));
  const previous = process.env.OPENUI_RUNTIME_TELEMETRY_ENABLED;
  process.env.OPENUI_RUNTIME_TELEMETRY_ENABLED = "1";
  try {
    const result = await checkResult(fakeScript(
      'const keys = ["OPENUI_TELEMETRY_DISABLED", "DO_NOT_TRACK", "OPENUI_RUNTIME_TELEMETRY_ENABLED"];\n'
      + 'process.stdin.resume(); process.stdin.on("end", () => console.log(JSON.stringify({ ok: true, errors: [], text: JSON.stringify(Object.fromEntries(keys.map((k) => [k, process.env[k] ?? null]))) })));\n',
    ), GOOD);
    assert.deepEqual(JSON.parse(result.text), { OPENUI_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1", OPENUI_RUNTIME_TELEMETRY_ENABLED: null });
  } finally {
    if (previous === undefined) delete process.env.OPENUI_RUNTIME_TELEMETRY_ENABLED;
    else process.env.OPENUI_RUNTIME_TELEMETRY_ENABLED = previous;
  }
});

function fakePi() {
  const handlers = new Map<string, Array<(event: any) => any>>();
  const tools: any[] = [];
  return {
    tools,
    on(name: string, handler: (event: any) => any) {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    },
    registerTool(tool: any) {
      tools.push(tool);
    },
    async emit(name: string, event: any = {}) {
      let result;
      for (const handler of handlers.get(name) ?? []) result = await handler(event);
      return result;
    },
  };
}

test("registered in pi even without a book; the lock lets them through", async () => {
  const pi = fakePi();
  const runner: CheckRunner = async () => ({ code: 0, output: Buffer.from(JSON.stringify({ ok: true, errors: [], text: "没问题。" })) });
  retainpdfBook(pi, null, new OpenUiTools(prompt(), runner));
  assert.deepEqual(pi.tools.map((tool) => tool.name), ["openui_spec", "openui_check"]);
  const spec = await pi.tools[0].execute("c1", { sections: ["core"] });
  assert.ok(spec.content[0].text.startsWith("## Syntax Rules"));
  assert.equal(spec.details.summary.startsWith("core（约 "), true);
  const check = await pi.tools[1].execute("c2", { program: GOOD });
  assert.equal(check.content[0].text, "没问题。");
  await pi.emit("agent_start");
  await pi.emit("turn_start");
  assert.equal(await pi.emit("tool_call", { toolName: "openui_spec" }), undefined);
  assert.equal((await pi.emit("tool_call", { toolName: "bash" })).block, true);
});

test("spec and check have their own quota apart from the book rounds", () => {
  const guard = new RoundGuard();
  guard.startRun();
  for (let call = 0; call < SPEC_CALLS_PER_TURN; call += 1) {
    guard.startTurn();
    assert.equal(guard.check("openui_spec"), undefined);
  }
  guard.startTurn();
  assert.ok(guard.check("openui_spec")?.reason.includes(`已经取了 ${SPEC_CALLS_PER_TURN} 次说明`));
  for (let call = 0; call < CHECK_CALLS_PER_TURN; call += 1) {
    guard.startTurn();
    assert.equal(guard.check("openui_check"), undefined);
  }
  guard.startTurn();
  assert.ok(guard.check("openui_check")?.reason.includes(`已经检查了 ${CHECK_CALLS_PER_TURN} 次`));
  // 互动块用掉的轮次不算读书的：读书照样还有 4 轮
  for (let round = 0; round < 4; round += 1) {
    guard.startTurn();
    assert.equal(guard.check("read_pages"), undefined, `book round ${round + 1}`);
  }
});
