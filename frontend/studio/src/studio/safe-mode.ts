import { t } from '@blog/i18n/index.mjs';

/**
 * 安全模式: the Studio opened without its plugins, so that whatever they have become (an edit by hand or by an AI that
 * broke one), the articles can be written. Asked for by `?safe` in the address, or taken by itself when the Studio did
 * not finish starting twice running (counted in this browser, a start finished once the article is shown). A bar says so,
 * and how to start as usual again.
 */

const STARTS = 'studio.unfinishedStarts';
/** Starts that did not finish, this many in a row and this recent: the next is safe. */
const TRIES = 2;
const RECENT = 5 * 60 * 1000;

export type SafeMode = { safe: boolean; why: 'asked' | 'unfinished' | 'rescue' | null };

/** Whether this start is safe; counted as begun (startFinished counts it done). */
export function safeModeNow(): SafeMode {
	const asked = new URL(window.location.href).searchParams.get('safe');
	// Opened by Studio.app from the last good version, its own code broken (?safe=rescue).
	if (asked === 'rescue') return { safe: true, why: 'rescue' };
	if (asked !== null) return { safe: true, why: 'asked' };
	let unfinished = 0;
	try {
		const kept = JSON.parse(localStorage.getItem(STARTS) ?? 'null') as { count: number; at: number } | null;
		if (kept && Date.now() - kept.at < RECENT) unfinished = kept.count;
		localStorage.setItem(STARTS, JSON.stringify({ count: unfinished + 1, at: Date.now() }));
	} catch {
		// No storage (a private window): not counted, the start is as usual.
	}
	return unfinished >= TRIES ? { safe: true, why: 'unfinished' } : { safe: false, why: null };
}

/** The start finished (the article shown): not counted against the next. */
export function startFinished(): void {
	try {
		localStorage.removeItem(STARTS);
	} catch {
		// Not counted.
	}
}

/** The bar saying the Studio is in 安全模式, and its button to start as usual. */
export function showSafeModeBar(mode: SafeMode): void {
	if (!mode.safe) return;
	const bar = document.createElement('div');
	bar.id = 'safe-mode-bar';
	bar.setAttribute('role', 'status');
	const words = document.createElement('span');
	words.textContent = mode.why === 'rescue'
		? t('安全启动：Studio 自己的代码改坏了，现在用的是上次能正常启动的版本，插件也没载入。页面照常写、照常保存；代码修好后关掉 Studio 再打开。')
		: mode.why === 'unfinished'
			? t('安全模式：前两次都没能启动完，这次没有载入插件。可以照常写；插件哪里坏了，在「插件」里看。')
			: t('安全模式：这次没有载入插件，可以照常写。');
	const usual = document.createElement('button');
	usual.type = 'button';
	usual.textContent = t('正常启动');
	usual.addEventListener('click', () => {
		const url = new URL(window.location.href);
		url.searchParams.delete('safe');
		startFinished();
		window.location.href = url.href;
	});
	// From the last good version the usual start is the broken one: Studio.app opened again, once it is mended.
	bar.append(words, ...(mode.why === 'rescue' ? [] : [usual]));
	document.body.append(bar);
}
