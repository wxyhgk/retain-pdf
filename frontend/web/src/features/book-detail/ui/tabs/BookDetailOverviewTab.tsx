// Tab「书籍简介」——标题 / 作者 / 标签 / 编辑 + 元信息网格。
// 改简介相关 UI 只动本文件（或 TitleMetaPanel）。
// 元信息（页数/大小/入库/合集）自左栏迁入：右栏不再空旷，左栏纯粹封面+主操作。

import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Clock3,
  FileText,
  FileStack,
  FolderOpen,
  HardDrive,
  Languages,
  ScanText,
} from "lucide-react";
import { TitleMetaPanel } from "../panels/overview/TitleMetaPanel.jsx";

type OverviewStatus = {
  label: string;
  tone: string;
};

type OverviewJob = {
  job_id?: string;
  id?: string;
  workflow?: string;
  job_type?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
};

export type BookDetailOverviewTabProps = {
  pageCount?: number | null;
  bytes?: number | null;
  addedAt?: string | null;
  memberCollections?: string[];
  editing: boolean;
  titleText: string;
  tagsText: string;
  tags: string[];
  authors: string[];
  year: string | number | null | undefined;
  displayTitle: string;
  busy: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
  onTagsTextChange: (value: string) => void;
  management?: ReactNode;
  ocrStatus?: OverviewStatus;
  translationStatus?: OverviewStatus;
  jobs?: OverviewJob[];
  onOpenProcessing?: () => void;
  onOpenArtifacts?: () => void;
};

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function activityTime(value?: string | null) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function jobActivity(job: OverviewJob) {
  const workflow = `${job.workflow || job.job_type || ""}`.trim().toLowerCase();
  const status = `${job.status || ""}`.trim().toLowerCase();
  const title = workflow === "ocr"
    ? "OCR 识别"
    : workflow === "render"
      ? "生成阅读文件"
      : "文档翻译";
  const statusLabel = status === "succeeded"
    ? "已完成"
    : status === "failed"
      ? "失败"
      : ["queued", "pending", "running", "validating"].includes(status)
        ? "处理中"
        : status === "cancelled" || status === "canceled"
          ? "已取消"
          : status || "已创建";
  return {
    key: `${job.job_id || job.id || title}:${job.updated_at || job.created_at || ""}`,
    title,
    status: statusLabel,
    tone: status === "failed" ? "failed" : status === "succeeded" ? "done" : "active",
    kind: workflow === "ocr" ? "ocr" : workflow === "render" ? "render" : "translation",
    time: activityTime(job.updated_at || job.created_at),
  };
}

function ActivityIcon({ kind }: { kind?: string }) {
  if (kind === "ocr") return <ScanText aria-hidden="true" />;
  if (kind === "translation") return <Languages aria-hidden="true" />;
  return <FileStack aria-hidden="true" />;
}

/**
 * @param {object} props TitleMetaPanel 业务 props + 元信息（pageCount/bytes/addedAt/memberCollections）
 */
