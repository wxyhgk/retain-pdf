/**
 * Light or dark (外观): chosen, or the system's, followed as it changes (as SiYuan's and the Mac's). Kept as the blog
 * keeps it (localStorage `theme`: `light`, `dark`, none for the system's), so the blog's pages and the Studio's windows
 * (window-main.ts, the 小程序, told through data-theme) look the same; `themechange` tells what draws in colours of
 * its own (plots, molecules).
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'theme';
const system = matchMedia('(prefers-color-scheme: dark)');

export function themeChoice(): ThemeChoice {
	try {
		const kept = localStorage.getItem(KEY);
		return kept === 'light' || kept === 'dark' ? kept : 'system';
	} catch {
		return 'system';
	}
}

function show(): void {
	const choice = themeChoice();
	const theme = choice === 'system' ? (system.matches ? 'dark' : 'light') : choice;
	if (document.documentElement.dataset.theme === theme) return;
	document.documentElement.dataset.theme = theme;
	window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

export function setTheme(choice: ThemeChoice): void {
	try {
		if (choice === 'system') localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, choice);
	} catch {
		// Not kept: this time only.
	}
	show();
}

/** Light ⇄ dark, from what is shown now (⌘K). */
export function toggleTheme(): void {
	setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

/** The system's light or dark followed while nothing is chosen, and what another window chose. */
export function followTheme(): void {
	system.addEventListener('change', show);
	window.addEventListener('storage', (event) => {
		if (event.key === KEY || event.key === null) show();
	});
	show();
}
