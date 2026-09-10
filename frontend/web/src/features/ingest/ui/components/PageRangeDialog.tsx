// 翻译选项面板。
//
// 历史上这里是叠在“添加 PDF”之上的第二层 Dialog；现在上传入口合并为单一
// 流程，页码范围与术语表直接在主弹窗内展开。保留既有 DOM id 与导出别名，
// 让 upload controller / tests 不需要承担无关的业务迁移。

import type { FormEvent } from "react";
import { BookOpen, FileText, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/ui/components/button.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useHomeServices } from "@/app/home/home-services-context.js";
import type { UploadViewStore } from "../../domain/upload-store.js";

export function TranslationOptionsPanel() {
  const services = useHomeServices();
  const upload = useStoreSnapshot(services.stores.uploadView);
  const workflow = useStoreSnapshot(services.stores.workflowView);

  if (!upload.pageRangeDialogOpen) return null;

  const selectedId = `${workflow.selectedGlossaryId || ""}`.trim();
  const hasSelected = !selectedId
    || workflow.glossaries.some((glossary) => glossary.glossaryId === selectedId);
  const maxAttr = upload.pageRangeMax > 0 ? { max: `${upload.pageRangeMax}` } : {};

  function handlePageInput(source: "start" | "end", event: FormEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    (services.stores.uploadView as unknown as UploadViewStore).actions.setPageRange(
      source === "start" ? { start: value } : { end: value },
    );
    services.features.uploadFeature?.constrainPageRanges({ source });
  }

  return (
    <section
      id="page-range-dialog"
      className="translation-options-panel"
      aria-labelledby="page-range-title"
    >
      <div className="translation-options-head">
        <div>
          <h3 id="page-range-title">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            翻译选项
          </h3>
          <p id="page-range-limit-text">按需设置页码范围和术语表；留空表示处理整份 PDF。</p>
        </div>
        <Button
          id="page-range-close-btn"
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="收起翻译选项"
          onClick={() => (services.stores.uploadView as unknown as UploadViewStore).actions.closePageRangeDialog()}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div className="translation-options-grid">
        <fieldset className="translation-options-range">
          <legend>
            <FileText className="h-4 w-4" aria-hidden="true" />
            页码范围
          </legend>
          <div>
            <label htmlFor="page-range-start">起始页</label>
            <input
              id="page-range-start"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1"
              {...maxAttr}
              value={upload.pageRangeStart}
              onInput={(event) => handlePageInput("start", event)}
            />
          </div>
          <span className="translation-options-range-separator" aria-hidden="true">—</span>
          <div>
            <label htmlFor="page-range-end">结束页</label>
            <input
              id="page-range-end"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              autoComplete="off"
              placeholder={upload.pageRangeMax > 0 ? `${upload.pageRangeMax}` : "总页数"}
              {...maxAttr}
              value={upload.pageRangeEnd}
              onInput={(event) => handlePageInput("end", event)}
            />
          </div>
        </fieldset>

        <label className="translation-options-glossary" htmlFor="job-glossary-id">
          <span>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            术语表
          </span>
          <select
            id="job-glossary-id"
            value={selectedId}
            onChange={(event) => services.workflowViewActions.setSelectedGlossaryId(event.target.value)}
          >
            <option value="">不使用术语表</option>
            {workflow.glossaries.map((glossary) => (
              <option key={glossary.glossaryId} value={glossary.glossaryId}>
                {glossary.name}
                {Number.isFinite(glossary.entryCount) ? ` (${glossary.entryCount})` : ""}
              </option>
            ))}
            {!hasSelected ? (
              <option value={selectedId}>{`已删除或不可用: ${selectedId}`}</option>
            ) : null}
          </select>
        </label>
      </div>

      <div className="translation-options-actions">
        <Button
          id="page-range-clear-btn"
          type="button"
          variant="outline"
          onClick={() => services.features.uploadFeature?.clearPageRanges()}
        >
          清除页码
        </Button>
        <Button
          id="page-range-apply-btn"
          type="button"
          onClick={() => services.features.uploadFeature?.applyPageRanges()}
        >
          完成
        </Button>
      </div>
    </section>
  );
}

// 兼容历史导入名；新代码应使用 TranslationOptionsPanel。
export const PageRangeDialog = TranslationOptionsPanel;
