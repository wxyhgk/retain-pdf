import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ArrowDown, BookOpen, BookOpenCheck, Calculator, ClipboardList, Paperclip, History, Maximize2, PanelRight, PictureInPicture2, NotebookPen, ScanSearch, Search, Settings2, Sigma, SquarePen, TextQuote, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { WIDGET_ASK, WIDGET_START, WIDGET_STATE, type WidgetAsk, type WidgetStart, type WidgetTold } from '@blog/kernel/widget-events.ts';
import { articleAddress } from '@blog/markdown/articles/rules.mjs';
import { cn, uiLayer } from '@studio/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@studio/ui/dialog';
import type { Conversation, ConversationItem } from '../../api/client';
import { observePluginBlocks } from '../../plugins';
import { useStore, type Store } from '../../shell/store';
import { markdownOfSelection, pictureUrl } from '../ai-markdown';
import { EffortMenu, ModelMenu } from './ModelMenu';
import { ModelsSheet, type ModelsSheetHost } from './ModelsSheet';
import { recentPages } from '../../state/recent-pages';
import { createPromptEditor, type PromptCaret, type PromptEditor, type PromptEditorHost } from './prompt-editor';
import { commandOf, Item, itemProps, ItemsContext, Markdown, PageChip, PanelContext, picturesOf, relativeTo, SettingsFix, type ToolItem } from './Items';
import { PagePeek } from './PagePeek';
import { mentionsIn, PASTE_CHARACTERS, PASTE_LINES, type PageInfo, type PanelActions, type PanelState } from './panel-state';

/** What each kind of tool call did, counted in a stretch of work: 读了 3 个文件. */
const TOOL_DONE: Record<string, (count: number) => string> = {
	read: (count) => t('读了 {count} 个文件', { count }),
	execute: (count) => t('运行了 {count} 个命令', { count }),
	search: (count) => t('搜索 {count} 次', { count }),
	fetch: (count) => t('查了 {count} 个网页', { count }),
	delete: (count) => t('删了 {count} 个文件', { count }),
	move: (count) => t('移动 {count} 个文件', { count }),
};
/** What a tool call going on is doing: 正在运行 echo hi. */
const TOOL_DOING: Record<string, (what: string) => string> = {
	read: (what) => t('正在读 {what}', { what }),
	edit: (what) => t('正在改 {what}', { what }),
	execute: (what) => t('正在运行 {what}', { what }),
	search: (what) => t('正在搜索 {what}', { what }),
	fetch: (what) => t('正在查 {what}', { what }),
	delete: (what) => t('正在删除 {what}', { what }),
	move: (what) => t('正在移动 {what}', { what }),
};
/** Items that are work toward an answer (thinking, tools, the plan): a stretch of them is one row, opened in a dialog. */
const WORK_KINDS = new Set(['thought', 'tool', 'plan']);
const SUGGESTIONS: Array<{ icon: LucideIcon; text: string }> = [
	{ icon: TextQuote, text: t('总结这篇文章') },
	{ icon: ScanSearch, text: t('检查这篇的公式和单位有没有错') },
	{ icon: Calculator, text: t('把文章里的计算重新跑一遍，核对结果') },
	{ icon: BookOpenCheck, text: t('找出正文里引用了却没在 refs.bib 里的文献') },
];
/** Reading a book in 翻译, at a page: about it (the AI is told the book and page, and reads it first). */
const BOOK_SUGGESTIONS: Array<{ icon: LucideIcon; text: string }> = [
	{ icon: BookOpen, text: t('讲讲这一页在说什么') },
	{ icon: Sigma, text: t('这一页的公式是怎么推出来的') },
	{ icon: Search, text: t('这一页用到的概念，书里前面哪里讲过') },
	{ icon: NotebookPen, text: t('把这一页的要点记进这本书的笔记') },
];

/** What the conversation shows: what is said as it is, each stretch of work (the items between what is said) one row. */
function laidOut(items: ConversationItem[]): Array<{ work: ConversationItem[] } | { item: ConversationItem }> {
	const rows: Array<{ work: ConversationItem[] } | { item: ConversationItem }> = [];
	for (const item of items) {
		const last = rows.at(-1);
		// Subagents at work: in the conversation, not folded in with the steps.
		if (!WORK_KINDS.has(item.kind) || (item.kind === 'tool' && item.subagents)) rows.push({ item });
		else if (last && 'work' in last) last.work.push(item);
		else rows.push({ work: [item] });
	}
	return rows;
}

