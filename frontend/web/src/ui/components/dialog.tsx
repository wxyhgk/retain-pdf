"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/ui/components/button"
import { cn } from "@/ui/lib/utils"

type DialogSize = "compact" | "standard" | "wide" | "workspace"
type DialogLevel = "base" | "nested"

const dialogSizeClass: Record<DialogSize, string> = {
  compact: "app-dialog-size-compact",
  standard: "app-dialog-size-standard",
  wide: "app-dialog-size-wide",
  workspace: "app-dialog-size-workspace",
}

const dialogLevelClass: Record<DialogLevel, string> = {
  base: "app-dialog-level-base",
  nested: "app-dialog-level-nested",
}

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  level = "base",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & { level?: DialogLevel }) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("app-dialog-overlay", dialogLevelClass[level], className)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  level = "base",
  overlayClassName,
  showCloseButton = true,
  size = "standard",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  level?: DialogLevel
  overlayClassName?: string
  showCloseButton?: boolean
  size?: DialogSize
}) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} level={level} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "app-dialog-content",
          dialogSizeClass[size],
          dialogLevelClass[level],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? <DialogCloseButton /> : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogShell({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-shell" className={cn("app-dialog-shell", className)} {...props} />
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("app-dialog-header", className)} {...props} />
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-body" className={cn("app-dialog-body", className)} {...props} />
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  return (
    <div data-slot="dialog-footer" className={cn("app-dialog-footer", className)} {...props}>
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">关闭</Button>
        </DialogPrimitive.Close>
      ) : null}
    </div>
  )
}

function DialogCloseButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      aria-label="关闭"
      data-slot="dialog-close-button"
      className={cn("app-dialog-close", className)}
      {...props}
    >
      {children ?? <XIcon className="h-4 w-4" />}
      <span className="sr-only">关闭</span>
    </DialogPrimitive.Close>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("app-dialog-title", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("app-dialog-description", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogShell,
  DialogTitle,
  DialogTrigger,
}
export type { DialogLevel, DialogSize }
