import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（提示文字换中文）。
import { useState, isValidElement, } from "react";
import { XIcon, PlusIcon, FileText, Loader2Icon, AlertCircleIcon, } from "lucide-react";
import { AttachmentPrimitive, ComposerPrimitive, MessagePrimitive, } from "@assistant-ui/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, } from "../shadcn/tooltip.js";
import { Dialog, DialogTitle, DialogContent, DialogTrigger, } from "../shadcn/dialog.js";
import { Avatar, AvatarImage, AvatarFallback, } from "../shadcn/avatar.js";
import { TooltipIconButton } from "./tooltip-icon-button.js";
import { useAttachmentState } from "./attachment-state.js";
import { cn } from "../lib/utils.js";
const AttachmentPreview = ({ src, name }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    return (_jsx("picture", { className: "contents", children: _jsx("img", { src: src, alt: `Preview of ${name}`, className: cn("block h-auto max-h-[80vh] w-auto max-w-full rounded-sm object-contain transition-opacity duration-300 motion-reduce:transition-none", isLoaded
                ? "aui-attachment-preview-image-loaded opacity-100"
                : "aui-attachment-preview-image-loading opacity-0"), onLoad: () => setIsLoaded(true) }) }));
};
const AttachmentPreviewDialog = ({ children, src, name, }) => {
    if (!src)
        return children;
    return (_jsxs(Dialog, { children: [_jsx(DialogTrigger, { className: "aui-attachment-preview-trigger cursor-zoom-in", asChild: true, children: isValidElement(children) ? (children) : (_jsx("button", { type: "button", children: children })) }), _jsxs(DialogContent, { className: "aui-attachment-preview-dialog-content [&>button]:bg-foreground/60 [&>button]:hover:bg-foreground/80 [&_svg]:text-background p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0!", children: [_jsxs(DialogTitle, { className: "aui-sr-only sr-only", children: ["Preview ", name] }), _jsx("div", { className: "aui-attachment-preview bg-background relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden rounded-sm", children: _jsx(AttachmentPreview, { src: src, name: name }) })] })] }));
};
const AttachmentThumb = ({ src }) => {
    return (_jsxs(Avatar, { className: "aui-attachment-tile-avatar h-full w-full rounded-none", children: [_jsx(AvatarImage, { src: src, alt: "", className: "aui-attachment-tile-image rounded-none object-cover" }), _jsx(AvatarFallback, { children: _jsx(FileText, { className: "aui-attachment-tile-fallback-icon text-muted-foreground/80 size-6 stroke-[1.5]" }) })] }));
};
const AttachmentUI = () => {
    const { isComposer, src, isImage, name, typeLabel, isUploading, isError, errorMessage, } = useAttachmentState();
    return (_jsx(TooltipProvider, { children: _jsxs(Tooltip, { children: [_jsxs(AttachmentPrimitive.Root, { className: cn("aui-attachment-root relative", isComposer &&
                        "animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none", isImage &&
                        !isComposer &&
                        "aui-attachment-root-message only:*:first:size-24"), children: [_jsx(AttachmentPreviewDialog, { src: src, name: name, children: _jsx(TooltipTrigger, { asChild: true, children: _jsxs("div", { className: cn("aui-attachment-tile bg-muted hover:after:bg-foreground/10 focus-visible:ring-ring/50 relative size-14 overflow-hidden rounded-[calc(var(--composer-radius,1rem)-var(--composer-padding,8px))] transition-transform outline-none after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/10 after:transition-colors after:ring-inset focus-visible:ring-1 motion-reduce:transition-none dark:after:ring-white/10", src ? "cursor-zoom-in active:scale-[0.96]" : "cursor-default", isError &&
                                        "after:ring-destructive/60 dark:after:ring-destructive/60"), role: src ? "button" : "group", tabIndex: 0, onKeyDown: src
                                        ? (e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                e.currentTarget.click();
                                            }
                                            else if (e.key === " ") {
                                                e.preventDefault();
                                            }
                                        }
                                        : undefined, onKeyUp: src
                                        ? (e) => {
                                            if (e.key === " ")
                                                e.currentTarget.click();
                                        }
                                        : undefined, "aria-label": `${src ? `Preview ${name}` : `${typeLabel} attachment ${name}`}${isError ? ", upload failed" : isUploading ? ", uploading" : ""}`, children: [_jsx(AttachmentThumb, { src: src }), isUploading && (_jsx("div", { "aria-hidden": "true", className: "aui-attachment-tile-uploading bg-background/60 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none", children: _jsx(Loader2Icon, { className: "text-muted-foreground size-4 animate-spin" }) })), isError && (_jsx("div", { "aria-hidden": "true", className: "aui-attachment-tile-error bg-background/70 animate-in fade-in-0 absolute inset-0 flex items-center justify-center backdrop-blur-[2px] motion-reduce:animate-none", children: _jsx(AlertCircleIcon, { className: "text-destructive size-4" }) }))] }) }) }), isComposer && _jsx(AttachmentRemove, { name: name })] }), _jsxs(TooltipContent, { side: "top", children: [_jsx(AttachmentPrimitive.Name, {}), errorMessage && (_jsx("p", { className: "aui-attachment-error-message", children: errorMessage }))] })] }) }));
};
const AttachmentRemove = ({ name }) => {
    return (_jsx(AttachmentPrimitive.Remove, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: `去掉 ${name}`, className: "aui-attachment-tile-remove absolute end-1 top-1 size-5 rounded-full bg-black/50! text-white after:absolute after:-inset-1.5 hover:bg-black/70! hover:text-white! active:scale-[0.96] motion-reduce:transition-none", side: "top", children: _jsx(XIcon, { className: "aui-attachment-remove-icon size-3 stroke-[2.5]" }) }) }));
};
export const UserMessageAttachments = () => {
    return (_jsx("div", { className: "aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2 empty:hidden", children: _jsx(MessagePrimitive.Attachments, { children: () => _jsx(AttachmentUI, {}) }) }));
};
export const ComposerAttachments = () => {
    return (_jsx("div", { className: "aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden", children: _jsx(ComposerPrimitive.Attachments, { children: () => _jsx(AttachmentUI, {}) }) }));
};
export const ComposerAddAttachment = () => {
    return (_jsx(ComposerPrimitive.AddAttachment, { asChild: true, children: _jsx(TooltipIconButton, { tooltip: "\u52A0\u56FE\u7247", side: "bottom", variant: "ghost", size: "icon", className: "aui-composer-add-attachment text-muted-foreground hover:text-foreground hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30 size-7 rounded-full active:scale-[0.96] motion-reduce:transition-none", "aria-label": "\u52A0\u56FE\u7247", children: _jsx(PlusIcon, { className: "aui-attachment-add-icon size-4" }) }) }));
};
