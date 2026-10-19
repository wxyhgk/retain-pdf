import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Blocks } from './blocks.mjs';
import { applyPlugins, Context, pluginProblems, pluginStatus, syncPlugins } from './index.mjs';
import { Routes } from './routes.mjs';

/**
 * The plugins of this project (`<root>/plugins/<name>/`) that take part in
 * this environment: those with this entry (`build.mjs`, `server.mjs`), by
 * folder name. One that cannot be loaded comes with its `error`.
 * @param {string} root the project
 * @param {'build.mjs' | 'server.mjs'} entry
 */
export async function pluginModules(root, entry) {
	const folder = join(root, 'plugins');
	if (!existsSync(folder)) return [];
	const names = readdirSync(folder, { withFileTypes: true })
		.filter((item) => item.isDirectory() && !item.name.startsWith('.') && existsSync(join(folder, item.name, entry)))
		.map((item) => item.name)
		.sort();
	return Promise.all(names.map(async (name) => {
		try {
			return { id: name, module: await import(pathToFileURL(join(folder, name, entry)).href) };
		} catch (error) {
			return { id: name, error };
		}
	}));
}

/**
 * The blog's build: `ctx.blocks`, filled by every plugin's build.mjs. What
 * went wrong is in `problems`; `warn` is told of it too.
 * @param {string} root the project
 * @param {{ warn?: (message: string) => void }} [options]
 */
export async function buildKernel(root, { warn = (message) => console.warn(`[plugins] ${message}`) } = {}) {
	const ctx = new Context();
	await ctx.plugin(Blocks);
	const results = await applyPlugins(ctx, await pluginModules(root, 'build.mjs'));
	const problems = pluginProblems(results);
	problems.forEach(warn);
	return { ctx, blocks: ctx.blocks, problems };
}

/** The plugin folders of this project, by name, with the environments they take part in (the entries they have). */
export function listPlugins(root) {
	const folder = join(root, 'plugins');
	if (!existsSync(folder)) return [];
	return readdirSync(folder, { withFileTypes: true })
		.filter((item) => item.isDirectory() && !item.name.startsWith('.'))
		.map((item) => ({ id: item.name, entries: ENTRIES.filter((entry) => existsSync(join(folder, item.name, entry))) }))
		.filter((plugin) => plugin.entries.length > 0)
		.sort((left, right) => left.id.localeCompare(right.id));
}

const ENTRIES = ['build.mjs', 'page.ts', 'studio.ts', 'server.mjs'];

/**
 * The Studio's dev server: `ctx.routes`, and `ctx.server` (what the server
 * knows: the project, the articles, where private state is kept), filled
 * by every plugin's server.mjs but those `disabled`. `setDisabled(ids)`
 * takes those out (all they registered undone) and puts the others back;
 * `status(id)` says how one is doing; `dispose()` stops them all (when the
 * server closes).
 * @param {string} root the project
 * @param {import('./server.mjs').StudioServer} server
 * @param {{ warn?: (message: string) => void, disabled?: string[] }} [options]
 */
export async function serverKernel(root, server, { warn = (message) => console.warn(`[plugins] ${message}`), disabled = [] } = {}) {
	const ctx = new Context();
	ctx.provide('server', server);
	await ctx.plugin(Routes);
	const modules = await pluginModules(root, 'server.mjs');
	/** @type {Map<string, any>} */
	const loaded = new Map();
	const setDisabled = async (off) => {
		const { problems } = await syncPlugins(ctx, loaded, modules.filter((plugin) => !off.includes(plugin.id)));
		problems.forEach(warn);
		return problems;
	};
	const problems = await setDisabled(disabled);
	return {
		ctx,
		routes: ctx.routes,
		problems,
		setDisabled,
		status: (id) => pluginStatus(loaded.get(id)),
		dispose: () => setDisabled(modules.map((plugin) => plugin.id)),
	};
}
