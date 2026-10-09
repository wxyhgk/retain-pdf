// 翻译调试 tab(高级诊断)——组合 Summary/FilterPanel/ItemsPanel/DetailPanel,
// 外层 status/empty/content 三态切换 JSX 重写
// status-detail-dialog-translation.js#renderTranslationSummary 的 hidden 分支
// (蓝图 §1.2 组件表:TranslationDebugTab 家族)。

import { TranslationSummary } from "./TranslationSummary.jsx";
import { TranslationFilterPanel } from "./TranslationFilterPanel.jsx";
import { TranslationItemsPanel } from "./TranslationItemsPanel.jsx";
import { TranslationItemDetailPanel } from "./TranslationItemDetailPanel.jsx";
import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";
import type { StatusDetailTranslation } from "../domain/status-detail-store.js";
import type { StatusDetailController } from "../domain/status-detail-controller.js";

export function TranslationDebugTab({
  translation,
  controller,
}: {
  translation: StatusDetailTranslation;
  controller: StatusDetailController;
}) {
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;
  // 只看 emptyMessage 是不够的：面板 forceMount 常驻，切任务/运行时重置会把
  // translation 打回初始 slice（emptyMessage 为空、summary 为 null、loaded 为
  // false）而不触发加载。此时内容区会渲染出一副"数据完整"的样子——
  // 已翻译 0 / 保留原文 0 / 失败 0 / 共 0 条，正是最容易骗人的假象。
  // 数据真正到位（loaded 且 summary 非 null）才允许显示内容区。
  // 判据用 summary 而不是 loaded：loaded 只存在于 data-port 的内部状态，
  // markLoaded() 从不调 syncTranslation，所以 store 里的它恒为 false。
  // summary 是真正到手的数据，null 就说明这一屏还不能信。
  const hidden = Boolean(translation.emptyMessage) || translation.summary == null;
  const placeholder = translation.emptyMessage || "暂无翻译调试数据";

  return (
    <section className="status-panel translation-debug-panel">
      <div className="status-panel-head">
        <h3>翻译调试</h3>
        <span id={ids.debugStatus} className="status-panel-note">
          {hidden ? placeholder : "按 item 排查为什么没翻译、为什么保留原文"}
        </span>
      </div>
      <div id={ids.debugEmpty} className={hidden ? "events-empty" : "events-empty hidden"}>
        {placeholder}
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
