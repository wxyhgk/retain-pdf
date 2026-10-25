import { Context, Service } from './index.mjs';

/**
 * The Studio's own places for plugins: a tab in the right column
 * (`ctx.panels`) and commands (`ctx.commands`) run from a shortcut, the
 * slash menu, the page's ⋯ menu or a button in the left column. Both are
 * lists the Studio draws (src/studio/workspace/plugin-ui.ts) and is told of
 * when they change; what a plugin registered goes with it.
 */

export class UiError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UiError';
	}
}

const KEY_NAME = /^[a-z][\w-]*$/u;

/**
 * A tab of the right column. `draw` fills its pane the first time it is
 * shown; what it returns is called when the tab goes (its plugin turned
 * off, edited, removed), so a timer or a listener started in `draw` is
 * stopped there. `shown` and `hidden` say when the pane comes on screen and
 * leaves it (another tab chosen, the column shut): what only matters on
 * screen can wait meanwhile.
 */
export type StudioPanel = {
	/** Its name (lowercase letters, digits, - and _); `ctx.studio.showPanel(key)` opens it. */
	key: string;
	/** The tab's text. */
	label: string;
	/** Among the plugins' tabs, after the Studio's own (files, terminal, drive): the smaller first. */
	order?: number;
	draw(pane: HTMLElement): void | (() => void);
	/** The pane is on screen now (also right after the first `draw`). */
	shown?(pane: HTMLElement): void;
	/** The pane is off screen now (not called when the tab goes: that is what `draw` returned). */
	hidden?(pane: HTMLElement): void;
};

/** The Studio's own tabs: no plugin's can be called so. */
export const STUDIO_PANELS = ['ai', 'files', 'terminal', 'drive'] as const;

/** Calls each listener; one that throws does not keep the others from hearing. */
function tell(listeners: Set<() => void>): void {
	for (const listener of listeners) {
		try {
			listener();
		} catch (error) {
			console.error('[plugins]', error);
		}
	}
}

/** `ctx.panels`: the plugins' tabs in the right column. */
export class Panels extends Service {
	readonly panels: StudioPanel[] = [];
	readonly listeners = new Set<() => void>();

	constructor(ctx: Context) {
		super(ctx, 'panels');
	}

	/** Adds this tab until the plugin goes; a wrong or taken key throws at once. */
	register(panel: StudioPanel): () => Promise<void> {
		if (!KEY_NAME.test(panel?.key ?? '')) throw new UiError(`面板的 key 要用小写字母开头，只含字母、数字、- 和 _：${panel?.key}`);
		if ((STUDIO_PANELS as readonly string[]).includes(panel.key)) throw new UiError(`面板 ${panel.key} 是 Studio 自己的`);
		if (this.panels.some((entry) => entry.key === panel.key)) throw new UiError(`已经有叫 ${panel.key} 的面板了`);
		if (typeof panel.label !== 'string' || !panel.label.trim()) throw new UiError(`面板 ${panel.key} 要有 label`);
		if (typeof panel.draw !== 'function') throw new UiError(`面板 ${panel.key} 要有 draw(pane)`);
		return this.ctx.effect(() => {
			this.panels.push(panel);
			tell(this.listeners);
			return () => {
				const index = this.panels.indexOf(panel);
				if (index >= 0) this.panels.splice(index, 1);
				tell(this.listeners);
			};
		}, `panels.register(${panel.key})`);
	}

	/** The tabs, in their order (then in the order they came). */
	list(): StudioPanel[] {
		return this.panels.map((panel, index) => ({ panel, index })).sort((a, b) => (a.panel.order ?? 0) - (b.panel.order ?? 0) || a.index - b.index).map(({ panel }) => panel);
	}

