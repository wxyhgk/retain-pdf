function emptyState() {
  return {
    status: "idle",
    data: null,
    error: null,
    requestId: 0,
    updatedAt: 0,
  };
}

export function createResource({
  name = "resource",
  loader,
  cacheKey = null,
}: any = {}) {
  if (typeof loader !== "function") {
    throw new TypeError(`Resource "${name}" requires a loader function.`);
  }
  let state = emptyState();
  const listeners = new Set<(snapshot: any, meta: any) => void>();
  const cache = new Map();

  function snapshot() {
    return Object.freeze({ ...state });
  }

  function emit() {
    const next = snapshot();
    for (const listener of listeners) {
      listener(next, { resource: name });
    }
  }

  function setState(patch) {
    state = {
      ...state,
      ...patch,
      updatedAt: Date.now(),
    };
    emit();
    return snapshot();
  }

  function keyFor(params) {
    if (typeof cacheKey === "function") {
      return cacheKey(params);
    }
    if (typeof cacheKey === "string") {
      return cacheKey;
    }
    return JSON.stringify(params ?? {});
  }

  async function load(params = {}, options: any = {}) {
    const key = keyFor(params);
    if (options.cache !== false && cache.has(key)) {
      return setState({
        status: "success",
        data: cache.get(key),
        error: null,
      });
    }
    const requestId = state.requestId + 1;
    setState({ status: "loading", error: null, requestId });
    try {
      const data = await loader(params, { resource: name, requestId });
      if (state.requestId !== requestId) {
        return snapshot();
      }
      cache.set(key, data);
      return setState({ status: "success", data, error: null });
    } catch (error) {
      if (state.requestId !== requestId) {
        return snapshot();
      }
      return setState({ status: "error", error, data: null });
    }
  }

  function invalidate(params = null) {
    if (params === null || params === undefined) {
      cache.clear();
      return;
    }
    cache.delete(keyFor(params));
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot() {
    return snapshot();
  }

  function reset() {
    state = emptyState();
    emit();
  }

  return Object.freeze({
    name,
    load,
    invalidate,
    subscribe,
    getSnapshot,
    reset,
  });
}
