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

export declare function applyPlugins(ctx: Context, plugins: Array<{ id: string; module?: unknown; error?: unknown }>): Promise<PluginResult[]>;
export declare function pluginProblems(results: PluginResult[]): string[];
