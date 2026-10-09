// TypeScript 严格模式棘轮。
//
// 背景：tsconfig.json 在全量迁移时关掉了 strict（注释说「关键模块再逐步收紧」），之后一直
// 没收紧——没写类型的参数自动是 any、可能为空的值不检查。全开大约一千多处错误，没法一次改完。
// 本门禁用 tsconfig.strict.json 对整个项目跑一遍严格检查，按文件记错误数（棘轮，同 module-size）：
//   - 不在 baseline 的文件（含新文件）必须零错误；
//   - 在 baseline 里的文件，错误数不许上涨；
//   - 错误数下降 / 清零了，baseline 陈旧，失败，强制拧紧。
// 只按文件计数而不按目录列名单，是因为 tsc 检查一部分文件时会顺带检查它们引用的所有文件，
// 没法只对某几个目录开严格。
//
// 收紧后运行 `UPDATE_STRICT_BASELINE=1 node --import ./tests/helpers/register-jsx.mjs --test tests/architecture/strict-ratchet.test.mjs`
// 重新生成 baseline（只减不增）。baseline: tests/architecture/helpers/strict-baseline.json

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { PROJECT_ROOT } from "./helpers/source-scan.mjs";

const BASELINE_PATH = join(PROJECT_ROOT, "tests/architecture/helpers/strict-baseline.json");
const UPDATE_ENV = "UPDATE_STRICT_BASELINE";
const require = createRequire(import.meta.url);

/** 严格检查下每个文件的错误数。 */
function strictErrorsByFile() {
  // typescript 的 exports 没开放 bin/，从主入口（lib/typescript.js）推回包目录。
  const tsc = join(dirname(require.resolve("typescript")), "..", "bin", "tsc");
  let output = "";
  try {
    output = execFileSync(process.execPath, [tsc, "--noEmit", "-p", "tsconfig.strict.json"], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // 有错误时 tsc 以非零码退出，输出照样在 stdout 里。
    output = `${error.stdout || ""}`;
    if (!output.includes("error TS")) throw error;
  }
  const counts = {};
  for (const line of output.split("\n")) {
    const match = line.match(/^(src\/[^(]+)\(\d+,\d+\): error TS\d+/);
    if (match) counts[match[1]] = (counts[match[1]] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

const current = strictErrorsByFile();

test("严格模式错误只减不增（新文件必须零错误）", () => {
  if (process.env[UPDATE_ENV] === "1") {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const failures = [];
  for (const [file, count] of Object.entries(current)) {
    const allowed = baseline[file];
    if (allowed === undefined) failures.push(`${file}: ${count} 处（不在 baseline，必须零错误）`);
    else if (count > allowed) failures.push(`${file}: ${count} 处（上限 ${allowed}，多了 ${count - allowed}）`);
  }
  assert.deepEqual(
    failures,
    [],
    `以下文件在 tsconfig.strict.json 下的错误变多了：\n  ${failures.join("\n  ")}\n`
      + "运行 npx tsc --noEmit -p tsconfig.strict.json 看具体位置。",
  );
});

test("strict baseline 没有虚高（改好了必须拧紧）", () => {
  if (process.env[UPDATE_ENV] === "1") return;
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const stale = [];
  for (const [file, allowed] of Object.entries(baseline)) {
    const count = current[file] ?? 0;
    if (count < allowed) stale.push(`${file}: 实际 ${count} < baseline ${allowed}${count === 0 ? "（已清零）" : ""}`);
  }
  assert.deepEqual(
    stale,
    [],
    `以下文件的严格错误减少了，请拧紧 baseline：\n  ${stale.join("\n  ")}\n`
      + `运行 ${UPDATE_ENV}=1 node --import ./tests/helpers/register-jsx.mjs --test tests/architecture/strict-ratchet.test.mjs`,
  );
});
