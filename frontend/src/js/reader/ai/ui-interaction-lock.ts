// Short isolation while switching/branching AI chats to prevent clicks passing through the collapsed list into PDFs/links.
// Active only during the lock window; never permanently blocks reader entry or normal navigation.

let lockUntil = 0;
let shieldCleanup: (() => void) | null = null;
let overlayEl: HTMLDivElement | null = null;
let openGuardInstalled = false;

export function isReaderAiNavigationLocked(now = Date.now()): boolean {
  return now < lockUntil;
}

export function lockReaderAiNavigation(durationMs = 700): void {
  const until = Date.now() + Math.max(0, durationMs);
  if (until > lockUntil) lockUntil = until;
}

/** Force-clear isolation as an entry/error fallback so a leftover overlay cannot block clicks. */
export function clearReaderAiNavigationLock(): void {
  lockUntil = 0;
  shieldCleanup?.();
  shieldCleanup = null;
  removeOverlay();
}

function ensureOverlay(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (overlayEl && overlayEl.isConnected) return overlayEl;
  const el = document.createElement("div");
  el.setAttribute("data-reader-ai-pointer-shield", "1");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483000",
    cursor: "progress",
    background: "transparent",
    pointerEvents: "auto",
    touchAction: "none",
  } as CSSStyleDeclaration);
  const block = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    (event as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  };
  for (const type of [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "auxclick",
    "dblclick",
    "contextmenu",
    "touchstart",
    "touchend",
  ] as const) {
    el.addEventListener(type, block, { capture: true, passive: false });
  }
  document.documentElement.appendChild(el);
  overlayEl = el;
  return el;
}

function removeOverlay(): void {
  if (!overlayEl) return;
  try {
    overlayEl.remove();
  } catch {
    // ignore
  }
  overlayEl = null;
}

/**
 * Brief full-screen pointer swallow plus page-jump/link suppression.
 * Only used for AI session-row switching/branching and should stay short.
 */
export function armReaderAiClickShield(
  durationMs = 700,
  options: { overlayDelayMs?: number } = {},
): void {
  lockReaderAiNavigation(durationMs);
  if (typeof document === "undefined") return;

  shieldCleanup?.();
  shieldCleanup = null;

  const until = Date.now() + Math.max(0, durationMs);
  const overlayDelay = Math.max(0, Number(options.overlayDelayMs) || 0);
  let overlayTimer: ReturnType<typeof setTimeout> | null = null;

  if (overlayDelay === 0) {
    ensureOverlay();
  } else {
    overlayTimer = setTimeout(() => {
      overlayTimer = null;
      if (Date.now() < until) ensureOverlay();
    }, overlayDelay);
  }

  const swallow = (event: Event) => {
    if (Date.now() >= until) {
      teardown();
      return;
    }
    const target = event.target;
    // Allow the session row and answer action bar, including the new-chat button, so pointerdown locking does not block the intended click.
    if (
      target instanceof Element
      && target.closest(
        "[data-reader-ai-sessions], [data-reader-ai-actions], .aui-action-btn-branch",
      )
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    (event as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
  };

  const opts: AddEventListenerOptions = { capture: true, passive: false };
  const types = ["click", "auxclick", "dblclick", "pointerup", "mouseup"] as const;

  const teardown = () => {
    if (overlayTimer != null) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }
    for (const type of types) {
      document.removeEventListener(type, swallow, opts);
    }
    removeOverlay();
    if (shieldCleanup === teardown) shieldCleanup = null;
  };

  for (const type of types) {
    document.addEventListener(type, swallow, opts);
  }
  shieldCleanup = teardown;
  window.setTimeout(teardown, Math.max(0, durationMs) + 48);
}

export function shouldIgnoreReaderAiNavEvent(event: Event | null | undefined): boolean {
  if (isReaderAiNavigationLocked()) return true;
  if (!event) return false;
  // typeof guard: node/jsdom has no global MouseEvent, and a bare instanceof
  // throws ReferenceError that event listeners swallow silently. answer-enhance
  // tests once failed this way: button injection succeeded but onJump never ran.
  if (typeof MouseEvent !== "undefined" && event instanceof MouseEvent && event.isTrusted === false) {
    return true;
  }
  return false;
}

/**
 * Intercept window.open/link defaults only during AI navigation lock.
 * Do not permanently ban same-origin navigation, preserving normal reader opening.
 */
export function installReaderWindowOpenGuard(): () => void {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return () => {};
  }
  if (openGuardInstalled) return () => {};
  openGuardInstalled = true;

  // Clear any leftover overlay on entry.
  clearReaderAiNavigationLock();

  const original = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    // Reject only during the lock window for accidental session-switch clicks; otherwise allow.
    if (isReaderAiNavigationLocked()) {
      return null;
    }
    return original(url as string, target, features);
  }) as typeof window.open;

  const onClickCapture = (event: Event) => {
    if (!isReaderAiNavigationLocked()) return;
    const t = event.target;
    if (!(t instanceof Element)) return;
    // Allow the session row itself.
    if (t.closest("[data-reader-ai-sessions]")) return;
    const a = t.closest("a[href]");
    if (a) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  document.addEventListener("click", onClickCapture, true);

  return () => {
    window.open = original;
    document.removeEventListener("click", onClickCapture, true);
    openGuardInstalled = false;
    clearReaderAiNavigationLock();
  };
}
