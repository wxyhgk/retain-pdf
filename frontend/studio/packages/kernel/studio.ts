import type { SheetTab } from '@blog/ui/block-sheet.ts';

import { Blocks, type Block } from './blocks.mjs';
import { applyPlugins, Context, pluginProblems, Service } from './index.mjs';
import { Styles, Theme } from './theme.ts';

/**
 * The Studio (in the browser): each plugin's studio.ts puts its block in the
 * editor and the slash menu (`ctx.blocks`), offers a molecule editor
 * (`ctx.molecules`), adds tabs to another block's sheet (`ctx.sheetTabs`),
 * changes how the Studio looks (`ctx.theme`, `ctx.styles`: theme.ts), and
 * reaches its own API on the dev server (`ctx.studio.api`).
 */

/** What the Studio gives its plugins. */
export type StudioHost = {
	/** The article open (its name); null before one is. */
	slug(): string | null;
	/** Where a file of an article is served from (its path in the article's folder). */
	fileUrl(slug: string, path: string): string;
	/** Saves the article now (what the editor holds). */
	save(): void;
	/** The plugins' API on the dev server (plugins/*\/server.mjs), as JSON; a failed request throws its error. */
	api: {
		get<T = unknown>(path: string): Promise<T>;
		post<T = unknown>(path: string, body?: unknown): Promise<T>;
		put<T = unknown>(path: string, body: unknown): Promise<T>;
	};
};

/** A block in the Studio: its editor nodes and, if it can be inserted, its slash-menu entry. */
export type StudioBlock = Block & {
	/** Milkdown plugins (its node, its view); taken when an article is opened. */
	milkdown?: unknown[];
	/** Its entry in the slash menu (块): `insert` puts a new one where the cursor is. */
	menu?: { key: string; label: string; icon: string; keywords?: string[]; insert(view: import('prosemirror-view').EditorView): void };
};

/** A molecule built or changed in an editor. */
export type BuiltMolecule = { mol: string; xyz: string; atoms: number; formula: string };

/** A molecule editor open over a place in a sheet. */
export type OpenMoleculeEditor = {
	/** Puts a structure in (MOL/SDF, XYZ; empty for an empty canvas); `report` sends back what it became. */
	load(text: string, options?: { report?: boolean }): void;
	dispose(): void;
};

/** A molecule editor (a seam: RetainMol is one; the blocks that build molecules ask for one, not for it). */
export type MoleculeEditor = {
	name: string;
	label: string;
	/** Over `host` (which it covers while shown), on `text`; `changed` is told the molecule after every edit. */
	open(host: HTMLElement, options: { text: string; report?: boolean; changed(molecule: BuiltMolecule): void; failed?(message: string): void }): Promise<OpenMoleculeEditor>;
	/** Gets ready, so that the first sheet to want it has it at once. */
	preload?(): void;
};

/** `ctx.molecules`: the molecule editors, the first registered first. */
export class Molecules extends Service {
	readonly editors: MoleculeEditor[] = [];

	constructor(ctx: Context) {
		super(ctx, 'molecules');
	}

	register(editor: MoleculeEditor): () => Promise<void> {
		return this.ctx.effect(() => {
			this.editors.push(editor);
			return () => {
				const index = this.editors.indexOf(editor);
				if (index >= 0) this.editors.splice(index, 1);
			};
		}, `molecules.register(${editor.name})`);
	}

	/** The editor by this name, or the first one; null when there is none. */
	editor(name?: string): MoleculeEditor | null {
		return (name ? this.editors.find((editor) => editor.name === name) : this.editors[0]) ?? null;
	}
}

/** A tab another plugin adds to a block's sheet; `detail` is what that block gives its tabs. */
export type ExtraSheetTab = Omit<SheetTab, 'draw'> & { draw(panel: HTMLElement, detail: unknown): void | (() => void) };

/** `ctx.sheetTabs`: tabs added to a block's sheet (by the block's name), after its own. */
export class SheetTabs extends Service {
	readonly byBlock = new Map<string, ExtraSheetTab[]>();

	constructor(ctx: Context) {
		super(ctx, 'sheetTabs');
	}

	register(block: string, tab: ExtraSheetTab): () => Promise<void> {
		return this.ctx.effect(() => {
			const tabs = this.byBlock.get(block) ?? [];
			this.byBlock.set(block, [...tabs, tab]);
			return () => this.byBlock.set(block, (this.byBlock.get(block) ?? []).filter((entry) => entry !== tab));
		}, `sheetTabs.register(${block}, ${tab.key})`);
	}

	/** The tabs added to this block's sheet, each drawn with `detail`. */
	for(block: string, detail: unknown): SheetTab[] {
		return (this.byBlock.get(block) ?? []).map((tab) => ({ ...tab, draw: (panel: HTMLElement) => tab.draw(panel, detail) }) as SheetTab);
	}
}

export interface StudioEvents {
	/** Files of an article changed on disk (its paths in the article's folder). */
	'studio/files-changed'(slug: string, paths: string[]): void;
	/** The Studio has opened and settled: a time to get ready what will be wanted. */
	'studio/ready'(): void;
}

declare module '@deepseek-ai/cordis' {
	interface Context {
		studio: StudioHost;
		molecules: Molecules;
		sheetTabs: SheetTabs;
	}
	interface Events extends StudioEvents {}
}

/** The Studio's blocks, read as the Studio reads them. */
export function studioBlocks(ctx: Context): StudioBlock[] {
	return ctx.blocks.list() as StudioBlock[];
}

/**
 * Starts the Studio's plugins (modules by path, as import.meta.glob gives
 * them). Resolves once they have started, with what went wrong.
 */
export async function startStudio(ctx: Context, modules: Record<string, unknown>, host: StudioHost): Promise<string[]> {
	ctx.provide('studio', host);
	await ctx.plugin(Blocks);
	await ctx.plugin(Molecules);
	await ctx.plugin(SheetTabs);
	await ctx.plugin(Theme);
	await ctx.plugin(Styles);
	const plugins = Object.entries(modules).map(([path, module]) => ({ id: /\/plugins\/([^/]+)\//u.exec(path)?.[1] ?? path, module }));
	const problems = pluginProblems(await applyPlugins(ctx, plugins));
	for (const problem of problems) console.warn(`[plugins] ${problem}`);
	return problems;
}
