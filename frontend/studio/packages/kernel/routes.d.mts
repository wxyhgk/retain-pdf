import { Service, type Context } from '@deepseek-ai/cordis';

/** What a plugin's handler is given about the request. */
export type RouteRequest = {
	params: Record<string, string>;
	query: URLSearchParams;
	/** The body, read as JSON (its Content-Type was checked). */
	json<T = any>(): Promise<T>;
	request: import('node:http').IncomingMessage;
};

export type RouteHandler = (request: RouteRequest) => unknown;

export declare class Routes extends Service {
	constructor(ctx: Context);
	register(method: string, path: string, handler: RouteHandler): () => Promise<void>;
	get(path: string, handler: RouteHandler): () => Promise<void>;
	post(path: string, handler: RouteHandler): () => Promise<void>;
	put(path: string, handler: RouteHandler): () => Promise<void>;
	match(method: string, path: string): { handler: RouteHandler; params: Record<string, string> } | null;
}

export declare function created<T>(value: T): { value: T };
export declare function readAnswer(answer: unknown): { status: 200 | 201; value: unknown };

declare module '@deepseek-ai/cordis' {
	interface Context {
		routes: Routes;
	}
}
