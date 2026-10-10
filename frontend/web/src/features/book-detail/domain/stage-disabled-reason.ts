// 后端 stage-actions 的 disabled_reason 是英文（给日志和接口调用方看的），书籍详情里要说中文。
// 认得的逐条对照；认不得的说「暂时不可用」，原文留在 title 里，排查时仍能看到。

const KNOWN_REASONS: Array<[RegExp, string]> = [
  [/queued or running/i, "任务还在运行，先取消才能重新处理。"],
  [/renders translations owned by another job/i, "这次的译文属于更早的翻译任务，要在那个任务上精修。"],
  [/committed translations.*to refine/i, "还没有译文，先翻译再精修。"],
  [/to retry translation/i, "缺少原文 PDF 或 OCR 结果，无法重新翻译。"],
  [/to retry render/i, "缺少原文 PDF 或译文，无法重新渲染。"],
  [/upload_id or source_url/i, "找不到当初上传的原文，需要重新上传 PDF。"],
  [/source PDF is not available/i, "原文 PDF 不在了，需要重新上传。"],
  [/refine runs model calls inside the Python render worker/i, "这次翻译用的模型连接不支持精修。"],
  [/receipt-preserving recovery|legacy retry is disabled/i, "这次翻译用的模型连接不支持重新处理。"],
];

function hasCjk(text: string): boolean {
  return /[一-鿿]/.test(text);
}

/** 给用户看的中文原因；原文本身已是中文就原样返回。 */
export function stageDisabledReasonText(reason: unknown): string {
  const raw = `${reason ?? ""}`.trim();
  if (!raw) return "";
  if (hasCjk(raw)) return raw;
  const known = KNOWN_REASONS.find(([pattern]) => pattern.test(raw));
  return known ? known[1] : "暂时不可用。";
}
