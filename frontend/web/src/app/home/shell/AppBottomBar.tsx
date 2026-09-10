// 底部三合一浮动栏(用户要求:添加左、搜索中、设置右,合成一条)。
// 合并了旧的 AppBottomActions(右下角添加/设置胶囊)+ LibrarySearchDock
// (底部居中搜索条)——之前是两个各飘各的浮岛,现在收成一条居中玻璃栏。
//
// 契约 id 全保留:library-add-pdf-btn / app-settings-btn / library-search-input
// (测试 + library-search-island 都按这些 id 找元素)。
//
// 关键:hidden 用 CSS display:none(不卸载),搜索框始终留在 DOM 里——
// library-search-island 在 connectedCallback 里 getElementById 抓这个 input 存引用,
// 一旦卸载重挂(如批量模式进出)引用就失效、搜索静默失灵(上一轮批量选择埋的
// 隐患)。这里改成隐藏而非卸载,引用永远有效。
// showSearch=false 用于"分类"tab:该 tab 下搜索语义不同,不渲染 input(测试
// 断言分类 tab 下 #library-search-input 不存在),只留添加/设置。

import { useHomeDialogStore, useHomeSettingsHub, useHomeWorkflowDialog } from "../home-services-context.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useLibrarySearchBinding } from "@/features/library/index.js";
import { TRANSLATION_WORKFLOW_DIALOG } from "@/features/ingest/domain.js";

export function AppBottomBar({ showSearch = true, hidden = false }) {
  // Shell 窄口直取:dialog 读侧 + workflow/settings 动作口,不再 useHomeServices 大包。
  const dialogStore = useHomeDialogStore();
  const workflowDialog = useHomeWorkflowDialog();
  const settingsHub = useHomeSettingsHub();
  const dialog = useStoreSnapshot(dialogStore);
  const open = Boolean(dialog.open);
  // hooks 不能条件调用——始终订阅,只在 showSearch 时渲染 input(分类 tab 下
  // 只是拿着 query 不显示,无副作用)。
  const { query, onSearchChange } = useLibrarySearchBinding();

  return (
    <div className={`library-bottom-bar${hidden ? " is-hidden" : ""}`} aria-label="快捷操作栏">
      <button
        id="library-add-pdf-btn"
        type="button"
        className={`library-bottom-icon-btn primary${open ? " is-active" : ""}`}
        aria-label="添加 PDF"
        title="添加 PDF"
        aria-controls="translation-workflow-dialog"
        aria-expanded={open ? "true" : "false"}
        data-workflow-open={open
          ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
          : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed}
        data-workflow-mode={dialog.mode}
        onClick={() => workflowDialog.requestOpenUpload()}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        {/* 装饰钩子：默认无样式零渲染（各主题无感），皮肤可在 CSS 里给它贴图换装 */}
        <span className="library-bottom-icon-btn-ornament" aria-hidden="true" />
      </button>

      {showSearch ? (
        <div className="library-bottom-search" role="search">
          <input
            id="library-search-input"
            type="search"
            autoComplete="off"
            placeholder="搜索书籍、任务或日期"
            aria-label="搜索书籍"
            value={query}
            onChange={onSearchChange}
          />
        </div>
      ) : null}

      <button
        id="app-settings-btn"
        type="button"
        className="library-bottom-icon-btn"
        aria-label="设置"
        title="设置"
        aria-controls="app-settings-dialog"
        onClick={() => settingsHub.dialogStore.open({ tab: "api" })}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" stroke="currentColor" strokeWidth="1.65" />
          <path d="M19.1 13.2c.06-.39.09-.79.09-1.2s-.03-.81-.09-1.2l2.02-1.55-1.9-3.29-2.38.96a8.01 8.01 0 0 0-2.08-1.2L14.4 3.2h-3.8l-.36 2.52c-.75.28-1.45.69-2.08 1.2l-2.38-.96-1.9 3.29L5.9 10.8c-.06.39-.09.79-.09 1.2s.03.81.09 1.2l-2.02 1.55 1.9 3.29 2.38-.96c.63.51 1.33.92 2.08 1.2l.36 2.52h3.8l.36-2.52c.75-.28 1.45-.69 2.08-1.2l2.38.96 1.9-3.29-2.02-1.55Z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
        </svg>
        {/* 装饰钩子：同添加钮，皮肤可贴图换装 */}
        <span className="library-bottom-icon-btn-ornament" aria-hidden="true" />
      </button>
    </div>
  );
}
