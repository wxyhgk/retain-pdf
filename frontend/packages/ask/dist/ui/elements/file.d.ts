import { type FC } from "react";
import { type VariantProps } from "class-variance-authority";
import type { FileMessagePartComponent } from "@assistant-ui/react";
declare const fileVariants: (props?: {
    variant?: "ghost" | "muted" | "outline";
    size?: "default" | "lg" | "sm";
} & import("class-variance-authority/types").ClassProp) => string;
declare function getMimeTypeIcon(mimeType: string): FC<{
    className?: string;
}>;
export type FileDataKind = "data-uri" | "url" | "base64" | "id";
declare function getFileDataKind(data: string, sourceType?: "url" | "id"): FileDataKind;
declare function getFileHref(data: string, mimeType: string, sourceType?: "url" | "id"): string | null;
declare function getBase64Size(base64: string): number;
declare function formatFileSize(bytes: number): string;
export type FileRootProps = React.ComponentProps<"div"> & VariantProps<typeof fileVariants>;
declare function FileRoot({ className, variant, size, children, ...props }: FileRootProps): import("react").JSX.Element;
type FileIconDisplayProps = React.ComponentProps<"span"> & {
    mimeType?: string;
};
declare function FileIconDisplay({ mimeType, className, children, ...props }: FileIconDisplayProps): import("react").JSX.Element;
declare function FileName({ className, children, ...props }: React.ComponentProps<"span">): import("react").JSX.Element;
type FileSizeProps = React.ComponentProps<"span"> & {
    bytes: number;
};
declare function FileSize({ bytes, className, ...props }: FileSizeProps): import("react").JSX.Element;
type FileDownloadProps = Omit<React.ComponentProps<"a">, "href"> & {
    data: string;
    mimeType: string;
    filename?: string;
    sourceType?: "url" | "id";
};
declare function FileDownload({ data, mimeType, filename, sourceType, className, children, ...props }: FileDownloadProps): import("react").JSX.Element;
export interface FilePlayerProps extends Omit<React.ComponentProps<"div">, "children"> {
    data: string;
    mimeType: string;
    filename?: string | undefined;
    sourceType?: "url" | "id" | undefined;
}
declare function FilePlayer({ data, mimeType, filename, sourceType, className, ...props }: FilePlayerProps): import("react").JSX.Element;
declare const File: FileMessagePartComponent & {
    Root: typeof FileRoot;
    Icon: typeof FileIconDisplay;
    Name: typeof FileName;
    Size: typeof FileSize;
    Download: typeof FileDownload;
    Player: typeof FilePlayer;
};
export { File, FileRoot, FileIconDisplay, FileName, FileSize, FileDownload, FilePlayer, fileVariants, getMimeTypeIcon, getFileDataKind, getFileHref, getBase64Size, formatFileSize, };
