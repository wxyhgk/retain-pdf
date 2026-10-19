import { crest } from './program.mjs';

/** The blog's build: CREST as a program of ```job blocks (the line saying what a job does). */
export const name = 'program-crest';
export const inject = ['jobs'];

export function apply(ctx) {
	ctx.jobs.register(crest);
}
