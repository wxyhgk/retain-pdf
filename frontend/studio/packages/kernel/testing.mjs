import { Blocks } from './blocks.mjs';
import { applyPlugins, Context, pluginProblems } from './index.mjs';

/**
 * For a plugin's tests: the build's kernel with only these plugins (their
 * build.mjs modules), so that `markdownPlugins({ blocks })` renders as the
 * blog would with them. Throws if one of them does not start.
 * @param {any[]} modules
 */
export async function buildBlocks(...modules) {
	const ctx = new Context();
	await ctx.plugin(Blocks);
	const problems = pluginProblems(await applyPlugins(ctx, modules.map((module, index) => ({ id: module.name ?? String(index), module }))));
	if (problems.length) throw new Error(problems.join('\n'));
	return ctx.blocks;
}
