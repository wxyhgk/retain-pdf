import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { cn } from '@studio/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@studio/ui/dialog';
import type { Conversation, ConversationItem, ConversationOption } from '../../api/client';
import { observePluginBlocks } from '../../plugins';
import { useStore, type Store } from '../../shell/store';
import { pictureUrl } from '../ai-markdown';
import { ModelsSheet, type ModelsSheetHost } from './ModelsSheet';
import { commandOf, Item, ItemsContext, picturesOf, relativeTo, SettingsFix, type ToolItem } from './Items';
import { SHOWN_OPTIONS, type ArticleRef, type PanelActions, type PanelState } from './panel-state';

/**
 * Names the adapters give in English, said in Chinese as what they let it do without asking (the rest as they come).
 * Claude Code's "accept edits" lets it change files, but asks before a command that does something (python, rm…).
 */
const OPTION_NAMES: Record<string, string> = {
	default: t('每步都问'),
	acceptEdits: t('自动改文件（命令要问）'),
	plan: t('只做计划'),
	auto: t('自动（只问危险的）'),
	bypassPermissions: t('全部允许（不再问）'),
	'read-only': t('只读（改动都要问）'),
	'workspace-write': t('可改文件夹（联网要问）'),
	agent: t('自动（只问不安全的）'),
	'agent-full-access': t('完全访问（不再问）'),
};
const EFFORT_NAMES: Record<string, string> = { default: t('思考：默认'), low: t('思考：低'), medium: t('思考：中'), high: t('思考：高'), xhigh: t('思考：很高'), max: t('思考：最高'), ultra: t('思考：极限') };
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
const SUGGESTIONS = [t('总结这篇文章'), t('检查这篇的公式和单位有没有错'), t('把文章里的计算重新跑一遍，核对结果'), t('找出正文里引用了却没在 refs.bib 里的文献')];

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
	const picture = (event.target as Element | null)?.closest?.<HTMLImageElement>('.ai-message img, .ai-tool-picture');
	if (!picture) return;
	event.preventDefault();
	show({ src: picture.src, alt: picture.alt });
}

/** What the plugins' previews leave to be drawn (a molecule's 3D view, a widget's frame), drawn in `node` too. */
function usePluginBlocks(node: React.RefObject<HTMLElement | null>, ready = true): void {
	useEffect(() => {
		if (ready && node.current) void observePluginBlocks(node.current);
	}, [ready]);
}

