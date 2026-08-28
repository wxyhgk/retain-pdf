import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint, submitJson } from "./http.js";

export async function fetchGlossaries(apiPrefix) {
  if (isMockMode()) {
    void apiPrefix;
    return {
      items: [
        {
          glossary_id: "mock-glossary-quantum",
          name: "Mock Thuật ngữ Hóa lượng tử",
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
    throw new Error(`Không thể tải bảng thuật ngữ, vui lòng thử lại sau.(${resp.status})`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function fetchGlossary(glossaryId, apiPrefix) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("Không thể tải bảng thuật ngữ: thiếu glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return {
      glossary_id: normalizedGlossaryId,
      name: normalizedGlossaryId === "mock-glossary-quantum" ? "Mock Thuật ngữ Hóa lượng tử" : "Mock Bảng thuật ngữ",
      entry_count: 2,
      entries: [
        {
          source: "Hartree-Fock",
          target: "",
          level: "preserve",
          match_mode: "case_insensitive",
          context: "",
          note: "Giữ nguyên tiếng Anh",
        },
        {
          source: "density functional theory",
          target: "Lý thuyết chức năng mật độ",
          level: "canonical",
          match_mode: "case_insensitive",
          context: "",
          note: "Dịch thuật cố định",
        },
      ],
    };
  }
  const resp = await fetch(buildApiEndpoint(apiPrefix, `glossaries/${encodeURIComponent(normalizedGlossaryId)}`), {
    headers: buildApiHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`Không thể tải chi tiết bảng thuật ngữ, vui lòng thử lại sau.(${resp.status})`);
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
    throw new Error("Không thể lưu bảng thuật ngữ: thiếu glossary_id");
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
    throw new Error(`Không thể lưu bảng thuật ngữ: ${resp.status} ${text}`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function deleteGlossary(apiPrefix, glossaryId) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("Không thể xóa bảng thuật ngữ: thiếu glossary_id");
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
    throw new Error(`Không thể xóa bảng thuật ngữ: ${resp.status} ${text}`);
  }
  return unwrapEnvelope(await resp.json());
}

export async function exportGlossaryCsv(apiPrefix, glossaryId) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("Không thể xuất bảng thuật ngữ: thiếu glossary_id");
  }
  if (isMockMode()) {
    void apiPrefix;
    return new Response("source,target,note,level,match_mode,context\nHartree-Fock,,Giữ nguyên tiếng Anh,preserve,case_insensitive,\n", {
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
    throw new Error(`Không thể xuất bảng thuật ngữ: ${resp.status} ${text || "unknown error"}`);
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
