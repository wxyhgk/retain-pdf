export type ReaderToolId = "favorites" | "markdown" | "ai";
export type ReaderToolDef = {
    id: ReaderToolId;
    label: string;
    /** 副文案（关 / 开） */
    subIdle: string;
    subOpen: string;
    /** 源文档只读时是否禁用 */
    needsJob: boolean;
};
/** 与 legacy ReaderTopbarActions.TOOL_BUTTONS 同一套能力 */
export declare const READER_TOOLS: readonly ReaderToolDef[];
//# sourceMappingURL=registry.d.ts.map