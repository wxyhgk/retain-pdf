// 挂在主页上：接住「打开说明书」事件（domain/open.ts），第一次打开时才下载说明书弹窗和 Markdown 渲染。

import { Suspense, lazy, useEffect, useState } from "react";
import { GUIDE_HOME, type GuideTarget } from "../domain/guide-pages.js";
import { USER_GUIDE_OPEN_EVENT } from "../domain/open.js";

const UserGuideDialog = lazy(() => import("./UserGuideDialog.jsx").then((m) => ({ default: m.UserGuideDialog })));

export function UserGuideHost() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<GuideTarget>({ page: GUIDE_HOME, anchor: "" });

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<Partial<GuideTarget>>).detail || {};
      setTarget({ page: detail.page || GUIDE_HOME, anchor: detail.anchor || "" });
      setMounted(true);
      setOpen(true);
    };
    document.addEventListener(USER_GUIDE_OPEN_EVENT, onOpen);
    return () => document.removeEventListener(USER_GUIDE_OPEN_EVENT, onOpen);
  }, []);

  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <UserGuideDialog open={open} target={target} onNavigate={setTarget} onOpenChange={setOpen} />
    </Suspense>
  );
}