	/** Calls `listener` whenever the tabs change; returns how to stop. */
	watch(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

/** Where a command shows, besides its shortcut. */
export type CommandPlace = 'slash' | 'page-menu' | 'sidebar';
export const COMMAND_PLACES: readonly CommandPlace[] = ['slash', 'page-menu', 'sidebar'];

/** What a command was run from: its keys, one of its places, or another plugin (`ctx.commands.run`). */
export type CommandContext = { from: 'keys' | CommandPlace | 'call' };

export type StudioCommand = {
	/** Its name (lowercase letters, digits, . - and _), unique: `plugin.action` is a good one. */
	id: string;
	/** What it shows as (in the slash menu, the ⋯ menu, the left column). */
	label: string;
	/** An SVG, or a character, for the slash menu and the left column. */
	icon?: string;
	/** More words the slash menu finds it by. */
	keywords?: string[];
	/** A shortcut, as `Mod-Shift-d` (Mod: ⌘ on a Mac, Ctrl elsewhere): Mod or Alt and one key. */
	keys?: string;
	/** Where it shows, besides its keys. */
	places?: CommandPlace[];
	/** In the slash menu, the `/…` typed is taken away first; the editor is `ctx.studio.editor`. */
	run(context: CommandContext): void | Promise<void>;
};

/** A shortcut, read: the key (a letter or digit in lowercase, or a name as `KeyboardEvent.key` has it) and what is held. */
export type Shortcut = { key: string; mod: boolean; shift: boolean; alt: boolean };

/** The Studio's and the editor's own shortcuts, and the browser's everyone knows: no plugin gets them. */
export const RESERVED_KEYS: readonly string[] = [
	// The Studio: find, find, save, save, ask AI.
	'Mod-k', 'Mod-p', 'Mod-s', 'Mod-Enter', 'Mod-j',
	// The editor: bold, italic, inline code, strikethrough, undo, redo, select all; a block copied, moved;
	// Milkdown's headings, lists, code block, quote, indent.
	'Mod-b', 'Mod-i', 'Mod-e', 'Mod-Shift-s', 'Mod-Alt-x', 'Mod-z', 'Mod-Shift-z', 'Mod-y', 'Mod-a',
	'Mod-d', 'Mod-Shift-ArrowUp', 'Mod-Shift-ArrowDown',
	'Mod-Alt-0', 'Mod-Alt-1', 'Mod-Alt-2', 'Mod-Alt-3', 'Mod-Alt-4', 'Mod-Alt-5', 'Mod-Alt-6', 'Mod-Alt-7', 'Mod-Alt-8',
	'Mod-Alt-c', 'Mod-Shift-b', 'Mod-[', 'Mod-]',
	// The browser: copy, cut, paste, find, reload, close, new tab, new window, quit, address bar.
	'Mod-c', 'Mod-x', 'Mod-v', 'Mod-f', 'Mod-r', 'Mod-w', 'Mod-t', 'Mod-n', 'Mod-q', 'Mod-l',
];

const KEY_NAMES = new Map(['Enter', 'Escape', 'Backspace', 'Delete', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`)].map((name) => [name.toLowerCase(), name]));
const MODIFIERS = new Set(['mod', 'shift', 'alt']);

/** Reads `Mod-Shift-d`; a shortcut that is not one, or has neither Mod nor Alt (it would take a key from typing), throws. */
export function parseShortcut(keys: string): Shortcut {
	const parts = typeof keys === 'string' ? keys.split('-') : [];
	// `Mod--`: the minus key.
	if (parts.at(-1) === '' && parts.at(-2) === '') parts.splice(-2, 2, '-');
	const key = parts.pop() ?? '';
	const held = parts.map((part) => part.toLowerCase());
	if (!key || held.some((part) => !MODIFIERS.has(part)) || new Set(held).size !== held.length) {
		throw new UiError(`快捷键写成 Mod-Shift-d 这样（Mod、Shift、Alt 加一个键）：${keys}`);
	}
	const named = KEY_NAMES.get(key.toLowerCase());
	if (!named && [...key].length !== 1) throw new UiError(`没有叫 ${key} 的键：${keys}`);
	const shortcut = { key: named ?? key.toLowerCase(), mod: held.includes('mod'), shift: held.includes('shift'), alt: held.includes('alt') };
	if (!shortcut.mod && !shortcut.alt && !/^f\d+$/iu.test(shortcut.key)) throw new UiError(`快捷键要按着 Mod 或 Alt，不然会占掉打字的键：${keys}`);
	return shortcut;
}

/** The shortcut written one way: `Mod-Shift-d`. */
export function shortcutName(shortcut: Shortcut): string {
	return [shortcut.mod && 'Mod', shortcut.shift && 'Shift', shortcut.alt && 'Alt', shortcut.key].filter(Boolean).join('-');
}

const RESERVED = new Set(RESERVED_KEYS.map((keys) => shortcutName(parseShortcut(keys))));

/** What of a key press a shortcut is matched on. */
export type KeyPress = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/** The key pressed as a shortcut names it: by its place for letters and digits, since Alt and Shift change what they type. */
function pressedKey(event: KeyPress): string {
	const place = /^(?:Key([A-Z])|Digit(\d))$/u.exec(event.code ?? '');
	if (place) return (place[1] ?? place[2]!).toLowerCase();
	return KEY_NAMES.get(event.key.toLowerCase()) ?? event.key.toLowerCase();
}

export function matchesShortcut(shortcut: Shortcut, event: KeyPress): boolean {
	return (
		shortcut.mod === (event.metaKey || event.ctrlKey) &&
		shortcut.shift === event.shiftKey &&
		shortcut.alt === event.altKey &&
		shortcut.key === pressedKey(event)
	);
}

const COMMAND_NAME = /^[a-z][\w.-]*$/u;

/** `ctx.commands`: commands of plugins, run from their keys or their places. */
export class Commands extends Service {
	readonly commands: Array<{ command: StudioCommand; shortcut: Shortcut | null }> = [];
	readonly listeners = new Set<() => void>();

	constructor(ctx: Context) {
		super(ctx, 'commands');
	}

	/** Adds this command until the plugin goes; a wrong or taken id or shortcut throws at once. */
	register(command: StudioCommand): () => Promise<void> {
		const id = command?.id;
		if (!COMMAND_NAME.test(id ?? '')) throw new UiError(`命令的 id 要用小写字母开头，只含字母、数字、.、- 和 _：${id}`);
		if (this.commands.some((entry) => entry.command.id === id)) throw new UiError(`已经有叫 ${id} 的命令了`);
		if (typeof command.label !== 'string' || !command.label.trim()) throw new UiError(`命令 ${id} 要有 label`);
		if (typeof command.run !== 'function') throw new UiError(`命令 ${id} 要有 run()`);
		for (const place of command.places ?? []) {
			if (!COMMAND_PLACES.includes(place)) throw new UiError(`命令 ${id} 的 places 里没有 ${place} 这个地方；有：${COMMAND_PLACES.join('、')}`);
		}
		const shortcut = command.keys === undefined ? null : parseShortcut(command.keys);
		if (shortcut) {
			const name = shortcutName(shortcut);
			if (RESERVED.has(name)) throw new UiError(`快捷键 ${command.keys} 是 Studio 或浏览器自己的`);
			const taken = this.commands.find((entry) => entry.shortcut && shortcutName(entry.shortcut) === name);
			if (taken) throw new UiError(`快捷键 ${command.keys} 已经给了命令 ${taken.command.id}`);
		}
		const entry = { command, shortcut };
		return this.ctx.effect(() => {
			this.commands.push(entry);
			tell(this.listeners);
			return () => {
				const index = this.commands.indexOf(entry);
				if (index >= 0) this.commands.splice(index, 1);
				tell(this.listeners);
			};
		}, `commands.register(${id})`);
	}

	get(id: string): StudioCommand | null {
		return this.commands.find((entry) => entry.command.id === id)?.command ?? null;
	}

	/** The commands, in the order they came; those shown in `place` only, if it is given. */
	list(place?: CommandPlace): StudioCommand[] {
		return this.commands.map((entry) => entry.command).filter((command) => !place || (command.places ?? []).includes(place));
	}

	/** The command this key press is the shortcut of, if any. */
	forKey(event: KeyPress): StudioCommand | null {
		return this.commands.find((entry) => entry.shortcut && matchesShortcut(entry.shortcut, event))?.command ?? null;
	}

	/** Runs a command (another plugin's too); throws when there is none by this id, or it fails. */
	async run(id: string, context: CommandContext = { from: 'call' }): Promise<void> {
		const command = this.get(id);
		if (!command) throw new UiError(`没有叫 ${id} 的命令`);
		await command.run(context);
	}

	/** Calls `listener` whenever the commands change; returns how to stop. */
	watch(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

/**
 * 识别: what a picture of an article can be read as, by the large model set in AI 设置 — a formula,
 * text, a table, a molecule. A picture's menu has one 「识别…」, which lists them all.
 */
export type Recognizer = {
	/** Its name (lowercase letters, digits, . - and _), unique: `plugin.kind` is a good one. */
	id: string;
	/** What it shows as in the list: 「公式 → LaTeX」. */
	label: string;
	/** What the model is asked, the picture given with it: what to read, and how to write it out. */
	prompt: string;
	/** The answer made into the Markdown put under the picture; the answer as it is when not given. */
	toMarkdown?(answer: string): string;
};

/** `ctx.recognizers`: what pictures can be read as (识别). */
export class Recognizers extends Service {
	readonly recognizers: Recognizer[] = [];
	readonly listeners = new Set<() => void>();

	constructor(ctx: Context) {
		super(ctx, 'recognizers');
	}

	/** Adds this until the plugin goes; a wrong or taken id throws at once. */
	register(recognizer: Recognizer): () => Promise<void> {
		const id = recognizer?.id;
		if (!COMMAND_NAME.test(id ?? '')) throw new UiError(`识别的 id 要用小写字母开头，只含字母、数字、.、- 和 _：${id}`);
		if (this.recognizers.some((entry) => entry.id === id)) throw new UiError(`已经有叫 ${id} 的识别了`);
		if (typeof recognizer.label !== 'string' || !recognizer.label.trim()) throw new UiError(`识别 ${id} 要有 label`);
		if (typeof recognizer.prompt !== 'string' || !recognizer.prompt.trim()) throw new UiError(`识别 ${id} 要有 prompt`);
		if (recognizer.toMarkdown !== undefined && typeof recognizer.toMarkdown !== 'function') throw new UiError(`识别 ${id} 的 toMarkdown 要是函数`);
		return this.ctx.effect(() => {
			this.recognizers.push(recognizer);
			tell(this.listeners);
			return () => {
				const index = this.recognizers.indexOf(recognizer);
				if (index >= 0) this.recognizers.splice(index, 1);
				tell(this.listeners);
			};
		}, `recognizers.register(${id})`);
	}

	/** Them all, in the order they came. */
	list(): Recognizer[] {
		return [...this.recognizers];
	}

	/** The Markdown for `answer`, as `recognizer` makes it. */
	static markdown(recognizer: Recognizer, answer: string): string {
		return recognizer.toMarkdown ? recognizer.toMarkdown(answer) : answer;
	}

	/** Calls `listener` whenever they change; returns how to stop. */
	watch(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

declare module '@deepseek-ai/cordis' {
	interface Context {
		panels: Panels;
		commands: Commands;
		recognizers: Recognizers;
	}
}
