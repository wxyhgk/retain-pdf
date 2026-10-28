import { t } from '@blog/i18n/index.mjs';

/**
 * The Studio and its windows of their own (显示方式 › 新窗口: a 小程序 or the AI, out of the Studio's window, on another
 * screen, beside other programs — StudioWindow.astro), talking over a BroadcastChannel of their origin: a window asks
 * what only the Studio can do (the article open, its selection, putting something in it, opening a page…), the Studio
 * answers; the Studio tells the windows what changed (the notes, the article open). A window opened or shut says so.
 */
const CHANNEL = 'studio-windows';
/** A call not taken up this soon: no Studio is open to answer it. */
const PATIENCE = 3000;

type Message =
	| { type: 'call'; from: string; id: number; method: string; args: unknown[] }
	| { type: 'ack' | 'answer'; to: string; id: number; result?: unknown; error?: string }
	| { type: 'event'; event: string; [more: string]: unknown }
	| { type: 'window'; from: string; what: 'hello' | 'bye'; kind: string };

/** The Studio's end: each call answered by `answer`; what to tell the windows, and what they say of themselves. */
export function answerWindows(answer: (method: string, args: unknown[]) => Promise<unknown>) {
	const channel = new BroadcastChannel(CHANNEL);
	const said = new Set<(message: { what: 'hello' | 'bye'; kind: string; from: string }) => void>();
	channel.onmessage = (event: MessageEvent<Message>) => {
		const data = event.data;
		if (data?.type === 'window') for (const listener of said) listener(data);
		if (data?.type !== 'call') return;
		channel.postMessage({ type: 'ack', to: data.from, id: data.id } satisfies Message);
		answer(data.method, Array.isArray(data.args) ? data.args : []).then(
			(result) => channel.postMessage({ type: 'answer', to: data.from, id: data.id, result } satisfies Message),
			(error: unknown) => channel.postMessage({ type: 'answer', to: data.from, id: data.id, error: error instanceof Error ? error.message : String(error) } satisfies Message),
		);
	};
	return {
		/** Something for every window: `event` and what goes with it. */
		tell(event: string, more: Record<string, unknown> = {}): void {
			channel.postMessage({ type: 'event', event, ...more } satisfies Message);
		},
		/** A window opened (`hello`) or shut (`bye`), and what it shows (`app:<id>`, `ai`). */
		heard(listener: (message: { what: 'hello' | 'bye'; kind: string; from: string }) => void): () => void {
			said.add(listener);
			return () => said.delete(listener);
		},
	};
}

/** A window's end: its calls to the Studio, what the Studio tells it; it says it is here (`kind`), and when it goes. */
export function studioLine(kind: string) {
	const me = `${kind}:${Math.random().toString(36).slice(2)}`;
	const channel = new BroadcastChannel(CHANNEL);
	let asked = 0;
	const waiting = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: number }>();
	const listeners = new Set<(event: string, data: Record<string, unknown>) => void>();
	channel.onmessage = (event: MessageEvent<Message>) => {
		const data = event.data;
		if (data?.type === 'event') {
			for (const listener of listeners) listener(data.event, data);
			return;
		}
		if ((data?.type !== 'ack' && data?.type !== 'answer') || data.to !== me) return;
		const call = waiting.get(data.id);
		if (!call) return;
		// Taken up: however long it takes now (a command run), it is answered.
		clearTimeout(call.timer);
		if (data.type === 'ack') return;
		waiting.delete(data.id);
		if (data.error !== undefined) call.reject(new Error(data.error));
		else call.resolve(data.result);
	};
	const say = (what: 'hello' | 'bye') => channel.postMessage({ type: 'window', from: me, what, kind } satisfies Message);
	say('hello');
	addEventListener('pagehide', () => say('bye'));
	return {
		call<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
			return new Promise<T>((resolve, reject) => {
				const id = ++asked;
				const timer = window.setTimeout(() => {
					waiting.delete(id);
					reject(new Error(t('Studio 没有开着：这个窗口要 Studio 开着才能用')));
				}, PATIENCE);
				waiting.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
				channel.postMessage({ type: 'call', from: me, id, method, args } satisfies Message);
			});
		},
		/** What the Studio tells the windows. */
		on(listener: (event: string, data: Record<string, unknown>) => void): void {
			listeners.add(listener);
		},
	};
}
