/**
 * The project's plugins in the Studio (plugins/*\/studio.ts), on a module
 * of their own: when one of them is edited, added or removed, Vite gives
 * plugins.ts a new version of this one, and it puts them in again without
 * the page being loaded again.
 */
export const pluginModules: Record<string, unknown> = import.meta.glob('/plugins/*/studio.ts', { eager: true });
