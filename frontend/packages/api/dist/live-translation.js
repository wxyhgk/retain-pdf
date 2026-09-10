import { API_PREFIX, buildApiHeaders, buildApiUrl, unwrapEnvelope, } from "./internal/runtime.js";
export class LiveTranslationApiError extends Error {
    status;
    code;
    constructor(message, status, code = "") {
        super(message);
        this.name = "LiveTranslationApiError";
        this.status = status;
        this.code = code;
    }
}
function jobPath(jobId, suffix) {
    const normalized = `${jobId || ""}`.trim();
    if (!normalized)
        throw new LiveTranslationApiError("job_id required", 400);
    return `jobs/${encodeURIComponent(normalized)}/${suffix}`;
}
async function responseError(response) {
    const text = await response.text().catch(() => "");
    let payload = null;
    try {
        payload = JSON.parse(text);
    }
    catch {
        // A proxy may return plain text. Keep it short and never infer behavior from it.
    }
    const code = `${payload?.error?.code || payload?.code || ""}`.trim();
    const message = `${payload?.message || payload?.error?.message || text || "Live translation request failed"}`
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);
    return new LiveTranslationApiError(message, response.status, code);
}
async function requestJson(path, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const response = await fetchImpl(buildApiUrl(options.apiPrefix || API_PREFIX, path), {
        headers: buildApiHeaders(),
        signal: options.signal,
    });
    if (!response.ok)
        throw await responseError(response);
    return unwrapEnvelope(await response.json());
}
export function fetchLiveTranslationLayout(jobId, options = {}) {
    return requestJson(jobPath(jobId, "live-translation/layout"), options);
}
export function fetchLiveTranslationPage(jobId, pageIdx, options = {}) {
    if (!Number.isInteger(pageIdx) || pageIdx < 0) {
        throw new LiveTranslationApiError("page_idx must be a non-negative integer", 400);
    }
    return requestJson(jobPath(jobId, `live-translation/pages/${pageIdx}`), options);
}
function parseSseFrame(rawFrame) {
    let id = "";
    let event = "message";
    const data = [];
    for (const rawLine of rawFrame.split(/\r?\n/)) {
        if (!rawLine || rawLine.startsWith(":"))
            continue;
        const separator = rawLine.indexOf(":");
        const field = separator < 0 ? rawLine : rawLine.slice(0, separator);
        let value = separator < 0 ? "" : rawLine.slice(separator + 1);
        if (value.startsWith(" "))
            value = value.slice(1);
        if (field === "id")
            id = value;
        else if (field === "event")
            event = value || "message";
        else if (field === "data")
            data.push(value);
    }
    if (!data.length)
        return null;
    return { id, event, data: data.join("\n") };
}
function normalizeCommitEvent(frame) {
    if (frame.event !== "translation_units_committed")
        return null;
    let value;
    try {
        value = JSON.parse(frame.data);
    }
    catch {
        throw new LiveTranslationApiError("Invalid live translation event JSON", 0, "LIVE_TRANSLATION_EVENT_INVALID");
    }
    const seq = Number(value?.seq ?? frame.id);
    const attempt = Number(value?.attempt);
    const generation = Number(value?.generation);
    const pageIdx = Number(value?.page_idx);
    const pageHash = `${value?.page_hash || ""}`.trim();
    if (value?.event !== "translation_units_committed"
        || !Number.isInteger(seq)
        || seq < 0
        || !Number.isInteger(attempt)
        || attempt < 0
        || !Number.isInteger(generation)
        || generation < 0
        || !Number.isInteger(pageIdx)
        || pageIdx < 0
        || !pageHash
        || !Array.isArray(value?.changed_item_ids)) {
        throw new LiveTranslationApiError("Invalid live translation event", 0, "LIVE_TRANSLATION_EVENT_INVALID");
    }
    return {
        event: "translation_units_committed",
        seq,
        attempt,
        generation,
        page_idx: pageIdx,
        page_hash: pageHash,
        changed_item_ids: value.changed_item_ids.map((item) => `${item || ""}`.trim()).filter(Boolean),
    };
}
/** Authenticated fetch-based SSE reader. Resolves only when the stream closes. */
export async function streamLiveTranslationEvents(jobId, options) {
    const fetchImpl = options.fetchImpl || fetch;
    const afterSeq = Math.max(0, Math.floor(Number(options.afterSeq) || 0));
    const path = `${jobPath(jobId, "live-events")}?after_seq=${afterSeq}`;
    const response = await fetchImpl(buildApiUrl(options.apiPrefix || API_PREFIX, path), {
        headers: buildApiHeaders({ Accept: "text/event-stream" }),
        signal: options.signal,
    });
    if (!response.ok)
        throw await responseError(response);
    if (!response.body) {
        throw new LiveTranslationApiError("Live translation event stream has no body", response.status);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const flushFrames = async (final = false) => {
        buffer += final ? decoder.decode() : "";
        while (true) {
            const match = /\r?\n\r?\n/.exec(buffer);
            if (!match)
                break;
            const rawFrame = buffer.slice(0, match.index);
            buffer = buffer.slice(match.index + match[0].length);
            const frame = parseSseFrame(rawFrame);
            if (!frame)
                continue;
            const event = normalizeCommitEvent(frame);
            if (event)
                await options.onEvent(event);
        }
        if (final && buffer.trim()) {
            const frame = parseSseFrame(buffer);
            buffer = "";
            if (frame) {
                const event = normalizeCommitEvent(frame);
                if (event)
                    await options.onEvent(event);
            }
        }
    };
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            await flushFrames();
        }
        await flushFrames(true);
    }
    finally {
        reader.releaseLock();
    }
}
