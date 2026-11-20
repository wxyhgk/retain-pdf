// Tab「概览」——一块紧凑信息区 + （预留）AI 导读 + 底部危险操作区。
//
// 质量、历史、用量各有自己的页签，概览只放「这本书是什么、现在什么状态」。
//
// 书名 / 作者已经在弹窗标题和左栏各出现一次，这里不再重复；编辑入口收进信息区的
// 「编辑信息」按钮。进度和文件本来就是上面的页签，概览不再放跳转大卡，只在
// 「翻译」一格里给一个可点的状态（点了去「进度」页）。
// 合集只在信息区出现一次（切换按钮自带是否已加入的状态）；删除挪到最底下单独
// 的危险操作区，不和日常的阅读状态挨在一起。
// 每一格、每一行前面一个图标（2026-11-20）：扫一眼认得出是哪一项；翻译那格的图标按状态换（完成打勾、在跑转圈、失败叹号）。

import type { ReactNode } from "react";
import { Button } from "@retainpdf/ui";
import {
  BookOpenCheck,
  CalendarPlus,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  FileStack,
  FolderHeart,
  HardDrive,
  Info,
  LoaderCircle,
  Pencil,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
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
  /** 译文版本（TranslationVersionsPanel）：只有一份译文时它自己不画。 */
  versionsSlot?: ReactNode;
  /** 信息区最后一项「花费」（usage 的 DocumentCostFact，一个 <div><dt/><dd/></div>）：没用量时它自己不画。 */
  costSlot?: ReactNode;
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




/** 信息区一格：图标、名字、值。图标放在 data-fact-icon 的小方块里（花费那格由 usage 的 DocumentCostFact 照这个样子画）。 */
function Fact({ id, icon: Icon, label, tone, children }: { id: string; icon: LucideIcon; label: string; tone?: string; children: ReactNode }) {
  return (
    <div data-book-detail-fact={id} data-tone={tone}>
      <span data-fact-icon={id} aria-hidden="true"><Icon /></span>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** 翻译状态的图标：完成打勾、在跑转圈、失败叹号，其余（没翻、取消）虚线圈。 */
const STATUS_ICON: Record<string, LucideIcon> = { done: CircleCheck, active: LoaderCircle, failed: CircleAlert };

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="book-detail-overview-row">
      <span className="book-detail-overview-row-label"><Icon aria-hidden="true" />{label}</span>
      <div className="book-detail-overview-row-value">{children}</div>
    </div>
  );
}

export function BookDetailOverviewTab({
  pageCount,
  bytes,
  addedAt,
  readingSlot,
  collectionsSlot,
  versionsSlot = null,
  costSlot = null,
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
  const StatusIcon = STATUS_ICON[translationStatus.tone] || CircleDashed;
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
          <h3><Info aria-hidden="true" />文档信息</h3>
          {!editing ? (
            <Button
              id="book-detail-edit-btn"
              variant="ghost"
              size="sm"
              className="book-detail-overview-text-btn"
              onClick={onStartEdit}
            >
              <Pencil aria-hidden="true" />编辑信息
            </Button>
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
          <Fact id="pages" icon={FileStack} label="页数">{pageCount ? `${pageCount} 页` : "—"}</Fact>
          <Fact id="size" icon={HardDrive} label="大小">{sizeText || "—"}</Fact>
          <Fact id="added" icon={CalendarPlus} label="入库">{dateText || "—"}</Fact>
          <Fact id="translation" icon={StatusIcon} label="翻译" tone={translationStatus.tone}>
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
          </Fact>
          {costSlot}
        </dl>

        <Row icon={FolderHeart} label="合集">{collectionsSlot}</Row>
        <Row icon={BookOpenCheck} label="阅读状态">{readingSlot}</Row>
      </section>

      {versionsSlot}

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
