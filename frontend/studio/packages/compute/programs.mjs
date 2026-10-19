import { Service } from '@blog/kernel/index.mjs';

/**
 * The programs a ```job block runs: a seam. Each is a plugin of its own
 * (plugins/xtb, plugins/crest; ORCA would be one more), which registers it
 * in `ctx.jobs` in every environment it takes part in; the calculation
 * plugin (plugins/job) provides `ctx.jobs` and asks it for the program a
 * fence names. What a program is (programs.d.mts):
 *
 * - everywhere: its name (the fence's `program=`, the command it runs, its
 *   key in a machine's programs), its label, the command line a new block
 *   starts with, the form's fields for its command line (read, write,
 *   describe), what a run executes, its output and the files followed while
 *   it runs, the files it leaves that are no result, where else to look for
 *   it on a machine;
 * - in the browser also `summarize` (a card's line) and `draw` (its
 *   results), from browser/job-view.ts' pieces.
 */
export class JobPrograms extends Service {
	/** @param {import('@blog/kernel/index.mjs').Context} ctx */
	constructor(ctx) {
		super(ctx, 'jobs');
		/** @type {any[]} */
		this.programs = [];
	}

	/** Registers a program until the plugin that did goes; a name taken is refused. */
	register(program) {
		if (!/^[a-z][\w-]*$/u.test(String(program?.name ?? ''))) throw new TypeError(`程序名 ${program?.name} 不对：小写字母开头，字母、数字、- 和 _`);
		return this.ctx.effect(() => {
			if (this.get(program.name)) throw new Error(`程序 ${program.name} 已经有插件注册了`);
			this.programs.push(program);
			return () => {
				const index = this.programs.indexOf(program);
				if (index >= 0) this.programs.splice(index, 1);
			};
		}, `jobs.register(${program.name})`);
	}

	/** The program by this name; null when no plugin registered it. */
	get(name) {
		return this.programs.find((program) => program.name === String(name ?? '').toLowerCase()) ?? null;
	}

	/** Every program, by its `order` (100 when it has none), then as registered. */
	list() {
		return this.programs.map((program, index) => ({ program, index })).sort((left, right) => (left.program.order ?? 100) - (right.program.order ?? 100) || left.index - right.index).map(({ program }) => program);
	}
}
