import { type PropsWithChildren } from "react";
import { type VariantProps } from "class-variance-authority";
import type { ImageMessagePart, ImageMessagePartComponent } from "@assistant-ui/react";
declare const imageVariants: (props?: {
    variant?: "ghost" | "muted" | "outline";
    size?: "default" | "full" | "lg" | "sm";
} & import("class-variance-authority/types").ClassProp) => string;
export type ImageRootProps = React.ComponentProps<"div"> & VariantProps<typeof imageVariants>;
declare function ImageRoot({ className, variant, size, children, ...props }: ImageRootProps): import("react").JSX.Element;
type ImagePreviewProps = Omit<React.ComponentProps<"img">, "children"> & {
    containerClassName?: string | undefined;
    ratio?: "auto" | "1:1" | "4:3" | "16:9" | "9:16" | undefined;
    fit?: "cover" | "contain" | undefined;
};
declare function ImagePreview({ className, containerClassName, ratio, fit, onLoad, onError, alt, src, ...props }: ImagePreviewProps): import("react").JSX.Element;
export type ImageSourceProps = {
    label?: string | undefined;
    url?: string | undefined;
    iconUrl?: string | undefined;
} & React.ComponentProps<"div">;
declare function ImageSource({ className, label, url, iconUrl, ...props }: ImageSourceProps): import("react").JSX.Element;
declare function ImageFilename({ className, children, ...props }: React.ComponentProps<"span">): import("react").JSX.Element;
type ImageZoomProps = PropsWithChildren<{
    src: string;
    alt?: string;
}>;
declare function ImageZoom({ src, alt, children }: ImageZoomProps): import("react").JSX.Element;
declare function ImageGenerating({ className }: {
    className?: string;
}): import("react").JSX.Element;
declare function ImageContentFilterError({ className, reason, }: {
    className?: string;
    reason?: string;
}): import("react").JSX.Element;
export type ImageActionsProps = {
    part: ImageMessagePart;
    /**
     * Wire to your own generation call to show a regenerate button. The button
     * renders only when this is set and the part carries a `prompt`.
     */
    onRegenerate?: () => void | Promise<void>;
    className?: string;
};
declare function ImageActions({ part, onRegenerate, className }: ImageActionsProps): import("react").JSX.Element;
declare const Image: ImageMessagePartComponent & {
    Root: typeof ImageRoot;
    Preview: typeof ImagePreview;
    Source: typeof ImageSource;
    Filename: typeof ImageFilename;
    Zoom: typeof ImageZoom;
    Actions: typeof ImageActions;
    Generating: typeof ImageGenerating;
    ContentFilterError: typeof ImageContentFilterError;
};
export { Image, ImageRoot, ImagePreview, ImageSource, ImageFilename, ImageZoom, ImageActions, ImageGenerating, ImageContentFilterError, imageVariants, };
//# sourceMappingURL=image.d.ts.map