/** What a stretch did (读了 3 个文件 · 运行了 1 个命令), or what it is doing now; how many of its steps failed. */
function workSummary(run: ConversationItem[], conversation: Conversation | null, items: ConversationItem[]): { text: string; going: boolean; failed: number } {
	const tools = run.filter((item): item is ToolItem => item.kind === 'tool');
	const failed = tools.filter((tool) => tool.status === 'failed').length;
	const last = run.at(-1)!;
	const going = conversation?.state === 'running' && items.at(-1) === last;
	if (going) {
		if (last.kind === 'tool') return { text: (TOOL_DOING[last.toolKind] ?? ((what: string) => t('正在做 {what}', { what })))(commandOf(last) ?? (last.title || '…')), going, failed };
		return { text: last.kind === 'plan' ? t('正在定计划…') : t('正在思考…'), going, failed };
	}
	const parts: string[] = [];
	if (run.some((item) => item.kind === 'thought')) parts.push(t('思考'));
	const byKind = new Map<string, ToolItem[]>();
	for (const tool of tools) byKind.set(tool.toolKind, [...(byKind.get(tool.toolKind) ?? []), tool]);
	for (const [kind, those] of byKind) {
		if (kind === 'edit') {
			const files = [...new Set(those.flatMap((tool) => [...tool.locations.map((location) => location.path), ...tool.content.flatMap((content) => (content.type === 'diff' ? [content.path] : []))]).map((path) => relativeTo(conversation, path).split('/').pop()!))];
			const named = files.slice(0, 2).join('、');
			parts.push(files.length > 2 ? t('改了 {files} 等 {count} 个文件', { files: named, count: files.length }) : files.length ? t('改了 {files}', { files: named }) : t('改了 {count} 处', { count: those.length }));
		} else {
			parts.push((TOOL_DONE[kind] ?? ((count: number) => t('{count} 个其他操作', { count })))(those.length));
		}
	}
	const plan = run.find((item): item is Extract<ConversationItem, { kind: 'plan' }> => item.kind === 'plan');
	if (plan) parts.push(t('计划 {done}/{total}', { done: plan.entries.filter((entry) => entry.status === 'completed').length, total: plan.entries.length }));
	return { text: parts.join(' · ') || t('过程'), going, failed };
}

/** A picture in what is said or in a step, clicked: whole, over everything. */
function pictureClicked(event: MouseEvent, show: (picture: { src: string; alt: string }) => void): void {
	const picture = (event.target as Element | null)?.closest?.<HTMLImageElement>('.ai-message img, .ai-tool-picture, .ai-user-picture');
	if (!picture) return;
	event.preventDefault();
	show({ src: picture.src, alt: picture.alt });
}

/** A code block's copy button clicked (ai-markdown.ts): its code copied. */
function copyClicked(event: MouseEvent, copy: PanelActions['copy']): void {
	const button = (event.target as Element | null)?.closest?.<HTMLElement>('.ai-copy');
	if (!button) return;
	event.preventDefault();
	copy(button.dataset.copy ?? '', t('已复制代码'));
}

/** What the plugins' previews leave to be drawn (a molecule's 3D view, a widget's frame), drawn in `node` too. */
function usePluginBlocks(node: React.RefObject<HTMLElement | null>, ready = true): void {
	useEffect(() => {
		if (ready && node.current) void observePluginBlocks(node.current);
	}, [ready]);
}

/**
 * The widgets in the answers, as ChatGPT's and Claude's apps in a conversation: what one asks (a button in it) is said
 * in the conversation; what it tells of itself is kept for it, and told the AI with what is said next; it may be shown
 * large. Each known by its conversation, its answer and its place in it.
 */
function useWidgets(node: React.RefObject<HTMLElement | null>, actions: PanelActions, conversation: string): void {
	useEffect(() => {
		const root = node.current;
		if (!root || !conversation) return;
		const keyOf = (target: EventTarget | null): string | null => {
			const figure = target instanceof HTMLElement ? target.closest('figure.note-widget') : null;
			const answer = figure?.closest<HTMLElement>('[data-item]');
			if (!figure || !answer) return null;
			return `${conversation}/${answer.dataset.item}/${[...answer.querySelectorAll('figure.note-widget')].indexOf(figure)}`;
		};
		const started = (event: Event) => {
			const detail = (event as CustomEvent<WidgetStart>).detail;
			const key = keyOf(event.target);
			if (!key) return;
			Object.assign(detail, { canAsk: true, expand: true, state: actions.widgetState(key) });
		};
		const told = (event: Event) => {
			const { title, state } = (event as CustomEvent<WidgetTold>).detail;
			const key = keyOf(event.target);
			if (key) actions.widgetTold(key, title, state);
		};
		const asked = (event: Event) => {
			if (keyOf(event.target) && actions.widgetAsked((event as CustomEvent<WidgetAsk>).detail.text)) event.preventDefault();
			// Taken here or not, not the article's to take.
			event.stopPropagation();
		};
		root.addEventListener(WIDGET_START, started);
		root.addEventListener(WIDGET_STATE, told);
		root.addEventListener(WIDGET_ASK, asked);
		return () => {
			root.removeEventListener(WIDGET_START, started);
			root.removeEventListener(WIDGET_STATE, told);
			root.removeEventListener(WIDGET_ASK, asked);
		};
	}, [conversation]);
}

