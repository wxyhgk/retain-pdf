export async function fetchGlossaries(apiPrefix: string) {
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

export async function fetchGlossary(glossaryId: string, apiPrefix: string) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("读取术语表失败: 缺少 glossary_id");
  }
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

export async function createGlossary(apiPrefix: string, payload: Record<string, unknown> = {}) {
  void apiPrefix;
  return {
    glossary_id: `mock-glossary-${Date.now()}`,
    entry_count: Array.isArray(payload?.entries) ? payload.entries.length : 0,
    ...payload,
  };
}

export async function updateGlossary(apiPrefix: string, glossaryId: string, payload: Record<string, unknown> = {}) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("保存术语表失败: 缺少 glossary_id");
  }
  void apiPrefix;
  return {
    glossary_id: normalizedGlossaryId,
    entry_count: Array.isArray(payload?.entries) ? payload.entries.length : 0,
    ...payload,
  };
}

export async function deleteGlossary(apiPrefix: string, glossaryId: string) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("删除术语表失败: 缺少 glossary_id");
  }
  void apiPrefix;
  return { glossary_id: normalizedGlossaryId, deleted: true };
}

export async function exportGlossaryCsv(apiPrefix: string, glossaryId: string) {
  const normalizedGlossaryId = `${glossaryId || ""}`.trim();
  if (!normalizedGlossaryId) {
    throw new Error("导出术语表失败: 缺少 glossary_id");
  }
  void apiPrefix;
  return new Response("source,target,note,level,match_mode,context\nHartree-Fock,,保留英文,preserve,case_insensitive,\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${normalizedGlossaryId}.csv"`,
    },
  });
}

export async function parseGlossaryCsv(apiPrefix: string, csvText: string) {
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
