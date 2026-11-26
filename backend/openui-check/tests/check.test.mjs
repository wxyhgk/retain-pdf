// openui_check：检查本身（lib/check.mjs）和命令行入口（bin/openui-check.mjs）。组件库用仓库里前端生成的那份。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { createParser } from "@openuidev/lang-core";

import { checkProgram, MAX_ERRORS, MAX_PROGRAM_CHARS } from "../lib/check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const libraryPath = resolve(packageRoot, "..", "..", "contracts", "openui", "ask-openui-library.v1.json");
const promptPath = resolve(packageRoot, "..", "..", "contracts", "openui", "ask-openui-prompt.v1.json");
const library = JSON.parse(readFileSync(libraryPath, "utf8"));
const parser = createParser(library.schema, library.root);
const cli = resolve(packageRoot, "bin", "openui-check.mjs");

const GOOD = 'root = Col([title, slider])\n$n = 3\ntitle = Title("迭代 " + $n + " 次")\nslider = Slider($n, 1, 10, 1, "次数")';

function run(program, { env = {}, args = [], preload = [] } = {}) {
  const done = spawnSync(process.execPath, [...preload.flatMap((file) => ["--import", file]), cli, ...args], {
    input: program,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 30_000,
  });
  return { status: done.status, stdout: done.stdout, stderr: done.stderr, json: done.stdout.trim() ? JSON.parse(done.stdout) : null };
}

test("pins lang-core 1.2.0 (same as the contract's sources)", () => {
  const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(packageRoot, "package-lock.json"), "utf8"));
  const prompt = JSON.parse(readFileSync(promptPath, "utf8"));
  assert.equal(pkg.dependencies["@openuidev/lang-core"], "1.2.0");
  assert.equal(lock.packages["node_modules/@openuidev/lang-core"].version, "1.2.0");
  assert.equal(prompt.sources["@openuidev/lang-core"], "1.2.0");
});

test("a correct program passes", () => {
  const result = checkProgram(parser, GOOD);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.text, "没问题。");
  assert.equal(result.statements, 4);
});

// 前端演示模式的那段程序（frontend/web/src/platform/mock/ask-agent.ts 的 MOCK_OPENUI_BLOCK，抄一份做夹具；Python、Rust 的测试也用它）
const MOCK_BLOCK = readFileSync(resolve(here, "fixtures", "good-program.txt"), "utf8");

test("the frontend demo block passes, fenced as openui-lang or openui", () => {
  assert.equal(checkProgram(parser, MOCK_BLOCK).ok, true);
  for (const fence of ["openui-lang", "openui"]) {
    const result = checkProgram(parser, "```" + fence + "\n" + MOCK_BLOCK + "```\n");
    assert.equal(result.ok, true, fence);
  }
});

test("a misspelt component is unknown-component with the list of components", () => {
  const result = checkProgram(parser, 'root = Col([t])\nt = Titel("x")');
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "unknown-component");
  assert.equal(result.errors[0].statementId, "t");
  assert.match(result.errors[0].message, /Available components: .*Slider/);
  assert.match(result.text, /^有 1 处问题/);
  assert.match(result.text, /1\. \[unknown-component\] t：Unknown component "Titel"/);
});

test("removed components (Image, YouTube) are unknown-component too", () => {
  for (const name of ["Image", "YouTube"]) {
    const result = checkProgram(parser, `root = Col([x])\nx = ${name}("https://example.com/a")`);
    assert.equal(result.errors[0].code, "unknown-component", name);
    const available = result.errors[0].message.split("Available components:")[1];
    assert.ok(available.includes("HtmlView"), "HtmlView stays");
    assert.ok(!new RegExp(`\\b${name}\\b`).test(available), `${name} is not offered`);
  }
});

test("argument errors come from meta.errors", () => {
  const result = checkProgram(parser, 'root = Col([t])\nt = Slider("a", "b")');
  assert.deepEqual(result.errors.map((error) => error.code), ["type-mismatch", "type-mismatch", "missing-required"]);
});

