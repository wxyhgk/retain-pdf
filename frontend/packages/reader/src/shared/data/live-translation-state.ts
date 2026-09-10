import type {
  LiveTranslationCommitEvent,
  LiveTranslationItem,
  LiveTranslationLayout,
  LiveTranslationLayoutPage,
  LiveTranslationPageSnapshot,
} from "@retainpdf/api/live-translation";

export type LiveTranslationPageState = {
  attempt: number;
  generation: number;
  pageHash: string;
  itemsById: ReadonlyMap<string, LiveTranslationItem>;
  /** Last authoritative SSE seq that changed this item; used only as an animation key. */
  changedAtSeqById: ReadonlyMap<string, number>;
  lastEventSeq: number;
};

export type LiveTranslationState = {
  layoutByPage: ReadonlyMap<number, LiveTranslationLayoutPage>;
  pagesByPage: ReadonlyMap<number, LiveTranslationPageState>;
  lastSeq: number;
  connection: "idle" | "connecting" | "live" | "reconnecting" | "terminal" | "unavailable";
  /** Authoritative task status supplied by the Reader session. */
  jobStatus: string;
  /** Human-readable transport/capability failure. Never contains translated content. */
  error: string;
};

export const EMPTY_LIVE_TRANSLATION_STATE: LiveTranslationState = {
  layoutByPage: new Map(),
  pagesByPage: new Map(),
  lastSeq: 0,
  connection: "idle",
  jobStatus: "",
  error: "",
};

export function layoutPageMap(layout: LiveTranslationLayout): ReadonlyMap<number, LiveTranslationLayoutPage> {
  return new Map((layout?.pages || []).map((page) => [page.page_idx, page]));
}

export type SnapshotDecision = "accept" | "ignore" | "retry";

function compareVersion(
  left: Pick<LiveTranslationPageState | LiveTranslationPageSnapshot, "attempt" | "generation">,
  right: Pick<LiveTranslationPageState | LiveTranslationPageSnapshot, "attempt" | "generation">,
): number {
  if (left.attempt !== right.attempt) return left.attempt < right.attempt ? -1 : 1;
  if (left.generation !== right.generation) return left.generation < right.generation ? -1 : 1;
  return 0;
}

/**
 * Decide against the event first, then against the already rendered page.
 * A newer snapshot is valid because the immutable page endpoint may have advanced
 * again between the SSE hint and this read.
 */
export function decideLiveTranslationSnapshot(
  current: LiveTranslationPageState | undefined,
  event: LiveTranslationCommitEvent,
  snapshot: LiveTranslationPageSnapshot,
): SnapshotDecision {
  if (snapshot.page_idx !== event.page_idx) return "retry";
  const againstEvent = compareVersion(snapshot, event);
  if (againstEvent < 0) return "retry";
  if (againstEvent === 0 && snapshot.page_hash !== event.page_hash) return "retry";
  if (!current) return "accept";
  const againstCurrent = compareVersion(snapshot, current);
  if (againstCurrent < 0) return "ignore";
  if (againstCurrent === 0) {
    return snapshot.page_hash === current.pageHash ? "ignore" : "retry";
  }
  return "accept";
}

export function applyLiveTranslationSnapshot(
  state: LiveTranslationState,
  event: LiveTranslationCommitEvent,
  snapshot: LiveTranslationPageSnapshot,
): LiveTranslationState {
  if (event.seq <= state.lastSeq) return state;
  const current = state.pagesByPage.get(event.page_idx);
  const decision = decideLiveTranslationSnapshot(current, event, snapshot);
  if (decision === "retry") return state;
  if (decision === "ignore") {
    return { ...state, lastSeq: event.seq, connection: "live", error: "" };
  }
  const itemsById = new Map(snapshot.items.map((item) => [item.item_id, item]));
  const changedAtSeqById = new Map(current?.changedAtSeqById || []);
  for (const itemId of event.changed_item_ids) {
    if (itemsById.has(itemId)) changedAtSeqById.set(itemId, event.seq);
  }
  const pagesByPage = new Map(state.pagesByPage);
  pagesByPage.set(event.page_idx, {
    attempt: snapshot.attempt,
    generation: snapshot.generation,
    pageHash: snapshot.page_hash,
    itemsById,
    changedAtSeqById,
    lastEventSeq: event.seq,
  });
  return {
    ...state,
    pagesByPage,
    lastSeq: event.seq,
    connection: "live",
    error: "",
  };
}
