import { useRef, type ReactNode } from 'react';

import { cn } from '@studio/lib/utils';
import { Button } from '@studio/ui/button';
import type { ArticleIssue } from '../../types';
import { Actions, Frame } from './Frame';

/** A list of what to know before saying yes: each line marked at its left, red for what stops it. */
function Notes({ id, children }: { id: string; children: ReactNode }) {
	return (
		<ul id={id} className="grid max-h-[min(50vh,360px)] gap-1.5 overflow-y-auto">
			{children}
		</ul>
	);
}
const noteLook = 'publish-check-item grid gap-2 rounded-[5px] border-l-[3px] border-l-muted-foreground bg-muted px-2.5 py-[7px] text-xs leading-[1.55] [overflow-wrap:anywhere]';

/** What the check before publishing found, and what the author decides (`done`: publish all the same, or not). */
export type PublishCheckAsk = { issues: ArticleIssue[]; done(publish: boolean): void };

/**
 * 发布前检查: what would stop the blog's build blocks publishing; what the page would only show broken may be published
 * all the same.
 */
export function PublishCheckDialog({ issues, done, onClose }: PublishCheckAsk & { onClose(): void }) {
	const cancel = useRef<HTMLButtonElement>(null);
	const errors = issues.filter((issue) => issue.severity === 'error').length;
	const answer = (publish: boolean) => {
		done(publish);
		onClose();
	};
	return (
		<Frame
			id="publish-check-dialog"
			title="发布前检查"
			description={<span id="publish-check-summary">{errors ? `${errors} 处问题会让博客构建失败（整个网站都发布不了），修好后再发布` : `${issues.length} 处问题会在页面上显示出错，可以先修好，也可以照样发布`}</span>}
			className="sm:max-w-[560px]"
			onClose={() => answer(false)}
			focus={() => cancel.current}
		>
			<Notes id="publish-check-list">
				{issues.map((issue, at) => (
					<li key={at} className={cn(noteLook, `is-${issue.severity}`, 'grid-cols-[52px_minmax(0,1fr)]', issue.severity === 'error' && 'border-l-destructive')}>
						<span className="pt-px text-[11px] text-muted-foreground tabular-nums">{issue.line ? `第 ${issue.line} 行` : '属性'}</span>
						{issue.message}
					</li>
				))}
			</Notes>
			<Actions>
				<Button id="publish-check-cancel" ref={cancel} type="button" variant="outline" size="sm" onClick={() => answer(false)}>
					{errors ? '知道了' : '先不发布'}
				</Button>
				{!errors && (
					<Button id="publish-anyway" type="button" size="sm" onClick={() => answer(true)}>
						仍然发布
					</Button>
				)}
			</Actions>
		</Frame>
	);
}

/** Pages to delete: `all` (with the pages under them), `lift` (they go up), or `cancel`. */
export type DeletePageChoice = 'all' | 'lift' | 'cancel';
export type DeletePageAsk = { title: string; summary: string; notes: string[]; deleteLabel: string; canLift: boolean; done(choice: DeletePageChoice): void };

/** Deleting pages: what goes with them, what links to them, and whether the pages under them go too. */
export function DeletePageDialog({ title, summary, notes, deleteLabel, canLift, done, onClose }: DeletePageAsk & { onClose(): void }) {
	const answer = (choice: DeletePageChoice) => {
		done(choice);
		onClose();
	};
	return (
		<Frame id="delete-page-dialog" title={<span id="delete-page-title">{title}</span>} description={<span id="delete-page-summary">{summary}</span>} className="sm:max-w-[560px]" onClose={() => answer('cancel')}>
			<Notes id="delete-page-notes">
				{notes.map((note) => (
					<li key={note} className={noteLook}>
						{note}
					</li>
				))}
			</Notes>
			<Actions>
				<Button type="button" variant="outline" size="sm" onClick={() => answer('cancel')}>
					取消
				</Button>
				{canLift && (
					<Button id="delete-page-lift" type="button" variant="outline" size="sm" onClick={() => answer('lift')}>
						只删这一篇，下面的移到上一级
					</Button>
				)}
				<Button id="delete-page-all" type="button" variant="destructive" size="sm" onClick={() => answer('all')}>
					{deleteLabel}
				</Button>
			</Actions>
		</Frame>
	);
}
