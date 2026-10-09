// 稳定序列化(默认 cacheKey 用):对象键排序,避免 JSON 键序抖动造成缓存键漂移。
// 与 JSON.stringify 保持一致的取舍:undefined/函数/Symbol 字段丢弃,Date 等
// 带 toJSON 的对象走原生序列化。
function stableSerialize(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = [];
    for (const item of value) {
      const serialized = stableSerialize(item);
      items.push(serialized === undefined ? "null" : serialized);
    }
    return `[${items.join(",")}]`;
  }
  const parts = [];
  for (const key of Object.keys(value).sort()) {
    const serialized = stableSerialize((value as Record<string, unknown>)[key]);
    if (serialized === undefined) {
      continue;
    }
    parts.push(`${JSON.stringify(key)}:${serialized}`);
  }
  return `{${parts.join(",")}}`;
}

export type ResourceStatus = "idle" | "loading" | "success" | "error";

/** 资源快照。data 的类型由 loader 的返回值推出来。 */
export type ResourceState<TData> = {
  status: ResourceStatus;
  data: TData | null;
  error: unknown;
  requestId: number;
  updatedAt: number;
};

export type ResourceMeta = { resource: string };
export type ResourceListener<TData> = (snapshot: Readonly<ResourceState<TData>>, meta: ResourceMeta) => void;

export type ResourceLoadOptions = {
  /** false：跳过缓存，强制重新加载。 */
  cache?: boolean;
  /** false：加载失败时清掉旧 data（默认保留，后台刷新失败不闪空）。 */
  keepData?: boolean;
};

export type CreateResourceOptions<TData, TParams> = {
  name?: string;
  loader: (params: TParams, context: { resource: string; requestId: number }) => Promise<TData> | TData;
  /** 缓存键：函数按参数算，字符串表示固定键，缺省按参数稳定序列化。 */
  cacheKey?: ((params: TParams) => string) | string | null;
};

function emptyState<TData>(): ResourceState<TData> {
  return {
    status: "idle",
    data: null,
    error: null,
    requestId: 0,
    updatedAt: 0,
  };
}

export function createResource<TData = unknown, TParams = Record<string, unknown>>({
  name = "resource",
  loader,
  cacheKey = null,
}: CreateResourceOptions<TData, TParams>) {
  if (typeof loader !== "function") {
    throw new TypeError(`Resource "${name}" requires a loader function.`);
  }
  let state = emptyState<TData>();
  const listeners = new Set<ResourceListener<TData>>();
  const cache = new Map<string, TData>();
  // 同 key 在途去重:并发 load 复用同一 promise,settled 后删除。
  const inflight = new Map<string, Promise<Readonly<ResourceState<TData>>>>();

  function snapshot(): Readonly<ResourceState<TData>> {
    return Object.freeze({ ...state });
  }

  function emit() {
    const next = snapshot();
    for (const listener of listeners) {
      try {
        listener(next, { resource: name });
      } catch (error) {
        console.error(`Resource "${name}" listener failed:`, error);
      }
    }
  }

  function setState(patch: Partial<ResourceState<TData>>) {
    state = {
      ...state,
      ...patch,
      updatedAt: Date.now(),
    };
    emit();
    return snapshot();
  }

  function keyFor(params: TParams): string {
    if (typeof cacheKey === "function") {
      return cacheKey(params);
    }
    if (typeof cacheKey === "string") {
      return cacheKey;
    }
    return stableSerialize(params ?? {}) ?? "";
  }

  async function load(
    params: TParams = {} as TParams,
    options: ResourceLoadOptions = {},
  ): Promise<Readonly<ResourceState<TData>>> {
    const key = keyFor(params);
    if (options.cache !== false && cache.has(key)) {
      // 缓存命中同样推进 requestId:之后才 settle 的旧在途一律过期,避免慢请求反超覆盖。
      const requestId = state.requestId + 1;
      return setState({
        status: "success",
        data: cache.get(key),
        error: null,
        requestId,
      });
    }
    if (inflight.has(key)) {
      return inflight.get(key);
    }
    const requestId = state.requestId + 1;
    setState({ status: "loading", error: null, requestId });
    const pending = (async () => {
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
        // 后台刷新失败默认保留旧 data;仅 keepData:false 显式清空。
        if (options.keepData === false) {
          return setState({ status: "error", error, data: null });
        }
        return setState({ status: "error", error });
      } finally {
        if (inflight.get(key) === pending) {
          inflight.delete(key);
        }
      }
    })();
    inflight.set(key, pending);
    return pending;
  }

  function invalidate(params: TParams | null = null) {
    if (params === null || params === undefined) {
      cache.clear();
      return;
    }
    cache.delete(keyFor(params));
  }

  function subscribe(listener: ResourceListener<TData>) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getSnapshot() {
    return snapshot();
  }

  function reset(options: { keepCache?: boolean } = {}) {
    // Never reuse an in-flight request ID after reset: an old promise may still settle.
    state = { ...emptyState(), requestId: state.requestId + 1 };
    // reset 默认清 cache(旧数据不跨重置复活);传 keepCache:true 显式保留。
    if (options.keepCache !== true) {
      cache.clear();
    }
    inflight.clear();
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
