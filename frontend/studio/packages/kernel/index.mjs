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
 * became of each: active, waiting for a service no plugin provides (its
 * `inject`), or failed (and why). One plugin failing does not stop the others.
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
			results.push({ id, state: 'invalid', error: `${id} 没有导出 apply(ctx)` });
			continue;
		}
		try {
			const fiber = await ctx.plugin(plugin);
			results.push({ id, fiber, state: fiber.state === PluginState.ACTIVE ? 'active' : fiber.state === PluginState.PENDING ? 'waiting' : fiber.state === PluginState.FAILED ? 'failed' : String(fiber.state) });
		} catch (error) {
			results.push({ id, state: 'failed', error: error instanceof Error ? error.message : String(error) });
		}
	}
	return results;
}

/** What `applyPlugins` found worth saying: plugins left waiting, or that failed. */
export function pluginProblems(results) {
	return results
		.filter((result) => result.state !== 'active')
		.map((result) => (result.state === 'waiting' ? `插件 ${result.id} 在等它需要的服务（inject），没有启动` : `插件 ${result.id} 没能启动：${result.error ?? result.state}`));
}
