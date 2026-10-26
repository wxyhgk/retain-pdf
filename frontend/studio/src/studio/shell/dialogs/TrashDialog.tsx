import { useEffect, useState, type ReactNode } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { listTrash, purgeTrash, restoreArticle, restoreArticleFile } from '../../api/client';
import { trackWrite } from '../../state/writes';
import type { TrashEntry } from '../../types';
import { timeAgo } from '../../common/time-ago';
import { errorText, Frame, Status } from './Frame';

/** What the trash needs from the Studio around it. */
export type TrashHost = {
	/** A whole article is back. */
	articleRestored(slug: string): void;
	/** A file or folder of an article is back. */
	fileRestored(slug: string, path: string): void;
};

/** A line of a list of things to bring back (the trash's, the history's): an icon, what it is, where and when, its buttons. */
export function Row({ icon, name, where, children }: { icon: string; name: string; where: string; children: ReactNode }) {
	return (
		<li className="trash-item grid grid-cols-[22px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
			<span className="trash-icon text-center text-[15px] text-muted-foreground">{icon}</span>
			<span className="grid min-w-0 gap-px">
				<span className="trash-name truncate text-[13px]">{name}</span>
				<span className="trash-where truncate text-[11px] text-muted-foreground">{where}</span>
			</span>
			{children}
		</li>
	);
}

/** Where a deleted thing was, and when it was deleted. */
function whereOf(entry: TrashEntry): string {
	const time = timeAgo(entry.deletedAt);
	if (entry.kind === 'article') return t('文章 · blog/{slug}/ · {time}删除', { slug: entry.slug, time });
	if (entry.kind === 'directory') return t('{slug} 的文件夹 · {time}删除', { slug: entry.slug, time });
	return t('{slug} 的文件 · {time}删除', { slug: entry.slug, time });
}

export const listLook = 'grid max-h-[min(56vh,460px)] gap-0.5 overflow-y-auto';
export const emptyLook = 'trash-empty px-2 py-[22px] text-center text-[13px] text-muted-foreground';

/** 回收站: what was deleted in the last 30 days, to put back or delete for good. */
export function TrashDialog({ host, onClose }: { host: TrashHost; onClose(): void }) {
	const [entries, setEntries] = useState<TrashEntry[] | null>(null);
	const [status, setStatus] = useState({ text: '', error: false });
	const say = (text: string, error = false) => setStatus({ text, error });

	async function load(): Promise<void> {
		try {
			setEntries(await listTrash());
		} catch (error) {
			say(errorText(error, t('读不到回收站')), true);
		}
	}
	useEffect(() => void load(), []);

	async function restore(entry: TrashEntry): Promise<void> {
		try {
			if (entry.kind === 'article') {
				const { slug } = await trackWrite(() => restoreArticle(entry.trashed));
				host.articleRestored(slug);
				say(t('已恢复「{title}」', { title: entry.title ?? slug }));
			} else {
				const { path } = await trackWrite(() => restoreArticleFile(entry.slug, entry.trashed));
				host.fileRestored(entry.slug, path);
				say(t('已恢复 {slug}/{path}', { slug: entry.slug, path }));
			}
		} catch (error) {
			say(errorText(error, t('恢复失败')), true);
		}
		await load();
	}

	async function purge(entry: TrashEntry): Promise<void> {
		const title = entry.title ?? entry.slug;
		const path = `${entry.slug}/${entry.path}`;
		const article = entry.kind === 'article';
		if (!window.confirm(article ? t('彻底删除文章「{title}」？\n删除后不能再恢复。', { title }) : t('彻底删除{path}？\n删除后不能再恢复。', { path }))) return;
		try {
			await purgeTrash(entry.trashed);
			say(article ? t('已彻底删除文章「{title}」', { title }) : t('已彻底删除{path}', { path }));
		} catch (error) {
			say(errorText(error, t('删除失败')), true);
		}
		await load();
	}

	return (
		<Frame id="trash-dialog" title={t('回收站')} description={t('删除的文章和文件保留 30 天')} className="sm:max-w-[600px]" onClose={onClose}>
			<ul id="trash-list" className={listLook}>
				{entries?.map((entry) => (
					<Row
						key={entry.trashed}
						icon={entry.kind === 'article' ? entry.icon || '▤' : entry.kind === 'directory' ? '▸' : '▫'}
						name={entry.kind === 'article' ? (entry.title ?? entry.slug) : (entry.path ?? '')}
						where={whereOf(entry)}
					>
						<Button type="button" variant="outline" size="xs" onClick={() => void restore(entry)}>
							{t('恢复')}
						</Button>
						<Button type="button" variant="outline" size="xs" className="text-destructive hover:text-destructive" onClick={() => void purge(entry)}>
							{t('彻底删除')}
						</Button>
					</Row>
				))}
				{entries?.length === 0 && <li className={emptyLook}>{t('回收站是空的。删除的文章和文件会在这里保留 30 天。')}</li>}
			</ul>
			<Status id="trash-status" {...status} />
		</Frame>
	);
}
