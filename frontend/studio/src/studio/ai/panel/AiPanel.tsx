import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ArrowDown, BookOpenCheck, Calculator, ClipboardList, History, Maximize2, Minimize2, ScanSearch, Settings2, SquarePen, TextQuote, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import { cn, uiLayer } from '@studio/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@studio/ui/dialog';
import type { Conversation, ConversationItem } from '../../api/client';
import { observePluginBlocks } from '../../plugins';
import { useStore, type Store } from '../../shell/store';
import { markdownOfSelection, pictureUrl } from '../ai-markdown';
import { EffortMenu, ModelMenu } from './ModelMenu';
import { ModelsSheet, type ModelsSheetHost } from './ModelsSheet';
import { commandOf, Item, ItemsContext, Markdown, PageChip, picturesOf, relativeTo, SettingsFix, type ToolItem } from './Items';
import { PagePeek } from './PagePeek';
import { PASTE_CHARACTERS, PASTE_LINES, type ArticleRef, type PageInfo, type PanelActions, type PanelState } from './panel-state';

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

/** What the conversation shows: what is said as it is, each stretch of work (the items between what is said) one row. */
function laidOut(items: ConversationItem[]): Array<{ work: ConversationItem[] } | { item: ConversationItem }> {
	const rows: Array<{ work: ConversationItem[] } | { item: ConversationItem }> = [];
	for (const item of items) {
		const last = rows.at(-1);
		if (!WORK_KINDS.has(item.kind)) rows.push({ item });
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

/**
 * A copy button clicked (code, a formula on its own lines: ai-markdown.ts), or a formula in a line: what it copies
 * copied, as written.
 */
function copyClicked(event: MouseEvent, copy: PanelActions['copy']): void {
	const target = event.target as Element | null;
	const button = target?.closest?.<HTMLElement>('.ai-copy');
	if (button) {
		event.preventDefault();
		copy(button.dataset.copy ?? '', button.dataset.what === 'code' ? t('已复制代码') : t('已复制公式'));
		return;
	}
	const math = target?.closest?.<HTMLElement>('.ai-message .ai-math, .ai-tool-text .ai-math');
	// Clicked, not selected across.
	if (math?.dataset.tex && document.getSelection()?.isCollapsed !== false) copy(`$${math.dataset.tex}$`, t('已复制公式'));
}

/** What the plugins' previews leave to be drawn (a molecule's 3D view, a widget's frame), drawn in `node` too. */
function usePluginBlocks(node: React.RefObject<HTMLElement | null>, ready = true): void {
	useEffect(() => {
		if (ready && node.current) void observePluginBlocks(node.current);
	}, [ready]);
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
				{state.full ? button(t('收回到右边'), Minimize2, actions.toggleWhole) : button(t('在页面中打开'), Maximize2, actions.toggleWhole, t('在页面中打开（AI 问答）'))}
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
						<Item key={item.id} item={item} />
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
	/** Away from the end by more than a screen: ↓ to it; `fresh`, something came meanwhile. */
	const [far, setFar] = useState<{ at: number } | null>(null);
	const fresh = far !== null && items.length > far.at;
	const [workShown, setWorkShown] = useState<string | null>(null);
	const [picture, setPicture] = useState<{ src: string; alt: string } | null>(null);
	/** Something of what the AI said selected: a button over it, to quote it in what is said next. */
	const [quoting, setQuoting] = useState<{ top: number; left: number; markdown: string } | null>(null);
	const rows = useMemo(() => laidOut(items), [items]);
	usePluginBlocks(list);
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
		if (!away.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
	});
	// Another conversation shown (one of before, opened): at its end, wherever the one before was scrolled to.
	useLayoutEffect(() => {
		away.current = false;
		setFar(null);
		if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
	}, [conversation?.id]);
	// What is drawn after (pictures loaded, formulas, molecules, widgets) or the panel shown again: kept at the end.
	useEffect(() => {
		const node = scroller.current;
		if (!node || !list.current) return;
		const stay = new ResizeObserver(() => {
			if (!away.current) node.scrollTop = node.scrollHeight;
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
			onScroll={(event) => {
				const node = event.currentTarget;
				const left = node.scrollHeight - node.scrollTop - node.clientHeight;
				away.current = left > 40;
				if (left > node.clientHeight) setFar((now) => now ?? { at: items.length });
				else setFar(null);
				setQuoting(null);
			}}
		>
			<div className="ai-empty" hidden={items.length > 0}>
				<p className="ai-empty-title">{t('要做点什么？')}</p>
				<p className="ai-empty-hint">{t('它会自己读文件、运行命令、改文章；改了文章会像别的改动一样让你过目。')}</p>
				<div className="ai-suggestions">
					{SUGGESTIONS.map(({ icon: Icon, text }) => (
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
					'work' in row ? <WorkRow key={row.work[0]!.id} run={row.work} onOpen={() => setWorkShown(row.work[0]!.id)} /> : <Item key={row.item.id} item={row.item} />,
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

function Composer({ state, actions }: { state: PanelState; actions: PanelActions }) {
	const { conversation, article, leftOut, selected, selectionLeftOut, mentions, draft, status, pictures, quotes, pastes, queued } = state;
	const input = useRef<HTMLTextAreaElement>(null);
	const [caret, setCaret] = useState(0);
	const [mentionAt, setMentionAt] = useState(0);
	const [mentionsClosed, setMentionsClosed] = useState(false);
	const [dropping, setDropping] = useState(false);
	const running = conversation?.state === 'running';

	/** Where the caret goes once what is typed is drawn anew (an article named, a command written). */
	const caretAfter = useRef<number | null>(null);
	// The input as tall as what is typed, up to 200px; the caret where it was asked to go.
	useLayoutEffect(() => {
		const node = input.current!;
		node.style.height = 'auto';
		node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
		if (caretAfter.current !== null) {
			node.setSelectionRange(caretAfter.current, caretAfter.current);
			caretAfter.current = null;
		}
	}, [draft]);
	// Asked to take the keys (focus, ask).
	useEffect(() => {
		if (state.focusAsked) input.current?.focus();
	}, [state.focusAsked]);

	const open = article && leftOut !== article.slug ? article : null;
	const pages = actions.articles();
	const pageOf = (slug: string) => pages.find((page) => page.slug === slug);
	const chips: ReactNode[] = [];
	if (open) chips.push(<Chip key="article" label={open.title} page={pageOf(open.slug)} title={t('当前文章：说话时会告诉 AI 你在看这篇')} onRemove={actions.leaveOutArticle} />);
	if (open && !selectionLeftOut && selected) chips.push(<Chip key="selection" label={t('选中的内容')} title={t('文章里选中的那几行会一起告诉 AI')} onRemove={actions.leaveOutSelection} />);
	for (const entry of mentions) chips.push(<Chip key={entry.slug} label={entry.title} page={pageOf(entry.slug)} title={t('用 @ 提到的文章')} onRemove={() => actions.unmention(entry)} />);
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

	const asked = mentionsClosed ? null : naming(draft, caret);
	const needle = asked?.query.toLocaleLowerCase('zh-CN') ?? '';
	const choices = asked
		? actions
				.articles()
				.filter((entry) => !mentions.some((named) => named.slug === entry.slug))
				.filter((entry) => !needle || entry.title.toLocaleLowerCase('zh-CN').includes(needle) || entry.slug.includes(needle))
				.slice(0, 8)
		: [];
	// A slash command its agent offers (/compact), typed at the start: chosen from a list as an article is with @.
	const slash = mentionsClosed ? null : /^\/(\S*)$/u.exec(draft.slice(0, caret));
	const commands = slash ? (conversation?.commands ?? []).filter((command) => command.name.toLowerCase().startsWith(slash[1]!.toLowerCase())).slice(0, 12) : [];
	const listed = choices.length || commands.length;
	const current = Math.min(mentionAt, Math.max(0, (choices.length || commands.length) - 1));

	/** The command `name` written at the start, what to write after it to follow. */
	function command(name: string): void {
		const rest = draft.slice(caret).replace(/^\S*/u, '');
		const next = `/${name} ${rest.trimStart()}`;
		actions.type(next);
		setMentionAt(0);
		setCaret(name.length + 2);
		caretAfter.current = name.length + 2;
	}

	/** Pictures among what is pasted or dropped: given with what is said next. */
	function picturesIn(transfer: DataTransfer): File[] {
		return [...transfer.files].filter((file) => file.type.startsWith('image/'));
	}

	/** `entry` named: the @ and what was typed after it taken out of the input, the article a chip. */
	function mention(entry: ArticleRef): void {
		const at = naming(draft, caret);
		const next = at ? `${draft.slice(0, at.from)}${draft.slice(caret)}` : draft;
		actions.mention(entry, next);
		setMentionAt(0);
		if (at) {
			setCaret(at.from);
			caretAfter.current = at.from;
		}
	}

	function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		const composing = event.nativeEvent.isComposing || event.keyCode === 229;
		// Choosing an article to name, or a command.
		if (listed && !composing) {
			const count = choices.length || commands.length;
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				setMentionAt((current + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				if (choices.length) mention(choices[current]!);
				else command(commands[current]!.name);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				setMentionsClosed(true);
				return;
			}
		}
		// Enter sends; not while a Chinese input method is still choosing words.
		if (event.key !== 'Enter' || event.shiftKey || composing) return;
		event.preventDefault();
		actions.submit();
	}

	const effort = conversation?.configOptions.find((option) => option.type === 'select' && option.category === 'thought_level');
	const used = conversation?.usage;
	return (
		<div
			className={cn('ai-composer', dropping && 'is-dropping')}
			onDragOver={(event) => {
				if (![...event.dataTransfer.items].some((item) => item.kind === 'file' && item.type.startsWith('image/'))) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = 'copy';
				setDropping(true);
			}}
			onDragLeave={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
			}}
			onDrop={(event) => {
				setDropping(false);
				const files = picturesIn(event.dataTransfer);
				if (!files.length) return;
				event.preventDefault();
				void actions.addPictures(files);
			}}
		>
			<p className={cn('ai-status', status.error && 'is-error')} role="status">
				{status.text}
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
				<div className="ai-mention-menu" role="listbox">
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
			<textarea
				ref={input}
				className="ai-input"
				rows={1}
				aria-label={t('对 AI 说')}
				// While it works: to one that can take it, a word in between (Enter); else said once it is done.
				placeholder={running ? (conversation?.canSteer ? t('插话：它会尽快看到（Enter）') : t('排队：它做完这一轮就发（Enter）')) : t('让 AI 做点什么…（@ 提到文章，/ 命令，可以粘贴图片）')}
				value={draft}
				onChange={(event) => {
					actions.type(event.target.value);
					setCaret(event.target.selectionStart ?? event.target.value.length);
					setMentionsClosed(false);
				}}
				onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? 0)}
				onBlur={() => setMentionsClosed(true)}
				onFocus={() => setMentionsClosed(false)}
				onKeyDown={keyDown}
				onPaste={(event) => {
					// Words pasted at length (a log, an output): a chip, sent after what is typed.
					const words = event.clipboardData.getData('text/plain');
					if (words.split('\n').length >= PASTE_LINES || words.length >= PASTE_CHARACTERS) {
						event.preventDefault();
						actions.paste(words);
						return;
					}
					const files = picturesIn(event.clipboardData);
					if (!files.length) return;
					// A picture copied with words (from a page): the words pasted too.
					if (!event.clipboardData.getData('text/plain')) event.preventDefault();
					void actions.addPictures(files);
				}}
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
	return (
		<ItemsContext value={context}>
			<PagePeek root={pane} pages={actions.articles} open={actions.openArticle} />
			<Toolbar state={state} actions={actions} />
			<ModelsSheet open={state.settings} host={sheetHost} onClose={() => actions.showSheet(false)} />
			<Transcript state={state} actions={actions} />
			<Composer state={state} actions={actions} />
		</ItemsContext>
	);
}
