import type { DraggableData, Position, ResizableDelta } from "react-rnd";
import type { AskWindowMode } from "./AskHeader.js";
/** 贴右边时上下让出宿主页面的栏（宿主不给时：上面让 60px，下面不让）。RetainPDF 阅读页 2026-11-28 起是三行壳层，
 * 给 { top: 顶栏高, bottom: 底栏高 }，贴右边的窗口正好落在中间工作区的右边那一栏。 */
export type AskDockInsets = {
    top: number;
    bottom: number;
};
export declare const DEFAULT_DOCK_INSETS: AskDockInsets;
type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function useWindowLayout(onLayout?: (layout: {
    mode: AskWindowMode;
    width: number;
}) => void, dockTaken?: boolean, dockInsets?: AskDockInsets): {
    mode: AskWindowMode;
    rect: Rect;
    changeMode: (next: AskWindowMode) => void;
    onDragStop: (_event: unknown, data: DraggableData) => void;
    onResizeStop: (_event: unknown, _direction: unknown, element: HTMLElement, _delta: ResizableDelta, position: Position) => void;
};
export {};