export function BookDetailOverviewTab({
  pageCount,
  bytes,
  addedAt,
  memberCollections = [],
  management,
  ocrStatus = { label: "尚未执行", tone: "muted" },
  translationStatus = { label: "尚未开始", tone: "muted" },
  jobs = [],
  onOpenProcessing,
  onOpenArtifacts,
  ...titleMetaProps
}: BookDetailOverviewTabProps) {
  const sizeText = formatBytes(bytes);
  const dateText = formatDate(addedAt);
  const activities = jobs
    .slice()
    .sort((left, right) => `${right.updated_at || right.created_at || ""}`.localeCompare(`${left.updated_at || left.created_at || ""}`))
    .slice(0, 2)
    .map(jobActivity);
  if (activities.length < 2 && addedAt) {
    activities.push({
      key: `added:${addedAt}`,
      title: "加入书库",
      status: "原始 PDF 已保存",
      tone: "done",
      kind: "file",
      time: activityTime(addedAt),
    });
  }
  return (
    <div
      className="book-detail-tab-overview"
      data-book-detail-tab="overview"
    >
      <TitleMetaPanel {...titleMetaProps} />

      <section className="book-detail-overview-hero">
        <div className="book-detail-overview-hero-copy">
          <span className="book-detail-overview-hero-icon" aria-hidden="true">
            <FileText />
          </span>
          <div className="book-detail-overview-page-count">
            <strong>{pageCount || "—"}</strong>
            <span>页文档</span>
          </div>
        </div>
        <div className="book-detail-overview-actions">
          <button id="book-detail-overview-process-btn" type="button" className="book-detail-overview-action is-primary" onClick={onOpenProcessing}>
            <span aria-hidden="true"><Languages /></span>
            <small>处理</small>
            <ArrowRight className="book-detail-overview-action-arrow" aria-hidden="true" />
          </button>
          <button id="book-detail-overview-files-btn" type="button" className="book-detail-overview-action" onClick={onOpenArtifacts}>
            <span aria-hidden="true"><FolderOpen /></span>
            <small>文件</small>
            <ArrowRight className="book-detail-overview-action-arrow" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="book-detail-overview-stats" aria-label="文档信息">
        <article className="book-detail-overview-stat">
          <span className="book-detail-overview-stat-icon" aria-hidden="true"><HardDrive /></span>
          <div><span>大小</span><strong>{sizeText || "—"}</strong></div>
        </article>
        <article className="book-detail-overview-stat">
          <span className="book-detail-overview-stat-icon" aria-hidden="true"><CalendarDays /></span>
          <div><span>入库</span><strong>{dateText || "—"}</strong></div>
        </article>
        <article className="book-detail-overview-stat">
          <span className="book-detail-overview-stat-icon" aria-hidden="true"><FolderOpen /></span>
          <div><span>合集</span><strong title={memberCollections.join("、")}>
              {memberCollections.length ? memberCollections.join("、") : "未加入"}
          </strong></div>
        </article>
      </div>

      <div className="book-detail-overview-main-grid">
        <section className="book-detail-overview-feature-card" aria-label="处理状态">
          <div className="book-detail-overview-card-heading">
            <div className="book-detail-overview-heading-title">
              <span aria-hidden="true"><FileStack /></span>
              <h3>处理</h3>
            </div>
            <button type="button" className="book-detail-overview-icon-link" onClick={onOpenProcessing} aria-label="查看处理详情">
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <div className="book-detail-overview-capabilities">
            <div className="book-detail-overview-capability">
              <span className="book-detail-overview-capability-icon" aria-hidden="true"><ScanText /></span>
              <div><span>OCR</span><strong className={`is-${ocrStatus.tone}`}>{ocrStatus.label}</strong></div>
            </div>
            <div className="book-detail-overview-capability">
              <span className="book-detail-overview-capability-icon" aria-hidden="true"><Languages /></span>
              <div><span>翻译</span><strong className={`is-${translationStatus.tone}`}>{translationStatus.label}</strong></div>
            </div>
          </div>
        </section>

        {management ? (
          <section className="book-detail-overview-management" aria-label="阅读与归档">
          <div className="book-detail-overview-section-heading">
            <span aria-hidden="true"><BookOpenCheck /></span>
            <h3>阅读</h3>
          </div>
          {management}
          </section>
        ) : null}
      </div>

      <section className="book-detail-overview-activity" aria-label="最近活动">
          <div className="book-detail-overview-card-heading">
            <div className="book-detail-overview-heading-title">
              <span aria-hidden="true"><Clock3 /></span>
              <h3>最近活动</h3>
            </div>
        </div>
        {activities.length ? (
          <ol>
            {activities.map((activity) => (
              <li key={activity.key}>
                <span className={`book-detail-overview-activity-icon is-${activity.tone}`}>
                  <ActivityIcon kind={activity.kind} />
                </span>
                <div>
                  <strong>{activity.title}</strong>
                  <span>{activity.status}</span>
                </div>
                <time>{activity.time}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="book-detail-overview-empty-activity">任务开始后，处理记录会显示在这里。</p>
        )}
      </section>
    </div>
  );
}
