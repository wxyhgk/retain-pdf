/**
 * fast-mol (https://github.com/wxyhgk/fast-mol): the molecules in 3D, drawn
 * on a Canvas 2D (no WebGL, so no limit on how many a page shows). Its
 * read-only build is in ../third-party/fast-mol/ (VERSION.md there says which
 * commit), a chunk of its own loaded when a molecule is first drawn.
 */

import type { FastMolViewer } from '../third-party/fast-mol/fast-mol-viewer.js';

export type { FastMolViewer };

let loading: Promise<typeof import('../third-party/fast-mol/fast-mol-viewer.js')> | null = null;

export function loadFastMol(): Promise<typeof import('../third-party/fast-mol/fast-mol-viewer.js')> {
	loading ??= import('../third-party/fast-mol/fast-mol-viewer.js').catch((error: unknown) => {
		loading = null;
		throw error;
	});
	return loading;
}

/** The page's own background (its `--surface`), so a molecule sits on the page, light or dark. */
export function pageBackground(): string {
	const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
	return surface || (document.documentElement.dataset.theme === 'dark' ? '#191919' : '#ffffff');
}

/** The page's own dark gray (`--gray-dark`: light gray on a dark page), for what fast-mol would draw red: a mode's arrows. */
export function pageInk(): string {
	const ink = getComputedStyle(document.documentElement).getPropertyValue('--gray-dark').trim();
	return ink ? `rgb(${ink})` : document.documentElement.dataset.theme === 'dark' ? 'rgb(211, 211, 211)' : 'rgb(55, 53, 47)';
}

/** A viewer in `root`, its colors (background, a mode's arrows) following the page's theme until `root` leaves the page. */
export async function createMoleculeViewer(root: HTMLElement): Promise<FastMolViewer> {
	const { createViewer } = await loadFastMol();
	const viewer = createViewer(root);
	// Still, as the author saved it: fast-mol turns a molecule by itself unless told not to.
	viewer.set({ background: pageBackground(), autoRotate: false });
	// Black, white and gray: fast-mol's arrows are red, which here says something went wrong.
	viewer.modes.arrowColor = pageInk();
	const follow = () => {
		if (!root.isConnected) {
			window.removeEventListener('themechange', follow);
			return;
		}
		// The page's colors change with its theme attribute, after the event.
		requestAnimationFrame(() => {
			viewer.set({ background: pageBackground() });
			viewer.modes.arrowColor = pageInk();
		});
	};
	window.addEventListener('themechange', follow);
	return viewer;
}
