const SUBSTAGE_DEFINITIONS = Object.freeze([
  {
    key: "ocr_submitting",
    stageKey: "ocr",
    aliases: ["ocr_submitting"],
    label: "Khởi động",
    cardLabel: "Khởi động",
    detail: "Đang khởi động nhiệm vụ con OCR",
    progressRange: [0, 5],
    defaultProgressUnit: "step",
  },
  {
    key: "ocr_upload",
    stageKey: "ocr",
    aliases: ["ocr_upload", "mineru_upload"],
    label: "Tải lên",
    cardLabel: "Tải lên",
    detail: "Đang tải lên PDF",
    progressRange: [5, 15],
    defaultProgressUnit: "page",
  },
  {
    key: "ocr_processing",
    stageKey: "ocr",
    aliases: ["provider_processing", "mineru_processing", "ocr_processing"],
    label: "Phân tích OCR",
    cardLabel: "Phân tích OCR",
    detail: "Đang thực hiện OCR trên đám mây",
    progressRange: [15, 85],
    defaultProgressUnit: "page",
  },
  {
    key: "ocr_result_ready",
    stageKey: "ocr",
    aliases: ["ocr_result_ready"],
    label: "Tổ chức kết quả",
    cardLabel: "Tổ chức kết quả",
    detail: "Kết quả OCR đã sẵn sàng",
    progressRange: [85, 90],
    defaultProgressUnit: "step",
  },
  {
    key: "normalizing",
    stageKey: "ocr",
    aliases: ["normalizing"],
    label: "Chuẩn hóa",
    cardLabel: "Chuẩn hóa",
    detail: "Đang tổ chức kết quả OCR",
    progressRange: [90, 99],
    defaultProgressUnit: "step",
  },
  {
    key: "translation_prepare",
    stageKey: "translate",
    aliases: ["translation_prepare"],
    label: "Chuẩn bị dịch",
    cardLabel: "Chuẩn bị",
    detail: "Đang chuẩn bị nhiệm vụ dịch",
    progressRange: [0, 5],
    defaultProgressUnit: "step",
  },
  {
    key: "domain_inference",
    stageKey: "translate",
    aliases: ["domain_inference"],
    label: "Xác định lĩnh vực",
    cardLabel: "Lĩnh vực",
    detail: "Đang nhận diện lĩnh vực và thuật ngữ của tài liệu",
    progressRange: [5, 10],
    defaultProgressUnit: "step",
  },
  {
    key: "page_policies",
    stageKey: "translate",
    aliases: ["page_policies", "page_policy"],
    label: "Chiến lược trang",
    cardLabel: "Chiến lược trang",
    detail: "Đang xác định nội dung chính và nội dung giữ nguyên bố cục",
    progressRange: [18, 28],
    defaultProgressUnit: "page",
  },
  {
    key: "continuation_review",
    stageKey: "translate",
    aliases: ["continuation_review", "cross_page", "cross_column"],
    label: "Xác định liên tục cột/trang",
    cardLabel: "Liên tục cột/trang",
    detail: "Đang xác định đoạn liên tục qua cột/trang",
    progressRange: [10, 18],
    defaultProgressUnit: "page",
  },
  {
    key: "translation_batches",
    stageKey: "translate",
    aliases: ["translation_batches", "translating"],
    label: "Dịch",
    cardLabel: "Lô dịch",
    detail: "Đang dịch nội dung chính",
    progressRange: [28, 82],
    defaultProgressUnit: "batch",
  },
  {
    key: "translation_tail_retry",
    stageKey: "translate",
    aliases: ["translation_tail_retry", "tail_retry"],
    label: "Thử lại phần cuối",
    cardLabel: "Thử lại phần cuối",
    detail: "Đang thử lại các lô dịch còn lại",
    progressRange: [82, 88],
    defaultProgressUnit: "batch",
  },
  {
    key: "garbled_repair",
    stageKey: "translate",
    aliases: ["garbled_repair"],
    label: "Sửa lỗi mã hóa",
    cardLabel: "Sửa lỗi mã hóa",
    detail: "Đang sửa các đoạn văn bản bị lỗi mã hóa",
    progressRange: [88, 93],
    defaultProgressUnit: "step",
  },
  {
    key: "agent_repair",
    stageKey: "translate",
    aliases: ["agent_repair"],
    label: "Sửa kết quả",
    cardLabel: "Sửa kết quả",
    detail: "Đang sửa kết quả dịch",
    progressRange: [93, 97],
    defaultProgressUnit: "step",
  },
  {
    key: "final_untranslated_recovery",
    stageKey: "translate",
    aliases: ["final_untranslated_recovery", "untranslated_recovery"],
    label: "Hoàn thiện cuối",
    cardLabel: "Hoàn thiện cuối",
    detail: "Đang xử lý nội dung chưa dịch",
    progressRange: [97, 99],
    defaultProgressUnit: "step",
  },
  {
    key: "render_prepare",
    stageKey: "render",
    aliases: ["render_prepare", "render_preprocess"],
    label: "Chuẩn bị",
    cardLabel: "Chuẩn bị",
    detail: "Đang chuẩn bị tài nguyên render",
  },
  {
    key: "render_prewarm",
    stageKey: "render",
    aliases: ["render_prewarm"],
    label: "Làm nóng",
    cardLabel: "Làm nóng",
    detail: "Đang làm nóng tài nguyên render",
  },
  {
    key: "render_pages",
    stageKey: "render",
    aliases: ["render_pages", "rendering"],
    label: "Trang",
    cardLabel: "Trang",
    detail: "Đang tạo nội dung trang",
  },
  {
    key: "render_compile",
    stageKey: "render",
    aliases: ["render_compile", "compile"],
    label: "Biên dịch",
    cardLabel: "Biên dịch",
    detail: "Đang biên dịch PDF",
  },
]);

