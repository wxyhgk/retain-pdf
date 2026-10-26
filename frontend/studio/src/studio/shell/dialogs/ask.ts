import { t } from '@blog/i18n/index.mjs';
import { aiSettings, listAgents, localeSettings, type AiSettingsShown } from '../../api/client';
import { showToast } from '../../common/toast';
import type { ArticleIssue } from '../../types';
import type { CiteHost } from './CiteDialog';
import { openDialog } from './Dialogs';
import type { Picked, QuickFindHost } from './QuickFindDialog';

// What the rest of the Studio asks through the dialogs: each opened with what it shows, answering when it is closed.

/** Ready to ask: a key there and, for an OpenAI-compatible service, its address and model. */
export function aiReady(settings: AiSettingsShown): boolean {
	return settings.hasKey && (settings.provider === 'anthropic' || Boolean(settings.baseUrl && settings.model));
}

/**
 * 「AI 设置」 (shell/dialogs/AiSettingsDialog.tsx) opened as they are, saying `why` above (when it is opened for want of a
 * setting); resolves with the settings saved, or null.
 */
export async function openAiSettings(why = ''): Promise<AiSettingsShown | null> {
	const shown = await aiSettings();
	return new Promise((done) => openDialog('aiSettings', { shown, why, done }));
}

/** 「AI 助手」 (shell/dialogs/AgentsDialog.tsx) opened with the AIs as they are; `saved` once the list is saved. */
export async function openAgents(saved: () => void): Promise<void> {
	try {
		openDialog('agents', { shown: await listAgents(), saved });
	} catch (error) {
		showToast(error instanceof Error ? error.message : t('读不到 AI 助手的设置'), true);
	}
}

/**
 * Whether to publish with what the check before publishing found (shell/dialogs/AskDialogs.tsx): at once when it found
 * nothing.
 */
export function confirmPublish(issues: ArticleIssue[]): Promise<boolean> {
	if (!issues.length) return Promise.resolve(true);
	return new Promise((done) => openDialog('publishCheck', { issues, done }));
}

/** The finder asked last (one at a time): given up when another is asked for. */
let round = 0;
let givenUp: (() => void) | null = null;

/** ⌘K, and the questions asked through it (shell/dialogs/QuickFindDialog.tsx): which article to link, where pages go. */
export function createQuickFind(host: QuickFindHost) {
	function ask<T>(mode: 'pick' | 'place', more: { excluded?: Set<string>; placeholder?: string } = {}): Promise<T | null> {
		givenUp?.();
		return new Promise((resolve) => {
			let answered = false;
			const done = (answer: T | null) => {
				if (answered) return;
				answered = true;
				givenUp = null;
				resolve(answer);
			};
			givenUp = () => done(null);
			openDialog('finder', { round: ++round, host, mode, ...more, done } as never);
		});
	}

	return {
		/** ⌘K: finds an article or a file of the drive; open already, its words selected to be typed over. */
		open(): void {
			const field = document.querySelector<HTMLInputElement>('#quick-find-dialog #quick-find-input');
			if (field && !givenUp) {
				field.select();
				return;
			}
			givenUp?.();
			openDialog('finder', { round: ++round, host, mode: 'find' });
		},
		/**
		 * 移到…: asks where these pages go, by a page's title (each shown with its path): that page's folder name, `''`
		 * for the top, null when given up. Not among the pages moved, nor under them.
		 */
		pickPlace(moving: string[]): Promise<string | null> {
			const all = host.articles();
			const excluded = new Set(moving);
			// And all under them.
			for (let grew = true; grew; ) {
				grew = false;
				for (const article of all) {
					if (article.parent && excluded.has(article.parent) && !excluded.has(article.slug)) {
						excluded.add(article.slug);
						grew = true;
					}
				}
			}
			return ask<string>('place', { excluded, placeholder: moving.length > 1 ? t('把 {count} 个页面移到哪个页面下面…', { count: moving.length }) : t('移到哪个页面下面…') });
		},
		/** Asks which article: one there is, a new one to make (its title typed), or null when given up. */
		pick: (): Promise<Picked | null> => ask<Picked>('pick'),
	};
}

/** The work to cite, asked when `[@` is typed (shell/dialogs/CiteDialog.tsx). */
export function createCitePicker(host: CiteHost) {
	let round = 0;
	let givenUp: (() => void) | null = null;
	return {
		/** Asks which work to cite: its key, or null when given up. */
		pick(): Promise<string | null> {
			givenUp?.();
			return new Promise((resolve) => {
				const done = (key: string | null) => {
					givenUp = null;
					resolve(key);
				};
				givenUp = () => done(null);
				openDialog('cite', { round: ++round, host, done });
			});
		},
	};
}

/** 语言 (shell/dialogs/LocaleDialog.tsx), opened with what is chosen and what there is. */
export async function openLocale(): Promise<void> {
	try {
		openDialog('locale', { shown: await localeSettings() });
	} catch (error) {
		showToast(error instanceof Error ? error.message : t('读不到语言设置'), true);
	}
}
