// 文件页：按分组列出用得上的文件；排查用的文件和旧任务留下的同类文件收进底部默认折叠的「调试文件」。
// 怎么拆由 domain/artifact-visibility 决定，这里只管摆。
// 下载 / 查看按钮的 id、aria-label 和 li 上的 data-artifact-id 是对外契约，调试区里的行也原样沿用。

import { Button } from "@retainpdf/ui";
import {
  Archive,
  Bot,
  Bug,
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileCode,
  FileJson,
  FileText,
  FileType,
  ScanText,
  TriangleAlert,
} from "lucide-react";

import {
  formatArtifactBytes,
  formatArtifactTime,
  layoutArtifactCenter,
  type ArtifactCenterGroupId,
  type ArtifactCenterItem,
  type ArtifactCenterSection,
} from "../../../domain/artifact-center-model.js";

const SECTION_ICONS = {
  source: FileText,
  ocr: ScanText,
  translation: Archive,
  diagnostics: TriangleAlert,
  agent: Bot,
} satisfies Record<ArtifactCenterGroupId, typeof FileText>;

/** 按文件类型给图标：一排全是同一个 `{}` 时，PDF 和日志看起来没区别。 */
function iconForKind(kind: string) {
  const normalized = `${kind || ""}`.toUpperCase();
  if (normalized === "PDF") return FileText;
  if (normalized === "MD" || normalized === "MARKDOWN") return FileCode;
  if (normalized === "ZIP") return FileArchive;
  if (normalized === "JSON" || normalized === "JSONL") return FileJson;
  if (normalized === "DOCX" || normalized === "DOC") return FileType;
  return File;
}

/** 尝试次数只在大于 1 时才有信息量（「第 1 次尝试」等于没说）。 */
function attemptText(attempt: number | null | undefined): string {
  return attempt != null && attempt > 1 ? `第 ${attempt} 次尝试` : "";
}

function metaParts(item: ArtifactCenterItem, withAttempt: boolean): string[] {
  return [
    item.generatedAt ? formatArtifactTime(item.generatedAt) : "",
    item.sizeBytes != null ? formatArtifactBytes(item.sizeBytes) : "",
    withAttempt ? attemptText(item.attempt) : "",
  ].filter(Boolean);
}

function jobMeta(section: ArtifactCenterSection): string {
  const job = section.jobs[0];
  if (!job) return "";
  const status = job.status === "succeeded"
    ? "已完成"
    : job.status === "failed"
      ? "失败"
      : job.status === "canceled" || job.status === "cancelled"
        ? "已取消"
        : job.status;
  return [
    status,
    job.generatedAt ? formatArtifactTime(job.generatedAt) : "",
    attemptText(job.attempt),
  ].filter(Boolean).join(" · ");
}

function ArtifactRow({
  item,
  downloading,
  onPreview,
  onDownload,
  context = "",
  withAttempt = false,
}: {
  item: ArtifactCenterItem;
  downloading: boolean;
  onPreview: (item: ArtifactCenterItem) => void;
  onDownload: (item: ArtifactCenterItem) => void;
  /** 调试区：前面带上分组名 / 「旧版本」，看得出这份文件从哪来。 */
  context?: string;
  withAttempt?: boolean;
}) {
  const meta = metaParts(item, withAttempt);
  const detail = [context, item.filename !== item.label ? item.filename : "", ...meta].filter(Boolean);
  const Icon = iconForKind(item.kind);
  return (
    <li className="book-detail-artifact-item" data-artifact-id={item.id} data-artifact-kind={`${item.kind || ""}`.toLowerCase()}>
      <span className="book-detail-artifact-item-icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="book-detail-artifact-item-copy">
        <div>
          <strong>{item.label}</strong>
          <span>{item.kind}</span>
        </div>
        <p title={item.filename}>
          {detail.join(" · ") || "可下载"}
        </p>
      </div>
      <div className="book-detail-artifact-actions">
        {item.previewable ? (
          <Button
            id={item.group === "source" ? "book-detail-open-source-file-btn" : undefined}
            variant="ghost" size="sm" className="book-detail-artifact-action"
            onClick={() => onPreview(item)}
          >
            <ExternalLink aria-hidden="true" />
            <small>查看</small>
          </Button>
        ) : null}
        <Button
          variant="secondary" size="sm" className="book-detail-artifact-action"
          disabled={downloading}
          aria-label={`下载${item.label}`}
          onClick={() => onDownload(item)}
        >
          <Download aria-hidden="true" />
          <small>{downloading ? "下载中" : "下载"}</small>
        </Button>
      </div>
    </li>
  );
}

