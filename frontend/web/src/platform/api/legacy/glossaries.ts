import { buildApiHeaders, isMockMode } from "@/platform/config/runtime.js";
import { unwrapEnvelope } from "@retainpdf/domain/job";
import { buildApiEndpoint, submitJson } from "./http.js";

export async function fetchGlossaries(apiPrefix) {
  if (isMockMode()) {
    void apiPrefix;
    return {
      items: [
        {
          glossary_id: "mock-glossary-quantum",
          name: "Mock 量子化学术语",
          entry_count: 2,
          created_at: "",
          updated_at: "",
        },
      ],
    };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, "glossaries"), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`读取术语表失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchGlossary(glossaryId, apiPrefix) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("读取术语表失败: 缺少 glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return {
      glossary_id: normalizedGlossaryId,
      name: normalizedGlossaryId === "mock-glossary-quantum" ? "Mock 量子化学术语" : "Mock 术语表",
      entry_count: 2,
      entries: [
        {
          source: "Hartree-Fock",
          target: "",
          level: "preserve",
          match_mode: "case_insensitive",
          context: "",
          note: "保留英文",
        },
        {
          source: "density functional theory",
          target: "密度泛函理论",
          level: "canonical",
          match_mode: "case_insensitive",
          context: "",
          note: "固定译法",
        },
      ],
    };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`读取术语表详情失败，请稍后重试。(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function createGlossary(apiPrefix, payload) {
  if (isMockMode()) {
    void apiPrefix;
    return {
      glossary_id: `mock-glossary-${Date.now()}`,
      entry_count: Array.isArray(payload?.entries) ? payload.entries.length : 0,
      ...payload,
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "glossaries"), payload);
}

export async function updateGlossary(apiPrefix, glossaryId, payload) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("保存术语表失败: 缺少 glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return {
      glossary_id: normalizedGlossaryId,
      entry_count: Array.isArray(payload?.entries) ? payload.entries.length : 0,
      ...payload,
    };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), {
    method: "PUT",
    headers: buildApiHeaders({
      "Content-Type": "application/json",
    }),
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
  if (!normalizedGlossaryId) {
    throw new Error("删除术语表失败: 缺少 glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return { glossary_id: normalizedGlossaryId, deleted: true };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), {
    method: "DELETE",
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`删除术语表失败: ${resp.status} ${text}`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function exportGlossaryCsv(apiPrefix, glossaryId) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("导出术语表失败: 缺少 glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return new Response("source,target,note,level,match_mode,context\nHartree-Fock,,保留英文,preserve,case_insensitive,\n", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${normalizedGlossaryId}.csv"`,
      },
    });
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}/export.csv`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`导出术语表失败: ${resp.status} ${text || "unknown error"}`);
  }
  return resp;
}

export async function parseGlossaryCsv(apiPrefix, csvText) {
  if (isMockMode()) {
    void apiPrefix;
    void csvText;
    return {
      entry_count: 1,
      entries: [
        {
          source: "Hartree-Fock",
          target: "",
          level: "preserve",
          match_mode: "case_insensitive",
          context: "",
          note: "mock",
        },
      ],
    };
  }
  return submitJson(buildApiEndpoint(apiPrefix, "glossaries/parse-csv"), {
    csv_text: `${csvText || ""}`,
  });
}
