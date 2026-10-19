import { Context } from '@blog/kernel/index.mjs';
import { startStudio, studioBlocks, type StudioHost } from '@blog/kernel/studio.ts';

/**
 * The project's plugins in the Studio (plugins/*\/studio.ts, @blog/kernel):
 * their blocks in the editor and the slash menu, the molecule editor, the
 * tabs they add. `studioPlugins` is their context, which the Studio tells
 * what happens (files changed on disk, the Studio settled).
 */
export const studioPlugins = new Context();

let started: Promise<string[]> | null = null;

/** Starts them, once, with what the Studio gives them. */
export function startStudioPlugins(host: StudioHost): Promise<string[]> {
	started ??= startStudio(studioPlugins, import.meta.glob('/plugins/*/studio.ts', { eager: true }), host);
	return started;
}

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