function Toolbar({ state, actions }: { state: PanelState; actions: PanelActions }) {
	const title = state.conversation?.title || t('新对话');
	const button = (label: string, Icon: LucideIcon, onClick: (event: MouseEvent<HTMLButtonElement>) => void, hint = label) => (
		<button type="button" title={hint} aria-label={label} onClick={onClick}>
			<Icon aria-hidden />
		</button>
	);
	return (
		<header className="pane-toolbar ai-toolbar">
			<span className="ai-title" title={title}>
				{title}
			</span>
			<span className="ai-where">{state.conversation?.service ?? ''}</span>
			<div className="pane-actions">
				{button(t('显示方式'), state.full ? Maximize2 : state.floating ? PictureInPicture2 : PanelRight, (event) => actions.layout(event.currentTarget), t('显示方式：侧栏、悬浮、全屏'))}
				{button(t('模型和账号'), Settings2, () => actions.showSheet(!state.settings), t('模型和账号：Claude 账号、DeepSeek 等 API key'))}
				{button(t('对话记录'), History, (event) => actions.history(event.currentTarget))}
				{button(t('新对话'), SquarePen, actions.newConversation)}
			</div>
		</header>
	);
}

/** A stretch of work, as one quiet row: what it did, the pictures it looked at small; clicked, its detail. */
function WorkRow({ run, onOpen }: { run: ConversationItem[]; onOpen(): void }) {
	const { conversation, items } = useContext(ItemsContext)!;
	const { text, going, failed } = workSummary(run, conversation, items);
	const pictures = [...new Set(run.flatMap((item) => (item.kind === 'tool' ? picturesOf(item) : [])))].slice(0, 4);
	return (
		<button type="button" className={cn('ai-work', going && 'is-going')} title={t('点开看过程')} onClick={onOpen}>
			<span className="ai-work-icon">{going ? '' : '⚙'}</span>
			<span className="ai-work-text">{text}</span>
			{failed > 0 && <span className="ai-work-failed">{t('{count} 步失败', { count: failed })}</span>}
			{pictures.map((path) => (
				<img key={path} className="ai-work-picture" src={pictureUrl(path)} alt="" />
			))}
			<span className="ai-work-more">›</span>
		</button>
	);
}

