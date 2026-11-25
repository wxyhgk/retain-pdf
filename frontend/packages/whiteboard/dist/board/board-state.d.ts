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
export type BoardView = {
    x: number;
    y: number;
    zoom: number;
};
export type BoardDoc = {
    version: 1;
    items: BoardItem[];
    view: BoardView;
};
export declare const BOARD_ZOOM: {
    readonly min: 0.25;
    readonly max: 3;
};
export declare const NOTE_WIDTH: {
    readonly default: 320;
    readonly min: 160;
    readonly max: 1200;
};
export declare function emptyBoard(): BoardDoc;
export type Point = {
    x: number;
    y: number;
};
export declare function screenToWorld(view: BoardView, point: Point): Point;
export declare function clampZoom(zoom: number): number;
/** 以屏幕上的某一点为中心缩放（滚轮 / 捏合：鼠标下面那一点不动）。 */
export declare function zoomAt(view: BoardView, point: Point, zoom: number): BoardView;
export declare function panBy(view: BoardView, dx: number, dy: number): BoardView;
export type Size = {
    w: number;
    h: number;
};
/**
 * 让所有东西都看得见（「看全部」）：留 48px 边，最多放大到 1 倍。
 * heights 是每张卡片现在的高度（量出来的，按 id）；没量到的按 120 算。
 */
export declare function fitView(items: readonly BoardItem[], size: Size, heights?: ReadonlyMap<string, number>): BoardView;
export declare function newId(prefix?: string): string;
export declare function addNote(doc: BoardDoc, at: Point, text?: string, id?: string): {
    doc: BoardDoc;
    id: string;
};
export declare function updateItem(doc: BoardDoc, id: string, patch: Partial<Omit<BoardNote, "id" | "kind">>): BoardDoc;
export declare function removeItem(doc: BoardDoc, id: string): BoardDoc;
/** 拿到前面去（点了哪张哪张在上面）。 */
export declare function bringToFront(doc: BoardDoc, id: string): BoardDoc;
/** 读存档：不认识的版本、坏数据都当成空白板。 */
export declare function parseBoard(raw: unknown): BoardDoc;
