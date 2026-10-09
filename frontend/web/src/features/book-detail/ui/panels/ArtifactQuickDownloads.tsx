import { useCallback, useState } from "react";
import {
  Columns2,
  FileDown,
  FileType2,
  Languages,
  LoaderCircle,
  PackageOpen,
  Settings2,
  SquareM,
} from "lucide-react";

import { Button } from "@/ui/components/button.js";
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";
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
import {
  readWordExportDpi,
  withWordExportDpi,
  writeWordExportDpi,
  WORD_EXPORT_DPI_OPTIONS,
} from "../../domain/word-export-settings.js";

const DOWNLOADS = [
  { id: "source", label: "原始 PDF", short: "原文", Icon: FileDown },
  { id: "markdown", label: "Markdown", short: "MD", Icon: SquareM },
  { id: "translated", label: "翻译 PDF", short: "译文", Icon: Languages },
  { id: "comparison", label: "对照 PDF", short: "对照", Icon: Columns2 },
  { id: "word", label: "Word 排版稿", short: "Word", Icon: FileType2 },
] satisfies Array<{
  id: ArtifactQuickDownloadId;
  label: string;
  /** 图标下面的两三个字：光有图标看不出哪个是哪个。 */
  short: string;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 记住上次选的清晰度。读不到（隐私模式、禁用站点数据）时 readWordExportDpi 自己
  // 退回默认值，这里不需要再兜一层。
  const [dpi, setDpi] = useState(readWordExportDpi);

  const chooseDpi = useCallback((value: number) => {
    setDpi(value);
    writeWordExportDpi(value);
  }, []);

  const download = useCallback((id: ArtifactQuickDownloadId, item: ArtifactCenterItem) => {
    // Word 排版稿是**按请求现生成**的，清晰度得跟着这一次的地址走；其余四个是
    // 已经躺在磁盘上的产物，原样下载。
    onDownload(id === "word" ? { ...item, url: withWordExportDpi(item.url, dpi) } : item);
  }, [dpi, onDownload]);

  return (
    <section className="book-detail-quick-downloads" aria-label="常用文件下载">
      <header>
        <PackageOpen aria-hidden="true" />
        <span>文件下载</span>
        {loading ? <LoaderCircle className="book-detail-quick-downloads-loader" aria-label="正在读取产物" /> : null}
        <button
          id="book-detail-download-settings-btn"
          type="button"
          className="book-detail-quick-downloads-settings"
          aria-label="导出设置"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 aria-hidden="true" />
        </button>
      </header>
      <TooltipProvider delayDuration={220}>
        <div className="book-detail-quick-download-grid">
          {DOWNLOADS.map(({ id, label, short, Icon }) => {
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
                      onClick={() => item && download(id, item)}
                    >
                      {downloading
                        ? <LoaderCircle className="is-spinning" aria-hidden="true" />
                        : <Icon aria-hidden="true" />}
                      <span className="book-detail-quick-download-label" aria-hidden="true">{short}</span>
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

      {/*
        书籍详情本身就是一个对话框，这个必须是 nested——少了它没有独立的浮层层级，
        内容会直接铺在详情页上（标题被挤成竖排，选项飘在正文里）。
        DialogShell / DialogBody 也不能省，面板的底色、留白和圆角都挂在它们身上。
      */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          id="book-detail-export-settings-dialog"
          level="nested"
          showCloseButton={false}
          size="compact"
        >
          <DialogShell>
            <DialogHeader>
              <DialogTitle>导出设置</DialogTitle>
              <DialogCloseButton />
            </DialogHeader>
            <DialogBody>
              <DialogDescription>
                Word 排版稿把每一页的原始扫描件作为背景图，再把译文按排版层算好的位置盖上去。
                清晰度只影响背景图，不影响文字。
              </DialogDescription>
              <div className="book-detail-export-settings" role="radiogroup" aria-label="背景图清晰度">
                {WORD_EXPORT_DPI_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    id={`book-detail-export-dpi-${option.value}`}
                    type="button"
                    role="radio"
                    aria-checked={dpi === option.value}
                    className="book-detail-export-settings-option"
                    onClick={() => chooseDpi(option.value)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">完成</Button>
              </DialogClose>
            </DialogFooter>
          </DialogShell>
        </DialogContent>
      </Dialog>
    </section>
  );
}
