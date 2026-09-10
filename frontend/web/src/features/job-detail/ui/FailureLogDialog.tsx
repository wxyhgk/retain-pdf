import { ClipboardCheck, Copy, FileWarning } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/ui/components/button.js";
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";
import {
  copyText,
} from "@/platform/utils/clipboard.js";
import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";

type FailureLogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  logText: string;
};

export function FailureLogDialog({
  open,
  onOpenChange,
  jobId,
  logText,
}: FailureLogDialogProps) {
  const ids = STATUS_DETAIL_DIALOG_IDS.failure;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (open) setCopyState("idle");
  }, [open, logText]);

  async function handleCopy() {
    try {
      await copyText(logText || "暂无可复制的错误日志。");
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id={ids.logDialog}
        className="status-detail-log-dialog"
        level="nested"
        showCloseButton={false}
        size="standard"
      >
        <DialogShell className="status-detail-log-shell">
          <DialogHeader>
            <div className="status-detail-log-heading">
              <span className="status-detail-log-icon" aria-hidden="true">
                <FileWarning />
              </span>
              <div>
                <DialogTitle>错误日志</DialogTitle>
                <DialogDescription>{jobId && jobId !== "-" ? `任务 ${jobId}` : "当前任务"}</DialogDescription>
              </div>
            </div>
            <DialogCloseButton />
          </DialogHeader>
          <DialogBody className="status-detail-log-body">
            <pre id={ids.logContent} className="status-detail-log-content" tabIndex={0}>
              {logText || "暂无可复制的错误日志。"}
            </pre>
          </DialogBody>
          <DialogFooter className="status-detail-log-footer">
            <span id={ids.copyLogStatus} className="status-panel-note" role="status">
              {copyState === "copied" ? "已复制，可直接粘贴给开发人员。" : copyState === "failed" ? "复制失败，请手动选择日志。" : "日志已自动隐藏可能的密钥。"}
            </span>
            <Button id={ids.copyLogButton} type="button" onClick={handleCopy}>
              {copyState === "copied" ? <ClipboardCheck /> : <Copy />}
              {copyState === "copied" ? "已复制" : "复制日志"}
            </Button>
          </DialogFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  );
}
