const SUBSTAGE_DEFINITIONS = Object.freeze([
    {
        key: "ocr_submitting",
        stageKey: "ocr",
        aliases: ["ocr_submitting"],
        label: "启动",
        cardLabel: "启动",
        detail: "正在启动 OCR 子任务",
        progressRange: [0, 5],
        defaultProgressUnit: "step",
    },
    {
        key: "ocr_upload",
        stageKey: "ocr",
        aliases: ["ocr_upload", "mineru_upload"],
        label: "上传",
        cardLabel: "上传",
        detail: "正在上传 PDF",
        progressRange: [5, 15],
        defaultProgressUnit: "page",
    },
    {
        key: "ocr_processing",
        stageKey: "ocr",
        aliases: ["provider_processing", "mineru_processing", "ocr_processing"],
        label: "OCR 解析",
        cardLabel: "OCR 解析",
        detail: "正在执行云端 OCR",
        progressRange: [15, 85],
        defaultProgressUnit: "page",
    },
    {
        key: "ocr_result_ready",
        stageKey: "ocr",
        aliases: ["ocr_result_ready"],
        label: "结果整理",
        cardLabel: "结果整理",
        detail: "OCR 结果已就绪",
        progressRange: [85, 90],
        defaultProgressUnit: "step",
    },
    {
        key: "normalizing",
        stageKey: "ocr",
        aliases: ["normalizing"],
        label: "标准化",
        cardLabel: "标准化",
        detail: "正在整理 OCR 结果",
        progressRange: [90, 99],
        defaultProgressUnit: "step",
    },
    {
        key: "translation_prepare",
        stageKey: "translate",
        aliases: ["translation_prepare"],
        label: "翻译准备",
        cardLabel: "准备",
        detail: "正在准备翻译任务",
        progressRange: [0, 5],
        defaultProgressUnit: "step",
    },
    {
        key: "domain_inference",
        stageKey: "translate",
        aliases: ["domain_inference"],
        label: "领域判断",
        cardLabel: "领域",
        detail: "正在识别文档领域和术语",
        progressRange: [5, 10],
        defaultProgressUnit: "step",
    },
    {
        key: "page_policies",
        stageKey: "translate",
        aliases: ["page_policies", "page_policy"],
        label: "页面策略",
        cardLabel: "页面策略",
        detail: "正在判断正文与保留排版内容",
        progressRange: [18, 28],
        defaultProgressUnit: "page",
    },
    {
        key: "continuation_review",
        stageKey: "translate",
        aliases: ["continuation_review", "cross_page", "cross_column"],
        label: "跨栏/跨页判断",
        cardLabel: "跨栏/跨页",
        detail: "正在判断跨栏/跨页连续段",
        progressRange: [10, 18],
        defaultProgressUnit: "page",
    },
    {
        key: "translation_batches",
        stageKey: "translate",
        aliases: ["translation_batches", "translating"],
        label: "翻译",
        cardLabel: "翻译批次",
        detail: "正在翻译正文内容",
        progressRange: [28, 82],
        defaultProgressUnit: "batch",
    },
    {
        key: "translation_tail_retry",
        stageKey: "translate",
        aliases: ["translation_tail_retry", "tail_retry"],
        label: "尾部重试",
        cardLabel: "尾部重试",
        detail: "正在重试剩余翻译批次",
        progressRange: [82, 88],
        defaultProgressUnit: "batch",
    },
    {
        key: "garbled_repair",
        stageKey: "translate",
        aliases: ["garbled_repair"],
        label: "乱码修复",
        cardLabel: "乱码修复",
        detail: "正在修复乱码候选段",
        progressRange: [88, 93],
        defaultProgressUnit: "step",
    },
    {
        key: "agent_repair",
        stageKey: "translate",
        aliases: ["agent_repair"],
        label: "结果修复",
        cardLabel: "结果修复",
        detail: "正在修复翻译结果",
        progressRange: [93, 97],
        defaultProgressUnit: "step",
    },
    {
        key: "final_untranslated_recovery",
        stageKey: "translate",
        aliases: ["final_untranslated_recovery", "untranslated_recovery"],
        label: "最终收口",
        cardLabel: "最终收口",
        detail: "正在处理未翻译内容",
        progressRange: [97, 99],
        defaultProgressUnit: "step",
    },
    {
        key: "render_prepare",
        stageKey: "render",
        aliases: ["render_prepare", "render_preprocess"],
        label: "准备",
        cardLabel: "准备",
        detail: "正在准备渲染资源",
    },
    {
        key: "render_prewarm",
        stageKey: "render",
        aliases: ["render_prewarm"],
        label: "预热",
        cardLabel: "预热",
        detail: "正在预热渲染资源",
    },
    {
        key: "render_pages",
        stageKey: "render",
        aliases: ["render_pages", "rendering"],
        label: "页面",
        cardLabel: "页面",
        detail: "正在生成页面内容",
    },
    {
        key: "render_compile",
        stageKey: "render",
        aliases: ["render_compile", "compile"],
        label: "编译",
        cardLabel: "编译",
        detail: "正在编译 PDF",
    },
]);
const SUBSTAGE_BY_KEY = Object.freeze(Object.fromEntries(SUBSTAGE_DEFINITIONS.map((item) => [item.key, item])));
const SUBSTAGE_ALIAS_TO_KEY = Object.freeze(Object.fromEntries(SUBSTAGE_DEFINITIONS.flatMap((item) => [
    [item.key, item.key],
    ...(item.aliases || []).map((alias) => [alias, item.key]),
])));
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
    return Object.fromEntries(SUBSTAGE_DEFINITIONS
        .filter((item) => item.stageKey === stageKey)
        .map((item) => [item.key, item.label]));
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
