import {
  createStore,
  type BoundStoreActions,
  type Store,
  type StoreListener,
} from "@/platform/store/store.js";
import { HOME_VIEW_MODES } from "@/platform/contracts/home-view-contract.js";
import type { HomeStatePort } from "@/platform/contracts/home-view-contract.js";
import { TRANSLATION_WORKFLOW_MODES } from "./contract.js";

export type TranslationWorkflowMode =
  (typeof TRANSLATION_WORKFLOW_MODES)[keyof typeof TRANSLATION_WORKFLOW_MODES];

export interface TranslationWorkflowDialogState {
  open: boolean;
  mode: TranslationWorkflowMode;
}

export type TranslationWorkflowDialogInitialState = Partial<TranslationWorkflowDialogState>;

export interface CreateTranslationWorkflowDialogStatePortOptions {
  homeStatePort?: Pick<HomeStatePort, "setViewMode"> | null;
  initialState?: TranslationWorkflowDialogInitialState;
}

export type TranslationWorkflowDialogActions = {
  open(
    currentState: TranslationWorkflowDialogState,
    mode?: string,
  ): TranslationWorkflowDialogState;
  close(currentState: TranslationWorkflowDialogState): TranslationWorkflowDialogState;
  setMode(
    currentState: TranslationWorkflowDialogState,
    mode?: unknown,
  ): TranslationWorkflowDialogState;
};

export type TranslationWorkflowDialogStore = Store<
  TranslationWorkflowDialogState,
  TranslationWorkflowDialogActions
>;

export interface TranslationWorkflowDialogStatePort {
  close(): TranslationWorkflowDialogState;
  getSnapshot(): TranslationWorkflowDialogState;
  open(mode?: string): TranslationWorkflowDialogState;
  setMode(mode?: string): TranslationWorkflowDialogState;
  subscribe(listener: StoreListener<TranslationWorkflowDialogState>): () => void;
  store: TranslationWorkflowDialogStore;
}

function normalizeMode(mode: unknown = ""): TranslationWorkflowMode {
  return mode === TRANSLATION_WORKFLOW_MODES.STATUS
    ? TRANSLATION_WORKFLOW_MODES.STATUS
    : TRANSLATION_WORKFLOW_MODES.UPLOAD;
}

export function homeViewModeForTranslationWorkflow(
  mode: unknown = TRANSLATION_WORKFLOW_MODES.UPLOAD,
  open = false,
) {
  if (!open) {
    return HOME_VIEW_MODES.LIBRARY;
  }
  return normalizeMode(mode) === TRANSLATION_WORKFLOW_MODES.STATUS
    ? HOME_VIEW_MODES.WORKFLOW_STATUS
    : HOME_VIEW_MODES.WORKFLOW_UPLOAD;
}

export function createTranslationWorkflowDialogStore(
  initialState: TranslationWorkflowDialogInitialState = {},
): TranslationWorkflowDialogStore {
  return createStore<TranslationWorkflowDialogState, TranslationWorkflowDialogActions>({
    name: "translationWorkflowDialog",
    initialState: {
      open: Boolean(initialState.open),
      mode: normalizeMode(initialState.mode),
    },
    actions: {
      open(currentState, mode = currentState.mode) {
        return {
          ...currentState,
          open: true,
          mode: normalizeMode(mode),
        };
      },
      close(currentState) {
        return {
          ...currentState,
          open: false,
        };
      },
      setMode(currentState, mode = TRANSLATION_WORKFLOW_MODES.UPLOAD) {
        return {
          ...currentState,
          mode: normalizeMode(mode),
        };
      },
    },
  });
}

export function createTranslationWorkflowDialogStatePort({
  homeStatePort = null,
  initialState = {},
}: CreateTranslationWorkflowDialogStatePortOptions = {}): TranslationWorkflowDialogStatePort {
  const store = createTranslationWorkflowDialogStore(initialState);
  const actions: BoundStoreActions<
    TranslationWorkflowDialogState,
    TranslationWorkflowDialogActions
  > = store.actions;

  function syncHomeMode(snapshot: TranslationWorkflowDialogState = store.getSnapshot()) {
    homeStatePort?.setViewMode?.(homeViewModeForTranslationWorkflow(snapshot.mode, snapshot.open));
  }

  function getSnapshot(): TranslationWorkflowDialogState {
    return store.getSnapshot();
  }

  function open(mode?: string): TranslationWorkflowDialogState {
    const snapshot = actions.open(mode);
    syncHomeMode(snapshot);
    return snapshot;
  }

  function close(): TranslationWorkflowDialogState {
    const snapshot = actions.close();
    syncHomeMode(snapshot);
    return snapshot;
  }

  function setMode(mode?: string): TranslationWorkflowDialogState {
    const snapshot = actions.setMode(mode);
    syncHomeMode(snapshot);
    return snapshot;
  }

  return {
    close,
    getSnapshot,
    open,
    setMode,
    subscribe: store.subscribe,
    store,
  };
}
