import type { DraggableData, Position, ResizableDelta } from "react-rnd";
import type { AskWindowMode } from "./AskHeader.js";
type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function useWindowLayout(onLayout?: (layout: {
    mode: AskWindowMode;
    width: number;
}) => void, dockTaken?: boolean): {
    mode: AskWindowMode;
    rect: Rect;
    changeMode: (next: AskWindowMode) => void;
    onDragStop: (_event: unknown, data: DraggableData) => void;
    onResizeStop: (_event: unknown, _direction: unknown, element: HTMLElement, _delta: ResizableDelta, position: Position) => void;
};
export {};
