import type { BoardScript, LevelsOp, NoteOp, WriteOp } from "../script/types.js";
import { type Size } from "./measure.js";
export declare const LAYOUT: {
    readonly margin: 40;
    readonly gapY: 18;
    /** 有箭头从上面指过来的东西，和上面隔开这么多（放得下箭头和标签）。 */
    readonly arrowGapY: 64;
    readonly gapX: 32;
    readonly noteGap: 28;
    readonly noteFont: 16;
    readonly noteMaxWidth: 280;
    readonly levels: {
        readonly w: 240;
        readonly h: 260;
    };
};
export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type NoteLayout = Box & {
    lines: string[];
};
export type BoardLayout = {
    /** write / levels 的位置。 */
    boxes: Map<string, Box>;
    /** 批注的位置，key 是「步序号:指令序号」。 */
    notes: Map<string, NoteLayout>;
};
export type MathSizer = (tex: string, size: "s" | "m" | "l") => Size;
export declare function opKey(stepIndex: number, opIndex: number): string;
export declare function writeSize(op: WriteOp, mathSize: MathSizer): Size;
/** 能级图：线段区 160px + 标签（右边）；高度固定。标签宽度按字符估。 */
export declare function levelsSize(op: LevelsOp): Size;
export declare function noteLayout(op: NoteOp, target: Box): NoteLayout;
export declare function layoutScript(script: BoardScript, mathSize: MathSizer): BoardLayout;
export declare function unionBox(boxes: Iterable<Box>): Box | null;
