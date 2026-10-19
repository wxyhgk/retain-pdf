import { Context, syncPlugins } from '@blog/kernel/index.mjs';
import { provideStudio, studioBlocks, studioPluginList, type StudioHost } from '@blog/kernel/studio.ts';

import { pluginModules } from './plugin-modules.ts';

/**
 * The project's plugins in the Studio (plugins/*\/studio.ts, @blog/kernel):
 * their blocks in the editor and the slash menu, the molecule editor, the
 * look, the tabs they add. `studioPlugins` is their context, which the
 * Studio tells what happens (files changed on disk, the Studio settled).
 *
 * Hot: a plugin edited, added or removed (plugin-modules.ts) is taken out,
 * all it registered undone, and put in again; the others stay as they are.
 * The Studio is told (`studio/plugins-reloaded`), and if the editor's
 * blocks changed (`studio/blocks-changed`) it draws the article again.
 */
export const studioPlugins = new Context();

/** What is applied: each plugin's module and its fiber (null if it failed). */
const loaded = new Map<string, { module: unknown; fiber: { dispose(): Promise<void>; state: number } | null }>();
let started: Promise<string[]> | null = null;
/** One reload at a time, in the order the edits came. */
let reloading: Promise<void> = Promise.resolve();

function warn(problems: string[]): void {
	for (const problem of problems) console.warn(`[plugins] ${problem}`);
}

/** Starts them, once, with what the Studio gives them; resolves with what went wrong. */
export function startStudioPlugins(host: StudioHost): Promise<string[]> {
	started ??= (async () => {
		await provideStudio(studioPlugins, host);
		const { problems } = await syncPlugins(studioPlugins, loaded, studioPluginList(pluginModules));
		warn(problems);
		return problems;
	})();
	return started;
}

/** Puts these versions of the plugins in, in place of those applied. */
function reload(modules: Record<string, unknown>): void {
	reloading = reloading.then(async () => {
		if (!started) return;
		await started;
		const before = studioBlocks(studioPlugins);
		const { changed, problems } = await syncPlugins(studioPlugins, loaded, studioPluginList(modules));
		if (!changed.length) return;
		warn(problems);
		const after = studioBlocks(studioPlugins);
		studioPlugins.emit('studio/plugins-reloaded', changed, problems);
		if (before.length !== after.length || before.some((block, index) => block !== after[index])) studioPlugins.emit('studio/blocks-changed');
	}).catch((error) => console.error('[plugins] 重新载入失败', error));
}

import.meta.hot?.accept('./plugin-modules.ts', (next) => {
	if (next) reload(next.pluginModules as Record<string, unknown>);
});

/** Once they have started: the blocks they put in the editor (none if they were never started). */
export async function pluginBlocks() {
	if (!started) return [];
	await started;
	return studioBlocks(studioPlugins);
}

/** The molecule editor a plugin offers (the first); null when none does, or before they have started. */
export function moleculeEditor() {
	return started ? (studioPlugins.get('molecules') as typeof studioPlugins.molecules | undefined)?.editor() ?? null : null;
}
