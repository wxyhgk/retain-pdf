// 翻译 (the left column): RetainPDF's own pages (the books, translating them, reading them) in the middle, as they
// are, in a frame. Where they are is a setting (设置 › RetainPDF, server/retainpdf-settings.mjs). Nothing is loaded
// until the view is first shown; the frame stays when another view is shown, so coming back finds it as it was left.
import { t } from '@blog/i18n/index.mjs';
import { retainpdfSettings } from '../api/client';

export type RetainpdfViewHost = {
	/** 设置 › RetainPDF, to change the address. */
	openSettings(): void;
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
	/** The address the frame shows; empty while it shows nothing. */
	let shown = '';

	function cannot(text: string, url: string): void {
		shown = '';
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
	async function show(): Promise<void> {
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
		frame.src = url;
		shown = url;
	}

	return { show };
}
