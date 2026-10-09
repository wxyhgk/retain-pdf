import { defineComponent } from "./component.js";

/** 能被订阅的数据源（store / resource 都满足）。 */
export type SnapshotSource = {
  getSnapshot?: () => unknown;
  subscribe?: (listener: (snapshot: unknown, meta?: Record<string, unknown>) => void) => () => void;
};
type SourceMap = Record<string, SnapshotSource | null | undefined>;

export type ConnectedRenderInfo<TSnapshots, TProps, TContext> = {
  context: TContext;
  instance: Record<string, unknown>;
  meta: Record<string, unknown>;
  props: TProps;
  snapshots: TSnapshots;
};

export type ConnectedComponentOptions<TSnapshots, TViewModel, TProps, TContext> = {
  name?: string;
  sources?: SourceMap | ((props: TProps, context: TContext) => SourceMap);
  /** 快照 → 视图模型；不给就把快照原样交给 render。 */
  mapState?: ((snapshots: TSnapshots, props: TProps, context: TContext) => TViewModel) | null;
  mount?: ((props: TProps, context: TContext) => Record<string, unknown> | void) | null;
  render: (viewModel: TViewModel, info: ConnectedRenderInfo<TSnapshots, TProps, TContext>) => void;
  unmount?: ((instance: Record<string, unknown>, context: TContext) => void) | null;
};

function normalizeSources<TProps, TContext>(
  sources: ConnectedComponentOptions<unknown, unknown, TProps, TContext>["sources"],
  props: TProps,
  context: TContext,
): SourceMap {
  const sourceConfig = typeof sources === "function" ? sources(props, context) : sources;
  if (!sourceConfig || typeof sourceConfig !== "object" || Array.isArray(sourceConfig)) {
    return {};
  }
  return sourceConfig;
}

function snapshotsFor(sourceMap: SourceMap): Record<string, unknown> {
  const snapshots: Record<string, unknown> = {};
  for (const [key, source] of Object.entries(sourceMap)) {
    if (!source || typeof source.getSnapshot !== "function") {
      continue;
    }
    snapshots[key] = source.getSnapshot();
  }
  return snapshots;
}

export function defineConnectedComponent<
  TSnapshots = Record<string, unknown>,
  TViewModel = TSnapshots,
  TProps = Record<string, unknown>,
  TContext = Record<string, unknown>,
>({
  name,
  sources = {},
  mapState = null,
  mount = null,
  render,
  unmount = null,
}: ConnectedComponentOptions<TSnapshots, TViewModel, TProps, TContext>) {
  if (typeof render !== "function") {
    throw new TypeError("defineConnectedComponent requires a render function.");
  }

  return defineComponent<TProps, TContext>({
    name,
    mount(props, context) {
      let currentProps = props;
      let mounted = true;
      const sourceMap = normalizeSources(sources, currentProps, context);
      const instance: Record<string, unknown> = typeof mount === "function"
        ? mount(currentProps, context) || {}
        : {};

      function renderSnapshot(meta: Record<string, unknown> = {}) {
        if (!mounted) {
          return;
        }
        // 快照的形状由调用方声明（TSnapshots），这里按声明交出去。
        const snapshots = snapshotsFor(sourceMap) as TSnapshots;
        const viewModel = (typeof mapState === "function"
          ? mapState(snapshots, currentProps, context)
          : snapshots) as TViewModel;
        render(viewModel, {
          context,
          instance,
          meta,
          props: currentProps,
          snapshots,
        });
      }

      const unsubscribers = Object.entries(sourceMap).map(([key, source]) => {
        if (!source || typeof source.subscribe !== "function") {
          return () => {};
        }
        return source.subscribe((snapshot, meta = {}) => {
          renderSnapshot({
            ...meta,
            source: key,
            snapshot,
          });
        });
      });

      renderSnapshot({ initial: true });

      return {
        update(nextProps: unknown = currentProps) {
          currentProps = nextProps as TProps;
          renderSnapshot({ update: true });
        },
        unmount(nextContext?: unknown) {
          if (!mounted) {
            return;
          }
          mounted = false;
          for (const unsubscribe of [...unsubscribers].reverse()) {
            unsubscribe();
          }
          if (typeof unmount === "function") {
            unmount(instance, (nextContext as TContext) || context);
          }
        },
      };
    },
  });
}
