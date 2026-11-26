import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 照搬 assistant-ui 官方组件（MIT，https://r.assistant-ui.com；shadcn/ 下是 shadcn/ui，MIT）。只改了引用路径（@/ 别名换成相对路径）。
// 别的不改，方便对着上游更新；我们的改动写在外面（../window/）。
// RetainPDF 的改动（提示文字换中文）。
import { useEffect, useRef, useState, } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { flushSync } from "react-dom";
import { cn } from "../lib/utils.js";
import { field, inkButton, mono, paper } from "./surfaces.js";
import { canPreload } from "../utils/href.js";
function formatDuration(seconds) {
    const wholeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(wholeSeconds / 60);
    const remainingSeconds = wholeSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
function useDeferredSource(mediaRef, src, mediaOrigins) {
    const preload = canPreload(src, mediaOrigins);
    const [armedSrc, setArmedSrc] = useState(undefined);
    if (armedSrc !== undefined && armedSrc !== src)
        setArmedSrc(undefined);
    const armed = preload || armedSrc === src;
    const wasArmed = useRef(armed);
    // `arm` sets the attribute outside React, and removing `src` leaves the
    // element playing what it loaded, so reset it when the source is held.
    useEffect(() => {
        const media = mediaRef.current;
        if (media && !armed && (wasArmed.current || media.hasAttribute("src"))) {
            media.removeAttribute("src");
            media.load();
        }
        wasArmed.current = armed;
    }, [mediaRef, src, armed]);
    return {
        preload,
        armed,
        arm: () => {
            const media = mediaRef.current;
            if (!media || armed)
                return;
            media.src = src;
            setArmedSrc(src);
        },
    };
}
function useMediaDuration(mediaRef, src, durationMs) {
    const [metadata, setMetadata] = useState({
        src,
    });
    // A server-rendered media element can load metadata before hydration attaches onLoadedMetadata.
    useEffect(() => {
        const media = mediaRef.current;
        if (!media || media.readyState < HTMLMediaElement.HAVE_METADATA)
            return;
        if (Number.isFinite(media.duration) && media.duration >= 0) {
            setMetadata({ src, duration: media.duration });
        }
    }, [mediaRef, src]);
    const fallbackDuration = durationMs !== undefined && Number.isFinite(durationMs)
        ? Math.max(0, durationMs / 1000)
        : undefined;
    return {
        duration: metadata.src === src
            ? (metadata.duration ?? fallbackDuration)
            : fallbackDuration,
        setDurationFromMetadata: (duration) => {
            if (Number.isFinite(duration) && duration >= 0) {
                setMetadata({ src, duration });
            }
        },
    };
}
export function AudioPlayer({ src, title, artwork, durationMs, mediaOrigins, className, ...props }) {
    const audioRef = useRef(null);
    const source = useDeferredSource(audioRef, src, mediaOrigins);
    const [playback, setPlayback] = useState({
        src,
        currentTime: 0,
        playing: false,
        hasError: false,
    });
    const { duration, setDurationFromMetadata } = useMediaDuration(audioRef, src, durationMs);
    const playbackState = playback.src === src
        ? playback
        : { src, currentTime: 0, playing: false, hasError: false };
    const { currentTime, playing, hasError } = playbackState;
    const update = (patch) => setPlayback((current) => ({
        ...(current.src === src
            ? current
            : { src, currentTime: 0, playing: false, hasError: false }),
        ...patch,
    }));
    const displayTitle = title ?? "Audio";
    const playbackLabel = title ? ` ${title}` : " audio";
    const durationLabel = duration === undefined ? "--:--" : formatDuration(duration);
    useEffect(() => {
        if (audioRef.current?.error) {
            setPlayback({ src, currentTime: 0, playing: false, hasError: true });
        }
    }, [src]);
    const togglePlayback = () => {
        const audio = audioRef.current;
        if (!audio || hasError)
            return;
        if (playing) {
            audio.pause();
            update({ playing: false });
            return;
        }
        source.arm();
        void audio.play().then(() => update({ playing: true }), () => update(audio.error ? { hasError: true, playing: false } : { playing: false }));
    };
    return (_jsxs("div", { "data-slot": "audio-player", className: cn(paper, "flex w-full max-w-md items-center gap-3 rounded-2xl p-3", className), ...props, children: [canPreload(artwork, mediaOrigins) ? (_jsx("picture", { className: "contents", children: _jsx("img", { src: artwork, alt: "", className: "size-10 shrink-0 rounded-lg object-cover" }) })) : null, _jsx("button", { type: "button", "aria-label": `${playing ? "Pause" : "Play"}${playbackLabel}`, disabled: hasError, onClick: togglePlayback, className: cn(inkButton, "flex size-9 shrink-0 items-center justify-center rounded-full disabled:cursor-default disabled:opacity-40"), children: playing ? (_jsx(PauseIcon, { "aria-hidden": true, className: "size-4" })) : (_jsx(PlayIcon, { "aria-hidden": true, className: "ml-0.5 size-4" })) }), _jsxs("div", { className: "flex min-w-0 grow basis-16 flex-col gap-1.5", children: [_jsx("span", { className: "truncate text-[13.5px] font-medium", children: displayTitle }), _jsx("input", { type: "range", min: 0, max: duration ?? 0, step: 0.1, value: Math.min(currentTime, duration ?? 0), "aria-label": "\u62D6\u52A8\u8FDB\u5EA6", "aria-valuetext": `${formatDuration(currentTime)} of ${durationLabel}`, disabled: hasError, onChange: (event) => {
                            const nextTime = Number(event.currentTarget.value);
                            if (!Number.isFinite(nextTime))
                                return;
                            const resolvedTime = Math.min(nextTime, duration ?? nextTime);
                            if (audioRef.current)
                                audioRef.current.currentTime = resolvedTime;
                            update({ currentTime: resolvedTime });
                        }, className: "accent-foreground w-full" })] }), _jsxs("span", { className: cn(mono, "text-muted-foreground tabular-nums"), children: [formatDuration(currentTime), "\u00A0/ ", durationLabel] }), _jsx("audio", { ref: audioRef, src: source.preload ? src : undefined, preload: source.preload ? "metadata" : "none", className: "hidden", onLoadedMetadata: (event) => {
                    setDurationFromMetadata(event.currentTarget.duration);
                }, onTimeUpdate: (event) => update({ currentTime: event.currentTarget.currentTime }), onPlay: () => update({ playing: true }), onPause: () => update({ playing: false }), onError: () => update({ hasError: true, playing: false }) }), hasError ? (_jsx("span", { role: "alert", className: "text-muted-foreground text-xs", children: "Can't play this audio" })) : null] }));
}
export function VideoPlayer({ src, poster, title, ratio = "16:9", durationMs, mediaOrigins, className, ...props }) {
    const videoRef = useRef(null);
    const source = useDeferredSource(videoRef, src, mediaOrigins);
    const { duration, setDurationFromMetadata } = useMediaDuration(videoRef, src, durationMs);
    const ratioClassName = ratio === "1:1"
        ? "aspect-square"
        : ratio === "4:3"
            ? "aspect-[4/3]"
            : ratio === "16:9"
                ? "aspect-video"
                : ratio === "9:16"
                    ? "aspect-[9/16]"
                    : undefined;
    return (_jsxs("div", { "data-slot": "video-player", className: cn("flex w-full max-w-xl flex-col gap-2", className), ...props, children: [_jsxs("div", { className: cn(field, "relative overflow-hidden rounded-xl", ratioClassName), children: [_jsx("video", { ref: videoRef, src: source.preload ? src : undefined, poster: canPreload(poster, mediaOrigins) ? poster : undefined, controls: source.armed, playsInline: true, preload: source.preload ? "metadata" : "none", "aria-label": title ?? "Video", className: cn("block max-w-full", ratio !== "auto" && "h-full w-full object-contain"), onLoadedMetadata: (event) => {
                            setDurationFromMetadata(event.currentTarget.duration);
                        } }), source.armed ? null : (_jsx("button", { type: "button", "aria-label": `Play ${title ?? "video"}`, onClick: () => {
                            flushSync(() => source.arm());
                            videoRef.current?.focus();
                            void videoRef.current?.play().catch(() => { });
                        }, className: "absolute inset-0 flex items-center justify-center", children: _jsx("span", { className: cn(inkButton, "flex size-11 items-center justify-center rounded-full"), children: _jsx(PlayIcon, { "aria-hidden": true, className: "ml-0.5 size-5" }) }) }))] }), (title || duration !== undefined) && (_jsxs("div", { className: "flex min-w-0 items-center gap-2 px-1", children: [title ? (_jsx("span", { className: "min-w-0 flex-1 truncate text-[13.5px] font-medium", children: title })) : null, duration !== undefined ? (_jsx("span", { className: cn(mono, "text-muted-foreground shrink-0 tabular-nums"), children: formatDuration(duration) })) : null] }))] }));
}
