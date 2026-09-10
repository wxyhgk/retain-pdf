// Radix Dialog 关闭后的焦点归还补偿(阶段 C:shadcn 改造,dialog 渲染层换血)。
//
// Radix 默认的"关闭后焦点归还触发元素"依赖 DialogPrimitive.Trigger 记录
// context.triggerRef——但本项目 9 个对话框全部不是"Trigger 和 Content 同一
// 子树"的经典用法:没有一处渲染 DialogPrimitive.Trigger(触发按钮都是普通
// <button onClick={...}>,分散在 HeroUpload/SettingsHubDialog 面板/
// AppShellHeader/EventsTimeline 触发卡片等完全不同的组件里,状态经
// dialogStore.open()/APP_EVENTS/本地 useState 驱动),Radix 无法知道"是谁
// 打开了我",于是默认的 onCloseAutoFocus(尝试 focus triggerRef.current)
// 永远是 no-op——实测验证:关闭后焦点会落到 <body>,不会回到用户刚才点击
// 的按钮。这个根因和"触发按钮是否与 Content 同一 React 子树"无关(即使同树,
// 只要没用 DialogPrimitive.Trigger,同样是 no-op),所以本项目 9 个对话框
// 统一都需要这个 hook,不按"是否跨子树"挑着用。
//
// 这里手动补上等价语义:open 从 false→true 的那一刻,记下当时的
// document.activeElement(几乎总是用户刚点击的触发按钮),对话框关闭时
// (DialogPrimitive.Content 的 onCloseAutoFocus)把焦点还给它,并
// preventDefault 掉 Radix 自己的默认行为。
//
// 本文件原先在 src/pages/home/state/ 下(阶段 C 前 4 批对话框都在 home 页);
// 阶段 C 收官批把 detail 页的 EventsTimeline 两个模态也接入 Radix Dialog 后,
// 这个 hook 变成跨页共享(home.bundle.js + detail.bundle.js 都要打包它),
// 挪到 src/ui/hooks/ 与 use-app-event.js/use-store.js 同级
// (DownloadToastHost.jsx 落在 src/ui/download-toast/,同样是"多页面各自
// esbuild 打包但共享同一份源码"的先例)。

import { useEffect, useRef } from "react";

export function useDialogReturnFocus(open) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement;
    }
  }, [open]);

  function onCloseAutoFocus(event) {
    event.preventDefault();
    const target = previouslyFocusedRef.current;
    if (target && typeof target.focus === "function" && document.contains(target)) {
      target.focus();
    }
  }

  return { onCloseAutoFocus };
}
