import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（提示文字换中文）。
import { memo, useState, useEffect, useCallback, useRef, } from "react";
import { createPortal } from "react-dom";
import { cva } from "class-variance-authority";
import { CopyIcon, DownloadIcon, ImageIcon, ImageOffIcon, Loader2Icon, RefreshCwIcon, ShieldAlertIcon, XIcon, } from "lucide-react";
import { cn } from "../lib/utils.js";
import { hostOf, safeHref } from "../utils/href.js";
const extensionForMimeType = (mimeType) => {
    switch (mimeType) {
        case "image/png":
            return "png";
        case "image/jpeg":
        case "image/jpg":
            return "jpg";
        case "image/webp":
            return "webp";
        case "image/gif":
            return "gif";
        case "image/svg+xml":
            return "svg";
        default:
            return "png";
    }
};
const dataUriToBlob = (dataUri) => {
    const commaIndex = dataUri.indexOf(",");
    const meta = commaIndex >= 0 ? dataUri.slice(0, commaIndex) : dataUri;
    const data = commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : "";
    const mime = meta.match(/data:([^;]+)/i)?.[1]?.toLowerCase() ??
        "application/octet-stream";
    if (!/;base64/i.test(meta)) {
        const parts = [];
        let last = 0;
        for (const match of data.matchAll(/(?:%[\da-f]{2})+/gi)) {
            if (match.index > last)
                parts.push(data.slice(last, match.index));
            const run = match[0];
            const escaped = new Uint8Array(run.length / 3);
            for (let index = 0; index < escaped.length; index++) {
                escaped[index] = Number.parseInt(run.slice(index * 3 + 1, index * 3 + 3), 16);
            }
            parts.push(escaped);
            last = match.index + run.length;
        }
        parts.push(data.slice(last));
        return new Blob(parts, { type: mime });
    }
    let bytes;
    try {
        const base64 = data.replace(/%([\da-f]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
        bytes = atob(base64);
    }
    catch {
        return null;
    }
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++)
        arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
};
const mimeFromImage = (image) => image.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
const defaultFilenameFromImage = (image) => {
    const mime = mimeFromImage(image);
    if (mime)
        return `image.${extensionForMimeType(mime)}`;
    try {
        const path = new URL(image, document.baseURI).pathname;
        const encodedBasename = path.split("/").pop() ?? "";
        let basename = encodedBasename;
        try {
            basename = decodeURIComponent(encodedBasename);
        }
        catch { }
        if (/\.(png|jpe?g|webp|gif|svg)$/i.test(basename))
            return basename;
    }
    catch { }
    return "image.png";
};
const safeImageDownloadHref = (image) => {
    try {
        const url = new URL(image, document.baseURI);
        return url.protocol === "http:" ||
            url.protocol === "https:" ||
            url.protocol === "blob:"
            ? image
            : null;
    }
    catch {
        return null;
    }
};
const downloadImagePart = (part) => {
    if (typeof document === "undefined")
        return;
    const filename = part.filename ?? defaultFilenameFromImage(part.image);
    const isDataUri = /^data:/i.test(part.image);
    const blob = isDataUri ? dataUriToBlob(part.image) : null;
    if (isDataUri && !blob)
        return;
    const objectUrl = blob ? URL.createObjectURL(blob) : null;
    const href = objectUrl ?? safeImageDownloadHref(part.image);
    if (!href)
        return;
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (objectUrl)
        setTimeout(() => URL.revokeObjectURL(objectUrl), 40_000);
};
const copyImagePart = async (part) => {
    if (typeof navigator === "undefined" ||
        !navigator.clipboard ||
        typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard API is not available in this environment.");
    }
    const blob = /^data:/i.test(part.image)
        ? dataUriToBlob(part.image)
        : await fetch(part.image).then((r) => r.blob());
    if (!blob)
        return;
    const mime = mimeFromImage(part.image) ?? blob.type ?? "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
};
const imageVariants = cva("aui-image-root relative overflow-hidden rounded-lg", {
    variants: {
        variant: {
            outline: "border-border border",
            ghost: "",
            muted: "bg-muted/50",
        },
        size: {
            sm: "max-w-64",
            default: "max-w-96",
            lg: "max-w-[512px]",
            full: "w-full",
        },
    },
    defaultVariants: {
        variant: "outline",
        size: "default",
    },
});
function ImageRoot({ className, variant, size, children, ...props }) {
    return (_jsx("div", { "data-slot": "image-root", "data-variant": variant, "data-size": size, className: cn(imageVariants({ variant, size, className })), ...props, children: children }));
}
function ImagePreview({ className, containerClassName, ratio = "auto", fit = "contain", onLoad, onError, alt = "图片", src, ...props }) {
    const imgRef = useRef(null);
    const [loadedSrc, setLoadedSrc] = useState(undefined);
    const [errorSrc, setErrorSrc] = useState(undefined);
    const loaded = loadedSrc === src;
    const error = errorSrc === src;
    const fixedRatio = ratio !== "auto";
    const ratioClassName = ratio === "1:1"
        ? "aspect-square"
        : ratio === "4:3"
            ? "aspect-[4/3]"
            : ratio === "16:9"
                ? "aspect-video"
                : ratio === "9:16"
                    ? "aspect-[9/16]"
                    : undefined;
    useEffect(() => {
        const image = imgRef.current;
        if (typeof src !== "string" || !image?.complete)
            return;
        if (image.naturalWidth > 0)
            setLoadedSrc(src);
        else
            setErrorSrc(src);
    }, [src]);
    return (_jsxs("div", { "data-slot": "image-preview", className: cn("relative", fixedRatio ? ratioClassName : "min-h-32", containerClassName), children: [!loaded && !error && (_jsx("div", { "data-slot": "image-preview-loading", className: "bg-muted/50 absolute inset-0 flex items-center justify-center", children: _jsx(ImageIcon, { className: "text-muted-foreground size-8 animate-pulse" }) })), error ? (_jsx("div", { "data-slot": "image-preview-error", className: cn("bg-muted/50 flex min-h-32 items-center justify-center p-4", fixedRatio && "absolute inset-0"), children: _jsx(ImageOffIcon, { className: "text-muted-foreground size-8" }) })) : (_jsx("picture", { className: "contents", children: _jsx("img", { ref: imgRef, src: src, alt: alt, className: cn(fixedRatio
                        ? cn("block h-full w-full", {
                            "object-cover": fit === "cover",
                            "object-contain": fit === "contain",
                        })
                        : "block h-auto w-full object-contain", !loaded && "invisible", className), onLoad: (e) => {
                        if (typeof src === "string")
                            setLoadedSrc(src);
                        onLoad?.(e);
                    }, onError: (e) => {
                        if (typeof src === "string")
                            setErrorSrc(src);
                        onError?.(e);
                    }, ...props }) }))] }));
}
function ImageSource({ className, label, url, iconUrl, ...props }) {
    const href = safeHref(url);
    const host = hostOf(url);
    const displayLabel = label || host;
    const [failedIconUrl, setFailedIconUrl] = useState();
    if (!displayLabel)
        return null;
    const showIcon = iconUrl !== undefined && failedIconUrl !== iconUrl;
    return (_jsxs("div", { "data-slot": "image-source", className: cn("text-muted-foreground flex items-center gap-2 border-t px-2 py-1.5 text-xs", className), ...props, children: [showIcon ? (_jsx("picture", { className: "contents", children: _jsx("img", { "data-slot": "image-source-icon", src: iconUrl, alt: "", className: "size-4 shrink-0 rounded-sm", onError: () => setFailedIconUrl(iconUrl) }) })) : (_jsx("span", { "data-slot": "image-source-icon-fallback", "aria-hidden": "true", className: "bg-muted flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium", children: displayLabel.charAt(0).toUpperCase() })), href ? (_jsxs("a", { "data-slot": "image-source-label", href: href, target: "_blank", rel: "noopener noreferrer", className: "hover:text-foreground truncate", children: [displayLabel, _jsx("span", { className: "sr-only", children: " (opens in a new tab)" })] })) : (_jsx("span", { "data-slot": "image-source-label", className: "truncate", children: displayLabel }))] }));
}
function ImageFilename({ className, children, ...props }) {
    if (!children)
        return null;
    return (_jsx("span", { "data-slot": "image-filename", className: cn("text-muted-foreground block truncate px-2 py-1.5 text-xs", className), ...props, children: children }));
}
function ImageZoom({ src, alt = "图片预览", children }) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const closeRef = useRef(null);
    const overlayRef = useRef(null);
    const handleOpen = useCallback(() => setIsOpen(true), []);
    const handleClose = useCallback(() => {
        setIsOpen(false);
        triggerRef.current?.focus();
    }, []);
    useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                handleClose();
                return;
            }
            if (e.key !== "Tab")
                return;
            const focusables = overlayRef.current?.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
            const first = focusables?.[0];
            const last = focusables?.[focusables.length - 1];
            if (!first || !last)
                return;
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleClose]);
    useEffect(() => {
        if (!isOpen)
            return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);
    useEffect(() => {
        if (isOpen)
            closeRef.current?.focus();
    }, [isOpen]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { ref: triggerRef, onClick: handleOpen, onKeyDown: (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.click();
                    }
                    else if (e.key === " ") {
                        e.preventDefault();
                    }
                }, onKeyUp: (e) => {
                    if (e.key === " ")
                        e.currentTarget.click();
                }, role: "button", tabIndex: 0, className: "aui-image-zoom-trigger cursor-zoom-in", "aria-label": "\u70B9\u5F00\u653E\u5927", children: children }), isOpen &&
                createPortal(_jsxs("div", { ref: overlayRef, "data-slot": "image-zoom-overlay", role: "dialog", "aria-modal": "true", className: "aui-image-zoom-overlay fade-in animate-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 duration-200", onClick: handleClose, "aria-label": "\u653E\u5927\u7684\u56FE", children: [_jsx("picture", { className: "contents", children: _jsx("img", { "data-slot": "image-zoom-content", src: src, alt: alt, className: "aui-image-zoom-content fade-in zoom-in-95 animate-in max-h-[90%] max-w-[90%] cursor-zoom-out object-contain duration-200", onClick: (e) => {
                                    e.stopPropagation();
                                    handleClose();
                                } }) }), _jsx("button", { ref: closeRef, type: "button", "aria-label": "\u5173\u6389\u653E\u5927", onClick: (e) => {
                                e.stopPropagation();
                                handleClose();
                            }, className: "text-muted-foreground hover:text-foreground bg-background/80 absolute end-4 top-4 rounded-md p-2", children: _jsx(XIcon, { className: "size-5" }) })] }), document.body)] }));
}
function ImageGenerating({ className }) {
    return (_jsxs("div", { "data-slot": "image-generating", className: cn("bg-muted/50 flex min-h-32 items-center justify-center p-4", className), children: [_jsx(Loader2Icon, { className: "text-muted-foreground size-8 animate-spin" }), _jsx("span", { className: "sr-only", children: "Generating image\u2026" })] }));
}
function ImageContentFilterError({ className, reason, }) {
    return (_jsxs("div", { "data-slot": "image-content-filter-error", className: cn("bg-muted/50 flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center", className), children: [_jsx(ShieldAlertIcon, { className: "text-muted-foreground size-8" }), _jsx("p", { className: "text-sm font-medium", children: "Image could not be generated" }), reason && _jsx("p", { className: "text-muted-foreground text-xs", children: reason })] }));
}
function RegenerateButton({ onRegenerate, }) {
    const [isRegenerating, setIsRegenerating] = useState(false);
    return (_jsx("button", { type: "button", onClick: async () => {
            setIsRegenerating(true);
            try {
                await onRegenerate();
            }
            catch {
            }
            finally {
                setIsRegenerating(false);
            }
        }, disabled: isRegenerating, "data-slot": "image-regenerate", "aria-label": "\u91CD\u65B0\u751F\u6210\u56FE\u7247", className: "hover:bg-muted inline-flex size-7 items-center justify-center rounded disabled:opacity-50", children: _jsx(RefreshCwIcon, { className: cn("size-4", isRegenerating && "animate-spin") }) }));
}
function ImageActions({ part, onRegenerate, className }) {
    return (_jsxs("div", { "data-slot": "image-actions", className: cn("flex items-center gap-1 p-1", className), children: [_jsx("button", { type: "button", onClick: () => downloadImagePart(part), "data-slot": "image-download", "aria-label": "\u4E0B\u8F7D\u56FE\u7247", className: "hover:bg-muted inline-flex size-7 items-center justify-center rounded", children: _jsx(DownloadIcon, { className: "size-4" }) }), _jsx("button", { type: "button", onClick: () => {
                    copyImagePart(part).catch(() => { });
                }, "data-slot": "image-copy", "aria-label": "\u590D\u5236\u56FE\u7247", className: "hover:bg-muted inline-flex size-7 items-center justify-center rounded", children: _jsx(CopyIcon, { className: "size-4" }) }), onRegenerate && _jsx(RegenerateButton, { onRegenerate: onRegenerate })] }));
}
const ImageImpl = (props) => {
    const { image, filename, status } = props;
    if (status?.type === "running") {
        return (_jsxs(ImageRoot, { children: [_jsx(ImageGenerating, {}), _jsx(ImageFilename, { children: filename })] }));
    }
    if (status?.type === "incomplete" && status.reason === "content-filter") {
        return (_jsx(ImageRoot, { children: _jsx(ImageContentFilterError, { reason: "\u670D\u52A1\u5546\u62E6\u4E86\u8FD9\u5F20\u56FE\u3002" }) }));
    }
    return (_jsxs(ImageRoot, { children: [_jsx(ImageZoom, { src: image, alt: filename || "图片", children: _jsx(ImagePreview, { src: image, alt: filename || "图片" }) }), _jsx(ImageFilename, { children: filename })] }));
};
const Image = memo(ImageImpl);
Image.displayName = "Image";
Image.Root = ImageRoot;
Image.Preview = ImagePreview;
Image.Source = ImageSource;
Image.Filename = ImageFilename;
Image.Zoom = ImageZoom;
Image.Actions = ImageActions;
Image.Generating = ImageGenerating;
Image.ContentFilterError = ImageContentFilterError;
export { Image, ImageRoot, ImagePreview, ImageSource, ImageFilename, ImageZoom, ImageActions, ImageGenerating, ImageContentFilterError, imageVariants, };
