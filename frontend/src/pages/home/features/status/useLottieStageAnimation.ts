// Hook hoạt ảnh theo giai đoạn lottie — phần mệnh lệnh độc lập (bản thiết kế §2 features/status/, rủi ro §8.2).
//
// Sao chép createStatusStageAnimationController từ components/status/job-status-card-animation.js
// (tệp đó nằm trong danh sách "đã loại bỏ, thay bằng họ StatusCard.jsx",
// cấm import từ js/components; bảng STAGE_ANIMATIONS sao chép từ
// job-status-card-presets.js; resolveVisualStageKeyForSnapshot sao chép từ
// job-status-card-visuals.js; resolveLottieVendorUrl là tiện ích thuần của runtime/,
// được phép import trực tiếp).
//
// Quy tắc bất biến (rủi ro §8.2): giữ nguyên ba lần kiểm tra desiredKey — lottie-web
// được tải bất đồng bộ qua thẻ <script> động; trong lúc tải, người dùng có thể
// chuyển giai đoạn liên tục (thậm chí đổi job). Ba lần kiểm tra
// stageAnimationDesiredKey bảo đảm chỉ gọi loadAnimation khi giai đoạn vẫn là
// giai đoạn hiện muốn hiển thị; nếu không, hoạt ảnh cũ tải chậm có thể ghi đè
// hoạt ảnh mới sau khi giai đoạn mới đã render.
//
// Cách tích hợp React: bản thân lottie là mệnh lệnh thuần túy (DOM ref của container),
// nhưng hai dấu hiệu thị giác "có hiển thị container hoạt ảnh / có ở trạng thái
// translate" được trả nguyên dạng từ hook; StatusCard.jsx render bằng
// className/dataset khai báo, không ghi DOM mệnh lệnh không cần thiết.

import { useEffect, useMemo, useRef, useState } from "react";
import { resolveLottieVendorUrl } from "../../composition/external.js";

// Dùng đường dẫn từ gốc trang để tránh lỗi phân giải ./src tương đối trong hộp thoại
// chi tiết / đường dẫn con khiến container hoạt ảnh trống.
const TRANSLATION_ANIMATION_PATH = "/src/assets/animations/deepseek_lottie.json";
const OCR_ANIMATION_PATH = "/src/assets/animations/ocr_Lottie.json";
const UPLOAD_ANIMATION_PATH = "/src/assets/animations/pdf_upload_Lottie.json";
const DOWNLOAD_ANIMATION_PATH = "/src/assets/animations/pdf_download_Lottie.json";
const RENDER_ANIMATION_PATH = "/src/assets/animations/typst_rendering.json";

const STAGE_ANIMATIONS = {
  queued: UPLOAD_ANIMATION_PATH,
  ocr_upload: UPLOAD_ANIMATION_PATH,
  ocr: OCR_ANIMATION_PATH,
  ocr_processing: OCR_ANIMATION_PATH,
  ocr_result_ready: OCR_ANIMATION_PATH,
  ocr_normalizing: OCR_ANIMATION_PATH,
  translate: TRANSLATION_ANIMATION_PATH,
  render: RENDER_ANIMATION_PATH,
  render_prepare: RENDER_ANIMATION_PATH,
  render_prewarm: RENDER_ANIMATION_PATH,
  render_pages: RENDER_ANIMATION_PATH,
  render_compile: RENDER_ANIMATION_PATH,
  done: DOWNLOAD_ANIMATION_PATH,
};

function resolveAnimationPathForStage(stageKey = "") {
  return STAGE_ANIMATIONS[`${stageKey || ""}`.trim()] || "";
}

const LOTTIE_WEB_PATH = resolveLottieVendorUrl("build/player/lottie.min.js");
let lottieLoaderPromise: Promise<any> | null = null;

function windowLottie() {
  return (globalThis.window as any)?.lottie;
}

function loadLottieWeb() {
  const existing = windowLottie();
  if (existing) {
    return Promise.resolve(existing);
  }
  if (lottieLoaderPromise) {
    return lottieLoaderPromise;
  }
  lottieLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LOTTIE_WEB_PATH;
    script.async = true;
    script.onload = () => {
      const lottie = windowLottie();
      return lottie ? resolve(lottie) : reject(new Error("lottie unavailable"));
    };
    script.onerror = () => reject(new Error("failed to load lottie-web"));
    document.head.appendChild(script);
  });
  return lottieLoaderPromise;
}

function speedForProgressDelta(stageKey, previous, next) {
  if (!["ocr", "translate", "render"].includes(stageKey) || !previous || previous.stageKey !== stageKey || previous.total !== next.total) {
    return 1;
  }
  const elapsedSeconds = Math.max(0.25, (next.time - previous.time) / 1000);
  const delta = next.current - previous.current;
  if (!Number.isFinite(delta) || delta <= 0) {
    return 0.75;
  }
  const unitsPerSecond = delta / elapsedSeconds;
  if (stageKey === "render") {
    if (next.progressUnit === "step") {
      return Math.min(1.6, Math.max(0.85, 0.85 + delta * 0.25));
    }
    if (next.progressUnit === "percent") {
      return Math.min(2, Math.max(0.8, 0.8 + unitsPerSecond / 10));
    }
    if (unitsPerSecond >= 18) return 2.8;
    if (unitsPerSecond >= 8) return 2.2;
    if (unitsPerSecond >= 3) return 1.55;
    if (unitsPerSecond >= 1) return 1.15;
    return 0.8;
  }
  if (stageKey === "ocr") {
    if (unitsPerSecond >= 20) return 2.4;
    if (unitsPerSecond >= 8) return 1.8;
    if (unitsPerSecond >= 2) return 1.25;
    return 0.85;
  }
  if (unitsPerSecond >= 50) return 3;
  if (unitsPerSecond >= 20) return 2.4;
  if (unitsPerSecond >= 8) return 1.8;
  if (unitsPerSecond >= 2) return 1.25;
  return 0.85;
}

