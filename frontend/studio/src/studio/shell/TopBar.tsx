import { useEffect, useState, type ComponentProps } from 'react';
import { Ellipsis, PanelLeft, PanelRight } from 'lucide-react';

import { cn } from '@studio/lib/utils';
import { Button } from '@studio/ui/button';
import { timeAgo } from '../workspace/time-ago';
import { shell, useActions, useShell, type View } from './shell-state';

const VIEW_NAMES: Record<Exclude<View, 'editor'>, string> = { drive: '资料库', table: '全部文章', chat: 'AI 问答' };

function IconButton({ className, ...props }: ComponentProps<'button'>) {
	return <Button type="button" variant="ghost" size="icon-sm" className={cn('size-7 text-muted-foreground hover:text-foreground aria-pressed:text-foreground [&_svg]:size-4', className)} {...props} />;
}

/** Drawn again every `ms`, for what says how long ago something was. */
function useTicking(ms: number): void {
	const [, tick] = useState(0);
	useEffect(() => {
		const timer = window.setInterval(() => tick((count) => count + 1), ms);
		return () => window.clearInterval(timer);
	}, [ms]);
}

/** The bar above the middle: the sidebar's toggle, where one is, when the article was edited and saved, its menu, the right column's toggle. */
export function TopBar({ siteTitle }: { siteTitle: string }) {
	const { view, sidebarCollapsed, title, status, edited, articleHref, panelOpen } = useShell();
	const act = useActions();
	useTicking(30_000);
	const article = view === 'editor';
	return (
		<>
			<div className="flex min-w-0 items-center gap-[7px] text-[11px]">
				<IconButton
					id="toggle-sidebar"
					aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
					aria-pressed={sidebarCollapsed}
					onClick={() => shell.set({ sidebarCollapsed: !sidebarCollapsed })}
				>
					<PanelLeft aria-hidden />
				</IconButton>
				<span className="text-muted-foreground max-[720px]:hidden">{siteTitle}</span>
				<span className="text-muted-foreground max-[720px]:hidden">/</span>
				<strong id="breadcrumb-title" className="max-w-[340px] truncate font-semibold max-[720px]:max-w-[150px]" hidden={!article}>
					{title}
				</strong>
				{!article && <strong className="truncate font-semibold">{VIEW_NAMES[view]}</strong>}
			</div>
			<div className="flex min-w-0 items-center gap-[7px]">
				<span id="edited-at" className="text-[10px] whitespace-nowrap text-muted-foreground opacity-85" title={edited === null ? '' : new Date(edited).toLocaleString('zh-CN')} hidden={!article}>
					{edited === null ? '' : `编辑于${timeAgo(edited)}`}
				</span>
				<span
					id="save-status"
					className="max-w-[230px] truncate text-[10px] text-muted-foreground data-[state=error]:text-destructive max-[720px]:hidden"
					data-state={status.tone}
					title="改动会自动保存，⌘S 立即保存"
					aria-live="polite"
					hidden={!article}
				>
					{status.text}
				</span>
				<Button asChild variant="outline" size="xs" className="h-[26px] px-2 text-[11px] font-normal shadow-none max-[720px]:hidden">
					<a id="open-article" href={articleHref} target="_blank" hidden={!article}>
						打开博客
					</a>
				</Button>
				<IconButton id="page-menu" aria-label="页面菜单" title="页面菜单" hidden={!article} onClick={(event) => act.pageMenu(event.currentTarget)}>
					<Ellipsis aria-hidden />
				</IconButton>
				<IconButton id="toggle-side-panel" aria-pressed={panelOpen} aria-label={panelOpen ? '收起右侧面板' : '展开右侧面板'} title="文件与终端" onClick={act.togglePanel}>
					<PanelRight aria-hidden />
				</IconButton>
			</div>
		</>
	);
}
