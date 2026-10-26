import { Context, Service } from './index.mjs';

/**
 * How the Studio looks, for plugins: its design tokens (`ctx.theme`), and
 * stylesheets of their own (`ctx.styles`). Both are undone when the plugin
 * goes. The tokens are a fixed list: a name not in it is refused, so that a
 * plugin (or an AI writing one) cannot think it changed something it did not.
 *
 *     ctx.theme.set({ 'editor-width': '720px', 'editor-font-size': '16px' })
 *     ctx.theme.set({ surface: '#f4f4f2' }, { scheme: 'light' })
 *     ctx.styles.add('.page-head { padding-top: 24px; }')
 *
 * The site is black, white and gray; red only for deleting and for errors.
 */

/**
 * - `color`: any CSS color.
 * - `rgb`: a color kept as "r, g, b" (the site's grays, used as rgb(var(--gray))); given as #hex or "r, g, b".
 * - `length`, `number`, `font`: CSS values of that kind.
 */
export type TokenKind = 'color' | 'rgb' | 'length' | 'number' | 'font';

export type DesignToken = {
	name: string;
	/** The CSS custom property it is. */
	css: string;
	kind: TokenKind;
	/** Its value in light mode when no plugin changes it (global.css, src/studio/tokens.css). */
	default: string;
	label: string;
};

const token = (name: string, css: string, kind: TokenKind, value: string, label: string): DesignToken => ({ name, css, kind, default: value, label });

export const DESIGN_TOKENS: readonly DesignToken[] = [
	// Colors (global.css): light here; dark mode has its own (html[data-theme='dark']).
	token('accent', '--accent', 'color', '#37352f', '强调色：主按钮、选中'),
	token('accent-strong', '--accent-dark', 'color', '#000000', '强调色的深一档'),
	token('on-accent', '--on-accent', 'color', '#ffffff', '强调色上的字'),
	token('heading', '--black', 'rgb', '55, 53, 47', '标题的颜色'),
	token('text', '--gray-dark', 'rgb', '55, 53, 47', '正文的颜色'),
	token('text-soft', '--gray', 'rgb', '120, 119, 116', '次要文字、图标'),
	token('line', '--gray-light', 'rgb', '233, 232, 229', '分隔线、边框'),
	token('surface', '--surface', 'color', '#ffffff', '页面底色'),
	token('surface-soft', '--surface-soft', 'color', '#f7f7f5', '侧栏、卡片的浅底色'),
	token('surface-hover', '--surface-hover', 'color', '#efefed', '悬停时的底色'),
	token('code-bg', '--code-bg', 'color', '#1e1e1e', '代码块底色'),
	token('code-text', '--code-text', 'color', '#f4f4f4', '代码块文字'),
	token('danger', '--danger', 'color', '#b42318', '出错、删除的红色'),
	// Fonts (global.css).
	token('font-text', '--font-text', 'font', 'var(--font-atkinson), -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif', '正文字体'),
	token('font-mono', '--font-mono', 'font', 'ui-monospace, SFMono-Regular, Menlo, monospace', '等宽字体（代码、路径）'),
	// The Studio (src/studio/tokens.css).
	token('editor-width', '--studio-editor-width', 'length', '926px', '正文区宽度'),
	token('editor-padding', '--studio-editor-padding', 'length', '96px', '正文左右留白'),
	token('editor-font-size', '--studio-editor-font-size', 'length', '17px', '正文字号'),
	token('editor-line-height', '--studio-editor-line-height', 'number', '1.72', '正文行高'),
	token('title-size', '--studio-title-size', 'length', 'clamp(30px, 3vw, 40px)', '标题字号'),
	token('sidebar-width', '--studio-sidebar-width', 'length', '250px', '左栏宽度'),
	token('panel-width', '--studio-panel-width', 'length', '340px', '右栏宽度（拖动过就按拖动的）'),
];

export type TokenName = (typeof DESIGN_TOKENS)[number]['name'];
export type TokenValues = Partial<Record<string, string>>;
export type Scheme = 'light' | 'dark';

const byName = new Map(DESIGN_TOKENS.map((entry) => [entry.name, entry]));

export class ThemeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ThemeError';
	}
}

/** "r, g, b" from #rgb, #rrggbb or "r, g, b"; null if it is none of those. */
function rgbTriplet(value: string): string | null {
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(value);
	if (hex) {
		const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit) : hex[1].match(/../gu)!;
		return digits.map((pair) => parseInt(pair, 16)).join(', ');
	}
	const parts = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/u.exec(value);
	return parts && parts.slice(1).every((part) => Number(part) <= 255) ? parts.slice(1).join(', ') : null;
}

