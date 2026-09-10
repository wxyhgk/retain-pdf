import { Link2 } from "lucide-react";
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
import type { OcrAmbiguityView } from "@/platform/api/index.js";
import type {
  OcrReceiptValues,
  OcrRecoveryOutcome,
} from "../domain/ocr-ambiguity-recovery.js";

type OcrReceiptBindingDialogProps = {
  descriptor: OcrAmbiguityView;
  id: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: OcrReceiptValues) => Promise<OcrRecoveryOutcome>;
  open: boolean;
  pending: boolean;
  status: string;
};

const OPERATION_LABELS: Record<string, string> = {
  apply_upload_url: "上传批次",
  create_extract_task: "解析任务",
  submit_local_file: "本地文件任务",
  submit_remote_url: "远程文件任务",
};

export function OcrReceiptBindingDialog({
  descriptor,
  id,
  onOpenChange,
  onSubmit,
  open,
  pending,
  status,
}: OcrReceiptBindingDialogProps) {
  const [values, setValues] = useState<OcrReceiptValues>({});

  useEffect(() => {
    setValues({});
  }, [open, descriptor.resolution_revision]);

  async function submit() {
    const outcome = await onSubmit(values);
    if (outcome.ok || outcome.conflict) onOpenChange(false);
  }

  const providerLabel = descriptor.provider === "mineru" ? "MinerU" : "PaddleOCR";
  const operationLabel = OPERATION_LABELS[descriptor.operation] || descriptor.operation;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!pending) onOpenChange(nextOpen);
    }}>
      <DialogContent id={id} level="nested" showCloseButton={false} size="compact">
        <DialogShell>
          <DialogHeader>
            <div className="app-confirm-heading">
              <span className="app-confirm-icon" aria-hidden="true">
                <Link2 className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle>绑定已有 OCR 任务</DialogTitle>
                <DialogDescription>
                  {providerLabel} · {operationLabel}
                </DialogDescription>
              </div>
            </div>
            <DialogCloseButton disabled={pending} />
          </DialogHeader>
          <DialogBody className="app-confirm-body">
            <div className="grid gap-4">
              {descriptor.receipt_fields.map((field) => {
                const fieldId = `${id}-${field.name}`;
                return (
                  <label key={field.name} htmlFor={fieldId}>
                    <span>{field.label}{field.required ? " *" : "（可选）"}</span>
                    <input
                      id={fieldId}
                      name={field.name}
                      type={field.secret ? "password" : "text"}
                      autoComplete={field.secret ? "new-password" : "off"}
                      value={values[field.name] || ""}
                      disabled={pending}
                      onChange={(event) => setValues((current) => ({
                        ...current,
                        [field.name]: event.target.value,
                      }))}
                    />
                  </label>
                );
              })}
              <p className="status-panel-note">
                回执只用于本次恢复，不会保存在浏览器中。带星号字段来自后端当前任务契约。
              </p>
              {status ? <p className="status-panel-note" role="status" aria-live="polite">{status}</p> : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button id={`${id}-submit`} type="button" disabled={pending} onClick={submit}>
              {pending ? "绑定中…" : "绑定并恢复"}
            </Button>
          </DialogFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  );
}
