// 书籍详情里只要「这是哪本书」就能画的页签：质量、术语。写成独立的一项（格式见 ui/book-detail/book-detail-tab.ts），
// 别的功能要加页签就照这个写，放在自己的目录里，再在 app/home/shell/book-detail-tabs.ts 的表里加一行。
import { Languages, ShieldCheck } from "lucide-react";
import type { BookDetailTab } from "@/ui/book-detail/book-detail-tab.js";
import { QualityPanel } from "../panels/overview/QualityPanel.jsx";
import { BookDetailTermsTab } from "./BookDetailTermsTab.jsx";

export const qualityBookDetailTab: BookDetailTab = {
  id: "quality",
  label: "质量",
  title: "译文质量",
  Icon: ShieldCheck,
  order: 40,
  lazy: true,
  available: ({ jobId }) => Boolean(jobId),
  render: ({ jobId, documentId, translationJobId, retryStage }) => (
    <QualityPanel
      jobId={jobId}
      documentId={documentId}
      translationJobId={translationJobId}
      onRerender={retryStage ? () => retryStage("render") : undefined}
    />
  ),
};

export const termsBookDetailTab: BookDetailTab = {
  id: "terms",
  label: "术语",
  title: "术语与风格",
  Icon: Languages,
  order: 50,
  lazy: true,
  available: ({ jobId }) => Boolean(jobId),
  render: ({ jobId, title, openSettings }) => (
    <BookDetailTermsTab
      jobId={jobId}
      title={title}
      onOpenGlossarySettings={openSettings ? () => openSettings("glossary") : undefined}
    />
  ),
};
