import { type ComponentProps } from "react";
export interface AudioPlayerProps extends Omit<ComponentProps<"div">, "children"> {
    src: string;
    title?: string | undefined;
    artwork?: string | undefined;
    durationMs?: number | undefined;
    /**
     * Origins this player may fetch from before the user presses play. A
     * remote `src` from another origin loads only on play, and its artwork or
     * poster is not shown. Same-page paths, `blob:` URLs and `data:` image,
     * audio or video URLs always load.
     */
    mediaOrigins?: readonly string[] | undefined;
}
export interface VideoPlayerProps extends Omit<ComponentProps<"div">, "children"> {
    src: string;
    poster?: string | undefined;
    title?: string | undefined;
    ratio?: "16:9" | "4:3" | "1:1" | "9:16" | "auto" | undefined;
    durationMs?: number | undefined;
    /**
     * Origins this player may fetch from before the user presses play. A
     * remote `src` from another origin loads only on play, and its artwork or
     * poster is not shown. Same-page paths, `blob:` URLs and `data:` image,
     * audio or video URLs always load.
     */
    mediaOrigins?: readonly string[] | undefined;
}
export declare function AudioPlayer({ src, title, artwork, durationMs, mediaOrigins, className, ...props }: AudioPlayerProps): import("react").JSX.Element;
export declare function VideoPlayer({ src, poster, title, ratio, durationMs, mediaOrigins, className, ...props }: VideoPlayerProps): import("react").JSX.Element;
//# sourceMappingURL=media-player.d.ts.map