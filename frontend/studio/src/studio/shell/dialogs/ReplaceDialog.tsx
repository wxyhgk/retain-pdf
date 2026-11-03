import { useRef, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { Input } from '@studio/ui/input';
import { findInArticles, replaceInArticles, type FoundIn } from '../../api/client';
import { trackWrite } from '../../state/writes';
import { Actions, errorText, Frame, Status } from './Frame';
import { emptyLook, listLook } from './TrashDialog';

/** What 查找替换 needs from the Studio around it, and the words it is opened with (those found in the article, say). */
export type ReplaceAsk = {
	round: number;
	find?: string;
	/** What is typed in the open article saved first: it is looked in as it is. */
	flush(): Promise<unknown>;
	/** These articles were changed (the one open among them is read again: chosen here, not to be reviewed again). */
	changed(slugs: string[]): Promise<unknown>;
	open(slug: string): void;
};

const key = (slug: string, index: number) => `${slug}:${index}`;

/**
 * 查找替换 in all the articles (as SiYuan's): what is found is listed first, every place with the words round it and what
 * it would become, each ticked; only those ticked are changed, each article's text kept in its 历史版本 first. By default
 * case is not minded, and code, formulas and where links lead are left out.
 */
export function ReplaceDialog({ ask, onClose }: { ask: ReplaceAsk; onClose(): void }) {
	const [find, setFind] = useState(ask.find ?? '');
	const [replacement, setReplacement] = useState('');
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [skipCode, setSkipCode] = useState(true);
	const [results, setResults] = useState<FoundIn[] | null>(null);
	/** What was looked for when `results` came (the places are those words' places). */
	const looked = useRef({ find: '', caseSensitive: false, skipCode: true });
	const [chosen, setChosen] = useState<Set<string>>(new Set());
	const [status, setStatus] = useState({ text: '', error: false });
	const [busy, setBusy] = useState(false);
	const findField = useRef<HTMLInputElement>(null);
	const say = (text: string, error = false) => setStatus({ text, error });

	async function search(): Promise<void> {
		if (!find.trim()) return;
		setBusy(true);
		try {
			await ask.flush();
			const options = { caseSensitive, skipCode };
			const { results: found } = await findInArticles(find, options);
			looked.current = { find, ...options };
			setResults(found);
			setChosen(new Set(found.flatMap((article) => article.matches.map((_, index) => key(article.slug, index)))));
			const places = found.reduce((sum, article) => sum + article.matches.length, 0);
			say(found.length ? t('{count} 个页面里有 {places} 处', { count: found.length, places }) : '');
		} catch (error) {
			say(errorText(error, t('没能查找')), true);
		} finally {
			setBusy(false);
		}
	}

	async function replace(): Promise<void> {
		if (!results || !chosen.size) return;
		const picks: Record<string, { revision: string; indexes: number[] }> = {};
		for (const article of results) {
			const indexes = article.matches.map((_, index) => index).filter((index) => chosen.has(key(article.slug, index)));
			if (indexes.length) picks[article.slug] = { revision: article.revision, indexes };
		}
		setBusy(true);
		try {
			await ask.flush();
			const { find: words, ...options } = looked.current;
			// The open one read again within: the disk's change is then not someone else's, to review.
			const done = await trackWrite(async () => {
				const answer = await replaceInArticles(words, replacement, picks, options);
				await ask.changed(answer.changed.map((article) => article.slug));
				return answer;
			});
			const places = done.changed.reduce((sum, article) => sum + article.count, 0);
			const left = done.skipped.map((article) => t('「{title}」{why}，没有改', { title: article.title, why: article.why })).join('；');
			say(t('已替换 {count} 个页面里的 {places} 处；每篇改之前的样子在它的「历史版本」里', { count: done.changed.length, places }) + (left ? `。${left}` : ''), Boolean(left));
			// What is left of those words, looked for again.
			const { results: found } = await findInArticles(words, options);
			setResults(found);
			setChosen(new Set());
		} catch (error) {
			say(errorText(error, t('没能替换')), true);
		} finally {
			setBusy(false);
		}
	}

	const toggle = (keys: string[], on: boolean) =>
		setChosen((before) => {
			const next = new Set(before);
			for (const each of keys) {
				if (on) next.add(each);
				else next.delete(each);
			}
			return next;
		});

	return (
		<Frame id="replace-dialog" title={t('查找替换')} description={t('在全部页面里找，先列出每一处，勾选的才换；每篇改之前存一份历史版本')} className="sm:max-w-[720px]" onClose={onClose} focus={() => findField.current}>
			<form
				className="grid gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					void search();
				}}
			>
				<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
					<Input id="replace-find" ref={findField} placeholder={t('查找')} value={find} onChange={(event) => setFind(event.target.value)} />
					<Input id="replace-with" placeholder={t('替换为')} value={replacement} onChange={(event) => setReplacement(event.target.value)} />
					<Button type="submit" size="sm" variant="outline" disabled={busy || !find.trim()}>
						{t('查找')}
					</Button>
				</div>
				<div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
					<label className="flex items-center gap-1.5">
						<input id="replace-case" type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />
						{t('区分大小写')}
					</label>
					<label className="flex items-center gap-1.5">
						<input id="replace-skip-code" type="checkbox" checked={skipCode} onChange={(event) => setSkipCode(event.target.checked)} />
						{t('不改代码、公式和链接地址')}
					</label>
				</div>
			</form>
			<ul id="replace-results" className={listLook}>
				{results?.map((article) => {
					const keys = article.matches.map((_, index) => key(article.slug, index));
					const all = keys.every((each) => chosen.has(each));
					return (
						<li key={article.slug} className="replace-article grid gap-0.5 py-1">
							<div className="flex items-center gap-2 px-2 text-[13px]">
								<input type="checkbox" aria-label={t('「{title}」的全部', { title: article.title })} checked={all} onChange={(event) => toggle(keys, event.target.checked)} />
								<button type="button" className="replace-title truncate font-medium hover:underline" onClick={() => ask.open(article.slug)}>
									{article.icon ? `${article.icon} ` : ''}
									{article.title}
								</button>
								<span className="text-xs text-muted-foreground">{t('{count} 处', { count: article.matches.length })}</span>
							</div>
							{article.matches.map((match, index) => (
								<label key={index} className="replace-place grid grid-cols-[16px_auto_minmax(0,1fr)] items-baseline gap-2 rounded-md px-2 py-0.5 pl-6 text-xs hover:bg-muted">
									<input type="checkbox" checked={chosen.has(key(article.slug, index))} onChange={(event) => toggle([key(article.slug, index)], event.target.checked)} />
									<span className="text-xs text-muted-foreground tabular-nums">{t('第 {line} 行', { line: match.line })}</span>
									<span className="truncate">
										{match.before}
										<del className="bg-[var(--studio-fill-3)] text-muted-foreground">{match.text}</del>
										<ins className="font-medium no-underline">{replacement}</ins>
										{match.after}
									</span>
								</label>
							))}
						</li>
					);
				})}
				{results?.length === 0 && <li className={emptyLook}>{t('没有找到')}</li>}
			</ul>
			<Status id="replace-status" {...status} />
			<Actions>
				<Button id="replace-apply" type="button" size="sm" disabled={busy || !chosen.size} onClick={() => void replace()}>
					{t('替换勾选的 {count} 处', { count: chosen.size })}
				</Button>
			</Actions>
		</Frame>
	);
}
