// 「深色文档」开关的状态：读本机存的偏好，变了写回去，并把属性挂到 <html> 上让样式生效。
// 只是 CSS 滤镜（styles/doc-theme.css），切换不重画 PDF，大文档也是即时的。

import { useCallback, useEffect, useState } from "react";
import {
  applyReaderDocTheme,
  loadReaderDocTheme,
  saveReaderDocTheme,
  type ReaderDocTheme,
} from "../shared/state/reader-doc-theme.js";

export type ReaderDocThemeApi = {
  docDark: boolean;
  toggleDocDark: () => void;
};

export function useReaderDocTheme(): ReaderDocThemeApi {
  const [theme, setTheme] = useState<ReaderDocTheme>(() => loadReaderDocTheme());

  useEffect(() => {
    applyReaderDocTheme(theme);
  }, [theme]);
  useEffect(() => () => applyReaderDocTheme("light"), []);

  const toggleDocDark = useCallback(() => {
    setTheme((current) => {
      const next: ReaderDocTheme = current === "dark" ? "light" : "dark";
      saveReaderDocTheme(next);
      return next;
    });
  }, []);

  return { docDark: theme === "dark", toggleDocDark };
}
