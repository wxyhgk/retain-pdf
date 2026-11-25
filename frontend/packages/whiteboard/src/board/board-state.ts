// 无限白板的数据和几何（纯函数）：白板上的东西放在「世界坐标」里，视图是平移 + 缩放。
// 屏幕上的一点 = 世界坐标 × zoom + (x, y)。

export type BoardNote = {
  id: string;
  kind: "note";
  /** 左上角（世界坐标）。 */
  x: number;
  y: number;
  /** 宽度；高度跟着内容走。 */
  w: number;
  /** Markdown，公式写在 $…$ 里。 */
  text: string;
};

export type BoardItem = BoardNote;

export type BoardView = { x: number; y: number; zoom: number };

export type BoardDoc = {
  version: 1;
  items: BoardItem[];
  view: BoardView;
};

export const BOARD_ZOOM = { min: 0.25, max: 3 } as const;
export const NOTE_WIDTH = { default: 320, min: 160, max: 1200 } as const;

export function emptyBoard(): BoardDoc {
  return { version: 1, items: [], view: { x: 0, y: 0, zoom: 1 } };
}

export type Point = { x: number; y: number };

export function screenToWorld(view: BoardView, point: Point): Point {
  return { x: (point.x - view.x) / view.zoom, y: (point.y - view.y) / view.zoom };
}

export function clampZoom(zoom: number): number {
  return Math.min(BOARD_ZOOM.max, Math.max(BOARD_ZOOM.min, zoom));
}

/** 以屏幕上的某一点为中心缩放（滚轮 / 捏合：鼠标下面那一点不动）。 */
export function zoomAt(view: BoardView, point: Point, zoom: number): BoardView {
  const next = clampZoom(zoom);
  const world = screenToWorld(view, point);
  return { zoom: next, x: point.x - world.x * next, y: point.y - world.y * next };
}

export function panBy(view: BoardView, dx: number, dy: number): BoardView {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

export type Size = { w: number; h: number };

/**
 * 让所有东西都看得见（「看全部」）：留 48px 边，最多放大到 1 倍。
 * heights 是每张卡片现在的高度（量出来的，按 id）；没量到的按 120 算。
 */
export function fitView(items: readonly BoardItem[], size: Size, heights: ReadonlyMap<string, number> = new Map()): BoardView {
  if (!items.length || size.w <= 0 || size.h <= 0) return { x: size.w / 2, y: size.h / 2, zoom: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.w);
    maxY = Math.max(maxY, item.y + (heights.get(item.id) ?? 120));
  }
  const pad = 48;
  const zoom = clampZoom(Math.min(1, (size.w - pad * 2) / Math.max(1, maxX - minX), (size.h - pad * 2) / Math.max(1, maxY - minY)));
  return {
    zoom,
    x: (size.w - (maxX - minX) * zoom) / 2 - minX * zoom,
    y: (size.h - (maxY - minY) * zoom) / 2 - minY * zoom,
  };
}

let counter = 0;
export function newId(prefix = "note"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function addNote(doc: BoardDoc, at: Point, text = "", id = newId()): { doc: BoardDoc; id: string } {
  const note: BoardNote = { id, kind: "note", x: Math.round(at.x), y: Math.round(at.y), w: NOTE_WIDTH.default, text };
  return { doc: { ...doc, items: [...doc.items, note] }, id };
}

export function updateItem(doc: BoardDoc, id: string, patch: Partial<Omit<BoardNote, "id" | "kind">>): BoardDoc {
  return {
    ...doc,
    items: doc.items.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      if (patch.w !== undefined) next.w = Math.round(Math.min(NOTE_WIDTH.max, Math.max(NOTE_WIDTH.min, patch.w)));
      return next;
    }),
  };
}

export function removeItem(doc: BoardDoc, id: string): BoardDoc {
  return { ...doc, items: doc.items.filter((item) => item.id !== id) };
}

/** 拿到前面去（点了哪张哪张在上面）。 */
export function bringToFront(doc: BoardDoc, id: string): BoardDoc {
  const item = doc.items.find((entry) => entry.id === id);
  if (!item || doc.items[doc.items.length - 1]?.id === id) return doc;
  return { ...doc, items: [...doc.items.filter((entry) => entry.id !== id), item] };
}

/** 读存档：不认识的版本、坏数据都当成空白板。 */
export function parseBoard(raw: unknown): BoardDoc {
  const value = raw as Partial<BoardDoc> | null;
  if (!value || value.version !== 1 || !Array.isArray(value.items)) return emptyBoard();
  const items = value.items.filter((item): item is BoardNote => Boolean(item)
    && (item as BoardNote).kind === "note"
    && typeof (item as BoardNote).id === "string"
    && Number.isFinite((item as BoardNote).x) && Number.isFinite((item as BoardNote).y)
    && Number.isFinite((item as BoardNote).w) && typeof (item as BoardNote).text === "string");
  const view = value.view && Number.isFinite(value.view.x) && Number.isFinite(value.view.y) && Number.isFinite(value.view.zoom)
    ? { x: value.view.x, y: value.view.y, zoom: clampZoom(value.view.zoom) }
    : { x: 0, y: 0, zoom: 1 };
  return { version: 1, items, view };
}
