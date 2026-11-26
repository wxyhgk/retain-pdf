// 书上的位置（ReaderAskAnchor）→ 提问窗（@retainpdf/ask）认的 AskContext：标题栏的页码和位置、顶上引的那段、发给 agent 的出处。
// 纯函数，测试在 frontend/web/tests/reader/reader-ask.test.mjs。

import type { AskContext, AskPort } from "@retainpdf/ask";

import type { ReaderAskAnchor, ReaderAskPort } from "../contracts/ask.js";

const QUOTE_LIMIT = 4000;

function clip(text: string, limit = QUOTE_LIMIT): string {
  const value = `${text || ""}`.trim();
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

/** 第一问前面的出处：一段文字，agent 不管有没有接书的工具都看得懂；带上任务号和块号，接了 retainpdf mcp 的 agent 能自己去读。 */
export function anchorPreamble(anchor: ReaderAskAnchor, jobId: string, bookTitle = ""): string {
  const lines: string[] = [];
  const where = [`第 ${anchor.page} 页`, anchor.section ? `「${anchor.section}」` : ""].filter(Boolean).join("，");
  lines.push(`我在读${bookTitle ? `《${bookTitle}》` : "一本书"}，${where}（${anchor.pane === "source" ? "原文" : "译文"}栏）。`);
  if (anchor.selection) lines.push("", "我选中的这段：", clip(anchor.selection));
  if (anchor.sourceText) lines.push("", "这一块的原文：", clip(anchor.sourceText));
  if (anchor.translatedText) lines.push("", "这一块的译文：", clip(anchor.translatedText));
  if (!anchor.selection && !anchor.sourceText && !anchor.translatedText) lines.push("", "这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。");
  lines.push("", `（RetainPDF 任务 ${jobId}${anchor.itemId ? `，块 ${anchor.itemId}` : ""}，第 ${anchor.page} 页）`);
  return lines.join("\n");
}

export function toAskContext(anchor: ReaderAskAnchor, jobId: string, bookTitle = ""): AskContext {
  return {
    page: anchor.page,
    label: [`第 ${anchor.page} 页`, anchor.section].filter(Boolean).join(" · "),
    quote: {
      selection: anchor.selection || undefined,
      source: anchor.sourceText || undefined,
      translated: anchor.translatedText || undefined,
      prefer: anchor.pane === "translated" ? "translated" : "source",
    },
    preamble: anchorPreamble(anchor, jobId, bookTitle),
  };
}

/** 阅读页的端口 → 提问窗的端口：开会话时绑上这本书的任务号（自带 agent 拿它读书）。 */
export function bindAskPort(port: ReaderAskPort, jobId: string): AskPort {
  return {
    listAgents: () => port.listAgents(),
    openSession: (options, handlers) => port.openSession({ ...options, jobId }, handlers),
  };
}
