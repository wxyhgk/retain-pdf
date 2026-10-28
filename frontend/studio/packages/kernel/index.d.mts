import type { Context } from '@deepseek-ai/cordis';
export { Context, Service } from '@deepseek-ai/cordis';

export declare const PluginState: Readonly<{ PENDING: 0; LOADING: 1; ACTIVE: 2; FAILED: 3; DISPOSED: 4; UNLOADING: 5 }>;

/** A plugin module of one environment (plugins/<name>/build.mjs, page.ts, studio.ts, server.mjs). */
export type PluginModule = {
	name?: string;
	inject?: string[] | Record<string, unknown>;
	apply(ctx: Context, config?: unknown): unknown;
};

export type PluginResult = { id: string; fiber?: { dispose(): Promise<void>; state: number }; state: 'active' | 'waiting' | 'failed' | 'invalid' | string; error?: string };

/** How long a plugin's `apply` is waited for. */
export declare const APPLY_PATIENCE: number;
export declare function applyPlugins(ctx: Context, plugins: Array<{ id: string; module?: unknown; error?: unknown }>, options?: { patience?: number }): Promise<PluginResult[]>;
export declare function pluginProblems(results: PluginResult[]): string[];

export declare function syncPlugins(
	ctx: Context,
	loaded: Map<string, LoadedPlugin>,
	plugins: Array<{ id: string; module?: unknown; error?: unknown }>,
): Promise<{ changed: string[]; problems: string[] }>;

export type LoadedPlugin = { module: unknown; fiber: { dispose(): Promise<void>; state: number } | null; error?: string | null };
export type PluginStatus = { state: 'off' | 'active' | 'waiting' | 'failed'; error?: string };
export declare function pluginStatus(entry: LoadedPlugin | undefined): PluginStatus;
