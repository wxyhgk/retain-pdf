import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// 事件名/命令名是字符串契约,typo 只能运行时静默失效。
// 现状:retainpdf:* 事件已全部收敛在 contracts/app-contract.js 的 APP_EVENTS,
// 命令总线两端都走 RECENT_JOBS_COMMANDS 常量。本测试锁住这个状态,
// 禁止未来出现绕过契约的裸字面量。
// 扫描覆盖 .js 与 .jsx(React 迁移的新世界 src/app、src/shared 一并纳入)。

const PROJECT_ROOT = process.cwd();
const JS_ROOT = join(PROJECT_ROOT, "src/js");
const SRC_ROOT = join(PROJECT_ROOT, "src");
// src/features 是按功能重组后的新树，事件名扫描必须一并覆盖，
// 否则功能迁过去后契约门禁会漏扫。
const SCAN_ROOTS = [
  JS_ROOT,
  join(PROJECT_ROOT, "src/features"),
  join(PROJECT_ROOT, "src/app"),
  // src/shared 已在 A7 解散，共享 React 层落到 src/ui。
  join(PROJECT_ROOT, "src/ui"),
];
const EVENT_CONTRACT_FILE = join(JS_ROOT, "contracts/app-contract.js");
// generated/ 为构建产物(打包内联的事件名字面量来自源码,由源码扫描守卫)
const GENERATED_ROOT = join(JS_ROOT, "generated");

// 非事件用途的 retainpdf: 前缀字符串(如 localStorage key),逐条登记
const ALLOWED_LITERALS = [
  { file: join(SRC_ROOT, "features/app-update/domain/state.js"), literal: "retainpdf:update-check:v1" },
];

function walkJsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (fullPath === GENERATED_ROOT) {
      continue;
    }
    if (statSync(fullPath).isDirectory()) {
      results.push(...walkJsFiles(fullPath));
    } else if (entry.endsWith(".js") || entry.endsWith(".jsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = SCAN_ROOTS.filter((root) => existsSync(root)).flatMap(walkJsFiles);

test("retainpdf:* 事件名只允许定义在 contracts/app-contract.js", () => {
  const violations = [];
  for (const file of jsFiles) {
    if (file === EVENT_CONTRACT_FILE) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/["'](retainpdf:[^"']+)["']/g)) {
      const allowed = ALLOWED_LITERALS.some(
        (entry) => entry.file === file && entry.literal === match[1],
      );
      if (!allowed) {
        violations.push(`${relative(PROJECT_ROOT, file)}: "${match[1]}"`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `发现契约外的 retainpdf:* 字面量,请改用 APP_EVENTS 常量:\n  ${violations.join("\n  ")}`,
  );
});

test("命令总线与 CustomEvent 不允许裸字符串事件名", () => {
  const patterns = [
    [/\.dispatch\(\s*["']/, ".dispatch(\"...\")"],
    [/\.on\(\s*["']/, ".on(\"...\")"],
    [/dispatchEvent\(\s*new\s+CustomEvent\(\s*["']/, "dispatchEvent(new CustomEvent(\"...\"))"],
    [/addEventListener\(\s*["']retainpdf/, "addEventListener(\"retainpdf...\")"],
  ];
  const violations = [];
  for (const file of jsFiles) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, label] of patterns) {
      if (pattern.test(text)) {
        violations.push(`${relative(PROJECT_ROOT, file)}: ${label}`);
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `发现裸字符串事件/命令名,请引用契约常量:\n  ${violations.join("\n  ")}`,
  );
});
