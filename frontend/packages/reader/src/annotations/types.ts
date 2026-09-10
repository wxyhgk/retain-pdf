// 新阅读器批注模型（与旧 favorites / selection-favorites 无关）

export type ReaderNotePane = "source" | "translated";

export type ReaderNote = {
  id: string;
  /** 1-based 页码 */
  page: number;
  pane: ReaderNotePane;
  quote: string;
  note: string;
  createdAt: string;
};

export type ReaderNotesDocKey = {
  jobId?: string;
  documentId?: string;
};

export function notesStorageKey(doc: ReaderNotesDocKey): string {
  const job = `${doc.jobId || ""}`.trim();
  const documentId = `${doc.documentId || ""}`.trim();
  if (job) {
    return `retainpdf.reader.notes.v1:job:${job}`;
  }
  if (documentId) {
    return `retainpdf.reader.notes.v1:doc:${documentId}`;
  }
  return "retainpdf.reader.notes.v1:anonymous";
}

export function createNoteId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function sortNotes(list: ReaderNote[]): ReaderNote[] {
  return [...list].sort((a, b) => {
    if (a.page !== b.page) {
      return a.page - b.page;
    }
    return `${a.createdAt}`.localeCompare(`${b.createdAt}`);
  });
}

export function groupNotesByPage(list: ReaderNote[]): Array<{ page: number; items: ReaderNote[] }> {
  const groups: Array<{ page: number; items: ReaderNote[] }> = [];
  for (const item of sortNotes(list)) {
    const last = groups[groups.length - 1];
    if (last && last.page === item.page) {
      last.items.push(item);
    } else {
      groups.push({ page: item.page, items: [item] });
    }
  }
  return groups;
}

export function buildNotesMarkdown(title: string, list: ReaderNote[]): string {
  const heading = title ? `# ${title} · 批注` : "# 批注";
  const groups = groupNotesByPage(list);
  if (!groups.length) {
    return `${heading}\n\n（暂无批注）\n`;
  }
  const lines = [heading, ""];
  for (const group of groups) {
    lines.push(`## 第 ${group.page} 页`, "");
    for (const item of group.items) {
      for (const row of item.quote.split("\n")) {
        lines.push(`> ${row}`);
      }
      if (item.note) {
        lines.push("", `笔记：${item.note}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
