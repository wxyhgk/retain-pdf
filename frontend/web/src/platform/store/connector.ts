import { defineComponent } from "./component.js";

function normalizeSources(sources, props, context) {
  const sourceConfig = typeof sources === "function" ? sources(props, context) : sources;
  if (!sourceConfig || typeof sourceConfig !== "object" || Array.isArray(sourceConfig)) {
    return {};
  }
  return sourceConfig;
}

function snapshotsFor(sourceMap) {
  const snapshots = {};
  for (const [key, source] of Object.entries(sourceMap) as [string, any][]) {
    if (!source || typeof source.getSnapshot !== "function") {
      continue;
    }
    snapshots[key] = source.getSnapshot();
  }
  return snapshots;
}

export function defineConnectedComponent({
  name,
  sources = {},
  mapState = null,
  mount = null,
  render,
  unmount = null,
}: any = {}) {
  if (typeof render !== "function") {
    throw new TypeError("defineConnectedComponent requires a render function.");
  }

  return defineComponent({
    name,
    mount(props, context) {
      let currentProps = props;
      let mounted = true;
      const sourceMap = normalizeSources(sources, currentProps, context);
      const instance = typeof mount === "function"
        ? mount(currentProps, context) || {}
        : {};

      function renderSnapshot(meta = {}) {
        if (!mounted) {
          return;
        }
        const snapshots = snapshotsFor(sourceMap);
        const viewModel = typeof mapState === "function"
          ? mapState(snapshots, currentProps, context)
          : snapshots;
        render(viewModel, {
          context,
          instance,
          meta,
          props: currentProps,
          snapshots,
        });
      }

      const unsubscribers = (Object.entries(sourceMap) as [string, any][]).map(([key, source]) => {
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
        update(nextProps = currentProps) {
          currentProps = nextProps;
          renderSnapshot({ update: true });
        },
        unmount(nextContext) {
          if (!mounted) {
            return;
          }
          mounted = false;
          for (const unsubscribe of [...unsubscribers].reverse()) {
            unsubscribe();
          }
          if (typeof unmount === "function") {
            unmount(instance, nextContext || context);
          }
        },
      };
    },
  });
}
