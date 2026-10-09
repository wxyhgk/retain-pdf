import type { ReaderAnchor } from "@/platform/navigation/pages.js";
// reader：阅读域（独立 reader.html 入口）。
/** 主页阅读入口：跳转独立 reader.html（不再维护 dialogStore / iframe）。 */
export type HomeReader = {
  openReader: (jobId: string, anchor?: ReaderAnchor | null, documentId?: string, options?: { pinJob?: boolean }) => unknown;
};
