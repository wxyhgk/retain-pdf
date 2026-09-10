const ROUTES = {
  direct: "translate/direct_typst/deepseek",
  fallback: "translate/direct_typst/deepseek→placeholder",
};

function buildItem({
  index,
  page,
  blockType,
  label,
  finalStatus,
  source,
  translated = "",
  skipReason = "",
  fallbackTo = "",
  errorTypes = [],
  degradationReason = "",
}: any) {
  const itemId = `mock-item-${String(index).padStart(3, "0")}`;
  return {
    item_id: itemId,
    page_idx: page - 1,
    page_number: page,
    block_type: blockType,
    classification_label: label,
    math_mode: "direct_typst",
    should_translate: finalStatus !== "skipped",
    skip_reason: skipReason,
    final_status: finalStatus,
    route_path: fallbackTo ? ROUTES.fallback : ROUTES.direct,
    fallback_to: fallbackTo,
    error_types: errorTypes,
    degradation_reason: degradationReason,
    source_preview: source.slice(0, 80),
    source_text: source,
    translated_text: translated,
    translation_diagnostics: errorTypes.length
      ? { attempts: 2, last_error: errorTypes[0], recovered: !!translated }
      : { attempts: 1 },
  };
}

const MOCK_TRANSLATION_ITEMS = [
  buildItem({
    index: 1, page: 1, blockType: "paragraph", label: "body",
    finalStatus: "translated",
    source: "Transformer architectures rely entirely on attention mechanisms to draw global dependencies between input and output.",
    translated: "Transformer 架构完全依赖注意力机制来建立输入与输出之间的全局依赖关系。",
  }),
  buildItem({
    index: 2, page: 1, blockType: "heading", label: "title",
    finalStatus: "translated",
    source: "2. Background and Related Work",
    translated: "2. 背景与相关工作",
  }),
  buildItem({
    index: 3, page: 2, blockType: "paragraph", label: "body",
    finalStatus: "translated",
    source: "We evaluate our method on three benchmark datasets and observe consistent improvements over strong baselines.",
    translated: "我们在三个基准数据集上评估了该方法，并观察到相对强基线的一致提升。",
  }),
  buildItem({
    index: 4, page: 2, blockType: "formula", label: "display_math",
    finalStatus: "kept_origin",
    source: "\\operatorname{Attention}(Q, K, V) = \\operatorname{softmax}(QK^{T} / \\sqrt{d_k}) V",
    skipReason: "",
    degradationReason: "formula_block_kept",
  }),
  buildItem({
    index: 5, page: 3, blockType: "paragraph", label: "body",
    finalStatus: "translated",
    source: "Ablation studies show that positional encodings contribute significantly to final accuracy.",
    translated: "消融实验表明位置编码对最终精度有显著贡献。",
    fallbackTo: "placeholder",
    errorTypes: ["schema_mismatch"],
    degradationReason: "retry_with_placeholder",
  }),
  buildItem({
    index: 6, page: 3, blockType: "code", label: "code_block",
    finalStatus: "kept_origin",
    source: "def scaled_dot_product_attention(q, k, v):\n    return softmax(q @ k.T / sqrt(d_k)) @ v",
    skipReason: "code_block_not_translatable",
  }),
  buildItem({
    index: 9, page: 4, blockType: "paragraph", label: "body",
    finalStatus: "partially_translated",
    source: "The proposed method achieves state-of-the-art results while remaining computationally efficient (see Appendix C for proofs).",
    translated: "所提方法在保持计算高效的同时达到了 state-of-the-art 结果(证明见 Appendix C)。",
    degradationReason: "terminology_partially_preserved",
  }),
  buildItem({
    index: 10, page: 4, blockType: "paragraph", label: "footnote",
    finalStatus: "failed",
    source: "Corresponding author: j.doe@example.edu. Code available at https://github.com/example/repo.",
    errorTypes: ["provider_timeout"],
    degradationReason: "max_retries_exhausted",
  }),
  buildItem({
    index: 7, page: 4, blockType: "table", label: "table_cell",
    finalStatus: "kept_origin",
    source: "BLEU / ROUGE-L / METEOR",
    degradationReason: "short_token_kept",
  }),
  buildItem({
    index: 8, page: 4, blockType: "paragraph", label: "body",
    finalStatus: "translated",
    source: "Finally, we discuss limitations and outline directions for future research.",
    translated: "最后，我们讨论了局限性并展望了后续研究方向。",
  }),
];

export function getMockTranslationSummary(jobId = "") {
  // 与真实管线落盘形状一致(backend scripts/services/translation/artifacts/io.py):
  // 统计键是 status_summary,状态枚举为 translated/partially_translated/kept_origin/failed
  const statusSummary = {
    translated: 0,
    partially_translated: 0,
    kept_origin: 0,
    failed: 0,
  };
  for (const item of MOCK_TRANSLATION_ITEMS) {
    statusSummary[item.final_status] = (statusSummary[item.final_status] || 0) + 1;
  }
  return {
    job_id: jobId,
    summary: {
      translation_protocol_version: "v2",
      provider_family: "deepseek_official",
      status_summary: statusSummary,
      route_summary: {},
      error_summary: { provider_timeout: 1, schema_mismatch: 1 },
    },
  };
}

export function getMockTranslationItems(jobId, {
  limit = 20,
  offset = 0,
  page = "",
  finalStatus = "",
  q = "",
}: any = {}) {
  let list = MOCK_TRANSLATION_ITEMS;
  if (`${finalStatus}`.trim()) {
    list = list.filter((item) => item.final_status === `${finalStatus}`.trim());
  }
  if (`${page}`.trim()) {
    list = list.filter((item) => `${item.page_number}` === `${page}`.trim());
  }
  const query = `${q}`.trim().toLowerCase();
  if (query) {
    list = list.filter((item) =>
      item.item_id.includes(query)
      || item.route_path.toLowerCase().includes(query)
      || item.source_text.toLowerCase().includes(query));
  }
  return {
    job_id: jobId,
    items: list.slice(offset, offset + limit),
    total: list.length,
    limit,
    offset,
  };
}

export function getMockTranslationItem(jobId, itemId) {
  const item = MOCK_TRANSLATION_ITEMS.find((entry) => entry.item_id === itemId);
  if (!item) {
    throw new Error("未找到该翻译 item，请确认 item_id 是否正确。");
  }
  return {
    job_id: jobId,
    item_id: item.item_id,
    page_idx: item.page_idx,
    page_number: item.page_number,
    page_path: `pages/page-${item.page_number}.json`,
    item,
  };
}

export function getMockTranslationReplay(jobId, itemId) {
  const item = MOCK_TRANSLATION_ITEMS.find((entry) => entry.item_id === itemId) || null;
  return {
    job_id: jobId,
    item_id: itemId,
    payload: {
      policy_before: { auto_preserve_terms: false },
      policy_after: { auto_preserve_terms: true },
      replay_result: {
        final_status: item?.final_status || "translated",
        translated_text: item?.translated_text || "",
      },
      replay_error: null,
    },
  };
}
