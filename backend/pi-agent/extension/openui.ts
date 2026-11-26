/**
 * 回答里的互动块（OpenUI，2026-11-26）：`openui_spec`、`openui_check` 两个工具，语义和 Python 自带 agent 的
 * `backend/ask-agent/retainpdf_ask_agent/openui.py`、本机 agent 的 `retainpdf mcp` 一样（方案
 * docs/ops/planning/reader-ask/20261126-互动块后端实现.md）。
 *
 * - 说明文件（前端生成、后端只读）：`RETAIN_OPENUI_PROMPT` 指向 `contracts/openui/ask-openui-prompt.v1.json`；读不到就不注册这两个工具。
 *   L0（`intro`）不在这里加：桥把它写进私有配置目录，包装脚本用 `--append-system-prompt` 接在 `ask_system.txt` 后面（固定，走缓存）。
 * - `openui_check` 起子进程跑后端那个 Node 包 `backend/openui-check/bin/openui-check.mjs`（`RETAIN_OPENUI_CHECK`、
 *   组件库 `RETAIN_OPENUI_LIBRARY`、Node 是 `RETAIN_OPENUI_NODE`，没给就用跑 pi 的这个 node）。不在扩展里直接 import lang-core：
 *   一份检查代码、一份锁定的依赖（pi-agent 没有 node_modules，pi 用 jiti 直接加载 TS），遥测变量只设在子进程上，超时能杀掉。
 *
 * 不 import pi 的包，测试时用假的 `pi` 对象。
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import type { ToolResult } from "./book.ts";

export const SPEC_TOOL = "openui_spec";
export const CHECK_TOOL = "openui_check";
export const OPENUI_TOOLS = [SPEC_TOOL, CHECK_TOOL];
// 每一问最多取几次说明、检查几次（和 Python 版 openui.py 一样）
export const SPEC_CALLS_PER_TURN = 2;
export const CHECK_CALLS_PER_TURN = 3;
export const MAX_PROGRAM_CHARS = 40_000;
export const CHECK_TIMEOUT_MS = 15_000;
export const MAX_CHECK_OUTPUT_BYTES = 256 * 1024;
export const TELEMETRY_ENV = { OPENUI_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1" } as const;
export const TELEMETRY_ENABLE_ENV = "OPENUI_RUNTIME_TELEMETRY_ENABLED";
const UNAVAILABLE_HINT = "这次没法检查：照 openui_spec 取的说明仔细写，写简单些；或者不写互动块，用文字回答。";

export const OPENUI_TOOL_SPECS = [
  {
    name: SPEC_TOOL,
    label: "取互动块说明",
    description: "取写互动块（```openui-lang 代码块）要的说明：按段的 id 取，一次取齐要用的几段（系统提示词「互动块」那段列了可取的段）。"
      + "第一次写一定要取 core。只在能动手的小界面明显比文字清楚时才写互动块；解释一句话、看译文对不对、总结、"
      + "概念问答这类问题用文字回答，不取说明。",
    parameters: {
      type: "object",
      properties: {
        sections: { type: "array", items: { type: "string" }, minItems: 1, description: "要取的段的 id，例如 [\"core\", \"components:inputs\", \"functions:builtin\"]" },
      },
      required: ["sections"],
      additionalProperties: false,
    },
  },
  {
    name: CHECK_TOOL,
    label: "检查互动块",
    description: "检查一段 OpenUI Lang 程序（代码块里面的，不带 ``` 围栏）：组件名、参数、没定义或没被引用的名字。"
      + "没错回「没问题。」，有错逐条列出，改完再检查。",
    parameters: {
      type: "object",
      properties: {
        program: { type: "string", description: "OpenUI Lang 程序，每行一条 `名字 = 表达式`，有 root = Col([...])" },
      },
      required: ["program"],
      additionalProperties: false,
    },
  },
];

type Section = { id: string; summary?: string; tokens?: number; text: string };
export type OpenUiPrompt = { intro: string; sections: Section[] };

const result = (text: string, summary: string, isError = false): ToolResult => ({ text, images: [], isError, summary });
const toolError = (text: string): ToolResult => result(text, text.slice(0, 200), true);

/** 读说明文件；读不了、不是 v1 的样子就 null（不开互动块）。 */
export function loadPromptFile(path: string | undefined): OpenUiPrompt | null {
  if (!path) return null;
  let payload: any;
  try {
    payload = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || payload.version !== 1) return null;
  const intro = String(payload.intro ?? "").trim();
  const sections = (Array.isArray(payload.sections) ? payload.sections : [])
    .filter((section: any) => section && typeof section === "object" && section.id && typeof section.text === "string");
  return intro && sections.length ? { intro, sections } : null;
}

