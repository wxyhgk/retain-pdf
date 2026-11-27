import type { AskWindowMode } from "./AskHeader.js";
export type AskWindowRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type AskWindowMemory = {
    mode?: Exclude<AskWindowMode, "full">;
    float?: AskWindowRect;
    dockWidth?: number;
    agentId?: string;
};
export declare function loadWindowMemory(): AskWindowMemory;
export declare function saveWindowMemory(patch: AskWindowMemory): void;
/** 记的浮动位置挪进现在的窗口（换了显示器、窗口变小了，不能停在屏幕外面）。 */
export declare function fitRect(rect: AskWindowRect, viewport: {
    width: number;
    height: number;
}, min?: {
    width: number;
    height: number;
}): AskWindowRect;
/** 列表里挑默认的 agent：上次用的（还能用的话），不然第一个能用的。 */
export declare function pickAgent(agents: readonly {
    id: string;
    available?: boolean;
}[], remembered: string | undefined): string;
