import { resolveAnimationPathForStage } from "./job-status-card-visuals.js";

const LOTTIE_WEB_PATH = "./vendor/lottie-web/build/player/lottie.min.js";
let lottieLoaderPromise = null;

function loadLottieWeb() {
  if (window.lottie) {
    return Promise.resolve(window.lottie);
  }
  if (lottieLoaderPromise) {
    return lottieLoaderPromise;
  }
  lottieLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LOTTIE_WEB_PATH;
    script.async = true;
    script.onload = () => window.lottie ? resolve(window.lottie) : reject(new Error("lottie unavailable"));
    script.onerror = () => reject(new Error("failed to load lottie-web"));
    document.head.appendChild(script);
  });
  return lottieLoaderPromise;
}

export function createStatusStageAnimationController(host) {
  let stageAnimation = null;
  let stageAnimationKey = "";
  let stageAnimationLoadingKey = "";
  let stageAnimationDesiredKey = "";

  function clearStageAnimation() {
    const container = host.querySelector("#status-stage-lottie");
    stageAnimation?.destroy?.();
    stageAnimation = null;
    stageAnimationKey = "";
    if (container) {
      container.innerHTML = "";
      container.classList.remove("is-fallback");
    }
  }

  function ensureStageAnimation(stageKey, animationPath) {
    const container = host.querySelector("#status-stage-lottie");
    if (!container || !animationPath || stageAnimationKey === stageKey || stageAnimationLoadingKey === stageKey) {
      return;
    }
    stageAnimationLoadingKey = stageKey;
    container.classList.remove("is-fallback");
    if (stageAnimationKey !== stageKey) {
      clearStageAnimation();
    }
    loadLottieWeb()
      .then((lottie) => {
        if (stageAnimationDesiredKey !== stageKey) {
          return;
        }
        if (stageAnimationKey !== stageKey) {
          stageAnimation?.destroy?.();
          container.innerHTML = "";
        }
        if (stageAnimationDesiredKey !== stageKey) {
          return;
        }
        stageAnimation = lottie.loadAnimation({
          container,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: animationPath,
        });
        stageAnimationKey = stageKey;
      })
      .catch(() => {
        if (stageAnimationDesiredKey !== stageKey) {
          return;
        }
        container.classList.add("is-fallback");
      })
      .finally(() => {
        if (stageAnimationLoadingKey === stageKey) {
          stageAnimationLoadingKey = "";
        }
      });
  }

  function setStageVisualMode(stageKey) {
    const normalized = `${stageKey || ""}`.trim();
    const animationPath = resolveAnimationPathForStage(normalized);
    stageAnimationDesiredKey = animationPath ? normalized : "";
    host.classList.toggle("has-stage-animation", Boolean(animationPath));
    host.classList.toggle("is-translation-stage", normalized === "translate");
    host.dataset.visualStageKey = normalized;
    host.querySelector("#status-stage-animation")?.classList.toggle("hidden", !animationPath);
    if (animationPath) {
      ensureStageAnimation(normalized, animationPath);
      stageAnimation?.play?.();
      return;
    }
    clearStageAnimation();
  }

  return {
    clear: clearStageAnimation,
    setStageVisualMode,
  };
}
