"use client"

import { AlertTriangle } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/ui/components/button.js"
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js"

type ConfirmDialogProps = {
  cancelLabel?: string
  confirmLabel?: string
  description: ReactNode
  id: string
  onConfirm: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
  title: string
  tone?: "default" | "danger"
}

function ConfirmDialog({
  cancelLabel = "取消",
  confirmLabel = "确认",
  description,
  id,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
  tone = "default",
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!pending) onOpenChange(nextOpen)
    }}>
      <DialogContent id={id} showCloseButton={false} size="compact">
        <DialogShell>
          <DialogHeader>
            <div className="app-confirm-heading">
              <span className={`app-confirm-icon app-confirm-icon-${tone}`} aria-hidden="true">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <DialogTitle>{title}</DialogTitle>
            </div>
            <DialogCloseButton disabled={pending} />
          </DialogHeader>
          <DialogBody className="app-confirm-body">
            <div className="app-confirm-description">{description}</div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              id={`${id}-confirm`}
              type="button"
              variant={tone === "danger" ? "destructive" : "default"}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? "处理中…" : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
export type { ConfirmDialogProps }
