"use client"

import { AlertTriangle, Info } from "lucide-react"
import type { ReactNode } from "react"

import { LegacyButton } from "./button.js"
import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogShell,
  DialogTitle,
  type DialogLevel,
  type DialogSize,
} from "./dialog.js"

type ConfirmDialogProps = {
  cancelLabel?: string
  confirmLabel?: string
  description: ReactNode
  id: string
  level?: DialogLevel
  onConfirm: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
  size?: DialogSize
  title: string
  tone?: "default" | "danger" | "info"
}

function ConfirmDialog({
  cancelLabel = "取消",
  confirmLabel = "确认",
  description,
  id,
  level = "base",
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  size = "compact",
  title,
  tone = "default",
}: ConfirmDialogProps) {
  const ToneIcon = tone === "info" ? Info : AlertTriangle
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!pending) onOpenChange(nextOpen)
    }}>
      <DialogContent id={id} showCloseButton={false} size={size} level={level}>
        <DialogShell>
          <DialogHeader>
            <div className="app-confirm-heading">
              <span className={`app-confirm-icon app-confirm-icon-${tone}`} aria-hidden="true">
                <ToneIcon className="h-4 w-4" />
              </span>
              <DialogTitle>{title}</DialogTitle>
            </div>
            <DialogCloseButton disabled={pending} />
          </DialogHeader>
          <DialogBody className="app-confirm-body">
            <div className="app-confirm-description">{description}</div>
          </DialogBody>
          <DialogFooter>
            <LegacyButton
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </LegacyButton>
            <LegacyButton
              id={`${id}-confirm`}
              type="button"
              variant={tone === "danger" ? "destructive" : "default"}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? "处理中…" : confirmLabel}
            </LegacyButton>
          </DialogFooter>
        </DialogShell>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
export type { ConfirmDialogProps }
