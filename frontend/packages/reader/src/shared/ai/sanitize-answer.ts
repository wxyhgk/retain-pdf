// 共享真值（原 frontend/web/src/js/reader/ai/sanitize-answer.ts），已抽离为 standalone
// 纯字符处理，无宿主依赖

import type { AiCitationLike } from "./answer-enhance.js";

const BLOCK_BRACKET_RE = /\[\s*(p\d+[-_]b\d+)\s*\]/gi;
const BLOCK_BARE_RE = /(?<![\w/])(p\d+[-_]b\d+)(?![\w/])/gi;

function normBlockId(id: string): string {
  return `${id || ""}`.trim().toLowerCase().replace(/_/g, "-");
}

// 代码保护：围栏块（含流式末尾未闭合的）+ 行内 code 整段抽出，
// 免遭空白压扁/block_id 清洗——Python 缩进、表格对齐曾被压成一行（审计 P1-6）
const CODE_SEGMENT_RE = /```[\s\S]*?(?:```|$)|`[^`\n]+`/g;
const CODE_SLOT_PREFIX = "CODE_";
const CODE_SLOT_SUFFIX = "";

/** 将 [p002-b0004] / 裸 p002-b0004 换成 [n]；无法映射则删除。代码段原样保留。 */
export function sanitizeAssistantAnswer(
  text: string,
  citations: AiCitationLike[] = [],
): string {
  let out = `${text || ""}`;
  if (!out) return "";

  const codeSlots: string[] = [];
  out = out.replace(CODE_SEGMENT_RE, (segment) => {
    const token = `${CODE_SLOT_PREFIX}${codeSlots.length}${CODE_SLOT_SUFFIX}`;
    codeSlots.push(segment);
    return token;
  });

  const byBlock = new Map<string, string>();
  for (const c of citations) {
    const id = normBlockId(`${(c as any).block_id || ""}`);
    if (!id) continue;
    const ref = `${(c as any).ref ?? ""}`.trim();
    if (ref) byBlock.set(id, ref);
  }

  out = out.replace(BLOCK_BRACKET_RE, (_m, id: string) => {
    const ref = byBlock.get(normBlockId(id));
    return ref ? `[${ref}]` : "";
  });
  out = out.replace(BLOCK_BARE_RE, (_m, id: string) => {
    const ref = byBlock.get(normBlockId(id));
    return ref ? `[${ref}]` : "";
  });

  // 去掉残留的内部字段口癖
  out = out.replace(/\bblock_id\s*[=:：]\s*\S+/gi, "");
  out = out.replace(/\bpage_idx\s*[=:：]\s*\d+/gi, "");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/ *\n/g, "\n");
  out = out.trim();

  if (codeSlots.length) {
    out = out.replace(
      new RegExp(`${CODE_SLOT_PREFIX}(\\d+)${CODE_SLOT_SUFFIX}`, "g"),
      (_m, idx: string) => codeSlots[Number(idx)] ?? "",
    );
  }
  return out;
}
