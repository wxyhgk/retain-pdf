import type { ArrowOp, BoardOp, BoardScript, LevelsOp, MarkOp, NoteOp, Tone, WriteOp } from "../script/types.js";
import { type BoardLayout, type Box, type NoteLayout } from "../layout/layout.js";
export declare const TIMING: {
    readonly camera: 450;
    readonly mark: 450;
    readonly arrow: 500;
    readonly erase: 350;
    readonly focus: 600;
    readonly levels: 900;
};
export declare function opDuration(op: BoardOp): number;
export type StepTimeline = {
    starts: number[];
    durations: number[];
    total: number;
};
export declare function stepTimeline(ops: readonly BoardOp[]): StepTimeline;
/** 缓动：先快后慢，像手写收笔。 */
export declare function easeOut(t: number): number;
type Base = {
    /** 稳定的 React key。 */
    key: string;
    /** 0..1：画到哪儿了。 */
    progress: number;
    /** 0..1：擦的时候淡出。 */
    opacity: number;
};
export type WriteItem = Base & {
    kind: "write";
    op: WriteOp;
    box: Box;
};
export type LevelsItem = Base & {
    kind: "levels";
    op: LevelsOp;
    box: Box;
};
export type MarkItem = Base & {
    kind: "mark";
    op: MarkOp;
    box: Box;
    tone: Tone;
};
export type ArrowItem = Base & {
    kind: "arrow";
    op: ArrowOp;
    from: Box;
    to: Box;
    tone?: Tone;
};
export type NoteItem = Base & {
    kind: "note";
    op: NoteOp;
    box: NoteLayout;
    target: Box;
    tone?: Tone;
};
export type FrameItem = WriteItem | LevelsItem | MarkItem | ArrowItem | NoteItem;
export type Frame = {
    stepIndex: number;
    stepCount: number;
    say: string;
    items: FrameItem[];
    camera: Box;
    /** 这一步的动画都画完了。 */
    stepDone: boolean;
    stepDuration: number;
    /** 这一步里没认出来的指令（板上标一句）。 */
    warnings: string[];
};
export declare function frameAt(script: BoardScript, layout: BoardLayout, stepIndex: number, elapsedMs: number): Frame;
export {};
