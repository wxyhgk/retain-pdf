import { Fragment, useEffect, useState } from 'react';

import { Button } from '@studio/ui/button';
import { listVersions, readVersion } from '../../api/client';
import type { HistoryEntry, HistoryReason } from '../../types';
import { timeAgo } from '../../common/time-ago';
import { errorText, Frame, Status } from './Frame';
import { emptyLook, listLook, Row } from './TrashDialog';

/** What the history needs from the Studio around it. */
export type HistoryHost = {
	/** Brings this earlier version's body back, through review. */
	restore(source: string): void;
};

const REASONS: Record<HistoryReason, string> = {
	'before-change': '磁盘上改动之前',
	unsaved: '你没保存的改动',
	'before-restore': '恢复旧版本之前',
	edit: '自动存档',
};

/** The day a version was kept, as the list heads it: 今天, 昨天, or its date. */
function dayOf(time: number): string {
	const day = new Date(time).toDateString();
	const today = new Date();
	if (day === today.toDateString()) return '今天';
	if (day === new Date(today.getTime() - 24 * 60 * 60_000).toDateString()) return '昨天';
	return new Date(time).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function size(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * 历史版本: the versions of the article `slug` the Studio kept in its ai/history (every ten minutes of writing, before
 * a change on disk or a restore; see article-history.mjs), by day, each to compare with what is there now and bring
 * back, through review.
 */
export function HistoryDialog({ slug, host, onClose }: { slug: string; host: HistoryHost; onClose(): void }) {
	const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
	const [status, setStatus] = useState({ text: '', error: false });

	useEffect(() => {
		listVersions(slug).then(setEntries, (error: unknown) => {
			setStatus({ text: errorText(error, '读不到历史版本'), error: true });
			setEntries([]);
		});
	}, [slug]);

	async function choose(entry: HistoryEntry): Promise<void> {
		try {
			const source = await readVersion(slug, entry.name);
			onClose();
			host.restore(source);
		} catch (error) {
			setStatus({ text: errorText(error, '读不到这个版本'), error: true });
		}
	}

	return (
		<Frame id="history-dialog" title="历史版本" description="写作时每 10 分钟自动存一份，存在文章的 ai/history 里，不会发布" className="sm:max-w-[600px]" onClose={onClose}>
			<ul id="history-list" className={listLook}>
				{entries?.map((entry, at) => (
					<Fragment key={entry.name}>
						{(at === 0 || dayOf(entries[at - 1]!.time) !== dayOf(entry.time)) && <li className="trash-day px-2 pt-2.5 pb-0.5 text-xs font-semibold text-muted-foreground">{dayOf(entry.time)}</li>}
						<Row icon="↺" name={REASONS[entry.reason]} where={`${new Date(entry.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · ${timeAgo(entry.time)} · ${size(entry.size)}`}>
							<Button type="button" variant="outline" size="xs" onClick={() => void choose(entry)}>
								对比并恢复
							</Button>
						</Row>
					</Fragment>
				))}
				{entries?.length === 0 && <li className={emptyLook}>还没有历史版本。写作时每 10 分钟自动存一份；终端、AI 或别的编辑器改动这篇文章前，也会先把原来的存在这里。</li>}
			</ul>
			<Status id="history-status" {...status} />
		</Frame>
	);
}
