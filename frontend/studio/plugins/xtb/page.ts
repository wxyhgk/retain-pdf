import type { Context } from '@blog/kernel/index.mjs';
import type {} from '@blog/compute/programs.mjs';

import { xtb } from './program.mjs';
import { xtbView } from './view.ts';

/** The blog's pages: xtb as a program of ```job blocks, with how its runs are drawn (view.ts). */
export const name = 'program-xtb';
export const inject = ['jobs'];

export function apply(ctx: Context): void {
	ctx.jobs.register({ ...xtb, ...xtbView });
}
