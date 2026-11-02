import { Service, type Context } from '@blog/kernel/index.mjs';

/**
 * One field of a program's form: a choice or a number, read from its
 * options and written back into them (which its `write` makes the command line).
 */
export type ProgramField<O = any> = {
	key: string;
	label: string;
	kind: 'select' | 'number';
	/** A choice's values and labels, for these options. */
	choices?: (options: O) => Array<[string, string]>;
	min?: number;
	max?: number;
	step?: number;
	placeholder?: string;
	/** Shown only when this says so (the optimization's level only for an optimization). */
	shown?: (options: O) => boolean;
	get(options: O): string;
	set(options: O, value: string): O;
};

/** A program, as every environment has it. */
export type JobProgram<O = any> = {
	name: string;
	label: string;
	/** Where it comes in lists and menus, the smaller first (100 when not given). */
	order?: number;
	/** The command line a new block starts with. */
	starter: string;
	read(args: string): O;
	write(options: O): string;
	/** A line saying what the job does: 「结构优化 · GFN2-xTB · 水（ALPB）」. */
	describe(options: O): string;
	fields: Array<ProgramField<O>>;
	/** The words a run executes in its folder: the program (by its name), the input file, the command line, the threads. */
	command(input: string, args: string, threads: number): string[];
	/** The file its output goes to. */
	output: string;
	/** The files followed while it runs. */
	live: string[];
	/** Files it leaves that are no result (patterns as `ls` takes them). */
	scratch: string[];
	/** Other programs next to which it is looked for on a machine (xtb beside CREST). */
	beside?: string[];
};

export declare class JobPrograms extends Service {
	constructor(ctx: Context);
	readonly programs: JobProgram[];
	register<P extends JobProgram>(program: P): () => Promise<void>;
	get(name: string | null | undefined): JobProgram | null;
	list(): JobProgram[];
}

declare module '@deepseek-ai/cordis' {
	interface Context {
		jobs: JobPrograms;
	}
}
