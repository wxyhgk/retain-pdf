// Tab「概览」——一块紧凑信息区 + （预留）AI 导读 + 底部危险操作区。
//
// 质量、历史、用量各有自己的页签，概览只放「这本书是什么、现在什么状态」。
//
// 书名 / 作者已经在弹窗标题和左栏各出现一次，这里不再重复；编辑入口收进信息区的
// 「编辑信息」按钮。进度和文件本来就是上面的页签，概览不再放跳转大卡，只在
// 「翻译」一格里给一个可点的状态（点了去「进度」页）。
// 合集只在信息区出现一次（切换按钮自带是否已加入的状态）；删除挪到最底下单独
// 的危险操作区，不和日常的阅读状态挨在一起。

import type { ReactNode } from "react";
import { ChevronRight, Pencil, TriangleAlert } from "lucide-react";
import { TitleMetaPanel } from "../panels/overview/TitleMetaPanel.jsx";
import { formatZhDate } from "@/platform/utils/datetime.js";

type OverviewStatus = {
  label: string;
  tone: string;
};


export type BookDetailOverviewTabProps = {
  pageCount?: number | null;
  bytes?: number | null;
  addedAt?: string | null;
  editing: boolean;
  titleText: string;
  busy: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
  /** 阅读状态切换（ReadingStatusPanel） */
  readingSlot?: ReactNode;
  /** 合集切换（CollectionsPanel） */
  collectionsSlot?: ReactNode;
  /** 危险操作（DeleteFooterPanel） */
  dangerSlot?: ReactNode;
  /**
   * 预留给 AI 导读：摘要、要点、生成的插图等。给了就放在信息区下面，不给就什么都不占。
   */
  aiSlot?: ReactNode;
  error?: string;
  ocrStatus?: OverviewStatus;
  translationStatus?: OverviewStatus;
  onOpenProcessing?: () => void;
};

function formatBytes(bytes: unknown) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: unknown) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return formatZhDate(parsed);
}




export function BookDetailOverviewTab({
  pageCount,
  bytes,
  addedAt,
  readingSlot,
  collectionsSlot,
  dangerSlot,
  aiSlot = null,
  error = "",
  ocrStatus = { label: "尚未执行", tone: "muted" },
  translationStatus = { label: "尚未开始", tone: "muted" },
  onOpenProcessing,
  editing,
  titleText,
  busy,
  onStartEdit,
  onCancelEdit,
  onSave,
  onTitleChange,
}: BookDetailOverviewTabProps) {
  const sizeText = formatBytes(bytes);
  const dateText = formatDate(addedAt);
  // 还没翻译时，「翻译」一格补一句 OCR 的状态：只做过 OCR 的书不至于看起来什么都没做。
  const translationHint = translationStatus.tone === "muted" && ocrStatus.tone !== "muted"
    ? `OCR ${ocrStatus.label}`
    : "";
  return (
    <div
      className="book-detail-tab-overview"
      data-book-detail-tab="overview"
    >
      <section
        className="book-detail-overview-card book-detail-overview-info"
        aria-label="文档信息"
        data-book-detail-section="management"
      >
        <div className="book-detail-overview-card-heading">
          <h3>文档信息</h3>
          {!editing ? (
            <button
              id="book-detail-edit-btn"
              type="button"
              className="book-detail-overview-text-btn"
              onClick={onStartEdit}
            >
              <Pencil aria-hidden="true" />编辑信息
            </button>
          ) : null}
        </div>

        {editing ? (
          <TitleMetaPanel
            titleText={titleText}
            busy={busy}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
            onTitleChange={onTitleChange}
          />
        ) : null}

        {error ? <p className="book-detail-overview-error" role="alert">{error}</p> : null}

        <dl className="book-detail-overview-facts">
          <div>
            <dt>页数</dt>
            <dd>{pageCount ? `${pageCount} 页` : "—"}</dd>
          </div>
          <div>
            <dt>大小</dt>
            <dd>{sizeText || "—"}</dd>
          </div>
          <div>
            <dt>入库</dt>
            <dd>{dateText || "—"}</dd>
          </div>
          <div>
            <dt>翻译</dt>
            <dd>
              <button
                id="book-detail-overview-process-btn"
                type="button"
                className={`book-detail-overview-status-link is-${translationStatus.tone}`}
                onClick={onOpenProcessing}
                title="查看进度"
              >
                <span>{translationStatus.label}</span>
                <ChevronRight aria-hidden="true" />
              </button>
              {translationHint ? <small>{translationHint}</small> : null}
            </dd>
          </div>
        </dl>

        <div className="book-detail-overview-row">
          <span className="book-detail-overview-row-label">合集</span>
          <div className="book-detail-overview-row-value">{collectionsSlot}</div>
        </div>
        <div className="book-detail-overview-row">
          <span className="book-detail-overview-row-label">阅读状态</span>
          <div className="book-detail-overview-row-value">{readingSlot}</div>
        </div>
      </section>

      {aiSlot ? <div className="book-detail-overview-ai" data-book-detail-section="ai">{aiSlot}</div> : null}

      {dangerSlot ? (
        <section className="book-detail-overview-danger" aria-label="危险操作">
          <div>
            <h3><TriangleAlert aria-hidden="true" />危险操作</h3>
            <p>删除这本书会一并删除它的任务和文件，无法恢复。</p>
          </div>
          {dangerSlot}
        </section>
      ) : null}
    </div>
  );
}