function Toolbar({ state, actions }: { state: PanelState; actions: PanelActions }) {
	const title = state.conversation?.title || t('新对话');
	const button = (label: string, text: string, onClick: (event: MouseEvent<HTMLButtonElement>) => void, hint = label) => (
		<button type="button" title={hint} aria-label={label} onClick={onClick}>
			{text}
		</button>
	);
	return (
		<header className="pane-toolbar ai-toolbar">
			<span className="ai-title" title={title}>
				{title}
			</span>
			<span className="ai-where">{state.conversation?.service ?? ''}</span>
			<div className="pane-actions">
				{state.full ? button(t('收回到右边'), '⤡', actions.toggleWhole) : button(t('在页面中打开'), '⤢', actions.toggleWhole, t('在页面中打开（AI 问答）'))}
				{button(t('模型和账号'), '⚙', () => actions.showSheet(!state.settings), t('模型和账号：Claude 账号、DeepSeek 等 API key'))}
				{button(t('对话记录'), '≡', (event) => actions.history(event.currentTarget))}
				{button(t('新对话'), '＋', actions.newConversation)}
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
function WorkDialog({ run, title, onClose, onPicture }: { run: ConversationItem[]; title: string; onClose(): void; onPicture(picture: { src: string; alt: string }): void }) {
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
				<div ref={setBody} className="ai-work-body" onClick={(event) => pictureClicked(event, onPicture)}>
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
	const [workShown, setWorkShown] = useState<string | null>(null);
	const [picture, setPicture] = useState<{ src: string; alt: string } | null>(null);
	const rows = useMemo(() => laidOut(items), [items]);
	usePluginBlocks(list);

	useLayoutEffect(() => {
		if (!away.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
	});

	const shownRun = workShown ? rows.find((row): row is { work: ConversationItem[] } => 'work' in row && row.work[0]!.id === workShown)?.work : undefined;
	return (
		<div
			ref={scroller}
			className="ai-transcript"
			role="log"
			aria-live="polite"
			onScroll={(event) => {
				const node = event.currentTarget;
				away.current = node.scrollHeight - node.scrollTop - node.clientHeight > 40;
			}}
		>
			<div className="ai-empty" hidden={items.length > 0}>
				<p className="ai-empty-title">{t('要做点什么？')}</p>
				<p className="ai-empty-hint">{t('它会自己读文件、运行命令、改文章；改了文章会像别的改动一样让你过目。')}</p>
				<div className="ai-suggestions">
					{SUGGESTIONS.map((text) => (
						<button key={text} type="button" className="ai-suggestion" onClick={() => actions.ask(text)}>
							{text}
						</button>
					))}
				</div>
			</div>
			<div ref={list} className="ai-items" onClick={(event) => pictureClicked(event, setPicture)}>
				{rows.map((row) =>
					'work' in row ? <WorkRow key={row.work[0]!.id} run={row.work} onOpen={() => setWorkShown(row.work[0]!.id)} /> : <Item key={row.item.id} item={row.item} />,
				)}
			</div>
			{shownRun && <WorkDialog run={shownRun} title={workSummary(shownRun, conversation, items).text} onClose={() => setWorkShown(null)} onPicture={setPicture} />}
			{picture && <PictureDialog picture={picture} onClose={() => setPicture(null)} />}
		</div>
	);
}

/** What follows an @ before the caret, if the author is naming an article. */
function naming(draft: string, caret: number): { from: number; query: string } | null {
	const before = draft.slice(0, caret);
	const found = /(^|\s)@([^\s@]*)$/u.exec(before);
	return found ? { from: before.length - found[2]!.length - 1, query: found[2]! } : null;
}

function Chip({ label, title, onRemove }: { label: string; title: string; onRemove(): void }) {
	return (
		<span className="ai-chip" title={title}>
			<span className="ai-chip-label">{label}</span>
			<button type="button" className="ai-chip-remove" aria-label={t('不带上{label}', { label })} onClick={onRemove}>
				×
			</button>
		</span>
	);
}

function OptionSelect({ option, onChange }: { option: ConversationOption; onChange(value: string): void }) {
	const choices = (option.options ?? []).flatMap((entry) => ('options' in entry ? entry.options : [entry]));
	const named = (value: string, name: string) => (option.category === 'thought_level' ? (EFFORT_NAMES[value] ?? t('思考：{name}', { name })) : option.category === 'mode' ? (OPTION_NAMES[value] ?? name) : name);
	return (
		<select className="ai-select" aria-label={option.name} title={option.description ?? option.name} value={String(option.currentValue)} onChange={(event) => onChange(event.target.value)}>
			{choices.map((choice) => (
				<option key={choice.value} value={choice.value}>
					{named(choice.value, choice.name)}
				</option>
			))}
		</select>
	);
}

function Composer({ state, actions }: { state: PanelState; actions: PanelActions }) {
	const { conversation, article, leftOut, selected, selectionLeftOut, mentions, draft, status } = state;
	const input = useRef<HTMLTextAreaElement>(null);
	const [caret, setCaret] = useState(0);
	const [mentionAt, setMentionAt] = useState(0);
	const [mentionsClosed, setMentionsClosed] = useState(false);
	const running = conversation?.state === 'running';

	// The input as tall as what is typed, up to 200px.
	useLayoutEffect(() => {
		const node = input.current!;
		node.style.height = 'auto';
		node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
	}, [draft]);
	// Asked to take the keys (focus, ask).
	useEffect(() => {
		if (state.focusAsked) input.current?.focus();
	}, [state.focusAsked]);

	const open = article && leftOut !== article.slug ? article : null;
	const chips: ReactNode[] = [];
	if (open) chips.push(<Chip key="article" label={`📄 ${open.title}`} title={t('当前文章：说话时会告诉 AI 你在看这篇')} onRemove={actions.leaveOutArticle} />);
	if (open && !selectionLeftOut && selected) chips.push(<Chip key="selection" label={t('选中的内容')} title={t('文章里选中的那几行会一起告诉 AI')} onRemove={actions.leaveOutSelection} />);
	for (const entry of mentions) chips.push(<Chip key={entry.slug} label={`@ ${entry.title}`} title={t('用 @ 提到的文章')} onRemove={() => actions.unmention(entry)} />);

	const asked = mentionsClosed ? null : naming(draft, caret);
	const needle = asked?.query.toLocaleLowerCase('zh-CN') ?? '';
	const choices = asked
		? actions
				.articles()
				.filter((entry) => !mentions.some((named) => named.slug === entry.slug))
				.filter((entry) => !needle || entry.title.toLocaleLowerCase('zh-CN').includes(needle) || entry.slug.includes(needle))
				.slice(0, 8)
		: [];
	const current = Math.min(mentionAt, Math.max(0, choices.length - 1));

	/** `entry` named: the @ and what was typed after it taken out of the input, the article a chip. */
	function mention(entry: ArticleRef): void {
		const at = naming(draft, caret);
		const next = at ? `${draft.slice(0, at.from)}${draft.slice(caret)}` : draft;
		actions.mention(entry, next);
		setMentionAt(0);
		if (at) {
			setCaret(at.from);
			requestAnimationFrame(() => input.current?.setSelectionRange(at.from, at.from));
		}
	}

	function keyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		const composing = event.nativeEvent.isComposing || event.keyCode === 229;
		// Choosing an article to name.
		if (choices.length && !composing) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				setMentionAt((current + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length);
				return;
			}
			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				mention(choices[current]!);
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

	const options = (conversation?.configOptions ?? []).filter((option) => option.type === 'select' && SHOWN_OPTIONS.includes(option.category ?? option.id));
	const used = conversation?.usage;
	return (
		<div className="ai-composer">
			<p className={cn('ai-status', status.error && 'is-error')} role="status">
				{status.text}
				{status.error && (
					<>
						{' '}
						<SettingsFix />
					</>
				)}
			</p>
			{/* What is told with what is said: the article open, what is selected in it, the articles named with @. */}
			<div className="ai-context" hidden={!chips.length}>
				{chips}
			</div>
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
				// While it works, to one that can take it: what is typed is a word in between (Enter), taken once its step is done.
				placeholder={running && conversation?.canSteer ? t('插话：它做完手头这一步就会看到（Enter）') : t('让 AI 做点什么…（@ 提到别的文章）')}
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
			/>
			<div className="ai-composer-bar">
				<select className="ai-select ai-agent" aria-label={t('用哪个 AI')} value={state.agent} onChange={(event) => actions.chooseAgent(event.target.value)}>
					{state.agents.map((agent) => (
						<option key={agent.id} value={agent.id}>
							{agent.name}
						</option>
					))}
				</select>
				<div className="ai-options">
					{options.map((option) => (
						<OptionSelect key={`${conversation?.id}:${option.id}:${String(option.currentValue)}`} option={option} onChange={(value) => actions.setOption(option.id, value)} />
					))}
				</div>
				<span className="ai-usage" title={used ? t('用掉的上下文 / 上下文上限（· 这次对话花费）') : ''}>
					{used ? `${Math.round(used.used / 1000)}k / ${used.size >= 1_000_000 ? `${used.size / 1_000_000}M` : `${Math.round(used.size / 1000)}k`}${used.cost ? ` · $${used.cost.amount.toFixed(2)}` : ''}` : ''}
				</span>
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
export function AiPanel({ store, actions, sheetHost }: { store: Store<PanelState>; actions: PanelActions; sheetHost: ModelsSheetHost }) {
	const state = useStore(store);
	const context = useMemo(() => ({ conversation: state.conversation, items: state.items, actions }), [state.conversation, state.items]);
	return (
		<ItemsContext value={context}>
			<Toolbar state={state} actions={actions} />
			<ModelsSheet open={state.settings} host={sheetHost} onClose={() => actions.showSheet(false)} />
			<Transcript state={state} actions={actions} />
			<Composer state={state} actions={actions} />
		</ItemsContext>
	);
}