/** A stretch's detail: each step as the panel draws it (thinking, a command and its output, a change). */
function WorkDialog({ run, title, onClose, onPicture, copy }: { run: ConversationItem[]; title: string; onClose(): void; onPicture(picture: { src: string; alt: string }): void; copy: PanelActions['copy'] }) {
	const { items } = useContext(ItemsContext)!;
	const [body, setBody] = useState<HTMLDivElement | null>(null);
	useEffect(() => {
		if (body) void observePluginBlocks(body);
	}, [body]);
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="ai-pane ai-work-dialog flex max-h-[80vh] w-[min(720px,92vw)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]" aria-label={t('过程')}>
				<header className="ai-work-head">
					<DialogTitle className="ai-work-title text-[13px] font-semibold">{title}</DialogTitle>
					<DialogDescription className="sr-only">{t('这一段过程的每一步')}</DialogDescription>
				</header>
				<div
					ref={setBody}
					className="ai-work-body"
					onClick={(event) => {
						pictureClicked(event, onPicture);
						copyClicked(event, copy);
					}}
				>
					{run.map((item) => (
						<Item key={item.id} {...itemProps(item, items)} />
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function PictureDialog({ picture, onClose }: { picture: { src: string; alt: string }; onClose(): void }) {
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent showCloseButton={false} className="ai-picture-dialog max-h-[94vh] w-auto max-w-[94vw] cursor-zoom-out gap-0 overflow-hidden p-0 sm:max-w-[94vw]" onClick={onClose}>
				<DialogTitle className="sr-only">{t('图片')}</DialogTitle>
				<DialogDescription className="sr-only">{picture.alt}</DialogDescription>
				<img src={picture.src} alt={picture.alt} />
			</DialogContent>
		</Dialog>
	);
}

function Transcript({ state, actions }: { state: PanelState; actions: PanelActions }) {
	const { conversation, items } = state;
	const scroller = useRef<HTMLDivElement>(null);
	const list = useRef<HTMLDivElement>(null);
	/** Scrolled up, away from the end: not taken back down as words come. */
	const away = useRef(false);
	/**
	 * When the author last scrolled it (wheel, touch, keys, its scroll bar): only then is it away. Its own scrolls to
	 * the end are not, though what is drawn meanwhile may have made it longer by the time it is told of them (WebKit).
	 */
	const touched = useRef(0);
	const byAuthor = () => performance.now() - touched.current < 1000;
	const touch = () => {
		touched.current = performance.now();
	};
	/** Where it last took itself, to the end: a scroll told at that place is that one (others, a focus's, are as they are). */
	const ownTop = useRef(-1);
	const toEnd = (node: HTMLElement) => {
		node.scrollTop = node.scrollHeight;
		ownTop.current = node.scrollTop;
	};
	/** Away from the end by more than a screen: ↓ to it; `fresh`, something came meanwhile. */
	const [far, setFar] = useState<{ at: number } | null>(null);
	const fresh = far !== null && items.length > far.at;
	const [workShown, setWorkShown] = useState<string | null>(null);
	const [picture, setPicture] = useState<{ src: string; alt: string } | null>(null);
	/** Something of what the AI said selected: a button over it, to quote it in what is said next. */
	const [quoting, setQuoting] = useState<{ top: number; left: number; markdown: string } | null>(null);
	const rows = useMemo(() => laidOut(items), [items]);
	usePluginBlocks(list);
	useWidgets(list, actions, conversation?.id ?? '');
	useEffect(() => {
		const changed = () => {
			const selection = document.getSelection();
			if (!selection || selection.isCollapsed) setQuoting(null);
		};
		document.addEventListener('selectionchange', changed);
		return () => document.removeEventListener('selectionchange', changed);
	}, []);

	/** What is selected, if it is of what the AI said: offered to be quoted. */
	function offerQuote(): void {
		const selection = document.getSelection();
		const root = list.current;
		if (!selection || selection.isCollapsed || !selection.rangeCount || !root) return setQuoting(null);
		const range = selection.getRangeAt(0);
		const answer = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest('.ai-message');
		const from = answer(range.startContainer);
		const to = answer(range.endContainer);
		if (!from || !to || !root.contains(from) || !root.contains(to)) return setQuoting(null);
		const markdown = markdownOfSelection(range, root);
		const rect = range.getBoundingClientRect();
		setQuoting(markdown ? { top: rect.top, left: rect.left + rect.width / 2, markdown } : null);
	}

	useLayoutEffect(() => {
		if (!away.current && scroller.current) toEnd(scroller.current);
	});
	// Another conversation shown (one of before, opened): at its end, wherever the one before was scrolled to.
	useLayoutEffect(() => {
		away.current = false;
		setFar(null);
		if (scroller.current) toEnd(scroller.current);
	}, [conversation?.id]);
	// What is drawn after (pictures loaded, formulas, molecules, widgets) or the panel shown again: kept at the end.
	useEffect(() => {
		const node = scroller.current;
		if (!node || !list.current) return;
		const stay = new ResizeObserver(() => {
			if (!away.current) toEnd(node);
		});
		stay.observe(node);
		stay.observe(list.current);
		return () => stay.disconnect();
	}, []);

	const shownRun = workShown ? rows.find((row): row is { work: ConversationItem[] } => 'work' in row && row.work[0]!.id === workShown)?.work : undefined;
	return (
		<div
			ref={scroller}
			className="ai-transcript"
			role="log"
			aria-live="polite"
			onWheel={touch}
			onTouchMove={touch}
			onPointerDown={touch}
			onKeyDown={touch}
			onScroll={(event) => {
				const node = event.currentTarget;
				const left = node.scrollHeight - node.scrollTop - node.clientHeight;
				// Its own scroll to the end, told late (longer by then): kept at the end.
				if (!byAuthor() && !away.current && Math.abs(node.scrollTop - ownTop.current) < 2) {
					toEnd(node);
					return;
				}
				away.current = left > 40;
				if (left > node.clientHeight) setFar((now) => now ?? { at: items.length });
				else setFar(null);
				setQuoting(null);
			}}
		>
			<div className="ai-empty" hidden={items.length > 0}>
				<p className="ai-empty-title">{t('要做点什么？')}</p>
				<p className="ai-empty-hint">
					{state.book
						? state.book.page
							? t('它读得到你在读的《{title}》（第 {page} 页），答之前先翻原文；引用的段落能直接放进笔记。', { title: state.book.title ?? t('这本书'), page: state.book.page })
							: t('它读得到你在读的《{title}》，答之前先翻原文；引用的段落能直接放进笔记。', { title: state.book.title ?? t('这本书') })
						: t('它会自己读文件、运行命令、改文章；改了文章会像别的改动一样让你过目。')}
				</p>
				<div className="ai-suggestions">
					{(state.book?.page ? BOOK_SUGGESTIONS : SUGGESTIONS).map(({ icon: Icon, text }) => (
						<button key={text} type="button" className="ai-suggestion" onClick={() => actions.ask(text)}>
							<Icon aria-hidden />
							{text}
						</button>
					))}
				</div>
			</div>
			<div
				ref={list}
				className="ai-items"
				onClick={(event) => {
					pictureClicked(event, setPicture);
					copyClicked(event, actions.copy);
				}} onMouseUp={() => requestAnimationFrame(offerQuote)} onKeyUp={(event) => event.shiftKey && offerQuote()}>
				{rows.map((row) =>
					'work' in row ? <WorkRow key={row.work[0]!.id} run={row.work} onOpen={() => setWorkShown(row.work[0]!.id)} /> : <Item key={row.item.id} {...itemProps(row.item, state.items)} />,
				)}
			</div>
			{far && (
				<button
					type="button"
					className={cn('ai-latest', fresh && 'is-fresh')}
					aria-label={fresh ? t('回到最新（有新内容）') : t('回到最新')}
					title={fresh ? t('回到最新（有新内容）') : t('回到最新')}
					onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })}
				>
					<ArrowDown aria-hidden />
				</button>
			)}
			{shownRun && <WorkDialog run={shownRun} title={workSummary(shownRun, conversation, items).text} onClose={() => setWorkShown(null)} onPicture={setPicture} copy={actions.copy} />}
			{picture && <PictureDialog picture={picture} onClose={() => setPicture(null)} />}
			{quoting &&
				createPortal(
					<button
						type="button"
						className="ai-quote-button"
						style={{ top: Math.max(8, quoting.top - 36), left: quoting.left }}
						// The selection kept as it is clicked.
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => {
							actions.quote(quoting.markdown);
							document.getSelection()?.removeAllRanges();
							setQuoting(null);
						}}
					>
						<TextQuote aria-hidden />
						{t('引用')}
					</button>,
					uiLayer() ?? document.body,
				)}
		</div>
	);
}

