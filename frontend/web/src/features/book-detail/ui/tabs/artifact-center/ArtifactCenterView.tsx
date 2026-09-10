import {
  Archive,
  Bot,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  ScanText,
  TriangleAlert,
} from "lucide-react";

import { btn } from "../../panels/ui.jsx";
import {
  formatArtifactBytes,
  formatArtifactTime,
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

function metaParts(item: ArtifactCenterItem): string[] {
  return [
    item.generatedAt ? formatArtifactTime(item.generatedAt) : "",
    item.sizeBytes != null ? formatArtifactBytes(item.sizeBytes) : "",
    item.attempt != null ? `Attempt ${item.attempt}` : "",
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
    job.attempt != null ? `Attempt ${job.attempt}` : "",
  ].filter(Boolean).join(" · ");
}

function ArtifactRow({
  item,
  downloading,
  onPreview,
  onDownload,
}: {
  item: ArtifactCenterItem;
  downloading: boolean;
  onPreview: (item: ArtifactCenterItem) => void;
  onDownload: (item: ArtifactCenterItem) => void;
}) {
  const meta = metaParts(item);
  const detail = [item.filename !== item.label ? item.filename : "", ...meta].filter(Boolean);
  return (
    <li className="book-detail-artifact-item" data-artifact-id={item.id}>
      <span className="book-detail-artifact-item-icon" aria-hidden="true">
        <FileJson />
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
          <button
            id={item.group === "source" ? "book-detail-open-source-file-btn" : undefined}
            type="button"
            className={btn("ghost", "book-detail-artifact-action")}
            onClick={() => onPreview(item)}
          >
            <ExternalLink aria-hidden="true" />
            <small>查看</small>
          </button>
        ) : null}
        <button
          type="button"
          className={btn("outline", "book-detail-artifact-action")}
          disabled={downloading}
          aria-label={`下载${item.label}`}
          onClick={() => onDownload(item)}
        >
          <Download aria-hidden="true" />
          <small>{downloading ? "下载中" : "下载"}</small>
        </button>
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

  return (
    <div className="book-detail-artifact-center" data-artifact-center="true">
      {sections.map((section) => {
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
                <button
                  id={section.id === "ocr" ? "book-detail-open-ocr-file-btn" : undefined}
                  type="button"
                  className={btn("ghost", "book-detail-artifact-group-open")}
                  onClick={() => onOpenJob(previewJob.jobId)}
                >
                  <ExternalLink aria-hidden="true" />
                  <small>查看</small>
                </button>
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
                任务已记录，当前没有后端可下载产物。
              </p>
            )}
          </section>
        );
      })}
      {loading ? <p className="text-[10px] text-muted-foreground" role="status">正在读取任务产物…</p> : null}
      {error ? <p className="text-[10px] text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
