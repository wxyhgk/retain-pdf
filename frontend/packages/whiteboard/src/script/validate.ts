// 播放前把模型给的 JSON 过一遍：结构不对的指令变成 UnknownOp（板上标一句），不抛错、不让整块板崩。
// 只有顶层就不是脚本时才给一份空脚本。issues 是给开发者看的说明（写进日志 / 测试）。

import type { BoardOp, BoardScript, BoardStep, KnownOp, Tone } from "./types.js";
import { KNOWN_OPS } from "./types.js";

export const SCRIPT_LIMITS = {
  steps: 100,
  opsPerStep: 40,
  text: 400,
  tex: 1000,
  say: 600,
  levels: 12,
} as const;

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/;
const TONES: readonly Tone[] = ["focus", "correct", "wrong"];

export type ValidatedScript = {
  script: BoardScript;
  issues: string[];
};

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function tone(value: unknown): Tone | undefined {
  return TONES.includes(value as Tone) ? (value as Tone) : undefined;
}

class Rejected extends Error {}

function reject(reason: string): never {
  throw new Rejected(reason);
}

function requireText(raw: Raw, key: string, max: number): string {
  const value = text(raw[key]);
  if (value === undefined || !value.trim()) reject(`缺少 ${key}`);
  if (value.length > max) reject(`${key} 超过 ${max} 个字符`);
  return value;
}

function optionalText(raw: Raw, key: string, max: number): string | undefined {
  const value = text(raw[key]);
  if (value === undefined) return undefined;
  if (value.length > max) reject(`${key} 超过 ${max} 个字符`);
  return value;
}

function requireRef(raw: Raw, key: string, known: Set<string>): string {
  const value = text(raw[key]);
  if (!value) reject(`缺少 ${key}`);
  if (!known.has(value)) reject(`${key} 指向不存在的「${value}」`);
  return value;
}

function placement(raw: Raw, known: Set<string>): { below?: string; right_of?: string } {
  const out: { below?: string; right_of?: string } = {};
  if (raw.below !== undefined) out.below = requireRef(raw, "below", known);
  if (raw.right_of !== undefined) out.right_of = requireRef(raw, "right_of", known);
  if (out.below && out.right_of) reject("below 和 right_of 只能写一个");
  return out;
}

function newId(raw: Raw, known: Set<string>): string {
  const id = text(raw.id);
  if (!id || !ID_PATTERN.test(id)) reject(`id「${id ?? ""}」不合规矩（字母开头，字母数字 _ -，最多 41 个字符）`);
  if (known.has(id)) reject(`id「${id}」重复`);
  return id;
}

function parseOp(raw: Raw, known: Set<string>): KnownOp {
  switch (raw.op) {
    case "write": {
      const id = newId(raw, known);
      const plain = optionalText(raw, "text", SCRIPT_LIMITS.text);
      const math = optionalText(raw, "math", SCRIPT_LIMITS.tex);
      if ((plain === undefined) === (math === undefined)) reject("write 要在 text 和 math 里二选一");
      if (!(plain ?? math)?.trim()) reject("write 的内容是空的");
      const size = raw.size === "s" || raw.size === "l" ? raw.size : raw.size === undefined || raw.size === "m" ? undefined : reject("size 只能是 s、m、l");
      const op: KnownOp = { op: "write", id, ...placement(raw, known), ...(plain !== undefined ? { text: plain } : { math }), ...(size ? { size } : {}) };
      known.add(id);
      return op;
    }
    case "mark": {
      const style = raw.style === undefined ? undefined : ["box", "underline", "highlight"].includes(raw.style as string) ? raw.style as "box" | "underline" | "highlight" : reject("style 只能是 box、underline、highlight");
      return { op: "mark", target: requireRef(raw, "target", known), ...(style ? { style } : {}), ...(tone(raw.tone) ? { tone: tone(raw.tone) } : {}) };
    }
    case "arrow": {
      const label = optionalText(raw, "label", 60);
      return {
        op: "arrow",
        from: requireRef(raw, "from", known),
        to: requireRef(raw, "to", known),
        ...(label ? { label } : {}),
        ...(tone(raw.tone) ? { tone: tone(raw.tone) } : {}),
      };
    }
    case "note":
      return {
        op: "note",
        target: requireRef(raw, "target", known),
        text: requireText(raw, "text", SCRIPT_LIMITS.text),
        ...(tone(raw.tone) ? { tone: tone(raw.tone) } : {}),
      };
    case "erase": {
      const target = requireRef(raw, "target", known);
      known.delete(target);
      return { op: "erase", target };
    }
    case "focus":
      return { op: "focus", target: requireRef(raw, "target", known) };
    case "levels": {
      const id = newId(raw, known);
      const rawLevels = Array.isArray(raw.levels) ? raw.levels : reject("levels 要是数组");
      if (!rawLevels.length) reject("levels 是空的");
      if (rawLevels.length > SCRIPT_LIMITS.levels) reject(`levels 超过 ${SCRIPT_LIMITS.levels} 条`);
      const levels = rawLevels.map((level, index) => {
        if (!isRecord(level)) reject(`第 ${index + 1} 条能级不是对象`);
        const energy = level.energy;
        if (typeof energy !== "number" || !Number.isFinite(energy)) reject(`第 ${index + 1} 条能级的 energy 不是数`);
        const electrons = level.electrons;
        if (electrons !== undefined && electrons !== 0 && electrons !== 1 && electrons !== 2) reject(`第 ${index + 1} 条能级的 electrons 只能是 0、1、2`);
        return { label: requireText(level, "label", 40), energy, ...(electrons !== undefined ? { electrons: electrons as 0 | 1 | 2 } : {}) };
      });
      const axis = optionalText(raw, "axis", 40);
      const op: KnownOp = { op: "levels", id, ...placement(raw, known), ...(axis ? { axis } : {}), levels };
      known.add(id);
      return op;
    }
    default:
      return reject(`不认识的指令「${String(raw.op)}」，认识的是 ${KNOWN_OPS.join("、")}`);
  }
}

