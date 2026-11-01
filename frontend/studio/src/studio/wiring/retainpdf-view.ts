// 翻译 (the left column): RetainPDF's own pages (the books, translating them, reading them) in the middle, in a frame.
// Where they are is a setting (设置 › RetainPDF, server/retainpdf-settings.mjs). Nothing is loaded until the view is
// first shown; the frame stays when another view is shown, so coming back finds it as it was left.
//
// The two talk by postMessage, as RetainPDF's contract studio-bridge.v1 says: its pages are loaded with
// `embed=studio`; each time the frame loads, the Studio says `hello` (light or dark) and RetainPDF answers `ready`
// with what it handles. Then `theme` follows the Studio's, `navigate` shows a passage, and RetainPDF's `quote` (摘到笔记)
// is handed to the Studio. Only messages from this frame, from the address set, are taken.
import { t } from '@blog/i18n/index.mjs';
import { retainpdfSettings } from '../api/client';
import type { RetainpdfTarget } from '../editor/retainpdf-quote';

export const BRIDGE_PROTOCOL = 'retainpdf-studio-bridge';

/** RetainPDF's 摘到笔记: a passage, its text as it is now (studio-bridge.v1 `QuoteMessage`). */
export type RetainpdfQuote = {
	job_id: string;
	document_id: string | null;
	title: string | null;
	item_id: string;
	page_idx: number;
	source_text: string | null;
	translated_text: string | null;
};

export type RetainpdfViewHost = {
	/** 设置 › RetainPDF, to change the address. */
	openSettings(): void;
	/** RetainPDF quoted a passage (摘到笔记). */
	quote(quote: RetainpdfQuote): void;
};

/** Whether anything answers at `url`: RetainPDF's pages are another origin, so only that it answered, not what. */
async function answers(url: string): Promise<boolean> {
	try {
		await fetch(url, { mode: 'no-cors', cache: 'no-store' });
		return true;
	} catch {
		return false;
	}
}

/** RetainPDF's page at `url`, told it is in the Studio. */
export function embedded(url: string, search: Record<string, string | number> = {}): string {
	const address = new URL(url);
	for (const [key, value] of Object.entries(search)) address.searchParams.set(key, String(value));
	address.searchParams.set('embed', 'studio');
	return address.href;
}

const theme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

const isQuote = (message: Record<string, unknown>): boolean =>
	typeof message.job_id === 'string' && !!message.job_id && typeof message.item_id === 'string' && !!message.item_id && Number.isInteger(message.page_idx) && (message.page_idx as number) >= 0;

export function createRetainpdfView(view: HTMLElement, host: RetainpdfViewHost) {
	const frame = document.createElement('iframe');
	frame.id = 'retainpdf-frame';
	frame.title = 'RetainPDF';
	frame.hidden = true;
	const unreachable = document.createElement('div');
	unreachable.id = 'retainpdf-unreachable';
	unreachable.className = 'translate-unreachable';
	unreachable.setAttribute('role', 'status');
	unreachable.hidden = true;
	view.append(frame, unreachable);
	/** The address set that the frame shows (its pages, wherever in them it went); empty while it shows nothing. */
	let shown = '';
	/** What RetainPDF said it handles, once it answered this load's `hello`; null before. */
	let features: Set<string> | null = null;
	/** Being shown: asked again meanwhile, the same. */
	let showing: Promise<void> | null = null;

	function post(message: Record<string, unknown>): void {
		if (!shown) return;
		frame.contentWindow?.postMessage({ protocol: BRIDGE_PROTOCOL, v: 1, ...message }, new URL(shown).origin);
	}

	frame.addEventListener('load', () => {
		features = null;
		post({ type: 'hello', theme: theme() });
	});
	window.addEventListener('message', (event) => {
		if (!shown || event.source !== frame.contentWindow || event.origin !== new URL(shown).origin) return;
		const message = event.data as Record<string, unknown> | null;
		if (!message || typeof message !== 'object' || message.protocol !== BRIDGE_PROTOCOL || message.v !== 1) return;
		if (message.type === 'ready') features = new Set(Array.isArray(message.features) ? message.features.filter((each): each is string => typeof each === 'string') : []);
		else if (message.type === 'quote' && features && isQuote(message)) host.quote(message as unknown as RetainpdfQuote);
	});
	window.addEventListener('themechange', () => {
		if (features?.has('theme')) post({ type: 'theme', theme: theme() });
	});

	function cannot(text: string, url: string): void {
		shown = '';
		features = null;
		frame.hidden = true;
		frame.removeAttribute('src');
		const line = document.createElement('p');
		line.textContent = text;
		const address = document.createElement('code');
		address.textContent = url;
		const buttons = document.createElement('div');
		const retry = document.createElement('button');
		retry.type = 'button';
		retry.textContent = t('重试');
		retry.addEventListener('click', () => void show());
		const change = document.createElement('button');
		change.type = 'button';
		change.textContent = t('改地址');
		change.addEventListener('click', () => host.openSettings());
		buttons.className = 'translate-unreachable-actions';
		buttons.append(retry, change);
		unreachable.replaceChildren(line, address, buttons);
		unreachable.hidden = false;
	}

	/** Shown (again): the pages at the address set, loaded when it changed or nothing is shown yet. */
	function show(): Promise<void> {
		showing ??= (async () => {
			let url: string;
			try {
				url = (await retainpdfSettings()).url;
			} catch (error) {
				cannot(t('读不到 RetainPDF 的地址：{error}', { error: error instanceof Error ? error.message : String(error) }), '');
				return;
			}
			if (url === shown) return;
			if (!(await answers(url))) {
				cannot(t('连不上 RetainPDF：先打开 RetainPDF，或者改一下它的地址'), url);
				return;
			}
			unreachable.hidden = true;
			frame.hidden = false;
			shown = url;
			features = null;
			frame.src = embedded(url);
		})().finally(() => {
			showing = null;
		});
		return showing;
	}

	/**
	 * A passage shown: told to RetainPDF when it handles `navigate`, else its reader opened there (the address it has
	 * always taken, so a RetainPDF without the bridge goes there too).
	 */
	async function navigate(target: RetainpdfTarget): Promise<void> {
		await show();
		if (!shown) return;
		if (features?.has('navigate')) {
			post({ type: 'navigate', ...target });
			return;
		}
		const search: Record<string, string | number> = { job_id: target.job_id };
		if (target.page_idx !== undefined) search.page_idx = target.page_idx;
		if (target.block_id) search.block_id = target.block_id;
		frame.src = embedded(new URL('reader.html', shown).href, search);
	}

	return { show, navigate };
}
