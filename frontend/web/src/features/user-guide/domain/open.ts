// 打开说明书：谁都可以派这个事件（底部「使用说明」按钮、设置每栏标题旁的「?」），
// 主页上挂着的 UserGuideHost 接住，打开说明书停在那一页。和任务中心一样走文档事件，不用把弹窗状态传来传去。

import { GUIDE_HOME, type GuideTarget } from "./guide-pages.js";

export const USER_GUIDE_OPEN_EVENT = "retainpdf:open-user-guide";

/** 打开说明书。page 是页名（模块名），不给就打开首页；anchor 是页里的标题锚点。 */
export function openUserGuide(page: string = GUIDE_HOME, anchor = ""): void {
  const detail: GuideTarget = { page: page || GUIDE_HOME, anchor };
  globalThis.document?.dispatchEvent(new globalThis.CustomEvent(USER_GUIDE_OPEN_EVENT, { detail }));
}
