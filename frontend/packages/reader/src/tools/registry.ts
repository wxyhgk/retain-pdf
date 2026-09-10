// 阅读器工具定义（自包含版，从 frontend/web/src/pages/reader/tools/registry.ts 复制）

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
export const READER_TOOLS: readonly ReaderToolDef[] = Object.freeze([
  {
    id: "favorites",
    label: "摘录",
    subIdle: "本书云端收藏",
    subOpen: "关闭悬浮窗",
    needsJob: false,
  },
  {
    id: "markdown",
    label: "Markdown",
    subIdle: "识别 / 译文文本",
    subOpen: "关闭悬浮窗",
    needsJob: true,
  },
  {
    id: "ai",
    label: "AI 问答",
    subIdle: "基于文档提问",
    subOpen: "关闭悬浮窗",
    needsJob: true,
  },
]);
