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

/** A viewer in `root`, its background following the page's theme until `root` leaves the page. */
export async function createMoleculeViewer(root: HTMLElement): Promise<FastMolViewer> {
	const { createViewer } = await loadFastMol();
	const viewer = createViewer(root);
	viewer.set({ background: pageBackground() });
	const follow = () => {
		if (!root.isConnected) {
			window.removeEventListener('themechange', follow);
			return;
		}
		// The page's colors change with its theme attribute, after the event.
		requestAnimationFrame(() => viewer.set({ background: pageBackground() }));
	};
	window.addEventListener('themechange', follow);
	return viewer;
}
