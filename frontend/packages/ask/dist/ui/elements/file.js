import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（提示文字换中文）。
import { memo } from "react";
import { cva } from "class-variance-authority";
import { FileIcon, FileTextIcon, ImageIcon, MusicIcon, VideoIcon, BracesIcon, DownloadIcon, } from "lucide-react";
import { cn } from "../lib/utils.js";
import { AudioPlayer, VideoPlayer } from "./media-player.js";
const fileVariants = cva("aui-file-root inline-flex items-center gap-3 rounded-lg transition-colors", {
    variants: {
        variant: {
            outline: "border-border hover:bg-muted/50 border",
            ghost: "hover:bg-muted/50",
            muted: "bg-muted/50 hover:bg-muted/70",
        },
        size: {
            sm: "px-2.5 py-1.5 text-xs",
            default: "px-3 py-2 text-sm",
            lg: "px-4 py-3 text-base",
        },
    },
    defaultVariants: {
        variant: "outline",
        size: "default",
    },
});
function getMimeTypeIcon(mimeType) {
    const type = mimeType.toLowerCase();
    if (type.startsWith("image/")) {
        return ImageIcon;
    }
    if (type === "application/pdf") {
        return FileTextIcon;
    }
    if (type === "application/json") {
        return BracesIcon;
    }
    if (type.startsWith("text/")) {
        return FileTextIcon;
    }
    if (type.startsWith("audio/")) {
        return MusicIcon;
    }
    if (type.startsWith("video/")) {
        return VideoIcon;
    }
    return FileIcon;
}
function getFileDataKind(data, sourceType) {
    if (sourceType === "url" && /^data:/i.test(data))
        return "data-uri";
    // A stored part can carry any value here; only the two literals count.
    if (sourceType === "url" || sourceType === "id")
        return sourceType;
    if (/^data:/i.test(data))
        return "data-uri";
    if (/^(https?:\/\/|blob:)/i.test(data))
        return "url";
    return "base64";
}
function isUnsafeScheme(data) {
    return (/^[a-z][a-z\d+.-]*:/i.test(data) &&
        !/^(data:|https?:\/\/|blob:)/i.test(data));
}
function getFileHref(data, mimeType, sourceType) {
    if (isUnsafeScheme(data))
        return null;
    const kind = getFileDataKind(data, sourceType);
    if (kind === "id")
        return null;
    if (kind === "data-uri")
        return /^data:[^,]*,/i.test(data) ? data : null;
    if (kind === "url")
        return /^(https?:\/\/|blob:)/i.test(data) ? data : null;
    return `data:${mimeType};base64,${data}`;
}
function getBase64PayloadSize(payload) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    const firstNonBase64 = payload.search(/[^A-Za-z\d+/]/);
    if ((firstNonBase64 !== -1 && firstNonBase64 !== payload.length - padding) ||
        payload.length % 4 === 1 ||
        (padding > 0 && payload.length % 4 !== 0)) {
        return 0;
    }
    return Math.floor((payload.length * 3) / 4) - padding;
}
function getBase64Size(base64) {
    const payload = /[\t\n\f\r ]/.test(base64)
        ? base64.replace(/[\t\n\f\r ]/g, "")
        : base64;
    return getBase64PayloadSize(payload);
}
function getDataUrlSize(data) {
    const fragment = data.indexOf("#");
    const end = fragment < 0 ? data.length : fragment;
    const comma = data.indexOf(",");
    if (comma < 0 || comma >= end) {
        return 0;
    }
    let payload = data.slice(comma + 1, end);
    if (/;base64$/i.test(data.slice(0, comma))) {
        if (/[%\t\n\f\r ]/.test(payload)) {
            payload = payload
                .replace(/%([\da-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
                .replace(/[\t\n\f\r ]/g, "");
        }
        return getBase64PayloadSize(payload);
    }
    // Each percent escape is one byte, including octets that are not valid UTF-8.
    return new TextEncoder().encode(payload.replace(/%[\da-f]{2}/gi, "_"))
        .byteLength;
}
function getFileLabel(mimeType) {
    const subtype = /^[^/;]+\/(?:x-)?(?:[^;+]*\.)?([^;+.\s]+)/.exec(mimeType.toLowerCase())?.[1];
    if (!subtype || subtype === "octet-stream")
        return "文件";
    if (subtype === "plain")
        return "文本文件";
    return `${subtype.toUpperCase()} file`;
}
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function FileRoot({ className, variant, size, children, ...props }) {
    return (_jsx("div", { "data-slot": "file-root", "data-variant": variant, "data-size": size, className: cn(fileVariants({ variant, size, className })), ...props, children: children }));
}
function FileIconDisplay({ mimeType, className, children, ...props }) {
    const IconComponent = mimeType ? getMimeTypeIcon(mimeType) : FileIcon;
    return (_jsx("span", { "data-slot": "file-icon", className: cn("text-muted-foreground shrink-0", className), ...props, children: children ?? _jsx(IconComponent, { className: "size-5" }) }));
}
function FileName({ className, children, ...props }) {
    return (_jsx("span", { "data-slot": "file-name", className: cn("min-w-0 flex-1 truncate font-medium", className), ...props, children: children || "没名字的文件" }));
}
function FileSize({ bytes, className, ...props }) {
    return (_jsx("span", { "data-slot": "file-size", className: cn("text-muted-foreground shrink-0", className), ...props, children: formatFileSize(bytes) }));
}
function FileDownload({ data, mimeType, filename, sourceType, className, children, ...props }) {
    if (typeof data !== "string")
        return null;
    const kind = getFileDataKind(data, sourceType);
    const href = getFileHref(data, mimeType, sourceType);
    if (!href)
        return null;
    return (_jsx("a", { "data-slot": "file-download", href: href, download: filename || "download", ...(kind === "url" && { target: "_blank", rel: "noopener noreferrer" }), className: cn("text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0 rounded-md p-1 transition-colors", className), "aria-label": !children ? `Download ${filename || "file"}` : undefined, ...props, children: children || _jsx(DownloadIcon, { className: "size-4" }) }));
}
function FilePlayer({ data, mimeType, filename, sourceType, className, ...props }) {
    const src = getFileHref(data, mimeType, sourceType);
    const normalizedMimeType = mimeType.toLowerCase();
    if (!src ||
        (!normalizedMimeType.startsWith("audio/") &&
            !normalizedMimeType.startsWith("video/"))) {
        return null;
    }
    return (_jsx("div", { "data-slot": "file-player", className: cn("w-full", className), ...props, children: normalizedMimeType.startsWith("audio/") ? (_jsx(AudioPlayer, { src: src, title: filename })) : (_jsx(VideoPlayer, { src: src, title: filename })) }));
}
const FileImpl = (part) => {
    // History from storage can carry fields of the wrong type; render a generic
    // file instead of throwing. Without string data there is nothing to play,
    // size or download.
    const data = typeof part.data === "string" ? part.data : undefined;
    const mimeType = typeof part.mimeType === "string"
        ? part.mimeType
        : "application/octet-stream";
    const filename = typeof part.filename === "string" ? part.filename : undefined;
    const sourceType = part.sourceType === "url" || part.sourceType === "id"
        ? part.sourceType
        : undefined;
    const kind = data === undefined ? undefined : getFileDataKind(data, sourceType);
    const bytes = data === undefined
        ? undefined
        : kind === "data-uri"
            ? getDataUrlSize(data)
            : kind === "base64"
                ? getBase64Size(data)
                : undefined;
    const mediaSource = data === undefined ? null : getFileHref(data, mimeType, sourceType);
    const isMedia = mimeType.toLowerCase().startsWith("audio/") ||
        mimeType.toLowerCase().startsWith("video/");
    if (data !== undefined && mediaSource && isMedia) {
        return (_jsxs("div", { className: "flex w-full max-w-xl flex-col gap-2", children: [_jsx(FilePlayer, { data: data, mimeType: mimeType, ...(filename !== undefined && { filename }), ...(sourceType !== undefined && { sourceType }) }), _jsxs("div", { className: "flex min-w-0 items-center justify-end gap-2 px-1", children: [bytes !== undefined && (_jsx(FileSize, { bytes: bytes, className: "text-muted-foreground text-[11px]" })), _jsx(FileDownload, { data: data, mimeType: mimeType, ...(filename !== undefined && { filename }), ...(sourceType !== undefined && { sourceType }) })] })] }));
    }
    return (_jsxs(FileRoot, { children: [_jsx(FileIconDisplay, { mimeType: mimeType }), _jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-0.5", children: [_jsx(FileName, { children: filename || getFileLabel(mimeType) }), bytes !== undefined && _jsx(FileSize, { bytes: bytes, className: "text-xs" })] }), data !== undefined && (_jsx(FileDownload, { data: data, mimeType: mimeType, ...(filename !== undefined && { filename }), ...(sourceType !== undefined && { sourceType }) }))] }));
};
const File = memo(FileImpl);
File.displayName = "File";
File.Root = FileRoot;
File.Icon = FileIconDisplay;
File.Name = FileName;
File.Size = FileSize;
File.Download = FileDownload;
File.Player = FilePlayer;
export { File, FileRoot, FileIconDisplay, FileName, FileSize, FileDownload, FilePlayer, fileVariants, getMimeTypeIcon, getFileDataKind, getFileHref, getBase64Size, formatFileSize, };
