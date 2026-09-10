// glossaries — pure
import { buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint, submitJson } from "./http.js";
export async function fetchGlossaries(apiPrefix) {
    const resp = await fetch(buildApiEndpoint(apiPrefix, "glossaries"), { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取术语表失败，请稍后重试。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
export async function fetchGlossary(glossaryId, apiPrefix) {
    const normalizedGlossaryId = `${glossaryId || ""}`.trim();
    if (!normalizedGlossaryId)
        throw new Error("读取术语表失败: 缺少 glossary_id");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), { headers: buildApiHeaders() });
    if (!resp.ok)
        throw new Error(`读取术语表详情失败，请稍后重试。(${resp.status})`);
    return unwrapEnvelope(await resp.json());
}
export async function createGlossary(apiPrefix, payload) {
    return submitJson(buildApiEndpoint(apiPrefix, "glossaries"), payload);
}
export async function updateGlossary(apiPrefix, glossaryId, payload) {
    const normalizedGlossaryId = `${glossaryId || ""}`.trim();
    if (!normalizedGlossaryId)
        throw new Error("保存术语表失败: 缺少 glossary_id");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), {
        method: "PUT",
        headers: buildApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`保存术语表失败: ${resp.status} ${text}`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function deleteGlossary(apiPrefix, glossaryId) {
    const normalizedGlossaryId = `${glossaryId || ""}`.trim();
    if (!normalizedGlossaryId)
        throw new Error("删除术语表失败: 缺少 glossary_id");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), { method: "DELETE", headers: buildApiHeaders() });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`删除术语表失败: ${resp.status} ${text}`);
    }
    return unwrapEnvelope(await resp.json());
}
export async function exportGlossaryCsv(apiPrefix, glossaryId) {
    const normalizedGlossaryId = `${glossaryId || ""}`.trim();
    if (!normalizedGlossaryId)
        throw new Error("导出术语表失败: 缺少 glossary_id");
    const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}/export.csv`), { headers: buildApiHeaders() });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`导出术语表失败: ${resp.status} ${text || "unknown error"}`);
    }
    return resp;
}
export async function parseGlossaryCsv(apiPrefix, csvText) {
    return submitJson(buildApiEndpoint(apiPrefix, "glossaries/parse-csv"), { csv_text: `${csvText || ""}` });
}
