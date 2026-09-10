import {
  Columns2,
  FileDown,
  Languages,
  LoaderCircle,
  PackageOpen,
  SquareM,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/tooltip.js";
import {
  selectArtifactQuickDownloads,
  type ArtifactCenterItem,
  type ArtifactCenterSection,
  type ArtifactQuickDownloadId,
} from "../../domain/artifact-center-model.js";

const DOWNLOADS = [
  { id: "source", label: "原始 PDF", Icon: FileDown },
  { id: "markdown", label: "Markdown", Icon: SquareM },
  { id: "translated", label: "翻译 PDF", Icon: Languages },
  { id: "comparison", label: "对照 PDF", Icon: Columns2 },
] satisfies Array<{
  id: ArtifactQuickDownloadId;
  label: string;
  Icon: typeof FileDown;
}>;

export function ArtifactQuickDownloads({
  sections,
  loading,
  downloadingId,
  onDownload,
}: {
  sections: ArtifactCenterSection[];
  loading: boolean;
  downloadingId: string;
  onDownload: (item: ArtifactCenterItem) => void;
}) {
  const items = selectArtifactQuickDownloads(sections);

  return (
    <section className="book-detail-quick-downloads" aria-label="常用文件下载">
      <header>
        <PackageOpen aria-hidden="true" />
        <span>文件下载</span>
        {loading ? <LoaderCircle className="book-detail-quick-downloads-loader" aria-label="正在读取产物" /> : null}
      </header>
      <TooltipProvider delayDuration={220}>
        <div className="book-detail-quick-download-grid">
          {DOWNLOADS.map(({ id, label, Icon }) => {
            const item = items[id];
            const downloading = Boolean(item && downloadingId === item.id);
            const unavailableLabel = loading ? `正在读取${label}` : `${label}尚未生成`;
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <span className="book-detail-quick-download-trigger">
                    <button
                      id={`book-detail-download-${id}-btn`}
                      type="button"
                      className="book-detail-quick-download-btn"
                      disabled={!item || Boolean(downloadingId)}
                      data-available={item ? "true" : "false"}
                      aria-label={item ? `下载${label}` : unavailableLabel}
                      aria-busy={downloading || undefined}
                      onClick={() => item && onDownload(item)}
                    >
                      {downloading
                        ? <LoaderCircle className="is-spinning" aria-hidden="true" />
                        : <Icon aria-hidden="true" />}
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={7}>
                  {item ? `下载${label}` : unavailableLabel}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </section>
  );
}
