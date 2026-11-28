// 这本书收藏的段落（本机存，reader-favorites.ts）：选字的浮条、右键「收藏这段」往里加，左下角「收藏」（星）列出来，一处改了别处跟着变。
import { useCallback, useEffect, useState } from "react";

import {
  addReaderFavorite,
  readReaderFavorites,
  removeReaderFavorite,
  subscribeReaderFavorites,
  type ReaderFavorite,
} from "../shared/state/reader-favorites.js";

export function useReaderFavorites(scope: string) {
  const [favorites, setFavorites] = useState<ReaderFavorite[]>(() => readReaderFavorites(scope));
  useEffect(() => {
    setFavorites(readReaderFavorites(scope));
    return subscribeReaderFavorites(scope, () => setFavorites(readReaderFavorites(scope)));
  }, [scope]);
  const add = useCallback(
    (entry: { text: string; page: number; pane: "source" | "translated" }) => setFavorites(addReaderFavorite(scope, entry)),
    [scope],
  );
  const remove = useCallback((id: string) => setFavorites(removeReaderFavorite(scope, id)), [scope]);
  return { favorites, add, remove };
}
