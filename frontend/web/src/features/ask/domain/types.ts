// 主页 AI 问答 Tab 的轻量类型（不绑阅读器 job）

/** @ 文档 */
export type HomeAskDocScope = {
  kind: "document";
  id: string;
  title: string;
  job_id?: string;
  source_filename?: string;
};

/** @ 合集（发送时展开为合集内文档列表，软限定检索） */
export type HomeAskCollectionScope = {
  kind: "collection";
  id: string;
  title: string;
  document_count?: number;
};

export type HomeAskScope = HomeAskDocScope | HomeAskCollectionScope;

/** @deprecated 兼容旧命名 */
export type HomeAskDocRef = HomeAskDocScope;

export type HomeAskCitation = {
  ref?: number | string;
  block_id?: string;
  page_idx?: number;
  page?: number;
  job_id?: string;
  document_id?: string;
  snippet?: string;
  [key: string]: unknown;
};

export type HomeAskMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: HomeAskCitation[];
  progress?: string;
  status?: "pending" | "streaming" | "complete" | "error";
};

export function scopeKey(s: HomeAskScope): string {
  return `${s.kind}:${s.id}`;
}
