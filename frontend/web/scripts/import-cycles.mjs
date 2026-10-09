// 文件级 import 环检测（Tarjan SCC）。
//
// 背景：architecture 下有分层方向、CSS/DOM 等多条门禁，但**没有任何一条**
// 检查「文件 A 依赖 B、B 又依赖 A」这类循环依赖。分层方向门禁只看层的归属，
// 同一层内部（甚至跨层回边，例如 features/jobs ↔ features/job-detail）绕成环
// 时完全不会被发现。本脚本补上这层能力。
//
// 设计要点：
// - 只扫描 src/**/*.{ts,tsx}，只统计**值依赖**。
//   * `import type ...` / `export type ... from` 整条忽略；
//   * `import { type X } from` / `export { type X } from` 若命名绑定全是
//     `type` 前缀也忽略；`{ type X, Y }` 因为存在值绑定 Y 仍然计入；
//   * 动态 `import("...")` 计入（但 `typeof import("x")` / `as import("x")`
//     是 TS 的 import type 节点，属于类型位置，忽略）；
//   * 裸模块（react、@retainpdf/*、node:* 等）不在 src 图内，忽略。
// - 解析 @/ 别名、相对 ./ ../、.js→.ts/.tsx、目录 index。
// - Tarjan 求强连通分量（SCC），大小 > 1（或存在自环）即为循环。
//
// 人工运行：node scripts/import-cycles.mjs [--json]
// 测试门禁：tests/architecture/import-cycles.test.mjs

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
export const SRC_DIR = join(PROJECT_ROOT, "src");

// ---------------------------------------------------------------------------
// 词法：把源码切成最小 token，跳过注释/空白，保留字符串字面量。
// 目的不是完整 JS/TS parser，而是稳健地找到 import/export 声明并区分
// type-only 与值依赖。注释、字符串、模板、正则都会被正确跳过。
// ---------------------------------------------------------------------------

const ID_START = /[A-Za-z_$]/;
const ID_PART = /[A-Za-z0-9_$]/;
const REGEX_PRECEDING = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "do", "else", "case", "yield", "await", "throw",
]);

function readString(code, i) {
  const quote = code[i];
  let j = i + 1;
  let value = "";
  while (j < code.length) {
    const ch = code[j];
    if (ch === "\\") {
      value += code[j + 1] ?? "";
      j += 2;
      continue;
    }
    if (ch === quote) {
      j += 1;
      break;
    }
    if (ch === "\n") break; // 未闭合，止损
    value += ch;
    j += 1;
  }
  return { value, end: j };
}

function readTemplate(code, i) {
  let j = i + 1;
  while (j < code.length) {
    const ch = code[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === "`") return j + 1;
    if (ch === "$" && code[j + 1] === "{") {
      j = skipBraced(code, j + 2);
      continue;
    }
    j += 1;
  }
  return j;
}

