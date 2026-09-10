// 本地持久化批注（localStorage）。不接旧 favorites API。

import {
  notesStorageKey,
  type ReaderNote,
  type ReaderNotesDocKey,
} from "./types.js";

function safeParse(raw: string | null): ReaderNote[] {
  if (!raw) {
    return [];
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item) => ({
        id: `${item?.id || ""}`.trim(),
        page: Math.max(1, Math.floor(Number(item?.page) || 1)),
        pane: item?.pane === "translated" ? "translated" as const : "source" as const,
        quote: `${item?.quote || ""}`.trim(),
        note: `${item?.note || ""}`.trim(),
        createdAt: `${item?.createdAt || ""}`.trim() || new Date().toISOString(),
      }))
      .filter((item) => item.id && item.quote);
  } catch {
    return [];
  }
}

export function loadNotes(doc: ReaderNotesDocKey): ReaderNote[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    return safeParse(localStorage.getItem(notesStorageKey(doc)));
  } catch {
    return [];
  }
}

export function saveNotes(doc: ReaderNotesDocKey, list: ReaderNote[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(notesStorageKey(doc), JSON.stringify(list));
  } catch (error) {
    console.warn("[reader-notes] persist failed", error);
  }
}