function catalog(prompt: OpenUiPrompt): string {
  return prompt.sections.map((section) => `- \`${section.id}\`：${section.summary ?? ""}（约 ${section.tokens ?? "?"} token）`).join("\n");
}

/** `openui_spec`：按给的顺序取各段（去重），拼起来；不认识的 id 回可取的列表。 */
export function specResult(prompt: OpenUiPrompt, raw: unknown): ToolResult {
  const list = typeof raw === "string" ? [raw] : raw;
  if (!Array.isArray(list) || !list.length || !list.every((item) => typeof item === "string")) {
    return toolError(`sections 要是段的 id 列表（字符串）。可取的段：\n${catalog(prompt)}`);
  }
  const wanted: string[] = [];
  for (const item of list as string[]) {
    const key = item.trim();
    if (key && !wanted.includes(key)) wanted.push(key);
  }
  const byId = new Map(prompt.sections.map((section) => [String(section.id), section]));
  const known = wanted.filter((key) => byId.has(key));
  const unknown = wanted.filter((key) => !byId.has(key));
  const quoted = (keys: string[]) => keys.map((key) => `\`${key}\``).join("、");
  if (!known.length) {
    return result(`不认识的段：${quoted(unknown) || "（空）"}。可取的段：\n${catalog(prompt)}`, "不认识的段", true);
  }
  let text = known.map((key) => byId.get(key)!.text.trim()).join("\n\n");
  if (unknown.length) {
    text += `\n\n（不认识的段：${quoted(unknown)}，没有取。可取的段：${quoted(prompt.sections.map((section) => String(section.id)))}。）`;
  }
  const tokens = known.reduce((sum, key) => sum + (Number(byId.get(key)!.tokens) || 0), 0);
  return result(text, `${known.join("、")}（约 ${tokens} token）`);
}

/** 起 openui-check 的环境变量：关掉 lang-core 的遥测。 */
export function checkEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  // ELECTRON_RUN_AS_NODE：桌面版的 node 可能是 Electron 本体（RETAINPDF_NODE_BIN），对真的 node 没影响
  const env: NodeJS.ProcessEnv = { ...base, ...TELEMETRY_ENV, ELECTRON_RUN_AS_NODE: "1" };
  delete env[TELEMETRY_ENABLE_ENV];
  return env;
}

export type CheckOutcome = { code: number | null; output: Buffer } | { error: "timeout" | "spawn"; message: string };
export type CheckRunner = (program: string, timeoutMs: number) => Promise<CheckOutcome>;

/** 起 `node <script> --library <library>`：stdin 写程序，stdout 最多读 `maxOutput + 1` 字节，超时杀掉。 */
export function nodeCheckRunner(options: { node: string; script: string; library: string; env?: NodeJS.ProcessEnv; maxOutput?: number }): CheckRunner {
  const maxOutput = options.maxOutput ?? MAX_CHECK_OUTPUT_BYTES;
  return (program, timeoutMs) => new Promise((done) => {
    let child;
    try {
      child = spawn(options.node, [options.script, "--library", options.library], {
        stdio: ["pipe", "pipe", "ignore"],
        env: checkEnv(options.env),
      });
    } catch (error) {
      done({ error: "spawn", message: String((error as Error)?.message ?? error) });
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (outcome: CheckOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(outcome);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ error: "timeout", message: `${timeoutMs} ms` });
    }, timeoutMs);
    child.on("error", (error) => finish({ error: "spawn", message: error.message }));
    child.stdout.on("data", (chunk: Buffer) => {
      if (size > maxOutput) return;
      size += chunk.length;
      chunks.push(chunk);
      if (size > maxOutput) child.kill("SIGKILL");
    });
    child.on("close", (code) => finish({ code, output: Buffer.concat(chunks) }));
    child.stdin.on("error", () => {});
    child.stdin.end(program, "utf8");
  });
}

