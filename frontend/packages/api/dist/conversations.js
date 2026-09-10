// conversations — pure (mock branches removed, runtime via internal)
import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";
async function apiJson(path, options = {}, apiPrefix = API_PREFIX) {
    const url = path.startsWith("http") ? path : buildApiEndpoint(apiPrefix, path.replace(/^\//, ""));
    const headers = buildApiHeaders({ "Content-Type": "application/json", ...options.headers });
    const resp = await fetch(url, { ...options, headers });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const err = new Error(`${body?.message || resp.statusText || "request failed"}`);
        err.status = resp.status;
        throw err;
    }
    return unwrapEnvelope(body);
}
export async function createConversation(payload = {}, apiPrefix = API_PREFIX) {
    return apiJson("ai/conversations", { method: "POST", body: JSON.stringify({ title: payload.title || "", document_id: payload.document_id || "" }) }, apiPrefix);
}
export async function listConversations(query = {}, apiPrefix = API_PREFIX) {
    const params = new URLSearchParams();
    if (query.limit != null)
        params.set("limit", String(query.limit));
    if (query.offset != null)
        params.set("offset", String(query.offset));
    if (query.document_id)
        params.set("document_id", query.document_id);
    const q = params.toString();
    return apiJson(`ai/conversations${q ? `?${q}` : ""}`, { method: "GET" }, apiPrefix);
}
export async function getConversation(conversationId, apiPrefix = API_PREFIX) {
    const id = `${conversationId || ""}`.trim();
    if (!id)
        throw new Error("conversation_id required");
    return apiJson(`ai/conversations/${encodeURIComponent(id)}`, { method: "GET" }, apiPrefix);
}
export async function deleteConversation(conversationId, apiPrefix = API_PREFIX) {
    const id = `${conversationId || ""}`.trim();
    if (!id)
        throw new Error("conversation_id required");
    return apiJson(`ai/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }, apiPrefix);
}
export async function patchConversation(conversationId, payload, apiPrefix = API_PREFIX) {
    const id = `${conversationId || ""}`.trim();
    if (!id)
        throw new Error("conversation_id required");
    const body = {};
    const head = `${payload.head_id || ""}`.trim();
    const title = `${payload.title || ""}`.trim();
    if (head)
        body.head_id = head;
    if (title)
        body.title = title;
    if (!Object.keys(body).length)
        throw new Error("patch requires head_id or title");
    return apiJson(`ai/conversations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }, apiPrefix);
}
export async function appendConversationMessage(conversationId, payload, apiPrefix = API_PREFIX) {
    const id = `${conversationId || ""}`.trim();
    if (!id)
        throw new Error("conversation_id required");
    return apiJson(`ai/conversations/${encodeURIComponent(id)}/messages`, {
        method: "POST",
        body: JSON.stringify({
            role: payload.role, content: payload.content, parent_id: payload.parent_id || "", message_id: payload.message_id || "",
            citations_json: payload.citations_json || "", tool_trace_json: payload.tool_trace_json || "", model: payload.model || "", set_head: payload.set_head !== false,
        }),
    }, apiPrefix);
}
export function baseConversationTitle(title) {
    let t = `${title || ""}`.replace(/\s+/g, " ").trim();
    if (!t)
        return "未命名对话";
    const fork = t.match(/^fork-\d+-(.+)$/i);
    if (fork?.[1])
        t = fork[1].trim();
    t = t.replace(/^分支\s*[·•\-—]\s*/, "").trim();
    return t || "未命名对话";
}
export function nextForkConversationTitle(sourceTitle, existingTitles = []) {
    const base = baseConversationTitle(sourceTitle);
    let maxN = 0;
    for (const raw of existingTitles) {
        const t = `${raw || ""}`.trim();
        const m = t.match(/^fork-(\d+)-(.+)$/i);
        if (!m)
            continue;
        if (baseConversationTitle(t) !== base)
            continue;
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > maxN)
            maxN = n;
    }
    const title = `fork-${maxN + 1}-${base}`;
    return title.length > 80 ? `${title.slice(0, 79).trim()}…` : title;
}
export async function forkConversationFromPath(options, apiPrefix = API_PREFIX) {
    const path = options.path || [];
    if (!path.length)
        throw new Error("fork path empty");
    const firstUser = path.find((m) => m.role === "user");
    const rawTitle = `${options.title || firstUser?.content || "未命名对话"}`.replace(/\s+/g, " ").trim();
    const title = rawTitle.length > 80 ? `${rawTitle.slice(0, 79).trim()}…` : rawTitle;
    const idMap = new Map();
    const makeId = (role, i) => `fork-${role[0] || "m"}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`;
    path.forEach((m, i) => { idMap.set(m.id, makeId(m.role, i)); });
    const forkMessages = path.map((m, i) => {
        const newId = idMap.get(m.id);
        const parentRaw = m.parentId ? idMap.get(m.parentId) || "" : "";
        const parentId = parentRaw || (i > 0 ? idMap.get(path[i - 1].id) || "" : "");
        let citations_json = "";
        if (m.citations?.length) {
            try {
                citations_json = JSON.stringify(m.citations);
            }
            catch {
                citations_json = "[]";
            }
        }
        return { role: m.role, content: m.content, message_id: newId, parent_id: parentId, citations_json };
    });
    const items = forkMessages.map((fm) => ({
        parentId: fm.parent_id || null,
        message: { id: fm.message_id, role: fm.role, content: fm.content, ...(fm.citations_json && fm.citations_json !== "[]" ? { citations: JSON.parse(fm.citations_json) } : {}), ...(fm.role === "assistant" ? { status: { type: "complete", reason: "stop" } } : {}) },
    }));
    try {
        const detail = await apiJson("ai/conversations/fork", {
            method: "POST",
            body: JSON.stringify({ title: title || "未命名对话", document_id: options.documentId || "", messages: forkMessages.map((m) => ({ role: m.role, content: m.content, message_id: m.message_id, parent_id: m.parent_id, citations_json: m.citations_json })) }),
        }, apiPrefix);
        const conversation = {
            conversation_id: detail.conversation_id || "",
            title: detail.title || title,
            document_id: detail.document_id ?? options.documentId ?? null,
            created_at: detail.created_at || new Date().toISOString(),
            updated_at: detail.updated_at || new Date().toISOString(),
            message_count: detail.messages?.length || forkMessages.length,
            head_id: detail.head_id || forkMessages[forkMessages.length - 1]?.message_id || "",
        };
        const serverMessages = detail.messages;
        if (Array.isArray(serverMessages) && serverMessages.length) {
            const serverItems = messagesToBranchItems(serverMessages);
            return { conversation: { ...conversation, head_id: serverItems[serverItems.length - 1]?.message.id || conversation.head_id, message_count: serverItems.length }, items: serverItems };
        }
        return { conversation: { ...conversation, head_id: items[items.length - 1]?.message.id || "", message_count: items.length }, items };
    }
    catch { }
    const conversation = await createConversation({ title: title || "未命名对话", document_id: options.documentId || "" }, apiPrefix);
    const convId = conversation.conversation_id;
    for (let i = 0; i < forkMessages.length; i += 1) {
        const fm = forkMessages[i];
        await appendConversationMessage(convId, { role: fm.role, content: fm.content, message_id: fm.message_id, parent_id: fm.parent_id, citations_json: fm.citations_json, set_head: i === forkMessages.length - 1 }, apiPrefix);
    }
    return { conversation: { ...conversation, head_id: items[items.length - 1]?.message.id || "", message_count: items.length }, items };
}
export function messagesToBranchItems(messages) {
    const items = [];
    for (const m of messages) {
        const role = m.role === "user" || m.role === "assistant" ? m.role : null;
        if (!role)
            continue;
        let citations;
        try {
            const raw = JSON.parse(m.citations_json || "[]");
            if (Array.isArray(raw) && raw.length)
                citations = raw;
        }
        catch { }
        const parent = `${m.parent_id || ""}`.trim();
        items.push({ parentId: parent || null, message: { id: m.message_id, role, content: m.content || "", ...(citations ? { citations } : {}), ...(role === "assistant" ? { status: { type: "complete", reason: "stop" } } : {}) } });
    }
    return items;
}
