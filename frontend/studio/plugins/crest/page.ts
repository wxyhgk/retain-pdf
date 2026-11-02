import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/compute/programs.mjs';

import { crest } from './program.mjs';
import { crestView } from './view.ts';

/** The blog's pages: CREST as a program of ```job blocks, with how its runs are drawn (view.ts). */
export const name = 'program-crest';
export const inject = ['jobs'];

export function apply(ctx: Context): void {
	ctx.jobs.register({ ...crest, ...crestView });
}
