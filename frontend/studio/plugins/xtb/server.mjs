import { xtb } from './program.mjs';

/** The Studio's dev server: xtb as a program of ```job blocks (what a run executes, its output, how to find it on a machine). */
export const name = 'program-xtb';
export const inject = ['jobs'];

export function apply(ctx) {
	ctx.jobs.register(xtb);
}