type ProgressSample = {
  stageKey?: string;
  current?: number;
  total?: number;
  progressUnit?: string;
};

export function useLottieStageAnimation(visualStageKey = "", progressSample: ProgressSample = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageAnimationRef = useRef(null);
  const stageAnimationKeyRef = useRef("");
  const stageAnimationLoadingKeyRef = useRef("");
  const stageAnimationDesiredKeyRef = useRef("");
  const playbackSpeedRef = useRef(1);
  const lastProgressSampleRef = useRef(null);
  const [isFallback, setIsFallback] = useState(false);

  const normalized = `${visualStageKey || ""}`.trim();
  const animationPath = useMemo(() => resolveAnimationPathForStage(normalized), [normalized]);

  function applyPlaybackSpeed() {
    stageAnimationRef.current?.setSpeed?.(playbackSpeedRef.current);
  }

  function clearStageAnimation() {
    const container = containerRef.current;
    stageAnimationRef.current?.destroy?.();
    stageAnimationRef.current = null;
    stageAnimationKeyRef.current = "";
    if (container) {
      container.innerHTML = "";
    }
    setIsFallback(false);
  }

  function ensureStageAnimation(stageKey, path) {
    const container = containerRef.current;
    if (!container || !path || stageAnimationKeyRef.current === stageKey || stageAnimationLoadingKeyRef.current === stageKey) {
      return;
    }
    stageAnimationLoadingKeyRef.current = stageKey;
    setIsFallback(false);
    if (stageAnimationKeyRef.current !== stageKey) {
      clearStageAnimation();
    }
    loadLottieWeb()
      .then((lottie) => {
        // Kiểm tra desiredKey ba lần (rủi ro §8.2, giữ nguyên): người dùng có thể
        // đổi giai đoạn liên tục trong lúc tải bất đồng bộ; một lần kiểm tra thất
        // bại bất kỳ đều cho biết kết quả tải này đã hết hạn.
        if (stageAnimationDesiredKeyRef.current !== stageKey) {
          return;
        }
        if (stageAnimationKeyRef.current !== stageKey) {
          stageAnimationRef.current?.destroy?.();
          container.innerHTML = "";
        }
        if (stageAnimationDesiredKeyRef.current !== stageKey) {
          return;
        }
        stageAnimationRef.current = lottie.loadAnimation({
          container,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path,
        });
        applyPlaybackSpeed();
        stageAnimationKeyRef.current = stageKey;
      })
      .catch(() => {
        if (stageAnimationDesiredKeyRef.current !== stageKey) {
          return;
        }
        setIsFallback(true);
      })
      .finally(() => {
        if (stageAnimationLoadingKeyRef.current === stageKey) {
          stageAnimationLoadingKeyRef.current = "";
        }
      });
  }

  useEffect(() => {
    stageAnimationDesiredKeyRef.current = animationPath ? normalized : "";
    if (animationPath) {
      ensureStageAnimation(normalized, animationPath);
      stageAnimationRef.current?.play?.();
    } else {
      clearStageAnimation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized, animationPath]);

  useEffect(() => clearStageAnimation, []);

  // syncProgressSpeed là side effect (đọc/ghi ref và gọi setSpeed của lottie),
  // phải chạy trong effect, không được gọi trực tiếp khi render (thân hàm render
  // phải là hàm thuần).
  const { stageKey = "", current = NaN, total = NaN, progressUnit = "" } = progressSample || {} as ProgressSample;
  useEffect(() => {
    const normalizedStageKey = `${stageKey || ""}`.trim();
    const numericCurrent = Number(current);
    const numericTotal = Number(total);
    if (!["ocr", "translate", "render"].includes(normalizedStageKey) || !Number.isFinite(numericCurrent) || !Number.isFinite(numericTotal) || numericTotal <= 0) {
      lastProgressSampleRef.current = null;
      playbackSpeedRef.current = 1;
      applyPlaybackSpeed();
      return;
    }
    const nextSample = {
      stageKey: normalizedStageKey,
      current: numericCurrent,
      total: numericTotal,
      progressUnit: `${progressUnit || ""}`.trim(),
      time: Date.now(),
    };
    playbackSpeedRef.current = speedForProgressDelta(normalizedStageKey, lastProgressSampleRef.current, nextSample);
    lastProgressSampleRef.current = nextSample;
    applyPlaybackSpeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey, current, total, progressUnit]);

  return {
    containerRef,
    hasStageAnimation: Boolean(animationPath),
    isTranslationStage: normalized === "translate",
    isFallback,
    visualStageKey: normalized,
  };
}