function skipBraced(code, start) {
  let depth = 1;
  let k = start;
  while (k < code.length && depth > 0) {
    const ch = code[k];
    if (ch === "\\") {
      k += 2;
      continue;
    }
    if (ch === "/" && code[k + 1] === "/") {
      k += 2;
      while (k < code.length && code[k] !== "\n") k += 1;
      continue;
    }
    if (ch === "/" && code[k + 1] === "*") {
      k += 2;
      while (k < code.length && !(code[k] === "*" && code[k + 1] === "/")) k += 1;
      k += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      k = readString(code, k).end;
      continue;
    }
    if (ch === "`") {
      k = readTemplate(code, k);
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    k += 1;
  }
  return k;
}

function readRegex(code, i) {
  let j = i + 1;
  let inClass = false;
  while (j < code.length) {
    const ch = code[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === "\n") return null;
    if (ch === "[") inClass = true;
    else if (ch === "]") inClass = false;
    else if (ch === "/" && !inClass) {
      j += 1;
      while (j < code.length && /[a-z]/i.test(code[j])) j += 1;
      return { value: code.slice(i, j), end: j };
    }
    j += 1;
  }
  return null;
}

function regexAllowed(prev) {
  if (!prev) return true;
  if (prev.kind === "punct") return prev.value !== ")" && prev.value !== "]" && prev.value !== "}";
  if (prev.kind === "ident") return REGEX_PRECEDING.has(prev.value);
  return false;
}

export function tokenize(code) {
  const tokens = [];
  const n = code.length;
  let i = 0;
  while (i < n) {
    const c = code[i];
    if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\f" || c === "\v") {
      i += 1;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      i += 2;
      while (i < n && code[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < n && !(code[i] === "*" && code[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const r = readString(code, i);
      tokens.push({ kind: "string", value: r.value, start: i });
      i = r.end;
      continue;
    }
    if (c === "`") {
      const end = readTemplate(code, i);
      tokens.push({ kind: "template", value: code.slice(i, end), start: i });
      i = end;
      continue;
    }
    if (c === "/" && regexAllowed(tokens[tokens.length - 1])) {
      const r = readRegex(code, i);
      if (r) {
        tokens.push({ kind: "regex", value: r.value, start: i });
        i = r.end;
        continue;
      }
    }
    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < n && ID_PART.test(code[j])) j += 1;
      tokens.push({ kind: "ident", value: code.slice(i, j), start: i });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(code[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && /[0-9a-fA-FxXoObBeE_n.]/.test(code[j])) j += 1;
      tokens.push({ kind: "number", value: code.slice(i, j), start: i });
      i = j;
      continue;
    }
    tokens.push({ kind: "punct", value: c, start: i });
    i += 1;
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// 语法：从 token 流中抽取 import/export ... from 的模块说明符。
// ---------------------------------------------------------------------------

function isPunct(t, value) {
  return t && t.kind === "punct" && t.value === value;
}

function isIdent(t, value) {
  return t && t.kind === "ident" && t.value === value;
}

/** 找到 `from "spec"` 中的 spec，返回 { spec, end } 或 null。遇到 `;`/`{` 边界止损。 */
function findFromSpecifier(tokens, start) {
  for (let k = start; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (isPunct(t, ";")) return null;
    if (isIdent(t, "from") && tokens[k + 1] && tokens[k + 1].kind === "string") {
      return { spec: tokens[k + 1].value, end: k + 2 };
    }
    // `export { a }` 之后若没有 from，不应跨语句匹配
    if (isPunct(t, "}") && !isIdent(tokens[k + 1], "from") && !isPunct(tokens[k + 1], "as")) {
      return null;
    }
  }
  return null;
}

/** `{ ... }` 内是否全部是 type-only 命名绑定。 */
function bracesAreTypeOnly(tokens, braceStart) {
  let depth = 0;
  let allType = true;
  let sawSpecifier = false;
  let expectFirst = true;
  for (let k = braceStart; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (isPunct(t, "{")) {
      depth += 1;
      if (depth === 1) {
        expectFirst = true;
        continue;
      }
    } else if (isPunct(t, "}")) {
      depth -= 1;
      if (depth === 0) break;
      continue;
    } else if (isPunct(t, ",") && depth === 1) {
      expectFirst = true;
      continue;
    }
    if (depth !== 1) continue;
    if (expectFirst) {
      expectFirst = false;
      sawSpecifier = true;
      if (!isIdent(t, "type")) allType = false;
    }
  }
  return sawSpecifier && allType;
}

function parseImport(tokens, importIndex) {
  const next = tokens[importIndex + 1];
  if (!next) return null;

  // 动态 import("spec")，排除 typeof/as 以及 `type X = import(...)` 类型位置
  if (isPunct(next, "(")) {
    const spec = tokens[importIndex + 2];
    if (spec && spec.kind === "string") {
      const prev = tokens[importIndex - 1];
      let typePosition = isIdent(prev, "typeof") || isIdent(prev, "as");
      if (!typePosition && isPunct(prev, "=")) {
        // `type Alias = import("x").T`：`=` 之前是 `<ident> =` 且更前是 `type`
        const nameToken = tokens[importIndex - 2];
        const typeToken = tokens[importIndex - 3];
        if (nameToken && nameToken.kind === "ident" && isIdent(typeToken, "type")) typePosition = true;
      }
      if (!typePosition) return { spec: spec.value, dynamic: true, typeOnly: false, end: importIndex + 4 };
    }
    return null;
  }

  // 副作用 import "spec"
  if (next.kind === "string") {
    return { spec: next.value, dynamic: false, typeOnly: false, end: importIndex + 2 };
  }

  // import type ...
  let typeOnly = isIdent(next, "type");
  const from = findFromSpecifier(tokens, importIndex + 1);
  if (!from) return null;

  if (!typeOnly) {
    const clauseStart = typeOnly ? importIndex + 2 : importIndex + 1;
    const first = tokens[clauseStart];
    if (first && isPunct(first, "{")) {
      typeOnly = bracesAreTypeOnly(tokens, clauseStart);
    }
  }
  return { spec: from.spec, dynamic: false, typeOnly, end: from.end };
}

function parseExport(tokens, exportIndex) {
  const next = tokens[exportIndex + 1];
  if (!next) return null;

  if (isPunct(next, "*")) {
    const from = findFromSpecifier(tokens, exportIndex + 1);
    return from ? { spec: from.spec, dynamic: false, typeOnly: false, end: from.end } : null;
  }

  if (isIdent(next, "type")) {
    const after = tokens[exportIndex + 2];
    if (isPunct(after, "{") || isPunct(after, "*")) {
      const from = findFromSpecifier(tokens, exportIndex + 2);
      return from ? { spec: from.spec, dynamic: false, typeOnly: true, end: from.end } : null;
    }
    return null;
  }

  if (isPunct(next, "{")) {
    const from = findFromSpecifier(tokens, exportIndex + 1);
    if (!from) return null;
    const typeOnly = bracesAreTypeOnly(tokens, exportIndex + 1);
    return { spec: from.spec, dynamic: false, typeOnly, end: from.end };
  }

  return null;
}

/** 抽取一个文件的**值依赖**说明符列表（保持出现顺序，含重复）。
 *  includeDynamic=false 时不计动态 import()——用来算「首屏同步加载哪些文件」。 */
export function extractValueSpecifiers(code, { includeDynamic = true } = {}) {
  const tokens = tokenize(code);
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.kind !== "ident") continue;
    let dep = null;
    if (t.value === "import") dep = parseImport(tokens, i);
    else if (t.value === "export") dep = parseExport(tokens, i);
    if (!dep || dep.typeOnly) continue;
    if (dep.dynamic && !includeDynamic) {
      if (dep.end) i = dep.end - 1;
      continue;
    }
    out.push(dep.spec);
    if (dep.end) i = dep.end - 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 依赖图与 SCC
// ---------------------------------------------------------------------------

function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) out.push(resolve(full));
  }
  return out;
}

export function listSourceFiles() {
  if (!existsSync(SRC_DIR)) throw new Error(`src 目录不存在: ${SRC_DIR}`);
  return walk(SRC_DIR, []).sort();
}

function resolveSpecifier(spec, importerFile, fileSet) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC_DIR, spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = resolve(dirname(importerFile), spec);
  else return null;

  const candidates = [base];
  if (base.endsWith(".js")) {
    const stem = base.slice(0, -3);
    candidates.push(`${stem}.ts`, `${stem}.tsx`);
  } else if (base.endsWith(".jsx")) {
    const stem = base.slice(0, -4);
    candidates.push(`${stem}.tsx`, `${stem}.ts`);
  } else if (base.endsWith(".mjs")) {
    candidates.push(`${base.slice(0, -4)}.mts`);
  }
  candidates.push(`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx"));

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

/** 构建文件级依赖图。返回 { files, byFile: Map<abs, abs[]>, external: Map<abs,string[]> }。
 *  includeDynamic=false 只连静态 import（首屏同步加载的那张图）。 */
export function buildGraph({ includeDynamic = true } = {}) {
  const files = listSourceFiles();
  const fileSet = new Set(files);
  const byFile = new Map();
  const external = new Map();
  for (const file of files) {
    const code = readFileSync(file, "utf8");
    const specs = extractValueSpecifiers(code, { includeDynamic });
    const deps = [];
    const ext = [];
    for (const spec of specs) {
      const target = resolveSpecifier(spec, file, fileSet);
      if (target && target !== file) deps.push(target);
      else if (!target) ext.push(spec);
    }
    byFile.set(file, [...new Set(deps)]);
    external.set(file, ext);
  }
  return { files, byFile, external };
}

/** Tarjan SCC（迭代实现，避免深图递归爆栈）。 */
export function findSccs(nodes, successorsOf) {
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const result = [];
  let counter = 0;

  for (const root of nodes) {
    if (index.has(root)) continue;
    const work = [{ node: root, next: 0 }];
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const { node } = frame;
      if (frame.next === 0) {
        index.set(node, counter);
        low.set(node, counter);
        counter += 1;
        stack.push(node);
        onStack.add(node);
      }
      const successors = successorsOf(node);
      if (frame.next < successors.length) {
        const succ = successors[frame.next];
        frame.next += 1;
        if (!index.has(succ)) {
          work.push({ node: succ, next: 0 });
        } else if (onStack.has(succ)) {
          low.set(node, Math.min(low.get(node), index.get(succ)));
        }
        continue;
      }
      if (low.get(node) === index.get(node)) {
        const component = [];
        let member;
        do {
          member = stack.pop();
          onStack.delete(member);
          component.push(member);
        } while (member !== node);
        result.push(component);
      }
      work.pop();
      if (work.length > 0) {
        const parent = work[work.length - 1].node;
        low.set(parent, Math.min(low.get(parent), low.get(node)));
      }
    }
  }
  return result;
}

export function toRepoPath(absPath) {
  return relative(PROJECT_ROOT, absPath).split(sep).join("/");
}

/** 规范化一个循环：成员排序 + 内部规范化边。 */
export function normalizeCycle(members, byFile) {
  const set = new Set(members);
  const sorted = [...members].map(toRepoPath).sort();
  const edges = [];
  for (const from of members) {
    for (const to of byFile.get(from) ?? []) {
      if (set.has(to)) edges.push(`${toRepoPath(from)} -> ${toRepoPath(to)}`);
    }
  }
  edges.sort();
  return { members: sorted, edges };
}

/** 分析当前仓库，返回所有循环（按成员数降序、再按成员字典序）。 */
export function analyzeImportCycles() {
  const { files, byFile } = buildGraph();
  const sccs = findSccs(files, (node) => byFile.get(node) ?? []);
  const cycles = [];
  for (const component of sccs) {
    if (component.length > 1) cycles.push(normalizeCycle(component, byFile));
  }
  cycles.sort((a, b) => b.members.length - a.members.length || a.members.join("|").localeCompare(b.members.join("|")));
  return cycles;
}

export function formatCycleSummary(cycles) {
  const lines = [`import 环检测：发现 ${cycles.length} 个循环`];
  cycles.forEach((cycle, i) => {
    lines.push("");
    lines.push(`[${i + 1}] ${cycle.members.length} 个文件、${cycle.edges.length} 条内部边`);
    for (const member of cycle.members) lines.push(`    - ${member}`);
    lines.push("  内部边:");
    for (const edge of cycle.edges) lines.push(`    ${edge}`);
  });
  return lines.join("\n");
}

function main() {
  const cycles = analyzeImportCycles();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(cycles, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${formatCycleSummary(cycles)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
