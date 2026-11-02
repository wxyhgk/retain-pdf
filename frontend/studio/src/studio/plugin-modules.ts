/**
 * The project's plugins in the Studio (plugins/*\/studio.ts), on a module
 * of their own: when one of them is edited, added or removed, Vite gives
 * plugins.ts a new version of this one, and it puts them in again without
 * the page being loaded again. Each is loaded on its own (plugins.ts): one
 * that cannot be loaded is that plugin failed, not the Studio.
 */
export const pluginLoaders: Record<string, () => Promise<unknown>> = import.meta.glob('/plugins/*/studio.ts');
