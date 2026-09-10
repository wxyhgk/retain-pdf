// lottie 阶段动画 hook——命令式孤岛(蓝图 §2 features/status/,风险 §8.2)。
//
// 拷贝自 components/status/job-status-card-animation.js 的
// createStatusStageAnimationController(该文件属"死,由 StatusCard.jsx 家族
// 替代"清单,js/components/ 禁止 import;STAGE_ANIMATIONS 表拷贝自
// job-status-card-presets.js;resolveVisualStageKeyForSnapshot 拷贝自
// job-status-card-visuals.js;resolveLottieVendorUrl 是 runtime/ 纯工具,
// 合法直接 import)。
//
// 铁律(风险 §8.2):desiredKey 三重检查原样保留——lottie-web 是通过动态
// <script> 标签异步加载的,加载期间用户可能连续切换阶段(甚至连续切换 job),
// 三次核对 stageAnimationDesiredKey 是为了保证"加载完成时仍是当前想要展示的
// 阶段"才真正 loadAnimation,否则会出现"网络慢时旧阶段动画在新阶段渲染完成
// 后才姗姗来迟地把新动画覆盖掉"的竞态闪烁。
//
// React 化的方式:lottie 实例本身是纯命令式(容器 DOM ref),但"是否显示动画
// 容器 / 是否 translate 态"两个视觉标记原样上抛为 hook 返回值,由
// StatusCard.jsx 以声明式 className/dataset 渲染(不必要的命令式 DOM 写)。

import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveLottieVendorUrl,
} from "@/platform/runtime/vendor-url.js";

// 用站点根路径，避免详情弹窗 / 子路径下相对 ./src 解析失败导致动画空盒
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

// 惰性解析：resolveLottieVendorUrl 依赖 document.baseURI，模块级求值会在无 DOM
// 的环境（node 测试经传递依赖 import 本模块时）抛 ERR_INVALID_URL。
const lottieWebPath = () => resolveLottieVendorUrl("build/player/lottie.min.js");
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
    script.src = lottieWebPath();
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
        // 三重 desiredKey 核对(风险 §8.2,原样保留):异步加载期间用户可能
        // 连续切换阶段,任何一次检查失败都说明这次加载结果已经过期。
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

  // syncProgressSpeed 是副作用(读写 ref + 调 lottie 实例的 setSpeed),必须
  // 在 effect 里跑,不能在渲染期间直接调用(渲染函数体必须是纯函数)。
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
