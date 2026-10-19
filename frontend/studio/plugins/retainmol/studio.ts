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
export const description = 'RetainMol 分子编辑器：计算块和化学块的「搭建」「结构」页签里用它画 2D、搭 3D。';
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
