export declare const JOB_LANGUAGE: 'job';
export declare const JOB_PROGRAMS: readonly ['xtb', 'crest'];
export type JobProgram = 'xtb' | 'crest';
export declare const JOB_ID_PATTERN: RegExp;
export declare const RUN_NAME_PATTERN: RegExp;
export declare const JOBS_FOLDER: 'assets/jobs';
export declare const STRUCTURE_EXTENSIONS: readonly string[];

export type JobStructure =
	| { kind: 'none' }
	| { kind: 'inline'; text: string; format: 'xyz' | 'mol' }
	| { kind: 'file'; written: string; path: string | null };

export type JobFenceOptions = {
	id: string;
	program: string;
	args: string;
	host: string;
	threads: number;
	title: string;
	run: string;
	rest?: string[];
};

export declare function parseJobFence(meta: string | null | undefined, body: string | null | undefined): Required<JobFenceOptions> & { structure: JobStructure };
export declare function jobStructure(body: string | null | undefined): JobStructure;
export declare function jobFenceMeta(options: Partial<JobFenceOptions>): string;
export declare function runFolder(id: string, run: string): string;
export declare function runName(date?: Date): string;
export declare function newJobId(taken?: Iterable<string>, random?: () => number): string;

export type RunState = 'preparing' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'lost';
export declare const RUN_STATES: readonly RunState[];
export declare const FINISHED_STATES: readonly RunState[];
export declare const RUN_STATE_NAMES: Readonly<Record<RunState, string>>;
