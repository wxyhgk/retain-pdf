import type { LibraryJobItem } from "./state.js";
import { recentJobRawImageUrls } from "./card-presenter.js";
import { clearRecentJobImageCache } from "./image-loader.js";

export function recentJobImageRefreshUrls(previousItem: LibraryJobItem | null | undefined, nextItem: LibraryJobItem | null | undefined) {
  return [
    ...recentJobRawImageUrls(previousItem),
    ...recentJobRawImageUrls(nextItem),
  ];
}

export function invalidateRecentJobImages(previousItem: LibraryJobItem | null | undefined, nextItem: LibraryJobItem | null | undefined) {
  clearRecentJobImageCache(recentJobImageRefreshUrls(previousItem, nextItem));
}