function describe(raw: unknown): string {
  try {
    return JSON.stringify(raw).slice(0, 120);
  } catch {
    return String(raw).slice(0, 120);
  }
}

export function validateScript(input: unknown): ValidatedScript {
  const issues: string[] = [];
  if (!isRecord(input) || !Array.isArray(input.steps)) {
    return { script: { version: 1, steps: [] }, issues: ["不是讲解脚本：缺少 steps 数组"] };
  }
  if (input.version !== 1) issues.push(`version 是 ${String(input.version)}，按 1 读`);
  const rawSteps = input.steps.slice(0, SCRIPT_LIMITS.steps);
  if (input.steps.length > SCRIPT_LIMITS.steps) issues.push(`步数超过 ${SCRIPT_LIMITS.steps}，后面的不播`);

  const known = new Set<string>();
  const stepIds = new Set<string>();
  const steps: BoardStep[] = rawSteps.map((rawStep, stepIndex) => {
    const step = isRecord(rawStep) ? rawStep : {};
    let id = text(step.id) || `step-${stepIndex + 1}`;
    if (stepIds.has(id)) {
      issues.push(`第 ${stepIndex + 1} 步的 id「${id}」重复，改成 step-${stepIndex + 1}`);
      id = `step-${stepIndex + 1}`;
    }
    stepIds.add(id);
    let say = text(step.say);
    if (say && say.length > SCRIPT_LIMITS.say) {
      issues.push(`第 ${stepIndex + 1} 步的字幕超过 ${SCRIPT_LIMITS.say} 个字符，截断`);
      say = say.slice(0, SCRIPT_LIMITS.say);
    }
    const rawOps = Array.isArray(step.ops) ? step.ops.slice(0, SCRIPT_LIMITS.opsPerStep) : [];
    if (Array.isArray(step.ops) && step.ops.length > SCRIPT_LIMITS.opsPerStep) {
      issues.push(`第 ${stepIndex + 1} 步的指令超过 ${SCRIPT_LIMITS.opsPerStep} 条，后面的不播`);
    }
    const ops: BoardOp[] = rawOps.map((rawOp, opIndex) => {
      try {
        if (!isRecord(rawOp)) reject("指令不是对象");
        return parseOp(rawOp, known);
      } catch (error) {
        if (!(error instanceof Rejected)) throw error;
        issues.push(`第 ${stepIndex + 1} 步第 ${opIndex + 1} 条：${error.message}`);
        return { op: "unknown", original: describe(rawOp), reason: error.message };
      }
    });
    return { id, ...(say ? { say } : {}), ops };
  });

  const title = text(input.title);
  return { script: { version: 1, ...(title ? { title: title.slice(0, 120) } : {}), steps }, issues };
}
