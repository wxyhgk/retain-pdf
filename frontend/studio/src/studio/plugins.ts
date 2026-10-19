import { Context, pluginStatus, syncPlugins, type LoadedPlugin, type PluginStatus } from '@blog/kernel/index.mjs';
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
 * A plugin turned off (插件, `setStudioPluginEnabled`) is taken out the same way.
 */
export const studioPlugins = new Context();

/** What is applied: each plugin's module and its fiber (null if it failed). */
const loaded = new Map<string, LoadedPlugin>();
/** The plugins as last given (the newest version of plugin-modules.ts), and those turned off. */
let modules = pluginModules;
const disabled = new Set<string>();
const applicable = () => studioPluginList(modules).filter((plugin) => !disabled.has(plugin.id));
let started: Promise<string[]> | null = null;
/** Settled once they have started (the editor waits for it, even before they begin: which are off is asked first). */
let markStarted: () => void = () => {};
const ready = new Promise<void>((resolve) => {
	markStarted = resolve;
});
/** One reload at a time, in the order the edits came. */
let reloading: Promise<void> = Promise.resolve();

function warn(problems: string[]): void {
	for (const problem of problems) console.warn(`[plugins] ${problem}`);
}

/** Starts them, once, with what the Studio gives them, but those turned off; resolves with what went wrong. */
export function startStudioPlugins(host: StudioHost, off: string[] = []): Promise<string[]> {
	started ??= (async () => {
		for (const id of off) disabled.add(id);
		await provideStudio(studioPlugins, host);
		const { problems } = await syncPlugins(studioPlugins, loaded, applicable());
		warn(problems);
		return problems;
	})().finally(markStarted);
	return started;
}

/** Brings what is applied in line with the plugins as they are now (new versions, some turned off); `announce`: tell the Studio. */
function reload({ announce }: { announce: boolean }): Promise<void> {
	reloading = reloading.then(async () => {
		if (!started) return;
		await started;
		const before = studioBlocks(studioPlugins);
		const { changed, problems } = await syncPlugins(studioPlugins, loaded, applicable());
		if (!changed.length) return;
		warn(problems);
		const after = studioBlocks(studioPlugins);
		studioPlugins.emit('studio/plugins-changed', changed);
		if (announce) studioPlugins.emit('studio/plugins-reloaded', changed, problems);
		if (before.length !== after.length || before.some((block, index) => block !== after[index])) studioPlugins.emit('studio/blocks-changed');
	}).catch((error) => console.error('[plugins] 重新载入失败', error));
	return reloading;
}

import.meta.hot?.accept('./plugin-modules.ts', (next) => {
	if (!next) return;
	modules = next.pluginModules as Record<string, unknown>;
	void reload({ announce: true });
});

/** Turns a plugin on or off here (taken out, or put in, at once); its server side is the server's (setPluginEnabled). */
export function setStudioPluginEnabled(id: string, enabled: boolean): Promise<void> {
	if (enabled) disabled.delete(id);
	else disabled.add(id);
	return reload({ announce: false });
}

/** How a plugin is doing in the Studio, and what it says it is (its studio.ts' `description`). */
export function studioPluginInfo(id: string): { status: PluginStatus; description: string | null } {
	const module = studioPluginList(modules).find((plugin) => plugin.id === id)?.module as { description?: unknown } | undefined;
	return { status: pluginStatus(loaded.get(id)), description: typeof module?.description === 'string' ? module.description : null };
}

/** Once they have started: the blocks they put in the editor. */
export async function pluginBlocks() {
	await ready;
	return studioBlocks(studioPlugins);
}

/** The molecule editor a plugin offers (the first); null when none does, or before they have started. */
export function moleculeEditor() {
	return started ? (studioPlugins.get('molecules') as typeof studioPlugins.molecules | undefined)?.editor() ?? null : null;
}
