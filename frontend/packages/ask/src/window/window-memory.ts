// 提问窗的摆法（浮动 / 贴右边）、浮动时的位置大小、贴右边的宽度、上次用的 agent：记在本机浏览器里（localStorage），
// 重开阅读页照旧（2026-11-27 用户：每次都要重新贴右边、调宽度、切 agent）。放大不记（下次打开不该一上来就盖满屏）。
// 只是图方便：读不到、写不进（隐私窗口、存储被禁）就当没记过。

import type { AskWindowMode } from "./AskHeader.js";

const KEY = "retainpdf.ask.window.v1";

export type AskWindowRect = { x: number; y: number; width: number; height: number };

export type AskWindowMemory = {
  mode?: Exclude<AskWindowMode, "full">;
  float?: AskWindowRect;
  dockWidth?: number;
  agentId?: string;
};

function isRect(value: unknown): value is AskWindowRect {
  const rect = value as AskWindowRect | null;
  return Boolean(rect) && ["x", "y", "width", "height"].every((key) => Number.isFinite((rect as Record<string, number>)[key]));
}

export function loadWindowMemory(): AskWindowMemory {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object") return {};
    return {
      ...(value.mode === "float" || value.mode === "dock" ? { mode: value.mode } : {}),
      ...(isRect(value.float) ? { float: value.float } : {}),
      ...(Number.isFinite(value.dockWidth) ? { dockWidth: value.dockWidth } : {}),
      ...(typeof value.agentId === "string" && value.agentId ? { agentId: value.agentId } : {}),
    };
  } catch {
    return {};
  }
}

export function saveWindowMemory(patch: AskWindowMemory): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ ...loadWindowMemory(), ...patch }));
  } catch {
    // 存不进就只管这一次。
  }
}

/** 记的浮动位置挪进现在的窗口（换了显示器、窗口变小了，不能停在屏幕外面）。 */
export function fitRect(rect: AskWindowRect, viewport: { width: number; height: number }, min = { width: 320, height: 280 }): AskWindowRect {
  const width = Math.max(min.width, Math.min(rect.width, viewport.width - 16));
  const height = Math.max(min.height, Math.min(rect.height, viewport.height - 16));
  const x = Math.max(0, Math.min(rect.x, viewport.width - width));
  const y = Math.max(0, Math.min(rect.y, viewport.height - height));
  return { x, y, width, height };
}

/** 列表里挑默认的 agent：上次用的（还能用的话），不然第一个能用的。 */
export function pickAgent(agents: readonly { id: string; available?: boolean }[], remembered: string | undefined): string {
  const usable = agents.filter((agent) => agent.available !== false);
  return (remembered && usable.some((agent) => agent.id === remembered) ? remembered : usable[0]?.id) || "";
}
