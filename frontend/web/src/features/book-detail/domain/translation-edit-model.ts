// 「改这段译文」的纯逻辑：从条目里取可编辑的文字、解读「重翻」的结果、把校验问题说成人话。
// 接口：GET / PATCH /jobs/:id/translations/:item_id、POST …/replay（契约 translation-revisions.v1）。

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * 编辑框里放什么：PATCH 要的是和条目 protected_translated_text 同一种写法（公式在 direct_typst 模式下写成 $…$），
 * 所以优先拿它；老条目没有就用 translated_text。
 */
export function editableTranslation(item: Row | null | undefined): { source: string; translated: string } {
  return {
    source: text(item?.source_text) || text(item?.unit_source_text),
    translated: text(item?.protected_translated_text) || text(item?.translated_text),
  };
}

export type ReplayOutcome =
  | { kind: "candidate"; text: string }
  | { kind: "keep_origin" }
  | { kind: "failed"; message: string };

/** 「重翻这一段」的结果：有新译文就填进编辑框；模型判断保留原文、或者没翻出来，都不动编辑框。 */
export function replayOutcome(view: { candidate?: { translated_text?: string; decision?: string } | null; payload?: Row } | null | undefined): ReplayOutcome {
  const candidate = view?.candidate;
  if (candidate?.decision === "keep_origin") return { kind: "keep_origin" };
  if (candidate && text(candidate.translated_text).trim()) return { kind: "candidate", text: text(candidate.translated_text) };
  const replayError = (view?.payload?.replay_error || null) as Row | null;
  const detail = text(replayError?.message);
  return { kind: "failed", message: detail ? `模型没给出新译文：${detail}` : "模型没给出新译文，可以再试一次或直接手改。" };
}

const ISSUE_LABELS: Record<string, string> = {
  empty_translation: "译文是空的",
  math_delimiter_unbalanced: "公式的 $ 或括号不成对",
  unexpected_placeholder: "多出了原文里没有的占位符",
  placeholder_inventory_mismatch: "占位符（公式、引用）和原文对不上，可能删掉或改坏了",
  english_residue: "还留着没翻的英文",
  mixed_english_residue: "中英文混在一起",
  protocol_shell_output: "混进了模型输出的格式标记",
  truncated_translation: "译文像是被截断了",
  context_bleed: "混进了别的段落的内容",
  formula_commands_dropped: "公式里的命令丢了",
  glossary_term_missing: "没用术语表规定的译法",
};

/** 校验问题说成一句人话：认识的类型给中文，后面跟后端的原话（可能是英文，但往往更具体）。 */
export function issueText(issue: { kind?: string; message?: string; severity?: string } | null | undefined): string {
  const label = ISSUE_LABELS[`${issue?.kind || ""}`] || `${issue?.kind || "问题"}`;
  const message = `${issue?.message || ""}`.trim();
  return message && message !== label ? `${label}（${message}）` : label;
}
