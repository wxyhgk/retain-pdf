import { readFileSync } from 'node:fs';

/**
 * The site's colors as global.css has them (its `:root`, and `html[data-theme='dark']` over it), named as the frames of
 * widgets and 小程序 use them (`--ink`, `--muted`, `--line`, `--soft`, `--surface`, `--danger`): a frame cannot read
 * the page's. In the browser, widget-host.ts reads them from the page itself.
 * @param {'light' | 'dark'} scheme
 * @returns {Record<string, string>}
 */
export function siteColors(scheme = 'light') {
	const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8');
	const block = (selector) => {
		const start = css.indexOf(`${selector} {`);
		const body = start < 0 ? '' : css.slice(start, css.indexOf('}', start));
		return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/gu)].map((found) => [found[1], found[2].trim()]));
	};
	const tokens = { ...block(':root'), ...(scheme === 'dark' ? block("html[data-theme='dark']") : {}) };
	// The grays are kept as "r, g, b" (rgb(var(--gray))).
	return { ink: `rgb(${tokens['--gray-dark']})`, muted: `rgb(${tokens['--gray']})`, line: `rgb(${tokens['--gray-light']})`, soft: tokens['--surface-soft'], surface: tokens['--surface'], danger: tokens['--danger'] };
}

/** Colors as CSS declarations: `--ink: …; --muted: …;`. */
export const colorDeclarations = (colors) => Object.entries(colors).map(([name, value]) => `--${name}: ${value};`).join(' ');
