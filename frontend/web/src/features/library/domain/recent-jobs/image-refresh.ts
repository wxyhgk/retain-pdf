import { recentJobRawImageUrls } from "./card-presenter.js";
import { clearRecentJobImageCache } from "./image-loader.js";

export function recentJobImageRefreshUrls(previousItem, nextItem) {
  return [
    ...recentJobRawImageUrls(previousItem),
    ...recentJobRawImageUrls(nextItem),
  ];
}

export function invalidateRecentJobImages(previousItem, nextItem) {
  clearRecentJobImageCache(recentJobImageRefreshUrls(previousItem, nextItem));
}