const SUBSTAGE_BY_KEY = Object.freeze(Object.fromEntries(
  SUBSTAGE_DEFINITIONS.map((item) => [item.key, item]),
));

const SUBSTAGE_ALIAS_TO_KEY = Object.freeze(Object.fromEntries(
  SUBSTAGE_DEFINITIONS.flatMap((item) => [
    [item.key, item.key],
    ...(item.aliases || []).map((alias) => [alias, item.key]),
  ]),
));

export function normalizeSubstageKey(value = "") {
  const normalized = `${value || ""}`.trim().toLowerCase();
  return SUBSTAGE_ALIAS_TO_KEY[normalized] || "";
}

export function substageDefinitionForKey(key = "") {
  return SUBSTAGE_BY_KEY[normalizeSubstageKey(key) || key] || null;
}

export function substageDetail(key = "") {
  return substageDefinitionForKey(key)?.detail || "";
}

export function substageLabel(key = "") {
  return substageDefinitionForKey(key)?.label || "";
}

export function substageCardLabel(key = "") {
  const definition = substageDefinitionForKey(key);
  return definition?.cardLabel || definition?.label || "";
}

export function substagesForStage(stageKey = "") {
  const normalizedStage = `${stageKey || ""}`.trim();
  return SUBSTAGE_DEFINITIONS
    .filter((item) => item.stageKey === normalizedStage)
    .slice()
    .sort((left, right) => {
      const leftStart = Number(left.progressRange?.[0] ?? Number.POSITIVE_INFINITY);
      const rightStart = Number(right.progressRange?.[0] ?? Number.POSITIVE_INFINITY);
      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }
      return SUBSTAGE_DEFINITIONS.indexOf(left) - SUBSTAGE_DEFINITIONS.indexOf(right);
    })
    .map((item) => ({
      key: item.key,
      label: substageCardLabel(item.key),
    }));
}

export function substageLabelsForStage(stageKey = "") {
  return Object.fromEntries(
    SUBSTAGE_DEFINITIONS
      .filter((item) => item.stageKey === stageKey)
      .map((item) => [item.key, item.label]),
  );
}

export function substageProgressRange(key = "") {
  const range = substageDefinitionForKey(key)?.progressRange;
  return Array.isArray(range) && range.length === 2 ? range : null;
}

export function substageDefaultProgressUnit(key = "") {
  return substageDefinitionForKey(key)?.defaultProgressUnit || "";
}

export function visualStageKeyForSubstage(stageKey = "", substage = "") {
  const normalizedStage = `${stageKey || ""}`.trim();
  const normalizedSubstage = normalizeSubstageKey(substage);
  if (normalizedStage === "ocr" && normalizedSubstage) {
    if (normalizedSubstage === "normalizing") {
      return "ocr_normalizing";
    }
    return normalizedSubstage;
  }
  return "";
}
