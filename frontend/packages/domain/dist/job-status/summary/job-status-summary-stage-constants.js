export const USER_STAGE_FLOW = [
    {
        key: "ocr",
        label: "OCR 解析",
        detail: "正在识别 PDF 内容",
        matches: ["ocr", "parse", "mineru", "paddle", "normaliz", "document", "submit", "startup"],
    },
    {
        key: "translate",
        label: "翻译",
        detail: "正在翻译正文内容",
        matches: ["translat"],
    },
    {
        key: "render",
        label: "渲染",
        detail: "正在生成翻译后的 PDF",
        matches: ["render", "sav"],
    },
];
export const USER_STAGE_TOTAL = USER_STAGE_FLOW.length + 1;
