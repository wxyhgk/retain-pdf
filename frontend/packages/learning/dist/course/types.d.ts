/** 书里的一个位置（锚在原文上）：页码从 1 数，块编号是 OCR 的 `p129-b000` 写法，quote 是那一块开头的几个词。 */
export type LearningAnchor = {
    page: number;
    itemId?: string;
    quote?: string;
};
/** 知识点的状态。只由答题证据决定（原型里由 state/session.ts 的规则改），学生说「懂了」不算。 */
export type PointStatus = "known" | "stuck" | "suspect" | "untested";
export type PointEvidence = {
    /** 日期，例如 11/25。 */
    date: string;
    text: string;
};
export type LearningPoint = {
    id: string;
    name: string;
    /** 小节，例如「3.1 Hartree-Fock 方程」。 */
    section: string;
    anchor: LearningAnchor;
    /** 一句话说明。 */
    summary: string;
    /** 前置知识点的 id。 */
    prereqs: string[];
    /** 演示数据的起始状态。 */
    status: PointStatus;
    evidence: PointEvidence[];
    /** 这个点的题（按顺序出）。 */
    itemIds: string[];
    /** 「讲给我听」用的讲解脚本。 */
    scriptId?: string;
    /** 「看一道例题」用的讲解脚本。 */
    exampleScriptId?: string;
};
export type ItemOption = {
    /** 选项文字；math 为 true 时按 TeX 排。 */
    text: string;
    math?: boolean;
};
export type LearningItem = {
    id: string;
    pointId: string;
    /** 题干（普通文字，公式写进 stemMath）。 */
    stem: string;
    stemMath?: string;
    options: ItemOption[];
    /** 正确选项的下标。原型里在前端；正式版答案只在服务端。 */
    answer: number;
    /** 诊断题：问「有多确定」，高信心答错开一个「疑似误解」。 */
    diagnostic?: boolean;
    /** 提示，一级一级给（最多 5 条；第 6 级是直接给答案）。 */
    hints: string[];
    /** 答完给的说明。 */
    explanation: string;
};
export type CannedAnswer = {
    /** 问题里出现其中任何一个词就用这条回答（原型；以后换成模型）。 */
    keywords: string[];
    answer: string;
    scriptId?: string;
    pointId?: string;
};
export type LearningCourse = {
    id: string;
    /** 这门课用的是哪本书：任务编号（原型里按它判断这本书有没有「学习」页签）。 */
    jobIds: string[];
    chapter: string;
    points: LearningPoint[];
    items: Record<string, LearningItem>;
    /** 讲解脚本（@retainpdf/whiteboard 的格式）。 */
    scripts: Record<string, unknown>;
    canned: CannedAnswer[];
};
