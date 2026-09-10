// 翻译调试 tab(高级诊断)——组合 Summary/FilterPanel/ItemsPanel/DetailPanel,
// 外层 status/empty/content 三态切换 JSX 重写
// status-detail-dialog-translation.js#renderTranslationSummary 的 hidden 分支
// (蓝图 §1.2 组件表:TranslationDebugTab 家族)。

import { TranslationSummary } from "./TranslationSummary.jsx";
import { TranslationFilterPanel } from "./TranslationFilterPanel.jsx";
import { TranslationItemsPanel } from "./TranslationItemsPanel.jsx";
import { TranslationItemDetailPanel } from "./TranslationItemDetailPanel.jsx";
import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";

export function TranslationDebugTab({ translation, controller }) {
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;
  const hidden = Boolean(translation.emptyMessage);

  return (
    <section className="status-panel translation-debug-panel">
      <div className="status-panel-head">
        <h3>翻译调试</h3>
        <span id={ids.debugStatus} className="status-panel-note">
          {hidden ? "暂无翻译调试数据" : "按 item 排查为什么没翻译、为什么保留原文"}
        </span>
      </div>
      <div id={ids.debugEmpty} className={hidden ? "events-empty" : "events-empty hidden"}>
        {translation.emptyMessage || "暂无翻译调试数据"}
      </div>
      <div id={ids.debugContent} className={hidden ? "translation-debug-content hidden" : "translation-debug-content"}>
        <TranslationSummary translation={translation} />
        <TranslationFilterPanel query={translation.query} onApply={controller.applyTranslationFilter} />
        <div className="translation-debug-layout">
          <TranslationItemsPanel
            translation={translation}
            onSelect={controller.selectTranslationItem}
            onChangePage={controller.changeTranslationPage}
          />
          <TranslationItemDetailPanel translation={translation} onReplay={controller.replayCurrentItem} />
        </div>
      </div>
    </section>
  );
}
