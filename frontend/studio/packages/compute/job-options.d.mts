import type { JobProgram } from './job-fence.mjs';

export type Solvent = { model: 'alpb' | 'gbsa'; name: string };

export type JobOptions = {
	task: string;
	method: string;
	/** An optimization's level: '' for xtb's default. */
	level: string;
	charge: number;
	uhf: number;
	solvent: Solvent | null;
	/** CREST's energy window, kcal/mol; null for its default. */
	ewin: number | null;
	/** The words of the command line the form does not know, as written. */
	extra: string[];
};

export declare const XTB_TASKS: Readonly<Record<'sp' | 'opt' | 'hess' | 'ohess', { name: string; flag: string }>>;
export declare const CREST_TASKS: Readonly<Record<'conformers', { name: string; flag: string }>>;
export declare const XTB_METHODS: Readonly<Record<string, string>>;
export declare const CREST_METHODS: Readonly<Record<string, string>>;
export declare const OPT_LEVELS: readonly string[];
export declare const SOLVENTS: Readonly<Record<string, string>>;
export declare const DEFAULT_OPTIONS: Readonly<Record<JobProgram, JobOptions>>;

export declare function splitArgs(text: string): string[];
export declare function joinArgs(words: string[]): string;
export declare function readJobOptions(program: JobProgram | string, args: string): JobOptions;
export declare function writeJobArgs(program: JobProgram | string, options: JobOptions): string;
export declare function threadArgs(program: JobProgram | string, args: string, threads: number): string[];
export declare function jobCommand(program: JobProgram | string, args: string, input: string, threads: number): string[];
export declare function outputFile(program: JobProgram | string): string;
export declare function describeJob(program: JobProgram | string, options: JobOptions): string;
