import { t } from '@blog/i18n/index.mjs';

/**
 * The plugin kernel. Everything the site does beyond plain Markdown is a
 * plugin (plugins/<name>/): a block such as ```job, a molecule editor such
 * as RetainMol. Plugins are Cordis plugins (@deepseek-ai/cordis, the
 * framework of DeepSeek Harness): they declare the services they need
 * (`inject`), and what they register is undone when they are disposed.
 *
 * A plugin is a folder with an entry for each environment it takes part in:
 *
 *     build.mjs    the blog's build (Node): what its fences become in the page
 *     page.ts      the blog's pages (browser): drawing what the build left
 *     studio.ts    the Studio (browser): its block in the editor, its sheet
 *     server.mjs   the Studio's dev server (Node): its API, its work
 *
 * each a module `{ name, inject?, apply(ctx, config) }`. The kernel gives
 * every environment the same few services (blocks.mjs, routes.mjs,
 * article.mjs, molecules.mjs); plugins provide others for each other (a
 * computation plugin's `jobs`, which another program can join).
 *
 * Plugins import Cordis only through here, so that what they rely on is
 * this short list, and the framework under it can change.
 */
export { Context, Service } from '@deepseek-ai/cordis';

/** Cordis' fiber states, as numbers (its `const enum` does not survive JavaScript). */
export const PluginState = Object.freeze({ PENDING: 0, LOADING: 1, ACTIVE: 2, FAILED: 3, DISPOSED: 4, UNLOADING: 5 });

/**
 * Applies these plugin modules to `ctx`, in order. Resolves with what
 * became of each once all have started: active, waiting for a service no
 * plugin provides (its `inject`; one that a later plugin provides is not
 * waiting by then), or failed (and why). One plugin failing does not stop the others.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Array<{ id: string, module?: any, error?: unknown }>} plugins (`error`: it could not be loaded)
 */
export async function applyPlugins(ctx, plugins) {
	const results = [];
	for (const { id, module, error: loading } of plugins) {
		if (loading) {
			results.push({ id, state: 'failed', error: loading instanceof Error ? loading.message : String(loading) });
			continue;
		}
		const plugin = module?.default ?? module;
		if (typeof plugin?.apply !== 'function' && typeof plugin !== 'function') {
			results.push({ id, state: 'invalid', error: t('{id} 没有导出 apply(ctx)', { id }) });
			continue;
		}
		try {
			results.push({ id, fiber: await ctx.plugin(plugin) });
		} catch (error) {
			results.push({ id, state: 'failed', error: error instanceof Error ? error.message : String(error) });
		}
	}
	// Read once all have started: one waiting for a service a later one provides has it now.
	for (const result of results) {
		if (!result.fiber) continue;
		const state = result.fiber.state;
		result.state = state === PluginState.ACTIVE ? 'active' : state === PluginState.PENDING ? 'waiting' : state === PluginState.FAILED ? 'failed' : String(state);
	}
	return results;
}

/** What `applyPlugins` found worth saying: plugins left waiting, or that failed. */
export function pluginProblems(results) {
	return results
		.filter((result) => result.state !== 'active')
		.map((result) => (result.state === 'waiting' ? t('插件 {id} 在等它需要的服务（inject），没有启动', { id: result.id }) : t('插件 {id} 没能启动：{error}', { id: result.id, error: result.error ?? result.state })));
}

/**
 * Brings the plugins applied to `ctx` in line with these modules (a new
 * version of them, after an edit): one gone, or whose module is another
 * now, is disposed (all it registered undone); one new or changed is
 * applied. The others are left as they are. `loaded` (id → { module,
 * fiber }) is what is applied, kept up to date here; a plugin that failed
 * stays in it, without a fiber, until its module changes.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Map<string, { module: any, fiber: any, error?: string | null }>} loaded
 * @param {Array<{ id: string, module?: any, error?: unknown }>} plugins
 * @returns {Promise<{ changed: string[], problems: string[] }>}
 */
export async function syncPlugins(ctx, loaded, plugins) {
	const coming = new Map(plugins.map((plugin) => [plugin.id, plugin]));
	const changed = [];
	// The last applied go first, as Cordis undoes things.
	for (const [id, entry] of [...loaded].reverse()) {
		const next = coming.get(id);
		if (next && !next.error && next.module === entry.module) continue;
		await entry.fiber?.dispose();
		loaded.delete(id);
		changed.push(id);
	}
	const applying = plugins.filter((plugin) => !loaded.has(plugin.id));
	const results = await applyPlugins(ctx, applying);
	results.forEach((result, index) => {
		loaded.set(result.id, { module: applying[index].module, fiber: result.fiber ?? null, error: result.error ?? null });
		if (!changed.includes(result.id)) changed.push(result.id);
	});
	return { changed, problems: pluginProblems(results) };
}

/**
 * How a plugin of `syncPlugins`' `loaded` is doing: off (not applied),
 * active, waiting for a service no plugin provides, or failed (and why).
 * @param {{ fiber: any, error?: string | null } | undefined} entry
 * @returns {{ state: 'off' | 'active' | 'waiting' | 'failed', error?: string }}
 */
export function pluginStatus(entry) {
	if (!entry) return { state: 'off' };
	if (!entry.fiber) return { state: 'failed', error: entry.error ?? t('没能启动') };
	if (entry.fiber.state === PluginState.ACTIVE) return { state: 'active' };
	if (entry.fiber.state === PluginState.PENDING) return { state: 'waiting' };
	return { state: 'failed', error: entry.error ?? t('没能启动') };
}
