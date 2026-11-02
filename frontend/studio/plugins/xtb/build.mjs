import { xtb } from './program.mjs';

/** The blog's build: xtb as a program of ```job blocks (the line saying what a job does). */
export const name = 'program-xtb';
export const inject = ['jobs'];

export function apply(ctx) {
	ctx.jobs.register(xtb);
}
