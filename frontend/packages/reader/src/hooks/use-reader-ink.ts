// 阅读页画笔：在书页上圈、划、涂（2026-11-20，用户要的；后端先不管，笔迹存在这台电脑的浏览器里）。
//
// - 画笔模式：选了笔（画笔 / 荧光笔 / 橡皮）就进画笔模式，书页上拖动就是画；悬停框、选字暂停。Esc、P、再点一次退出。
// - 笔迹按页、按栏存：在原文上画的只在原文栏，译文上画的只在译文栏，「对比版本」左栏那一份另算（同一位置的字两边不一样，
//   画在一边的圈挪到另一边会圈到别的词）。坐标是这一页宽高的比例（0–1），缩放、切模式都不错位。
// - 存在 localStorage（retainpdf.reader.ink.v1:<书>），读写失败（无痕窗口、清过站点数据）就只在这次打开里有效。
//   以后接了后端，换掉 load / save 两处就行。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type InkTool = "pen" | "highlighter" | "eraser";

/** 笔迹画在哪一栏：原文、译文，或「对比版本」时左栏放的另一份译文。 */
export type InkPane = "source" | "translated" | "compare";

export type InkStroke = {
  id: string;
  page: number;
  /** 旧数据没有这一项，按译文算。 */
  pane?: InkPane;
  tool: Exclude<InkTool, "eraser">;
  color: string;
  /** 线宽，按页宽的比例。 */
  width: number;
  /** [x, y] 按页宽、页高的比例。 */
  points: Array<[number, number]>;
};

export type InkColor = { key: string; label: string };

/** 颜色用皮肤里的语义色名（CSS 变量），换皮肤跟着变。 */
export const INK_COLORS: readonly InkColor[] = [
  { key: "danger", label: "红" },
  { key: "accent", label: "墨" },
  { key: "ok", label: "绿" },
  { key: "gold", label: "黄" },
];

export const INK_WIDTH: Record<Exclude<InkTool, "eraser">, number> = { pen: 0.0035, highlighter: 0.018 };
/** 橡皮擦的半径，按页宽的比例。 */
export const ERASER_RADIUS = 0.015;

const STORE_PREFIX = "retainpdf.reader.ink.v1:";

function load(scope: string): InkStroke[] {
  if (!scope) return [];
  try {
    const raw = globalThis.localStorage?.getItem(STORE_PREFIX + scope);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((stroke) => stroke && Array.isArray(stroke.points)) : [];
  } catch {
    return [];
  }
}

function save(scope: string, strokes: readonly InkStroke[]): void {
  if (!scope) return;
  try {
    if (strokes.length) globalThis.localStorage?.setItem(STORE_PREFIX + scope, JSON.stringify(strokes));
    else globalThis.localStorage?.removeItem(STORE_PREFIX + scope);
  } catch {
    // 存不下就只在这次打开里有效。
  }
}

/** 橡皮擦过的笔迹：任何一个点离擦的位置不到半径（按页宽算，y 按页高换算成同一尺度）就擦掉。 */
export function strokesHitByEraser(strokes: readonly InkStroke[], page: number, pane: InkPane, x: number, y: number, aspect: number): string[] {
  const r2 = ERASER_RADIUS * ERASER_RADIUS;
  return strokes
    .filter((stroke) => onPane(stroke, page, pane) && stroke.points.some(([px, py]) => (px - x) ** 2 + ((py - y) * aspect) ** 2 <= r2))
    .map((stroke) => stroke.id);
}

/** 这一笔在不在这一页的这一栏。 */
export function onPane(stroke: InkStroke, page: number, pane: InkPane): boolean {
  return stroke.page === page && (stroke.pane || "translated") === pane;
}

/** 拖动时点太密就丢掉一些：和上一个点挨得比 min 还近的不要。 */
export function appendPoint(points: Array<[number, number]>, x: number, y: number, min = 0.0015): Array<[number, number]> {
  const last = points[points.length - 1];
  if (last && Math.abs(last[0] - x) < min && Math.abs(last[1] - y) < min) return points;
  return [...points, [x, y]];
}

export type ReaderInk = {
  /** 画笔模式下用的工具；null = 没在画笔模式。 */
  tool: InkTool | null;
  color: string;
  strokes: InkStroke[];
  setTool: (tool: InkTool | null) => void;
  setColor: (color: string) => void;
  add: (stroke: Omit<InkStroke, "id">) => void;
  erase: (ids: readonly string[]) => void;
  undo: () => void;
  /** 清掉这一页的笔迹（几栏都清）。 */
  clearPage: (page: number) => void;
};

export function useReaderInk(scope: string): ReaderInk {
  const [tool, setTool] = useState<InkTool | null>(null);
  const [color, setColor] = useState(INK_COLORS[0].key);
  const [strokes, setStrokes] = useState<InkStroke[]>(() => load(scope));
  const current = useRef(strokes);
  // 撤销：每一步记下当时的整份笔迹（画、擦、清一页都能撤）。
  const history = useRef<InkStroke[][]>([]);

  useEffect(() => {
    const loaded = load(scope);
    current.current = loaded;
    setStrokes(loaded);
    history.current = [];
  }, [scope]);

  // 状态更新函数里不放副作用（StrictMode 会调两次）：按 ref 里的当前值算好再一次写进去。
  const commit = useCallback((updated: InkStroke[]) => {
    current.current = updated;
    setStrokes(updated);
    save(scope, updated);
  }, [scope]);
  const change = useCallback((next: (strokes: InkStroke[]) => InkStroke[]) => {
    const before = current.current;
    const updated = next(before);
    if (updated === before) return;
    history.current = [...history.current.slice(-49), before];
    commit(updated);
  }, [commit]);

  const add = useCallback((stroke: Omit<InkStroke, "id">) => {
    if (stroke.points.length < 1) return;
    change((list) => [...list, { ...stroke, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }]);
  }, [change]);
  const erase = useCallback((ids: readonly string[]) => {
    if (!ids.length) return;
    change((list) => list.filter((stroke) => !ids.includes(stroke.id)));
  }, [change]);
  const clearPage = useCallback((page: number) => {
    change((list) => (list.some((stroke) => stroke.page === page) ? list.filter((stroke) => stroke.page !== page) : list));
  }, [change]);
  const undo = useCallback(() => {
    const previous = history.current.pop();
    if (previous) commit(previous);
  }, [commit]);

  return useMemo(
    () => ({ tool, color, strokes, setTool, setColor, add, erase, undo, clearPage }),
    [tool, color, strokes, add, erase, undo, clearPage],
  );
}
