import type { SheetTab } from '@blog/ui/block-sheet.ts';

import { Blocks, type Block } from './blocks.mjs';
import { Context, Service } from './index.mjs';
import { Styles, Theme } from './theme.ts';
import { Commands, Panels } from './ui.ts';

/**
 * The Studio (in the browser): each plugin's studio.ts puts its block in the
 * editor and the slash menu (`ctx.blocks`), offers a molecule editor
 * (`ctx.molecules`), adds tabs to another block's sheet (`ctx.sheetTabs`),
 * changes how the Studio looks (`ctx.theme`, `ctx.styles`: theme.ts), adds
 * a tab to the right column (`ctx.panels`) and commands (`ctx.commands`:
 * ui.ts), and reaches its own API on the dev server (`ctx.studio.api`).
 */

/** What the Studio gives its plugins. */
export type StudioHost = {
	/** The article open (its name); null before one is. */
	slug(): string | null;
	/** Where a file of an article is served from (its path in the article's folder). */
	fileUrl(slug: string, path: string): string;
	/** Saves the article now (what the editor holds). */
	save(): void;
	/** The open article: its name and its title (as typed, saved or not); null before one is open. */
	article(): { slug: string; title: string } | null;
	/**
	 * The open article's file as the editor holds it, saved or not: its
	 * front matter (`---` … `---`) and its body. Null before one is open.
	 * To follow it, listen to `studio/source-changed` rather than asking again and again.
	 */
	source(): string | null;
	/** The article's editor. */
	editor: {
		/** Its ProseMirror view; null before an article is open. */
		view(): import('prosemirror-view').EditorView | null;
		/** Puts Markdown in where the caret is, as blocks of their own. */
		insert(markdown: string): void;
		/** Types plain text where the caret is, in its line (over what is selected); nothing without an editor. */
		insertText(text: string): void;
	};
	/** Says something for a moment at the bottom of the page (in red when it is an error). */
	toast(message: string, error?: boolean): void;
	/** Opens the right column on this tab (the Studio's own `files`, `terminal`, `drive`, or a plugin's `ctx.panels`); throws when there is none. */
	showPanel(key: string): void;
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
	/** An article was opened (another one, or the same one again from disk). */
	'studio/article-opened'(slug: string): void;
	/**
	 * The open article's file is other now (typed in, opened, changed on disk), a
	 * moment after the last change: the same as `ctx.studio.source()` gives.
	 */
	'studio/source-changed'(slug: string, source: string): void;
	/** Files of an article changed on disk (its paths in the article's folder). */
	'studio/files-changed'(slug: string, paths: string[]): void;
	/** The Studio has opened and settled: a time to get ready what will be wanted. */
	'studio/ready'(): void;
	/** Plugins were loaded again after an edit (their names), with what went wrong. */
	'studio/plugins-reloaded'(changed: string[], problems: string[]): void;
	/** Plugins were taken out or put in, for whatever reason (an edit, a switch): what others registered may be other now. */
	'studio/plugins-changed'(changed: string[]): void;
	/** What the editor is made with is other now (a block's plugin, or a slash-menu command, came or went): it must be drawn again. */
	'studio/editor-changed'(): void;
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

/** Gives `ctx` the Studio's services (`ctx.studio` is `host`), for its plugins. */
export async function provideStudio(ctx: Context, host: StudioHost): Promise<void> {
	ctx.provide('studio', host);
	await ctx.plugin(Blocks);
	await ctx.plugin(Molecules);
	await ctx.plugin(SheetTabs);
	await ctx.plugin(Theme);
	await ctx.plugin(Styles);
	await ctx.plugin(Panels);
	await ctx.plugin(Commands);
}

/** The plugins among these modules (by path, as import.meta.glob gives them), by their folder's name. */
export function studioPluginList(modules: Record<string, unknown>): Array<{ id: string; module: unknown }> {
	return Object.entries(modules).map(([path, module]) => ({ id: /\/plugins\/([^/]+)\//u.exec(path)?.[1] ?? path, module }));
}
