/** 摆放位置：默认接着往下排一列；需要时指着已有的 id 摆。不让模型写像素坐标。 */
export type Placement = {
    below?: string;
    right_of?: string;
};
export type Tone = "focus" | "correct" | "wrong";
/** 写一行：text（普通文字）或 math（TeX）二选一。 */
export type WriteOp = Placement & {
    op: "write";
    id: string;
    text?: string;
    math?: string;
    /** 字号档位，默认 m。 */
    size?: "s" | "m" | "l";
};
/** 圈 / 划 / 高亮一个已有的东西。 */
export type MarkOp = {
    op: "mark";
    target: string;
    style?: "box" | "underline" | "highlight";
    tone?: Tone;
};
/** 从一个东西指到另一个，可带短标签。 */
export type ArrowOp = {
    op: "arrow";
    from: string;
    to: string;
    label?: string;
    tone?: Tone;
};
/** 在一个东西旁边加批注（小字，带引线）。 */
export type NoteOp = {
    op: "note";
    target: string;
    text: string;
    tone?: Tone;
};
/** 擦掉一个东西（连同指着它的标记、箭头、批注）。 */
export type EraseOp = {
    op: "erase";
    target: string;
};
/** 镜头移到某个东西。 */
export type FocusOp = {
    op: "focus";
    target: string;
};
/** 轨道能级图：能量由代码换算成高度，电子用 ↑↓ 画。 */
export type LevelsOp = Placement & {
    op: "levels";
    id: string;
    /** 纵轴说明，例如「轨道能 / Hartree」。 */
    axis?: string;
    levels: Array<{
        label: string;
        energy: number;
        /** 0、1、2 个电子。 */
        electrons?: 0 | 1 | 2;
    }>;
};
export type KnownOp = WriteOp | MarkOp | ArrowOp | NoteOp | EraseOp | FocusOp | LevelsOp;
/** 不认识或写错了的指令：保留下来，播放时在板上标一句，不让整块板崩掉。 */
export type UnknownOp = {
    op: "unknown";
    original: string;
    reason: string;
};
export type BoardOp = KnownOp | UnknownOp;
export type BoardStep = {
    id: string;
    /** 字幕（以后接配音）。 */
    say?: string;
    ops: BoardOp[];
};
export type BoardScript = {
    version: 1;
    title?: string;
    steps: BoardStep[];
};
/** 会在板上占位置的东西（write、levels）。 */
export type PlacedOp = WriteOp | LevelsOp;
export declare const KNOWN_OPS: readonly ["write", "mark", "arrow", "note", "erase", "focus", "levels"];
