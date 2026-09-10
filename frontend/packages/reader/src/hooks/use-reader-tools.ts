// 阅读器工具开合：单一 active、互斥（对齐 legacy drawer-store）

import { useCallback, useState } from "react";
import type { ReaderToolId } from "../tools/registry.js";

export type ReaderToolsApi = {
  active: ReaderToolId | null;
  open: (id: ReaderToolId) => void;
  close: (id?: ReaderToolId | null) => void;
  toggle: (id: ReaderToolId) => void;
  isOpen: (id: ReaderToolId) => boolean;
};

export function useReaderTools(): ReaderToolsApi {
  const [active, setActive] = useState<ReaderToolId | null>(null);

  const open = useCallback((id: ReaderToolId) => {
    setActive(id);
  }, []);

  const close = useCallback((id: ReaderToolId | null = null) => {
    setActive((cur) => {
      if (!id || cur === id) return null;
      return cur;
    });
  }, []);

  const toggle = useCallback((id: ReaderToolId) => {
    setActive((cur) => (cur === id ? null : id));
  }, []);

  const isOpen = useCallback(
    (id: ReaderToolId) => active === id,
    [active],
  );

  return { active, open, close, toggle, isOpen };
}
