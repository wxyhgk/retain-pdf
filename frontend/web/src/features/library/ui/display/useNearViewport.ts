// 卡片快进入视口（上下各 NEAR_MARGIN 以内）才算「近了」：书库的封面等近了才下（useRecentJobCover 的 enabled）。
// 一旦近过就一直算近：滚走了不撤，再滚回来不用重下。
//
// 以前每加载一页（24 本）就立刻把这一页的封面全下完、全解码，不管在不在眼前；书一多，往下翻一页卡一下。

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_MARGIN = "800px 0px";

export function useNearViewport<T extends Element>(): [(element: T | null) => void, boolean] {
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const ref = useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setNear(true);
      observer.disconnect();
    }, { rootMargin: NEAR_MARGIN });
    observer.observe(element);
    observerRef.current = observer;
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);
  return [ref, near];
}
