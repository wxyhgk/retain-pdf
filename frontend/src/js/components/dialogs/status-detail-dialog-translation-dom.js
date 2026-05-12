export function translationSummaryElements(host) {
  return {
    content: host.querySelector("#translation-debug-content"),
    empty: host.querySelector("#translation-debug-empty"),
    status: host.querySelector("#translation-debug-status"),
    scope: host.querySelector("#translation-summary-scope"),
    filter: host.querySelector("#translation-list-filter"),
    counts: {
      translated: host.querySelector("#translation-count-translated"),
      keptOrigin: host.querySelector("#translation-count-kept-origin"),
      skipped: host.querySelector("#translation-count-skipped"),
      providerFamily: host.querySelector("#translation-provider-family"),
    },
  };
}

export function translationItemsElements(host) {
  return {
    list: host.querySelector("#translation-items-list"),
    empty: host.querySelector("#translation-items-empty"),
    loading: host.querySelector("#translation-items-loading"),
    meta: host.querySelector("#translation-items-meta"),
    page: host.querySelector("#translation-items-page"),
    prevButton: host.querySelector("#translation-items-prev"),
    nextButton: host.querySelector("#translation-items-next"),
  };
}

export function translationItemDetailElements(host) {
  return {
    detail: host.querySelector("#translation-item-detail"),
    empty: host.querySelector("#translation-item-empty"),
    loading: host.querySelector("#translation-item-loading"),
    meta: host.querySelector("#translation-item-meta"),
    replayButton: host.querySelector("#translation-item-replay"),
  };
}

export function translationReplayElements(host) {
  return {
    result: host.querySelector("#translation-replay-result"),
    status: host.querySelector("#translation-replay-status"),
  };
}
