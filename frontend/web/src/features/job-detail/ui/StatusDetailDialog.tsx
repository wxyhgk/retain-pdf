import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogShell,
} from "@/ui/components/dialog.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { StatusDetailHeader } from "./StatusDetailHeader.jsx";
import { StatusDetailTabs } from "./StatusDetailTabs.jsx";
import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";
import { useStatusDetailOverview } from "./useStatusDetailOverview.js";

/**
 * Task-detail composition root.
 *
 * Data orchestration lives in useStatusDetailOverview, navigation in
 * StatusDetailTabs, and each feature area owns its panel. Keeping this shell
 * deliberately small prevents recovery, diagnostics and artifact state from
 * leaking into the dialog lifecycle.
 */
export function StatusDetailDialog() {
  const detail = useStatusDetailOverview();
  const { onCloseAutoFocus } = useDialogReturnFocus(detail.open);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) detail.dialogStore.close();
  }

  return (
    <Dialog open={detail.open} onOpenChange={handleOpenChange}>
      <DialogContent
        id={STATUS_DETAIL_DIALOG_IDS.dialog}
        className="status-detail-dialog"
        level="nested"
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={false}
        size="wide"
      >
        <DialogShell className="desktop-shell">
          <StatusDetailHeader headline={detail.overview.headline} />
          <DialogBody className="desktop-body status-detail-body">
            <StatusDetailTabs
              activeTab={detail.activeTab}
              overview={detail.overview}
              translation={detail.translation}
              rerunPending={detail.rerunPending}
              ocrAmbiguityPending={detail.ocrAmbiguityPending}
              controller={detail.controller}
            />
          </DialogBody>
        </DialogShell>
      </DialogContent>
    </Dialog>
  );
}
