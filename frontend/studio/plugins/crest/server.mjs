import { crest } from './program.mjs';

/** The Studio's dev server: CREST as a program of ```job blocks (what a run executes, its output, how to find it on a machine). */
export const name = 'program-crest';
export const inject = ['jobs'];

export function apply(ctx) {
	ctx.jobs.register(crest);
}
