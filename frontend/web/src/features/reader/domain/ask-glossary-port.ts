// 阅读页记忆面板里「加进术语表」（2026-11-27）：读写用户自己的术语表（契约 glossaries.v1，整份保存带 expected_updated_at 防盖掉别处的改动）。
import type { ReaderAskGlossaryPort } from "@retainpdf/reader/contracts";
import { createGlossary, fetchGlossaries, fetchGlossary, updateGlossary, type GlossaryDetailView } from "@retainpdf/api/glossaries";

import { API_PREFIX } from "@/platform/config/api-constants.js";

type Entry = GlossaryDetailView["entries"][number];

/** 加一条进词条：同一个原文（不分大小写、去首尾空白）换成这次的译法，别的字段（级别、匹配方式）沿用原来那条。 */
export function mergeGlossaryEntry(entries: readonly Entry[], entry: { source: string; target: string; note?: string }): { entries: Entry[]; replaced: boolean } {
  const key = entry.source.trim().toLowerCase();
  const at = entries.findIndex((existing) => `${existing.source || ""}`.trim().toLowerCase() === key);
  if (at < 0) return { entries: [...entries, { source: entry.source, target: entry.target, ...(entry.note ? { note: entry.note } : {}) }], replaced: false };
  const next = [...entries];
  next[at] = { ...entries[at], source: entry.source, target: entry.target, ...(entry.note ? { note: entry.note } : {}) };
  return { entries: next, replaced: true };
}

export const askGlossaryPort: ReaderAskGlossaryPort = {
  list: async () => ((await fetchGlossaries(API_PREFIX)).items || []).map((item) => ({ id: item.glossary_id, name: item.name, entryCount: item.entry_count })),
  addEntry: async (into, entry) => {
    if ("name" in into) {
      const created = await createGlossary(API_PREFIX, { name: into.name, entries: [{ source: entry.source, target: entry.target, ...(entry.note ? { note: entry.note } : {}) }] });
      return { id: created.glossary_id, name: created.name, replaced: false };
    }
    const current = await fetchGlossary(into.id, API_PREFIX);
    const merged = mergeGlossaryEntry(current.entries || [], entry);
    const saved = await updateGlossary(API_PREFIX, into.id, { name: current.name, entries: merged.entries, expected_updated_at: current.updated_at });
    return { id: saved.glossary_id, name: saved.name, replaced: merged.replaced };
  },
};