/** The token by this name and the value as CSS takes it; throws, saying why, if either is wrong. */
export function checkToken(name: string, value: unknown): { token: DesignToken; value: string } {
	const found = byName.get(name);
	if (!found) throw new ThemeError(`没有叫 ${name} 的设计变量；有：${DESIGN_TOKENS.map((entry) => entry.name).join('、')}`);
	if (typeof value !== 'string' || !value.trim()) throw new ThemeError(`设计变量 ${name} 的值要是一段非空的文字`);
	const text = value.trim();
	// One declaration's value, nothing that could end it or open another rule.
	if (text.length > 300 || /[;{}<>\\]|\/\*/u.test(text)) throw new ThemeError(`设计变量 ${name} 的值不能含 ; { } < > \\ 或注释`);
	if (found.kind === 'rgb') {
		const triplet = rgbTriplet(text);
		if (!triplet) throw new ThemeError(`设计变量 ${name} 要写成 #rrggbb 或 "r, g, b"`);
		return { token: found, value: triplet };
	}
	if (found.kind === 'number' && !/^\d+(\.\d+)?$/u.test(text)) throw new ThemeError(`设计变量 ${name} 要是一个数`);
	return { token: found, value: text };
}

/** The stylesheet for these settings, the later over the earlier: one rule for light mode, one for dark. */
export function themeCss(settings: ReadonlyArray<{ values: TokenValues; scheme?: Scheme }>): string {
	const schemes: Record<Scheme, Map<string, string>> = { light: new Map(), dark: new Map() };
	for (const { values, scheme } of settings) {
		for (const [name, value] of Object.entries(values)) {
			const checked = checkToken(name, value);
			for (const target of scheme ? [scheme] : (['light', 'dark'] as const)) schemes[target].set(checked.token.css, checked.value);
		}
	}
	// Above global.css and tokens.css however their sheets are ordered.
	const rule = (selector: string, values: Map<string, string>) => (values.size ? `${selector} {\n${[...values].map(([css, value]) => `\t${css}: ${value};`).join('\n')}\n}\n` : '');
	return rule("html:root:not([data-theme='dark'])", schemes.light) + rule("html:root[data-theme='dark']", schemes.dark);
}

/** A <style> of the page's head, made when first needed. */
function styleElement(attribute: string): HTMLStyleElement {
	const element = document.createElement('style');
	element.setAttribute(attribute, '');
	document.head.append(element);
	return element;
}

/** `ctx.theme`: the design tokens plugins set. */
export class Theme extends Service {
	readonly settings: Array<{ values: TokenValues; scheme?: Scheme }> = [];
	/** The <style> it writes them into, once there are any. */
	element: HTMLStyleElement | null = null;

	constructor(ctx: Context) {
		super(ctx, 'theme');
	}

	/** Sets these tokens (in both modes, or the one named) until the plugin goes; a wrong name or value throws at once. */
	set(values: TokenValues, { scheme }: { scheme?: Scheme } = {}): () => Promise<void> {
		for (const [name, value] of Object.entries(values)) checkToken(name, value);
		const setting = { values: { ...values }, ...(scheme ? { scheme } : {}) };
		return this.ctx.effect(() => {
			this.settings.push(setting);
			this.paint();
			return () => {
				const index = this.settings.indexOf(setting);
				if (index >= 0) this.settings.splice(index, 1);
				this.paint();
			};
		}, `theme.set(${Object.keys(values).join(', ')})`);
	}

	/** Every token, with what it is now (as the page has it). */
	tokens(): Array<DesignToken & { value: string }> {
		const style = getComputedStyle(document.documentElement);
		return DESIGN_TOKENS.map((entry) => ({ ...entry, value: style.getPropertyValue(entry.css).trim() }));
	}

	private paint(): void {
		this.element ??= styleElement('data-plugin-theme');
		this.element.textContent = themeCss(this.settings);
	}
}

/** `ctx.styles`: stylesheets of plugins, after the Studio's own. */
export class Styles extends Service {
	constructor(ctx: Context) {
		super(ctx, 'styles');
	}

	/**
	 * Adds this CSS to the page until the plugin goes. It comes after the
	 * Studio's sheets; a rule that does not win needs a more specific selector.
	 */
	add(css: string): () => Promise<void> {
		if (typeof css !== 'string') throw new ThemeError('样式要是 CSS 文字');
		return this.ctx.effect(() => {
			const element = styleElement('data-plugin-style');
			element.textContent = css;
			return () => element.remove();
		}, 'styles.add');
	}
}

declare module '@deepseek-ai/cordis' {
	interface Context {
		theme: Theme;
		styles: Styles;
	}
}