/** How full its context is getting near: past this, it is said, with /compact (where it has it) to make room. */
const NEARLY_FULL = 0.8;

/**
 * How much of its context is used, as a ring and a percentage; the numbers (and what it cost) said as the pointer
 * rests on it. Nearly full, the ring dark and, clicked, /compact in the input.
 */
function Usage({ used, canCompact, onCompact }: { used: NonNullable<Conversation['usage']>; canCompact: boolean; onCompact(): void }) {
	const share = Math.min(1, used.used / used.size);
	const full = share >= NEARLY_FULL;
	const size = (tokens: number) => (tokens >= 1_000_000 ? `${+(tokens / 1_000_000).toFixed(1)}M` : `${Math.round(tokens / 1000)}k`);
	const detail = [
		t('上下文用了 {used} / {size}（{share}%）', { used: size(used.used), size: size(used.size), share: Math.round(share * 100) }),
		used.cost ? t('这次对话花了 ${amount}', { amount: used.cost.amount.toFixed(2) }) : '',
		full ? (canCompact ? t('快满了：点一下用 /compact 压缩') : t('快满了：可以新开一个对话')) : '',
	].filter(Boolean).join('\n');
	const ring = 2 * Math.PI * 6;
	return (
		<button type="button" className={cn('ai-usage-ring', full && 'is-full')} title={detail} aria-label={detail} onClick={() => full && canCompact && onCompact()}>
			<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
				<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
				<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${share * ring} ${ring}`} transform="rotate(-90 8 8)" strokeLinecap="round" />
			</svg>
			<span>{Math.round(share * 100)}%</span>
		</button>
	);
}

/** What follows an @ before the caret, if the author is naming an article. */
function naming(draft: string, caret: number): { from: number; query: string } | null {
	const before = draft.slice(0, caret);
	const found = /(^|\s)@([^\s@]*)$/u.exec(before);
	return found ? { from: before.length - found[2]!.length - 1, query: found[2]! } : null;
}

/** What is told with what is said; an article's, a link to it. */
function Chip({ label, title, page, onRemove }: { label: string; title: string; page?: PageInfo; onRemove(): void }) {
	return (
		<span className="ai-chip" title={page ? undefined : title}>
			{page ? <PageChip page={page} label={label} title={title} /> : <span className="ai-chip-label">{label}</span>}
			<button type="button" className="ai-chip-remove" aria-label={t('不带上{label}', { label })} onClick={onRemove}>
				×
			</button>
		</span>
	);
}

/**
 * The input: written as articles are (prompt-editor.ts: formulas drawn as they are typed), what is written the
 * panel's `draft` (Markdown) both ways; what it tells, to `handlers` as they are now.
 */
function PromptInput({ draft, placeholder, editor, handlers }: { draft: string; placeholder: string; editor: React.MutableRefObject<PromptEditor | null>; handlers: React.RefObject<PromptEditorHost | null> }) {
	const root = useRef<HTMLDivElement>(null);
	const latest = useRef(draft);
	latest.current = draft;
	useEffect(() => {
		let made: PromptEditor | null = null;
		let gone = false;
		const host: PromptEditorHost = {
			changed: (markdown, caret) => handlers.current!.changed(markdown, caret),
			key: (event, sends) => handlers.current!.key(event, sends),
			paste: (event) => handlers.current!.paste(event),
			drop: (event) => handlers.current!.drop(event),
			focused: (focus) => handlers.current!.focused(focus),
		};
		void createPromptEditor(root.current!, host, latest.current).then((ready) => {
			if (gone) return ready.destroy();
			made = ready;
			editor.current = ready;
			// What was put in while it was being made.
			ready.set(latest.current);
		});
		return () => {
			gone = true;
			made?.destroy();
			editor.current = null;
		};
	}, []);
	useEffect(() => editor.current?.set(draft), [draft]);
	return (
		<div className="ai-input math-editor">
			<div ref={root} className="ai-input-editor" data-host />
			{!draft.trim() && (
				<div className="ai-input-placeholder" aria-hidden="true">
					{placeholder}
				</div>
			)}
		</div>
	);
}

function Composer({ state, actions }: { state: PanelState; actions: PanelActions }) {
	const { conversation, article, leftOut, selected, selectionLeftOut, draft, status, pictures, files, quotes, pastes, queued } = state;
	const editor = useRef<PromptEditor | null>(null);
	const [caret, setCaret] = useState<PromptCaret>({ before: '', first: true });
	const [mentionAt, setMentionAt] = useState(0);
	const [mentionsClosed, setMentionsClosed] = useState(false);
	const [dropping, setDropping] = useState(false);
	const running = conversation?.state === 'running';

	// Asked to take the keys (focus, ask).
	useEffect(() => {
		if (state.focusAsked) editor.current?.focus();
	}, [state.focusAsked]);

	const open = article && leftOut !== article.slug ? article : null;
	const pages = actions.articles();
	const pageOf = (slug: string) => pages.find((page) => page.slug === slug);
	const chips: ReactNode[] = [];
	if (open) chips.push(<Chip key="article" label={open.title} page={pageOf(open.slug)} title={t('当前文章：说话时会告诉 AI 你在看这篇')} onRemove={actions.leaveOutArticle} />);
	if (open && !selectionLeftOut && selected) chips.push(<Chip key="selection" label={t('选中的内容')} title={t('文章里选中的那几行会一起告诉 AI')} onRemove={actions.leaveOutSelection} />);
	for (const picture of pictures) {
		chips.push(
			<span key={picture.id} className="ai-chip ai-picture-chip">
				<img src={picture.url} alt={t('图片')} />
				<button type="button" className="ai-chip-remove" aria-label={t('不带上这张图')} onClick={() => actions.removePicture(picture.id)}>
					×
				</button>
			</span>,
		);
	}

	for (const attachment of files) {
		chips.push(
			<span key={attachment.id} className="ai-chip ai-paste-chip" title={t('随这句话交给 AI 的文件：它在本机读')}>
				<Paperclip aria-hidden />
				<span className="ai-chip-label">{attachment.file.name}</span>
				<button type="button" className="ai-chip-remove" aria-label={t('不带上 {name}', { name: attachment.file.name })} onClick={() => actions.removeFile(attachment.id)}>
					×
				</button>
			</span>,
		);
	}

	pastes.forEach((paste, at) => {
		const lines = paste.replace(/\n+$/u, '').split('\n');
		chips.push(
			<span key={`paste-${at}`} className="ai-chip ai-paste-chip" title={lines.slice(0, 12).join('\n') + (lines.length > 12 ? '\n…' : '')}>
				<ClipboardList aria-hidden />
				<span className="ai-chip-label">{t('已粘贴 {count} 行', { count: lines.length })}</span>
				<button type="button" className="ai-chip-remove" aria-label={t('不带上粘贴的内容')} onClick={() => actions.unpaste(at)}>
					×
				</button>
			</span>,
		);
	});

	const asked = mentionsClosed ? null : naming(caret.before, caret.before.length);
	// Those named already (links in what is written): not offered again.
	const named = asked ? mentionsIn(draft, pages) : [];
	const needle = asked?.query.toLocaleLowerCase('zh-CN') ?? '';
	// The pages opened last first (the one open is told already, as its chip), then those changed last, as Notion's 最近.
	const recent = asked ? recentPages().filter((slug) => slug !== article?.slug) : [];
	const recency = (entry: PageInfo) => {
		const at = recent.indexOf(entry.slug);
		return at < 0 ? recent.length : at;
	};
	const choices = asked
		? actions
				.articles()
				.filter((entry) => !named.some((other) => other.slug === entry.slug))
				.filter((entry) => !needle || entry.title.toLocaleLowerCase('zh-CN').includes(needle) || entry.slug.includes(needle))
				.sort((one, other) => recency(one) - recency(other) || (other.modified ?? 0) - (one.modified ?? 0))
				.slice(0, 8)
		: [];
	// A slash command its agent offers (/compact), typed at the start: chosen from a list as an article is with @.
	const slash = mentionsClosed || !caret.first ? null : /^\/(\S*)$/u.exec(caret.before);
	const commands = slash ? (conversation?.commands ?? []).filter((command) => command.name.toLowerCase().startsWith(slash[1]!.toLowerCase())).slice(0, 12) : [];
	const listed = choices.length || commands.length;
	const current = Math.min(mentionAt, Math.max(0, (choices.length || commands.length) - 1));

	/** The command `name` written at the start, what to write after it to follow. */
	function command(name: string): void {
		editor.current?.replaceBefore(caret.before.length, `/${name} `);
		setMentionAt(0);
	}

	/** Pictures among what is pasted or dropped: given with what is said next. */
	/** The files of a paste or drop: pictures, and any other (a PDF, a table, an output). */
	function filesIn(transfer: DataTransfer): File[] {
		return [...transfer.files];
	}

	/** `entry` named: the @ and what was typed after it, a link to it in their place (as Notion's page mentions). */
	function mention(entry: PageInfo): void {
		const at = naming(caret.before, caret.before.length);
		editor.current?.mention(at ? caret.before.length - at.from : 0, entry.title, articleAddress(entry.kind, entry.slug));
		setMentionAt(0);
	}

	/** A key in the input, before the editor: a menu's, or Enter to send (`sends`: not a formula's, nor in code). */
	function keyDown(event: KeyboardEvent, sends: boolean): boolean {
		const composing = event.isComposing || event.keyCode === 229;
		if (composing) return false;
		// Choosing an article to name, or a command.
		if (listed) {
			const count = choices.length || commands.length;
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				setMentionAt((current + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
				return true;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				if (choices.length) mention(choices[current]!);
				else command(commands[current]!.name);
				return true;
			}
			if (event.key === 'Escape') {
				setMentionsClosed(true);
				return true;
			}
		}
		// Enter sends (⌘Enter too, from wherever it is); Shift+Enter is a new line.
		if (event.key !== 'Enter' || event.shiftKey || event.altKey || !(sends || event.metaKey || event.ctrlKey)) return false;
		actions.submit();
		return true;
	}

	/** Pasted: pictures and files given with what is said; words at length (a log, an output) a chip, sent after it. */
	function pasted(event: ClipboardEvent): boolean {
		const transfer = event.clipboardData;
		if (!transfer) return false;
		const words = transfer.getData('text/plain');
		if (words.split('\n').length >= PASTE_LINES || words.length >= PASTE_CHARACTERS) {
			actions.paste(words);
			return true;
		}
		const given = filesIn(transfer);
		if (!given.length) return false;
		void actions.addFiles(given);
		// A picture copied with words (from a page): the words pasted too.
		return !words;
	}

	const handlers = useRef<PromptEditorHost>(null);
	handlers.current = {
		changed(markdown, at) {
			if (markdown !== draft) {
				actions.type(markdown);
				setMentionsClosed(false);
			}
			setCaret(at);
		},
		key: keyDown,
		paste: pasted,
		drop(event) {
			const given = event.dataTransfer ? filesIn(event.dataTransfer) : [];
			if (!given.length) return false;
			setDropping(false);
			void actions.addFiles(given);
			return true;
		},
		focused: (focus) => setMentionsClosed(!focus),
	};

	const effort = conversation?.configOptions.find((option) => option.type === 'select' && option.category === 'thought_level');
	const used = conversation?.usage;
	return (
		<div
			className={cn('ai-composer', dropping && 'is-dropping')}
			onDragOver={(event) => {
				if (![...event.dataTransfer.items].some((item) => item.kind === 'file')) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = 'copy';
				setDropping(true);
			}}
			onDragLeave={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
			}}
			onDrop={(event) => {
				setDropping(false);
				// Taken by the input already.
				if (event.defaultPrevented) return;
				const given = filesIn(event.dataTransfer);
				if (!given.length) return;
				event.preventDefault();
				void actions.addFiles(given);
			}}
		>
			<p className={cn('ai-status', status.error && 'is-error')} role="status">
				{status.text}
				{status.error && status.retry && (
					<>
						{' '}
						<button type="button" className="ai-status-fix" onClick={actions.retryStatus}>
							{t('重试')}
						</button>
					</>
				)}
				{status.error && (
					<>
						{' '}
						<SettingsFix />
					</>
				)}
			</p>
			{/* Said while it worked, to be said once it is done: each taken back, or said now (what it does stopped). */}
			{queued.length > 0 && (
				<div className="ai-queue" aria-label={t('排队要说的话')}>
					{queued.map((said) => (
						<div key={said.id} className="ai-queued">
							<span className="ai-queued-text" title={said.text}>
								{said.text}
							</span>
							<button type="button" onClick={() => actions.sayNow(said.id)}>
								{t('立刻发')}
							</button>
							<button type="button" className="ai-chip-remove" aria-label={t('取回这句')} title={t('取回这句')} onClick={() => actions.unqueue(said.id)}>
								×
							</button>
						</div>
					))}
				</div>
			)}
			{/* What was quoted of the conversation, said before what is said next. */}
			{quotes.map((quote, at) => (
				<div key={at} className="ai-quote-row">
					<Markdown className="ai-quote" text={quote} />
					<button type="button" className="ai-chip-remove" aria-label={t('不引用这段')} onClick={() => actions.unquote(at)}>
						×
					</button>
				</div>
			))}
			{/* What is told with what is said: the article open, what is selected in it, the articles named with @, pictures. */}
			<div className="ai-context" hidden={!chips.length}>
				{chips}
			</div>
			{commands.length > 0 && !choices.length && (
				<div className="ai-mention-menu" role="listbox" aria-label={t('命令')}>
					{commands.map((entry, index) => (
						<button
							key={entry.name}
							type="button"
							role="option"
							aria-selected={index === current}
							className={cn('ai-mention ai-command', index === current && 'is-current')}
							onMouseDown={(event) => {
								event.preventDefault();
								command(entry.name);
							}}
						>
							<span>/{entry.name}</span>
							<span className="ai-mention-slug">{entry.description || entry.hint}</span>
						</button>
					))}
				</div>
			)}
			{choices.length > 0 && (
				<div className="ai-mention-menu" role="listbox" aria-label={needle ? t('页面') : t('最近')}>
					{!needle && <div className="ai-mention-heading">{t('最近')}</div>}
					{choices.map((entry, index) => (
						<button
							key={entry.slug}
							type="button"
							role="option"
							aria-selected={index === current}
							className={cn('ai-mention', index === current && 'is-current')}
							// Chosen before the input loses its caret.
							onMouseDown={(event) => {
								event.preventDefault();
								mention(entry);
							}}
						>
							<span>{entry.title}</span>
							<span className="ai-mention-slug">{entry.slug}</span>
						</button>
					))}
				</div>
			)}
			<PromptInput
				draft={draft}
				editor={editor}
				handlers={handlers}
				// While it works: to one that can take it, a word in between (Enter); else, or with something selected in the
				// article (a word in between goes alone), said once it is done.
				placeholder={running ? (conversation?.canSteer && !(open && !selectionLeftOut && selected) ? t('插话：它会尽快看到（Enter）') : t('排队：它做完这一轮就发（Enter）')) : t('让 AI 做点什么…（@ 提到文章，/ 命令，$ 写公式，可以粘贴图片）')}
			/>
			<div className="ai-composer-bar">
				<span className="ai-usage">{used && used.size > 0 && <Usage used={used} canCompact={Boolean(conversation?.commands.some((entry) => entry.name === 'compact'))} onCompact={() => actions.ask('/compact')} />}</span>
				{effort && <EffortMenu key={`${conversation?.id}:${String(effort.currentValue)}`} option={effort} onChange={(value) => actions.setOption(effort.id, value)} />}
				<ModelMenu state={state} actions={actions} />
				<button type="button" className={cn('ai-send', running && 'is-stop')} title={running ? t('停下') : t('发送（Enter；换行用 Shift+Enter）')} aria-label={running ? t('停下') : t('发送')} onClick={actions.sendOrStop}>
					{running ? '■' : '↑'}
				</button>
			</div>
		</div>
	);
}

/**
 * The AI panel (the right column's AI tab, or whole in the middle: AI 问答): a coding agent (Claude Code, Codex, pi)
 * that does what it is asked by itself, reading, running commands and changing files in the article's folder, shown as
 * it goes; its work (thinking, tools, the plan) one row a stretch, its detail in a dialog. Under the input: which AI,
 * and its options (who decides, model, effort).
 */
export function AiPanel({ store, actions, sheetHost, pane }: { store: Store<PanelState>; actions: PanelActions; sheetHost: ModelsSheetHost; pane: HTMLElement }) {
	const state = useStore(store);
	const context = useMemo(() => ({ conversation: state.conversation, items: state.items, actions }), [state.conversation, state.items]);
	const panel = useMemo(() => ({ conversation: state.conversation, actions }), [state.conversation]);
	return (
		<ItemsContext value={context}>
			<PanelContext value={panel}>
				<PagePeek root={pane} pages={actions.articles} open={actions.openArticle} />
				<Toolbar state={state} actions={actions} />
				<ModelsSheet open={state.settings} host={sheetHost} onClose={() => actions.showSheet(false)} />
				<Transcript state={state} actions={actions} />
				<Composer state={state} actions={actions} />
			</PanelContext>
		</ItemsContext>
	);
}
