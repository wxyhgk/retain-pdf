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
export type InkColor = {
    key: string;
    label: string;
};
/** 颜色用皮肤里的语义色名（CSS 变量），换皮肤跟着变。 */
export declare const INK_COLORS: readonly InkColor[];
export declare const INK_WIDTH: Record<Exclude<InkTool, "eraser">, number>;
/** 橡皮擦的半径，按页宽的比例。 */
export declare const ERASER_RADIUS = 0.015;
/** 橡皮擦过的笔迹：任何一个点离擦的位置不到半径（按页宽算，y 按页高换算成同一尺度）就擦掉。 */
export declare function strokesHitByEraser(strokes: readonly InkStroke[], page: number, pane: InkPane, x: number, y: number, aspect: number): string[];
/** 这一笔在不在这一页的这一栏。 */
export declare function onPane(stroke: InkStroke, page: number, pane: InkPane): boolean;
/** 拖动时点太密就丢掉一些：和上一个点挨得比 min 还近的不要。 */
export declare function appendPoint(points: Array<[number, number]>, x: number, y: number, min?: number): Array<[number, number]>;
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
export declare function useReaderInk(scope: string): ReaderInk;
//# sourceMappingURL=use-reader-ink.d.ts.map