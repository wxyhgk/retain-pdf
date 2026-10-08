// 翻译选项面板（主弹窗内联展开，非第二层 Dialog）。
//
// DOM id "page-range-dialog" / "page-range-title" 为历史契约（测试与样式锚点），保留不改。

import type { FormEvent } from "react";
import { BookOpen, FileText, Sparkles, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/ui/components/button.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import {
  useHomeFeatures,
  useHomeUploadViewStore,
  useHomeWorkflowViewActions,
  useHomeWorkflowViewStore,
} from "@/ui/context/home-services-context.js";
import type { UploadViewStore } from "../../domain/upload-store.js";

export function TranslationOptionsPanel() {
  const uploadViewStore = useHomeUploadViewStore();
  const workflowViewStore = useHomeWorkflowViewStore();
  const workflowViewActions = useHomeWorkflowViewActions();
  const features = useHomeFeatures();
  const upload = useStoreSnapshot(uploadViewStore);
  const workflow = useStoreSnapshot(workflowViewStore);

  if (!upload.translationOptionsOpen) return null;

  const selectedId = `${workflow.selectedGlossaryId || ""}`.trim();
  const hasSelected = !selectedId
    || workflow.glossaries.some((glossary) => glossary.glossaryId === selectedId);
  const maxAttr = upload.pageRangeMax > 0 ? { max: `${upload.pageRangeMax}` } : {};

  function handlePageInput(source: "start" | "end", event: FormEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    (uploadViewStore as unknown as UploadViewStore).actions.setPageRange(
      source === "start" ? { start: value } : { end: value },
    );
    features.uploadFeature?.constrainPageRanges({ source });
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
          <p id="page-range-limit-text">按需设置页码范围、术语表和翻译质量；页码留空表示处理整份 PDF。</p>
        </div>
        <Button
          id="page-range-close-btn"
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="收起翻译选项"
          onClick={() => (uploadViewStore as unknown as UploadViewStore).actions.closeTranslationOptions()}
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
            onChange={(event) => workflowViewActions.setSelectedGlossaryId(event.target.value)}
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

        <label className="translation-options-glossary" htmlFor="job-translation-quality">
          <span>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            翻译质量
          </span>
          <select
            id="job-translation-quality"
            value={workflow.translationQuality || "standard"}
            onChange={(event) => workflowViewActions.setTranslationQuality(event.target.value)}
          >
            <option value="standard">普通</option>
            <option value="terms">统一术语</option>
          </select>
          <small id="job-translation-quality-hint">
            {workflow.translationQuality === "terms"
              ? "先通读全书定好术语和文风再翻译，译法更一致；模型费用多约 0.4 倍。"
              : "直接翻译，速度最快、费用最低。"}
          </small>
        </label>
      </div>

      <div className="translation-options-actions">
        <Button
          id="page-range-clear-btn"
          type="button"
          variant="outline"
          onClick={() => features.uploadFeature?.clearPageRanges()}
        >
          清除页码
        </Button>
        <Button
          id="page-range-apply-btn"
          type="button"
          onClick={() => features.uploadFeature?.applyPageRanges()}
        >
          完成
        </Button>
      </div>
    </section>
  );
}