/** `openui_check`：起检查器，回它拼好的话。检查器用不了、超时、输出不对都回一段说明（工具出错）。 */
export async function checkResult(runner: CheckRunner | null, program: unknown, options: { timeoutMs?: number; unavailable?: string } = {}): Promise<ToolResult> {
  const timeoutMs = options.timeoutMs ?? CHECK_TIMEOUT_MS;
  if (typeof program !== "string" || !program.trim()) {
    return toolError("program 要是一段 OpenUI Lang 程序（代码块里面的，不带 ``` 围栏）。");
  }
  if (program.length > MAX_PROGRAM_CHARS) {
    return toolError(`程序太长（${program.length} 字符，最多 ${MAX_PROGRAM_CHARS}）：互动块要小，拆小或删掉用不到的部分。`);
  }
  if (!runner) return toolError(`检查器用不了（${options.unavailable || "没配好 openui-check"}）。${UNAVAILABLE_HINT}`);
  const outcome = await runner(program, timeoutMs);
  if ("error" in outcome) {
    return outcome.error === "timeout"
      ? toolError(`检查超时（${timeoutMs / 1000} 秒）。${UNAVAILABLE_HINT}`)
      : toolError(`检查器起不来（Node.js：${outcome.message}）。${UNAVAILABLE_HINT}`);
  }
  if (outcome.output.length > MAX_CHECK_OUTPUT_BYTES) {
    return toolError(`检查器的输出太大（超过 ${MAX_CHECK_OUTPUT_BYTES} 字节）。${UNAVAILABLE_HINT}`);
  }
  let payload: any;
  try {
    const lines = outcome.output.toString("utf8").trim().split("\n");
    payload = JSON.parse(lines[lines.length - 1]);
  } catch {
    return toolError(`检查器没有回结果（退出码 ${outcome.code}）。${UNAVAILABLE_HINT}`);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return toolError(`检查器回的不是结果（退出码 ${outcome.code}）。${UNAVAILABLE_HINT}`);
  }
  if (payload.fatal) return toolError(`检查器用不了：${String(payload.fatal).slice(0, 500)}。${UNAVAILABLE_HINT}`);
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const text = String(payload.text || (payload.ok ? "没问题。" : "有问题，但检查器没说是什么。"));
  if (payload.ok) return result(text, "没问题");
  // 检查出了问题不算工具出错，问题在 text 里
  const codes = [...new Set(errors.filter((error: any) => error && typeof error === "object").map((error: any) => String(error.code)))].join("、");
  return result(text, `${errors.length} 处问题：${codes}`.slice(0, 200));
}

export class OpenUiTools {
  readonly prompt: OpenUiPrompt;
  readonly runner: CheckRunner | null;
  readonly unavailable: string;
  readonly timeoutMs: number;

  // 不用构造参数属性：node --test 只去掉类型，不认这种写法
  constructor(prompt: OpenUiPrompt, runner: CheckRunner | null, unavailable = "", timeoutMs = CHECK_TIMEOUT_MS) {
    this.prompt = prompt;
    this.runner = runner;
    this.unavailable = unavailable;
    this.timeoutMs = timeoutMs;
  }

  async run(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    if (name === SPEC_TOOL) return specResult(this.prompt, params.sections);
    if (name === CHECK_TOOL) return checkResult(this.runner, params.program, { timeoutMs: this.timeoutMs, unavailable: this.unavailable });
    return toolError(`没有工具 ${name}；互动块的工具是 ${SPEC_TOOL}、${CHECK_TOOL}。`);
  }
}

/** 按桥给的环境变量建工具；说明文件读不了就 null。检查器缺东西时照样建，`openui_check` 回说明。 */
export function makeOpenUiTools(env: NodeJS.ProcessEnv = process.env, defaultNode = process.execPath): OpenUiTools | null {
  const prompt = loadPromptFile(env.RETAIN_OPENUI_PROMPT?.trim());
  if (!prompt) return null;
  const library = env.RETAIN_OPENUI_LIBRARY?.trim() ?? "";
  const script = env.RETAIN_OPENUI_CHECK?.trim() ?? "";
  const node = env.RETAIN_OPENUI_NODE?.trim() || defaultNode;
  const missing = ([["组件库 ask-openui-library.v1.json", library], ["openui-check", script], ["Node.js", node]] as const)
    .filter(([, value]) => !value || !existsSync(value))
    .map(([label]) => label);
  if (missing.length) return new OpenUiTools(prompt, null, `没找到 ${missing.join("、")}`);
  return new OpenUiTools(prompt, nodeCheckRunner({ node, script, library }));
}
