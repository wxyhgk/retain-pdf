import { TranslationDebugTab } from "../TranslationDebugTab.jsx";
import type { StatusDetailTranslation } from "../../domain/status-detail-store.js";
import type { StatusDetailControllerApi } from "../useStatusDetailOverview.js";
import { STATUS_DETAIL_DIALOG_IDS } from "../../domain/status-detail-dom-ids.js";
import { StatusDetailTabPanel } from "./StatusDetailTabPanel.jsx";

type TranslationPanelProps = {
  translation: StatusDetailTranslation;
  controller: StatusDetailControllerApi;
  active: boolean;
};

export function TranslationPanel({
  translation,
  controller,
  active,
}: TranslationPanelProps) {
  return (
    <StatusDetailTabPanel
      value="translation"
      id={STATUS_DETAIL_DIALOG_IDS.panels.translation}
      active={active}
    >
      <TranslationDebugTab translation={translation} controller={controller} />
    </StatusDetailTabPanel>
  );
}
