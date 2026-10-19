import { Service, type Context } from '@deepseek-ai/cordis';

/** A block of an article written as a fence; each environment reads its own fields. */
export type Block = {
	name: string;
	fence: string | string[];
	/** The build: what its fence becomes in the page (mdast), or nothing to leave it. */
	remark?: (node: { type: 'code'; lang?: string | null; meta?: string | null; value: string; position?: unknown }, file: { path?: string; message(reason: string, options?: unknown): unknown }) => unknown;
	[key: string]: unknown;
};

export declare class Blocks extends Service {
	constructor(ctx: Context);
	readonly byFence: Map<string, Block>;
	register<B extends Block>(block: B): () => Promise<void>;
	get(fence: string | null | undefined): Block | null;
	list(): Block[];
	fences(): string[];
}

declare module '@deepseek-ai/cordis' {
	interface Context {
		blocks: Blocks;
	}
}
