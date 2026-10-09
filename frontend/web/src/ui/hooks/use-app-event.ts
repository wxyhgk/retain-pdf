// APP_EVENTS(document CustomEvent)→ React 的适配 hook。
//
// 总计划口径:16 个 retainpdf:* 事件原样保留,不趁机改造通信方式;
// React 组件消费事件时统一走本 hook,不手写 addEventListener 样板。
//
// handler 走 ref:调用方可以传内联箭头函数(每次渲染都是新引用),
// 订阅本体只随 eventName/target 变化重建,不会因 handler 引用漂移反复解绑/重绑
// (解绑窗口内丢事件是轮询驱动页面的真实风险)。

import { useEffect, useRef } from "react";

export function useAppEvent(
  eventName: string | null | undefined,
  handler: (event: CustomEvent) => void,
  { target = null }: { target?: EventTarget | null } = {},
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!eventName) {
      return undefined;
    }
    const eventTarget = target || globalThis.document;
    if (!eventTarget?.addEventListener) {
      return undefined;
    }
    // APP_EVENTS 都是 CustomEvent 派发的，handler 按 CustomEvent 收。
    const listener = (event: Event) => handlerRef.current?.(event as CustomEvent);
    eventTarget.addEventListener(eventName, listener);
    return () => eventTarget.removeEventListener(eventName, listener);
  }, [eventName, target]);
}
