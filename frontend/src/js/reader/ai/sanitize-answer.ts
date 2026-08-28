// Clean internal block_id references that models occasionally emit and map them to [n] where possible.

import type { AiCitationLike } from "./answer-enhance.js";

const BLOCK_BRACKET_RE = /\[\s*(p\d+[-_]b\d+)\s*\]/gi;
const BLOCK_BARE_RE = /(?<![\w/])(p\d+[-_]b\d+)(?![\w/])/gi;

function normBlockId(id: string): string {
  return `${id || ""}`.trim().toLowerCase().replace(/_/g, "-");
}

// Code protection: extract fenced blocks, including unclosed streaming tails, and inline code
// so whitespace collapsing/block_id cleanup cannot damage them. Python indentation
// and table alignment were previously flattened into one line (audit P1-6).
const CODE_SEGMENT_RE = /```[\s\S]*?(?:```|$)|`[^`\n]+`/g;
const CODE_SLOT_PREFIX = "CODE_";
const CODE_SLOT_SUFFIX = "";

/** Replace [p002-b0004] or bare p002-b0004 with [n]; remove unmapped ids. Code segments stay unchanged. */
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
    const id = normBlockId(`${c.block_id || ""}`);
    if (!id) continue;
    const ref = `${c.ref ?? ""}`.trim();
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

  // Remove leftover internal-field wording.
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
