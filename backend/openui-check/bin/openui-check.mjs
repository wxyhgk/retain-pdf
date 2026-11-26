#!/usr/bin/env node
// openui_check 的命令行入口：stdin 收一段 OpenUI Lang 程序（代码块里面的，不带围栏），stdout 出一行 JSON。
//
//   node bin/openui-check.mjs [--library <ask-openui-library.v1.json>] < program.txt
//
// 检查过了（不管有没有错）：退出码 0，{"ok": bool, "errors": [{code, statementId?, message}], "statements": n, "text": "给模型的话"}。
// 跑不了（组件库读不到、lang-core 加载不了、输入太大）：退出码 2，{"ok": false, "fatal": "原因"}。
// stdout 只写这一行 JSON；别的（包括 lang-core 自己打的日志）一律改到 stderr。
//
// 遥测：lang-core 在 Node 里有抽样遥测（默认关，设 OPENUI_RUNTIME_TELEMETRY_ENABLED=1 才发）。调用方起这个脚本时已经设了
// OPENUI_TELEMETRY_DISABLED=1、DO_NOT_TRACK=1 并去掉 OPENUI_RUNTIME_TELEMETRY_ENABLED；这里在加载 lang-core 之前再做一遍。
// 装依赖一律 `npm ci --ignore-scripts`：lang-core 的 postinstall 是安装统计。
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkProgram, MAX_PROGRAM_CHARS } from "../lib/check.mjs";

process.env.OPENUI_TELEMETRY_DISABLED = "1";
process.env.DO_NOT_TRACK = "1";
delete process.env.OPENUI_RUNTIME_TELEMETRY_ENABLED;

const here = dirname(fileURLToPath(import.meta.url));
// 仓库里的默认位置：backend/openui-check/bin → contracts/openui
const DEFAULT_LIBRARY = resolve(here, "..", "..", "..", "contracts", "openui", "ask-openui-library.v1.json");
// stdin 最多读多少字节（中文一个字 3 字节；超过字符上限的由 checkProgram 回 program-too-long）
const MAX_STDIN_BYTES = MAX_PROGRAM_CHARS * 4 + 1024;

const out = process.stdout;
// lang-core 或别的模块往 stdout 打的东西改到 stderr，stdout 只留结果
console.log = console.error;
console.info = console.error;
console.warn = console.error;

function reply(payload, code) {
  out.write(`${JSON.stringify(payload)}\n`, () => process.exit(code));
}

function libraryPath(argv) {
  const at = argv.indexOf("--library");
  if (at >= 0 && argv[at + 1]) {
    return resolve(argv[at + 1]);
  }
  return process.env.RETAIN_OPENUI_LIBRARY ? resolve(process.env.RETAIN_OPENUI_LIBRARY) : DEFAULT_LIBRARY;
}

async function readStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_STDIN_BYTES) {
      throw new Error(`program is larger than ${MAX_STDIN_BYTES} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  let program;
  try {
    program = await readStdin();
  } catch (error) {
    return reply({ ok: false, fatal: `读不了程序：${error.message}` }, 2);
  }
  let schema;
  let root = "Col";
  const path = libraryPath(process.argv.slice(2));
  try {
    const library = JSON.parse(readFileSync(path, "utf8"));
    schema = library.schema;
    root = typeof library.root === "string" && library.root ? library.root : root;
    if (!schema || typeof schema !== "object") {
      throw new Error("no schema field");
    }
  } catch (error) {
    return reply({ ok: false, fatal: `读不了组件库 ${path}：${error.message}` }, 2);
  }
  let createParser;
  try {
    ({ createParser } = await import("@openuidev/lang-core"));
  } catch (error) {
    return reply({ ok: false, fatal: `加载不了 @openuidev/lang-core（在 backend/openui-check 里 npm ci --ignore-scripts）：${error.message}` }, 2);
  }
  try {
    const result = checkProgram(createParser(schema, root), program);
    return reply(result, 0);
  } catch (error) {
    return reply({ ok: false, fatal: `解析器出错：${error?.message ?? error}` }, 2);
  }
}

main();
