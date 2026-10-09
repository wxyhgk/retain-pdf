// 任务状态 → 显示：状态归一、中文文字、颜色类别的唯一出处。
//
// 以前这件事在书架卡片、书籍详情、任务中心、任务详情、状态卡各写一份，结果各说各的：
// 同一个运行中的任务，任务中心写「运行中」、别处写「处理中」；书籍详情把排队也写成
// 「处理中」；任务详情遇到取消的任务写成「准备中」；状态卡只认美式拼写 canceled。
//
// 后端只有五种状态（retain-core JobStatusKind：queued / running / succeeded / failed /
// canceled）。其余写法是旧数据、乐观提交或防御性兼容，这里统一折回这五种。
//
// 「成功」要不要再等完成信号（isJobTerminal），不在这里决定：实时推送里状态会先翻成
// succeeded、最终快照稍后才到，状态卡和任务详情要等；书架和书籍详情拿的是列表摘要，
// 根本没有那些信号，等了就永远停在「处理中」。所以由调用方按需传 succeededIsFinal。
const STATUS_ALIASES = {
    queued: "queued",
    pending: "queued",
    running: "running",
    validating: "running",
    succeeded: "succeeded",
    failed: "failed",
    timeout: "failed",
    dead: "failed",
    canceled: "canceled",
    cancelled: "canceled",
};
export const JOB_STATUS_LABELS = Object.freeze({
    queued: "排队中",
    running: "处理中",
    succeeded: "已完成",
    failed: "失败",
    canceled: "已取消",
});
const JOB_STATUS_TONES = Object.freeze({
    queued: "active",
    running: "active",
    succeeded: "done",
    failed: "failed",
    canceled: "muted",
});
function rawStatus(value) {
    return `${value ?? ""}`.trim().toLowerCase();
}
/** 折回后端的五种状态；没有状态返回 ""，认不出的返回 null。 */
export function normalizeJobStatus(value) {
    const raw = rawStatus(value);
    if (!raw)
        return "";
    return STATUS_ALIASES[raw] ?? null;
}
/** 已结束：成功、失败或取消。只看状态本身，不等完成信号。 */
export function isFinishedJobStatus(value) {
    const status = normalizeJobStatus(value);
    return status === "succeeded" || status === "failed" || status === "canceled";
}
/** 排队或运行中。 */
export function isActiveJobStatus(value) {
    const status = normalizeJobStatus(value);
    return status === "queued" || status === "running";
}
export function jobStatusPresentation(value, { idleLabel = "尚未开始", unknownLabel, succeededIsFinal = true } = {}) {
    const status = normalizeJobStatus(value);
    if (status === "")
        return { key: "", label: idleLabel, tone: "muted" };
    if (status === null) {
        const raw = rawStatus(value);
        return { key: raw, label: unknownLabel ?? `${value ?? ""}`.trim(), tone: "muted" };
    }
    if (status === "succeeded" && !succeededIsFinal) {
        return { key: "running", label: JOB_STATUS_LABELS.running, tone: JOB_STATUS_TONES.running };
    }
    return { key: status, label: JOB_STATUS_LABELS[status], tone: JOB_STATUS_TONES[status] };
}
/** 只要文字时的简写。 */
export function jobStatusLabel(value, options) {
    return jobStatusPresentation(value, options).label;
}
