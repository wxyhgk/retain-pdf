import { Context, pluginStatus, syncPlugins, type LoadedPlugin, type PluginStatus } from '@blog/kernel/index.mjs';
import { provideStudio, studioBlocks, studioPluginList, type StudioHost } from '@blog/kernel/studio.ts';
import type { Commands, Panels, Recognizers } from '@blog/kernel/ui.ts';

import type { FileBlock } from './files/article-files.ts';
import { pluginModules } from './plugin-modules.ts';

/**
 * The project's plugins in the Studio (plugins/*\/studio.ts, @blog/kernel):
 * their blocks in the editor and the slash menu, the molecule editor, the
 * look, the tabs they add, their panels and commands. `studioPlugins` is
 * their context, which the Studio tells what happens (files changed on
 * disk, the Studio settled).
 *
 * Hot: a plugin edited, added or removed (plugin-modules.ts) is taken out,
 * all it registered undone, and put in again; the others stay as they are.
 * The Studio is told (`studio/plugins-reloaded`), and if what the editor is
 * made with changed (its blocks, the slash menu's commands:
 * `studio/editor-changed`) it draws the article again.
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

/**
 * A plugin made while the page was loading, before it heard of updates, is
 * not in its list: when the server has one with a studio.ts that the list
 * lacks, the list is read anew.
 */
async function catchUp(present: string[]): Promise<void> {
	const known = new Set(studioPluginList(modules).map((plugin) => plugin.id));
	if (present.every((id) => known.has(id))) return;
	try {
		const next = (await import(/* @vite-ignore */ `./plugin-modules.ts?t=${Date.now()}`)) as { pluginModules: Record<string, unknown> };
		modules = next.pluginModules;
	} catch (error) {
		console.warn('[plugins] 没能重新读取插件列表', error); // i18n-ignore: developer log
	}
}

/**
 * Starts them, once, with what the Studio gives them, but those turned off;
 * `present`: the plugins with a studio.ts the server has. Resolves with what went wrong.
 */
export function startStudioPlugins(host: StudioHost, off: string[] = [], present: string[] = []): Promise<string[]> {
	started ??= (async () => {
		await catchUp(present);
		for (const id of off) disabled.add(id);
		await provideStudio(studioPlugins, host);
		const { problems } = await syncPlugins(studioPlugins, loaded, applicable());
		warn(problems);
		return problems;
	})().finally(markStarted);
	return started;
}

/** What the editor is made with when it draws an article: the plugins' blocks, the slash menu's commands. */
function editorParts(): unknown[] {
	return [...studioBlocks(studioPlugins), ...(pluginCommands()?.list('slash') ?? [])];
}

/** Brings what is applied in line with the plugins as they are now (new versions, some turned off); `announce`: tell the Studio. */
function reload({ announce }: { announce: boolean }): Promise<void> {
	reloading = reloading.then(async () => {
		if (!started) return;
		await started;
		const before = editorParts();
		const { changed, problems } = await syncPlugins(studioPlugins, loaded, applicable());
		if (!changed.length) return;
		warn(problems);
		const after = editorParts();
		studioPlugins.emit('studio/plugins-changed', changed);
		if (announce) studioPlugins.emit('studio/plugins-reloaded', changed, problems);
		if (before.length !== after.length || before.some((part, index) => part !== after[index])) studioPlugins.emit('studio/editor-changed');
	}).catch((error) => console.error('[plugins] 重新载入失败', error)); // i18n-ignore: developer log
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

/**
 * A code block in `language` drawn as the plugin that knows it draws it in the editor (an energy diagram, a molecule,
 * a widget's frame); null when none does, or before they have started.
 */
export function codeBlockPreview(language: string, content: string): HTMLElement | null {
	if (!started || !studioPlugins.get('blocks')) return null;
	for (const block of studioBlocks(studioPlugins)) {
		const shown = block.codeBlock?.preview?.(language, content, '');
		if (shown) return shown;
	}
	return null;
}

/**
 * The plugins' blocks watching `root` (an AI's answers) as they watch the editor's page, to draw what their previews
 * left there (a molecule's 3D view, a widget's frame); once they have started. Returns what stops them.
 */
export async function observePluginBlocks(root: HTMLElement): Promise<() => void> {
	const stops = (await pluginBlocks()).flatMap((block) => (block.observe ? [block.observe(root)] : []));
	return () => {
		for (const stop of stops) stop();
	};
}

/** The plugin blocks that show files of the article with this extension (their `files`); none before they have started. */
function blocksForFile(extension: string) {
	const blocks = started ? (studioPlugins.get('blocks') as typeof studioPlugins.blocks | undefined) : undefined;
	const wanted = extension.toLowerCase();
	return blocks ? studioBlocks(studioPlugins).filter((candidate) => candidate.files?.extensions.includes(wanted)) : [];
}

/**
 * The plugin block that shows files of the article with this extension (its `files`), and the
 * fence it writes for one (when the extension is one of its fences); null when none does, or
 * before they have started. One that tells its files by what they say (`sniff`) takes the file
 * only when its start (`head`) is given and is its own.
 */
export function blockForFile(extension: string, head?: string): FileBlock | null {
	const wanted = extension.toLowerCase();
	const block = blocksForFile(wanted).find((candidate) => !candidate.files!.sniff || (head !== undefined && candidate.files!.sniff(head)));
	if (!block?.files) return null;
	return { fence: [block.fence].flat().includes(wanted) ? wanted : null, icon: block.files.icon, markdown: block.files.markdown };
}

/** Whether a plugin block would read the start of a file with this extension to tell whether it is its own. */
export function fileHeadWanted(extension: string): boolean {
	return blocksForFile(extension).some((candidate) => candidate.files!.sniff);
}

/** The plugins' commands (`ctx.commands`); null before they have started. */
export function pluginCommands(): Commands | null {
	return started ? ((studioPlugins.get('commands') as Commands | undefined) ?? null) : null;
}

/** What the plugins read pictures as (`ctx.recognizers`, 识别); null before they have started. */
export function pluginRecognizers(): Recognizers | null {
	return started ? ((studioPlugins.get('recognizers') as Recognizers | undefined) ?? null) : null;
}

/** The plugins' tabs of the right column (`ctx.panels`); null before they have started. */
export function pluginPanels(): Panels | null {
	return started ? ((studioPlugins.get('panels') as Panels | undefined) ?? null) : null;
}

/** Once they have started: the commands they put in the slash menu. */
export async function pluginSlashCommands() {
	await ready;
	return pluginCommands()?.list('slash') ?? [];
}
