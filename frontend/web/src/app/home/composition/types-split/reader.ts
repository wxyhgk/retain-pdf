// types-split/reader.ts — 阅读域（独立 reader.html 入口）。
/** 主页阅读入口：跳转独立 reader.html（不再维护 dialogStore / iframe）。 */
export type HomeReader = {
  openReader: (jobId: string, anchor?: unknown, documentId?: string) => unknown;
};
