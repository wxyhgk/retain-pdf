// 这本书的书签（本机存，reader-bookmarks.ts）：底栏「给这一页加书签」和左栏「书签」页签各用一份，一处改了另一处跟着变。
import { useCallback, useEffect, useState } from "react";

import {
  bookmarkLabelForPage,
  readReaderBookmarks,
  removeReaderBookmark,
  subscribeReaderBookmarks,
  toggleReaderBookmark,
  type ReaderBookmark,
} from "../shared/state/reader-bookmarks.js";
import type { ReaderRegion } from "../shared/data/reader-regions.js";

export function useReaderBookmarks(scope: string, regions?: readonly ReaderRegion[]) {
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>(() => readReaderBookmarks(scope));
  useEffect(() => {
    setBookmarks(readReaderBookmarks(scope));
    return subscribeReaderBookmarks(scope, () => setBookmarks(readReaderBookmarks(scope)));
  }, [scope]);
  const toggle = useCallback((page: number) => {
    setBookmarks(toggleReaderBookmark(scope, page, bookmarkLabelForPage(regions, page)));
  }, [scope, regions]);
  const remove = useCallback((page: number) => setBookmarks(removeReaderBookmark(scope, page)), [scope]);
  return { bookmarks, toggle, remove };
}
