/** 一段要标出来的字：[start, end)、class、几个 data-* 属性（别的属性名不认，跳过）。 */
export type ReaderTextMark = {
    start: number;
    end: number;
    className: string;
    attrs?: Readonly<Record<string, string>>;
};
/** 按起点排；和前一段重叠的丢掉（先到的赢，起点一样按给的顺序，即扩展顺序）。 */
export declare function renderMarkedText(text: string, marks: readonly ReaderTextMark[], findTerm?: string): string;
//# sourceMappingURL=reader-text-marks.d.ts.map