export function ArtifactCenterView({
  sections,
  loading,
  error,
  downloadingId,
  onOpenSource,
  onOpenJob,
  onDownload,
}: {
  sections: ArtifactCenterSection[];
  loading: boolean;
  error: string;
  downloadingId: string;
  onOpenSource: () => void;
  onOpenJob: (jobId: string) => void;
  onDownload: (item: ArtifactCenterItem) => void;
}) {
  function preview(item: ArtifactCenterItem) {
    if (item.group === "source") onOpenSource();
    else if (item.jobId) onOpenJob(item.jobId);
  }

  const layout = layoutArtifactCenter(sections);

  return (
    <div className="book-detail-artifact-center" data-artifact-center="true">
      {layout.sections.map((section) => {
        const Icon = SECTION_ICONS[section.id];
        const previewJob = section.jobs.find((job) => job.previewable);
        const sectionJobMeta = jobMeta(section);
        return (
          <section key={section.id} className="book-detail-artifact-group" data-artifact-group={section.id}>
            <header className="book-detail-artifact-group-header">
              <span className="book-detail-artifact-group-icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="book-detail-artifact-group-copy">
                <h3>{section.label}</h3>
                <p>{section.description}</p>
                {sectionJobMeta ? <small>{sectionJobMeta}</small> : null}
              </div>
              {previewJob ? (
                <Button
                  id={section.id === "ocr" ? "book-detail-open-ocr-file-btn" : undefined}
                  variant="ghost" size="sm" className="book-detail-artifact-group-open"
                  onClick={() => onOpenJob(previewJob.jobId)}
                >
                  <ExternalLink aria-hidden="true" />
                  <small>查看</small>
                </Button>
              ) : null}
            </header>
            {section.items.length ? (
              <ul className="book-detail-artifact-items">
                {section.items.map((item) => (
                  <ArtifactRow
                    key={item.id}
                    item={item}
                    downloading={downloadingId === item.id}
                    onPreview={preview}
                    onDownload={onDownload}
                  />
                ))}
              </ul>
            ) : (
              <p className="book-detail-artifact-empty">
                {section.mergedIntoTranslation
                  ? "OCR 产出的 Markdown、结构化文档等和下方「翻译与阅读」里的是同一批，已合并显示在那里。"
                  : layout.debug.length
                    ? "这次任务没有可直接使用的文件，排查用的文件在下方「调试文件」里。"
                    : "任务已记录，当前没有后端可下载产物。"}
              </p>
            )}
          </section>
        );
      })}
      {layout.debug.length ? (
        <details className="book-detail-artifact-debug" data-artifact-group="debug">
          <summary>
            <ChevronRight className="book-detail-artifact-debug-chevron" aria-hidden="true" />
            <Bug aria-hidden="true" />
            <span>调试文件</span>
            <small>{layout.debug.length} 个 · 事件日志、请求记录、OCR 原始数据和旧任务的文件，排查问题时才用得上</small>
          </summary>
          <ul className="book-detail-artifact-items">
            {layout.debug.map(({ item, sectionLabel, superseded, duplicate }) => (
              <ArtifactRow
                key={item.id}
                item={item}
                downloading={downloadingId === item.id}
                onPreview={preview}
                onDownload={onDownload}
                context={superseded ? `${sectionLabel} · 旧版本` : duplicate ? `${sectionLabel} · 与「翻译与阅读」重复` : sectionLabel}
                withAttempt
              />
            ))}
          </ul>
        </details>
      ) : null}
      {loading ? <p className="text-[10px] text-muted-foreground" role="status">正在读取任务产物…</p> : null}
      {error ? <p className="text-[10px] text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
