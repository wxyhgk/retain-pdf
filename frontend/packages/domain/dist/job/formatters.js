import { firstNonEmpty, isJobTerminal, } from "./core.js";
function formatDurationMs(ms) {
    const num = Number(ms);
    if (!Number.isFinite(num) || num < 0) {
        return "-";
    }
    const totalSeconds = Math.floor(num / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}小时 ${minutes}分 ${seconds}秒`;
    }
    if (minutes > 0) {
        return `${minutes}分 ${seconds}秒`;
    }
    return `${seconds}秒`;
}
export function summarizeRuntimeField(value) {
    const text = firstNonEmpty(value);
    return text || "-";
}
export function formatRuntimeDuration(ms) {
    return formatDurationMs(ms);
}
export function formatEventTimestamp(value) {
    const rawValue = `${value || ""}`.trim();
    if (!rawValue) {
        return "-";
    }
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
        return rawValue;
    }
    return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(parsed);
}
export function formatJobFinishedAt(payload) {
    if (!payload || !isJobTerminal(payload)) {
        return "-";
    }
    const rawValue = (payload.finished_at || payload.updated_at || "").trim();
    if (!rawValue) {
        return "-";
    }
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
        return rawValue;
    }
    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(parsed);
}
export function formatJobDuration(payload) {
    if (!payload || !isJobTerminal(payload)) {
        return "-";
    }
    const startedRaw = (payload.started_at || "").trim();
    const finishedRaw = (payload.finished_at || payload.updated_at || "").trim();
    if (!startedRaw || !finishedRaw) {
        return "-";
    }
    const startedAt = new Date(startedRaw);
    const finishedAt = new Date(finishedRaw);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime())) {
        return "-";
    }
    const totalSeconds = Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}小时 ${minutes}分 ${seconds}秒`;
    }
    if (minutes > 0) {
        return `${minutes}分 ${seconds}秒`;
    }
    return `${seconds}秒`;
}
export function summarizeInvocationProtocol(payload) {
    const invocation = payload?.invocation || {};
    const inputProtocol = firstNonEmpty(invocation.input_protocol);
    if (inputProtocol === "stage_spec") {
        return "Stage Spec";
    }
    return "-";
}
export function summarizeInvocationSchemaVersion(payload) {
    const invocation = payload?.invocation || {};
    return firstNonEmpty(invocation.stage_spec_schema_version) || "-";
}
