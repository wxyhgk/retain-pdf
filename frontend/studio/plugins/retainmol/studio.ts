import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/kernel/studio.ts';

import { closeRetainmol, openRetainmol, preloadRetainmol, setRetainmolStudio } from './frame.ts';

/**
 * The Studio: RetainMol as its molecule editor (`ctx.molecules`), which
 * the blocks that build molecules open in their sheets (frame.ts). Loaded,
 * hidden, a moment after the Studio has settled, so that the first sheet
 * has it at once.
 */
export const name = 'molecules-retainmol';
export const inject = ['studio', 'molecules'];

export function apply(ctx: Context): void {
	ctx.effect(() => {
		setRetainmolStudio({
			address: async () => (await ctx.studio.api.post<{ url: string }>('/retainmol/url', {})).url,
			save: () => ctx.studio.save(),
		});
		return () => {
			setRetainmolStudio(null);
			closeRetainmol();
		};
	}, 'retainmol studio');
	ctx.molecules.register({ name: 'retainmol', label: 'RetainMol', open: openRetainmol, preload: preloadRetainmol });
	ctx.on('studio/ready', () => {
		const timer = window.setTimeout(preloadRetainmol, 3000);
		ctx.effect(() => () => window.clearTimeout(timer), 'retainmol preload');
	});
}