test("parse meta adds incomplete, unresolved, orphaned and empty programs", () => {
  assert.deepEqual(checkProgram(parser, "root = Col([").errors.map((error) => error.code), ["incomplete"]);
  assert.deepEqual(checkProgram(parser, 'root = Col([t, u])\nt = Title("x")').errors, [
    { code: "unresolved-reference", statementId: "u", message: "用到了 `u`，但没有定义它（每条语句单独一行：`u = ...`）。" },
  ]);
  assert.equal(checkProgram(parser, 'root = Col([t])\nt = Title("x")\nz = Text("y")').errors[0].code, "orphaned-statement");
  assert.equal(checkProgram(parser, "").errors[0].code, "empty-program");
  assert.equal(checkProgram(parser, "hello world").errors[0].code, "empty-program");
});

test("a fenced program is unwrapped and the model is told", () => {
  const result = checkProgram(parser, "```openui-lang\n" + GOOD + "\n```");
  assert.equal(result.ok, true);
  assert.match(result.text, /不带 ``` 围栏/);
});

test("limits: program length and number of reported errors", () => {
  const long = checkProgram(parser, `root = Col([t])\nt = Text("${"字".repeat(MAX_PROGRAM_CHARS)}")`);
  assert.equal(long.errors[0].code, "program-too-long");
  const many = Array.from({ length: MAX_ERRORS + 5 }, (_, index) => `x${index} = Titel("a")`).join("\n");
  const result = checkProgram(parser, `root = Col([${Array.from({ length: MAX_ERRORS + 5 }, (_, index) => `x${index}`).join(", ")}])\n${many}`);
  assert.equal(result.errors.length, MAX_ERRORS);
  assert.match(result.text, /还有 5 条/);
});

test("the command line reads stdin and writes one JSON line", () => {
  const good = run(GOOD, { args: ["--library", libraryPath] });
  assert.equal(good.status, 0);
  assert.equal(good.stdout.trim().split("\n").length, 1);
  assert.deepEqual(good.json, { ok: true, errors: [], statements: 4, text: "没问题。" });
  const bad = run('root = Col([i])\ni = Image("https://example.com/a.png")');
  assert.equal(bad.status, 0);
  assert.equal(bad.json.errors[0].code, "unknown-component");
});

test("the command line reports a missing library as fatal", () => {
  const done = run(GOOD, { args: ["--library", resolve(packageRoot, "missing.json")] });
  assert.equal(done.status, 2);
  assert.equal(done.json.ok, false);
  assert.match(done.json.fatal, /读不了组件库/);
});

test("the command line turns telemetry off before loading lang-core", () => {
  const probe = resolve(here, "helpers", "env-probe.mjs");
  const done = run(GOOD, { env: { OPENUI_RUNTIME_TELEMETRY_ENABLED: "1", DO_NOT_TRACK: "0" }, preload: [probe] });
  assert.equal(done.status, 0);
  const line = done.stderr.split("\n").find((text) => text.startsWith("ENV-PROBE "));
  assert.deepEqual(JSON.parse(line.slice("ENV-PROBE ".length)), {
    OPENUI_TELEMETRY_DISABLED: "1",
    DO_NOT_TRACK: "1",
    OPENUI_RUNTIME_TELEMETRY_ENABLED: null,
  });
  // 设环境变量在加载 lang-core 之前（静态 import 只有 node: 内置和 lib/check.mjs，lang-core 是动态 import）
  const source = readFileSync(cli, "utf8");
  assert.ok(source.indexOf('process.env.OPENUI_TELEMETRY_DISABLED = "1"') < source.indexOf('await import("@openuidev/lang-core")'));
  assert.ok(!/^import .*@openuidev/m.test(source));
  assert.ok(!/^import .*@openuidev/m.test(readFileSync(resolve(packageRoot, "lib", "check.mjs"), "utf8")));
});
