// Vendored from frontend/web/src/js/app-framework/selector.ts — pure memoization, no framework deps
function shallowEqualArray(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return (left as unknown[]).every((item, index) => Object.is(item, (right as unknown[])[index]));
}

export function createSelector(
  inputs: Array<( ...args: any[]) => any>,
  projector: (...args: any[]) => any,
): (...args: any[]) => any {
  if (!Array.isArray(inputs) || inputs.some((input) => typeof input !== "function")) {
    throw new TypeError("createSelector requires an array of input functions.");
  }
  if (typeof projector !== "function") {
    throw new TypeError("createSelector requires a projector function.");
  }
  let hasResult = false;
  let previousArgs: unknown[] = [];
  let previousResult: unknown;
  return (...args: unknown[]) => {
    const nextArgs = inputs.map((input) => (input as (...a: any[]) => any)(...args));
    if (hasResult && shallowEqualArray(nextArgs, previousArgs)) return previousResult;
    previousArgs = nextArgs;
    previousResult = projector(...nextArgs);
    hasResult = true;
    return previousResult;
  };
}

export function createStoreSelector(
  store: { getSnapshot: () => unknown },
  selector: (snapshot: unknown) => unknown,
) {
  if (!store || typeof store.getSnapshot !== "function") {
    throw new TypeError("createStoreSelector requires a store-like object.");
  }
  if (typeof selector !== "function") {
    throw new TypeError("createStoreSelector requires a selector function.");
  }
  return () => selector(store.getSnapshot());
}
