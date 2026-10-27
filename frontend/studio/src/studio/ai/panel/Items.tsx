import { createContext, memo, useContext, useEffect, useRef, useState } from 'react';

import { Copy, FilePlus2, PencilLine, RotateCcw, type LucideIcon } from 'lucide-react';

import { t } from '@blog/i18n/index.mjs';
import type { Conversation, ConversationItem } from '../../api/client';
import { STUDIO_MARKDOWN_DRAG_TYPE } from '../../files/article-files';
import { isPicture, pictureUrl, renderAiMarkdown } from '../ai-markdown';
import { PageIcon } from './PagePeek';
import { mentionsIn, type PageInfo, type PanelActions } from './panel-state';

export type ToolItem = Extract<ConversationItem, { kind: 'tool' }>;

/** What each item is drawn with: the conversation (its folder, whether it works), all its items, what the panel does. */
export const ItemsContext = createContext<{ conversation: Conversation | null; items: ConversationItem[]; actions: PanelActions } | null>(null);
const useItems = () => useContext(ItemsContext)!;

const PERMISSION_NAMES: Record<string, string> = { allow_once: t('允许'), allow_always: t('总是允许'), reject_once: t('拒绝'), reject_always: t('总是拒绝') };
const PERMISSION_CHOSEN: Record<string, string> = { allow_once: t('已允许'), allow_always: t('已总是允许'), reject_once: t('已拒绝'), reject_always: t('已总是拒绝') };
const TOOL_ICONS: Record<string, string> = { execute: '›_', read: '◫', edit: '✎', delete: '⌫', move: '⇄', search: '⌕', fetch: '⇣', think: '…', switch_mode: '⇆', other: '•' };
const STOP_NAMES: Record<string, string> = { cancelled: t('已停止'), max_tokens: t('回答太长，停在这里了'), max_turn_requests: t('步数到了上限，停在这里了'), refusal: t('它拒绝了这个请求') };

/** The pictures a tool call read (a plot the agent drew, looked at): their paths. */
export function picturesOf(item: ToolItem): string[] {
	if (item.toolKind !== 'read') return [];
	const input = item.rawInput as { path?: unknown; file_path?: unknown } | null;
	const paths = [...item.locations.map((location) => location.path), input?.path, input?.file_path].filter((path): path is string => typeof path === 'string' && isPicture(path));
	return [...new Set(paths)];
}

/** The command a tool call runs, if it runs one. */
export function commandOf(item: ToolItem): string | null {
	const input = item.rawInput as { command?: unknown } | null;
	if (item.toolKind !== 'execute') return null;
	if (typeof input?.command === 'string') return input.command;
	if (Array.isArray(input?.command)) return input.command.join(' ');
	return item.title || null;
}

/** A path as within the conversation's folder. */
export function relativeTo(conversation: Conversation | null, path: string): string {
	const base = conversation?.cwd ? `${conversation.cwd.replace(/\/$/u, '')}/` : '';
	return base && path.startsWith(base) ? path.slice(base.length) : path;
}

/** A quiet action under something said: its icon, named for those who cannot see it. */
function Act({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick(): void }) {
	return (
		<button type="button" aria-label={label} title={label} onClick={onClick}>
			<Icon aria-hidden />
		</button>
	);
}

/**
 * Markdown as the panel draws it (ai-markdown.ts: formulas, code, the plugins' blocks); `blocks`, each top block with a
 * handle at its left to drag it into the article (or click, to put it where the caret is). Drawn by that renderer in
 * an element of its own, out of reach of the shell's reset (data-host).
 */
export function Markdown({ text, blocks = false, className }: { text: string; blocks?: boolean; className: string }) {
	const { actions } = useItems();
	const node = useRef<HTMLDivElement>(null);
	const pages = actions.articles();
	useEffect(() => {
		const words = node.current!;
		const drawn = renderAiMarkdown(text, { blocks, pages });
		if (!blocks) {
			words.replaceChildren(drawn);
			return;
		}
		// As words stream in, only the blocks that changed are drawn again: those done (a molecule's 3D view…) stay as they are.
		const before = [...words.children] as HTMLElement[];
		const kept = ([...drawn.children] as HTMLElement[]).map((block, at) => {
			const old = before[at];
			return old?.dataset.markdown !== undefined && old.dataset.markdown === block.dataset.markdown && old.className === block.className ? old : block;
		});
		if (kept.length === before.length && kept.every((block, at) => block === before[at])) return;
		words.replaceChildren(...kept);
		for (const block of kept) {
			const markdown = block.dataset.markdown;
			if (markdown === undefined || block.querySelector(':scope > .ai-block-handle')) continue;
			const handle = document.createElement('button');
			handle.className = 'ai-block-handle';
			handle.type = 'button';
			handle.draggable = true;
			handle.title = t('拖到文章里；点一下插入到光标处');
			handle.setAttribute('aria-label', t('插入这一块到文章'));
			handle.addEventListener('dragstart', (event) => {
				if (!event.dataTransfer) return;
				event.dataTransfer.setData(STUDIO_MARKDOWN_DRAG_TYPE, markdown);
				event.dataTransfer.setData('text/plain', markdown);
				event.dataTransfer.effectAllowed = 'copy';
				event.dataTransfer.setDragImage(block, 0, 0);
				block.classList.add('is-dragged');
			});
			handle.addEventListener('dragend', () => block.classList.remove('is-dragged'));
			handle.addEventListener('click', () => actions.insert(markdown));
			block.prepend(handle);
		}
	}, [text, blocks, pages]);
	return <div ref={node} className={className} data-host />;
}

/** An article told with what was said, as a link to it (PagePeek opens it); as words, one no longer there. */
export function PageChip({ page, label, title }: { page: PageInfo | undefined; label: string; title?: string }) {
	if (!page) return <span className="ai-chip-label">{label}</span>;
	return (
		<button type="button" className="ai-chip-label ai-page-chip" data-page={page.slug} title={title}>
			<PageIcon page={page} />
			<span className="ai-page-title">{label}</span>
		</button>
	);
}

function User({ item }: { item: Extract<ConversationItem, { kind: 'user' }> }) {
	const { actions } = useItems();
	const told = item.context;
	const pages = actions.articles();
	// By the article it was, else (said before that was kept, or renamed since) by its title.
	const find = (title: string, slug?: string | null) => (slug ? pages.find((page) => page.slug === slug) : undefined) ?? pages.find((page) => page.title === title);
	// The articles named with @ are links in what was said (said before that, they were named under it).
	const inText = new Set(mentionsIn(item.text, pages).map((page) => page.slug));
	const named = [
		...(told?.article ? [{ label: `${told.article}${told.selection ? ` · ${told.selection}` : ''}`, page: find(told.article, told.articleSlug) }] : []),
		...(told?.mentions ?? []).map((title, at) => ({ label: title, page: find(title, told?.mentionSlugs?.[at]) })).filter(({ page }) => !page || !inText.has(page.slug)),
	];
	return (
		<div className="ai-user">
			{(item.quotes ?? []).map((quote, at) => (
				<Markdown key={at} className="ai-quote ai-user-quote" text={quote} />
			))}
			{item.pictures?.length ? (
				<div className="ai-user-pictures">
					{item.pictures.map((path) => (
						<img key={path} className="ai-user-picture" src={pictureUrl(path)} alt="" />
					))}
				</div>
			) : null}
			{/* As it was written: Markdown, its formulas drawn, the articles named links to them. */}
			{item.text.trim() && <Markdown className="ai-bubble" text={item.text} />}
			{/* What was pasted at length: folded, opened to be read. */}
			{(item.pastes ?? []).map((paste, at) => (
				<details key={at} className="ai-paste">
					<summary>{t('已粘贴 {count} 行', { count: paste.replace(/\n+$/u, '').split('\n').length })}</summary>
					<pre>{paste}</pre>
				</details>
			))}
			{/* Copied, or put back in the input to be changed and said again. */}
			<div className="ai-message-actions ai-user-actions">
				<Act icon={Copy} label={t('复制')} onClick={() => actions.copy(item.text)} />
				<Act icon={PencilLine} label={t('改一改再问')} onClick={() => actions.ask(item.text)} />
			</div>
			{item.steer && <div className="ai-user-context">{t('插话')}</div>}
			{named.length > 0 && (
				<div className="ai-user-context">
					{named.map(({ label, page }, at) => (
						<PageChip key={at} page={page} label={label} />
					))}
				</div>
			)}
		</div>
	);
}

/** What the AI said, block by block as in an article; under it, all of it put in, or copied as Markdown. */
function Message({ item }: { item: Extract<ConversationItem, { kind: 'message' }> }) {
	const { actions } = useItems();
	const whole = item.text.trim();
	return (
		<div className="ai-answer">
			<Markdown className="ai-message" text={item.text} blocks />
			{whole && (
				<div className="ai-message-actions">
					<Act icon={FilePlus2} label={t('插入到文章')} onClick={() => actions.insert(whole)} />
					<Act icon={Copy} label={t('复制')} onClick={() => actions.copy(whole)} />
				</div>
			)}
		</div>
	);
}

function Thought({ item }: { item: Extract<ConversationItem, { kind: 'thought' }> }) {
	const { conversation, items } = useItems();
	const thinking = items.at(-1) === item && conversation?.state === 'running';
	// In the dialog of its stretch: open, as it is opened to be read.
	return (
		<details className={`ai-thought${thinking ? ' is-going' : ''}`} open>
			<summary>{thinking ? t('思考中…') : t('思考过程')}</summary>
			<div className="ai-thought-text">{item.text}</div>
		</details>
	);
}

/** A change to a file: its lines taken away and put in, those kept in common at either end left out. */
function Diff({ path, before, after }: { path: string; before: string; after: string }) {
	const { conversation } = useItems();
	const old = before ? before.split('\n') : [];
	const next = after.split('\n');
	let head = 0;
	while (head < old.length && head < next.length && old[head] === next[head]) head += 1;
	let tail = 0;
	while (tail < old.length - head && tail < next.length - head && old[old.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
	const removed = old.slice(head, old.length - tail);
	const added = next.slice(head, next.length - tail);
	return (
		<div className="ai-diff">
			<p className="ai-diff-path">{relativeTo(conversation, path)}</p>
			<pre className="ai-diff-lines">
				{removed.map((line, at) => (
					<span key={`-${at}`} className="is-removed">{`- ${line}\n`}</span>
				))}
				{added.map((line, at) => (
					<span key={`+${at}`} className="is-added">{`+ ${line}\n`}</span>
				))}
				{!removed.length && !added.length && <span>{t('（没有改动）')}</span>}
			</pre>
		</div>
	);
}

function Tool({ item }: { item: ToolItem }) {
	const { conversation } = useItems();
	const [open, setOpen] = useState(false);
	const command = commandOf(item);
	const paths = item.locations.map((location) => relativeTo(conversation, location.path) + (location.line ? `:${location.line}` : ''));
	const texts = item.content.flatMap((content) => (content.type === 'content' && content.content.type === 'text' && content.content.text && content.content.text !== command ? [content.content.text] : []));
	const diffs = item.content.flatMap((content) => (content.type === 'diff' ? [content] : []));
	const pictures = picturesOf(item);
	const output = item.output ? (item.output.length > 20_000 ? `…${item.output.slice(-20_000)}` : item.output) : '';
	const failedExit = item.exitCode !== null && item.exitCode !== 0;
	const hasDetail = (paths.length > 0 && item.toolKind !== 'edit') || texts.length > 0 || diffs.length > 0 || pictures.length > 0 || Boolean(output) || failedExit;
	const label = command ?? item.title ?? '';
	return (
		<div className={`ai-tool${open ? ' is-open' : ''}${hasDetail ? ' has-detail' : ''}`} data-status={item.status} data-kind={item.toolKind}>
			<button type="button" className="ai-tool-row" aria-expanded={open} onClick={() => setOpen(!open)}>
				<span className="ai-tool-icon">{TOOL_ICONS[item.toolKind] ?? TOOL_ICONS.other}</span>
				<span className={`ai-tool-title${command ? ' is-command' : ''}`} title={label}>
					{label}
				</span>
				<span className="ai-tool-state" aria-label={{ pending: t('等待'), in_progress: t('进行中'), completed: t('完成'), failed: t('失败') }[item.status]}>
					{item.status === 'completed' ? '✓' : item.status === 'failed' ? '✗' : item.status === 'pending' ? t('等待') : ''}
				</span>
			</button>
			<div className="ai-tool-detail">
				{paths.length > 0 && item.toolKind !== 'edit' && <p className="ai-tool-paths">{paths.join('  ')}</p>}
				{diffs.map((diff, at) => (
					<Diff key={at} path={diff.path} before={diff.oldText ?? ''} after={diff.newText} />
				))}
				{texts.map((text, at) => (
					<Markdown key={at} className="ai-tool-text" text={text} />
				))}
				{/* A picture it looked at (read): shown, as the agent saw it. */}
				{pictures.map((path) => (
					<img key={path} className="ai-tool-picture" src={pictureUrl(path)} alt={relativeTo(conversation, path)} />
				))}
				{output && <pre className="ai-tool-output">{output}</pre>}
				{failedExit && <p className="ai-tool-exit">{t('退出码 {code}', { code: item.exitCode })}</p>}
			</div>
		</div>
	);
}

function Plan({ item }: { item: Extract<ConversationItem, { kind: 'plan' }> }) {
	return (
		<div className="ai-plan">
			<p className="ai-plan-title">{t('计划')}</p>
			<ul>
				{item.entries.map((entry, at) => (
					<li key={at} className={`is-${entry.status}`}>
						<span className="ai-plan-mark">{entry.status === 'completed' ? '✓' : entry.status === 'in_progress' ? '◐' : '○'}</span>
						<span>{entry.content}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function Permission({ item }: { item: Extract<ConversationItem, { kind: 'permission' }> }) {
	const { items, actions } = useItems();
	const [answered, setAnswered] = useState(false);
	const tool = items.find((entry): entry is ToolItem => entry.kind === 'tool' && entry.id === item.toolCallId);
	const what = (tool && commandOf(tool)) || item.title || t('这一步');
	const chosen = item.chosen ? item.options.find((entry) => entry.optionId === item.chosen) : undefined;
	// What it asks leave for, there to be read before it is allowed: the change to a file, the plan, what it says of it.
	const diffs = tool?.content.flatMap((content) => (content.type === 'diff' ? [content] : [])) ?? [];
	const plan = (tool?.rawInput as { plan?: unknown } | null)?.plan;
	const texts = tool?.content.flatMap((content) => (content.type === 'content' && content.content.type === 'text' && content.content.text && content.content.text !== what ? [content.content.text] : [])) ?? [];
	return (
		<div className={`ai-permission${item.chosen ? ' is-answered' : ''}`}>
			<p className="ai-permission-ask">{t('要允许它这么做吗？')}</p>
			<code className="ai-permission-what">{what}</code>
			{!item.chosen && (diffs.length > 0 || typeof plan === 'string' || texts.length > 0) && (
				<div className="ai-permission-detail">
					{diffs.map((diff, at) => (
						<Diff key={at} path={diff.path} before={diff.oldText ?? ''} after={diff.newText} />
					))}
					{typeof plan === 'string' ? <Markdown className="ai-tool-text" text={plan} /> : texts.map((text, at) => <Markdown key={at} className="ai-tool-text" text={text} />)}
				</div>
			)}
			{item.chosen ? (
				<p className="ai-permission-answer">{chosen ? (PERMISSION_CHOSEN[chosen.kind] ?? t('已{choice}', { choice: chosen.name })) : t('没有回答（已停止）')}</p>
			) : (
				<div className="ai-permission-choices">
					{item.options.map((option) => (
						<button
							key={option.optionId}
							type="button"
							className={option.kind.startsWith('allow') ? 'is-allow' : 'is-reject'}
							title={option.name}
							disabled={answered}
							onClick={() => {
								setAnswered(true);
								actions.answer(item.id, option.optionId);
							}}
						>
							{PERMISSION_NAMES[option.kind] ?? option.name}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

type Choice = { const: string; title?: string; description?: string };

/**
 * A question it asks (Claude Code's AskUserQuestion, as an ACP form): each field a row of choices (one, or several), or
 * words; a field `…_custom` the words of one's own for the question before it. Answered, what was chosen, in a line.
 */
function Question({ item }: { item: Extract<ConversationItem, { kind: 'question' }> }) {
	const { conversation, actions } = useItems();
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [sent, setSent] = useState(false);
	const fields = Object.entries(item.schema?.properties ?? {});
	const own = (key: string) => /_custom$/u.test(key);
	const set = (key: string, value: unknown) => setValues((now) => ({ ...now, [key]: value }));
	const answer = (response: Parameters<typeof actions.answerQuestion>[1]) => {
		setSent(true);
		actions.answerQuestion(item.id, response);
	};
	if (item.answer) {
		const content = item.answer.action === 'accept' ? item.answer.content : {};
		const said = fields
			.map(([key]) => content[key])
			.flatMap((value) => (Array.isArray(value) ? value : [value]))
			.filter((value) => value !== undefined && value !== null && value !== '')
			.map(String);
		return (
			<div className="ai-question is-answered">
				<p className="ai-question-ask">{item.message}</p>
				<p className="ai-question-answer">
					{item.answer.action === 'accept' && said.length ? t('你答：{answer}', { answer: said.join('；') }) : item.answer.action === 'decline' ? t('跳过了') : t('没有回答（已停止）')}
				</p>
			</div>
		);
	}
	const waiting = conversation?.state === 'running' && !sent;
	return (
		<div className="ai-question" role="group" aria-label={item.message}>
			<p className="ai-question-ask">{item.message}</p>
			{fields.map(([key, field]) => {
				const choices: Choice[] = field.oneOf ?? field.items?.anyOf ?? [];
				const several = Boolean(field.items?.anyOf);
				const value = values[key];
				return (
					<div key={key} className="ai-question-field">
						{!own(key) && (field.title || (fields.filter(([other]) => !own(other)).length > 1 && field.description)) && (
							<p className="ai-question-label">{[field.title, fields.filter(([other]) => !own(other)).length > 1 ? field.description : ''].filter(Boolean).join(' · ')}</p>
						)}
						{choices.length > 0 ? (
							<div className="ai-question-choices">
								{choices.map((choice) => {
									const chosen = several ? Array.isArray(value) && value.includes(choice.const) : value === choice.const;
									return (
										<button
											key={choice.const}
											type="button"
											className={chosen ? 'is-chosen' : ''}
											aria-pressed={chosen}
											title={choice.description}
											disabled={!waiting}
											onClick={() => {
												if (!several) return set(key, chosen ? undefined : choice.const);
												const now = Array.isArray(value) ? (value as string[]) : [];
												set(key, chosen ? now.filter((entry) => entry !== choice.const) : [...now, choice.const]);
											}}
										>
											<span className="ai-question-choice">{choice.title ?? choice.const}</span>
											{choice.description && <span className="ai-question-note">{choice.description}</span>}
										</button>
									);
								})}
							</div>
						) : field.type === 'boolean' ? (
							<input type="checkbox" checked={value === true} disabled={!waiting} onChange={(event) => set(key, event.target.checked)} />
						) : (
							<input
								className="ai-question-words"
								type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
								placeholder={own(key) ? t('或者自己写…') : (field.description ?? '')}
								aria-label={own(key) ? t('自己写的回答') : (field.title ?? key)}
								disabled={!waiting}
								value={typeof value === 'string' || typeof value === 'number' ? value : ''}
								onChange={(event) => set(key, field.type === 'number' || field.type === 'integer' ? Number(event.target.value) : event.target.value)}
							/>
						)}
					</div>
				);
			})}
			<div className="ai-question-actions">
				<button type="button" className="is-answer" disabled={!waiting} onClick={() => answer({ action: 'accept', content: values })}>
					{t('回答')}
				</button>
				<button type="button" disabled={!waiting} onClick={() => answer({ action: 'decline' })}>
					{t('跳过')}
				</button>
			</div>
		</div>
	);
}

/** Its context compacted: a line across; the summary it keeps of what was said before, opened from it. */
function Compaction({ item }: { item: Extract<ConversationItem, { kind: 'compaction' }> }) {
	const said = { in_progress: t('正在压缩上下文…'), completed: t('上下文已压缩'), failed: t('压缩上下文失败：{error}', { error: item.error }), cancelled: t('压缩上下文停下了') }[item.status];
	if (!item.summary.trim()) return <div className={`ai-compaction is-${item.status}`}>{said}</div>;
	return (
		<details className={`ai-compaction is-${item.status}`}>
			<summary>{said}</summary>
			<Markdown className="ai-tool-text ai-compaction-summary" text={item.summary} />
		</details>
	);
}

/** The fix for what most often fails, a login or a key: where to set them, right there. */
export function SettingsFix() {
	const { actions } = useItems();
	return (
		<button type="button" className="ai-status-fix" onClick={() => actions.showSheet(true)}>
			{t('模型和账号')}
		</button>
	);
}

/** An item of the conversation as the panel shows it (a stretch of work is shown by its row, WorkRow). */
export const Item = memo(function Item({ item }: { item: ConversationItem }) {
	const { items, actions } = useItems();
	switch (item.kind) {
		case 'user':
			return <User item={item} />;
		case 'message':
			return <Message item={item} />;
		case 'thought':
			return <Thought item={item} />;
		case 'tool':
			return <Tool item={item} />;
		case 'plan':
			return <Plan item={item} />;
		case 'permission':
			return <Permission item={item} />;
		case 'question':
			return <Question item={item} />;
		case 'notice':
			return (
				<div className={`ai-notice is-${item.severity}`}>
					<strong>{item.title}</strong>
					<span>{item.description ? ` ${item.description}` : ''}</span>
					{/* Nothing said: asked to say it, while it is the last thing in the conversation. */}
					{item.resume && items.at(-1)?.id === item.id && (
						<>
							{' '}
							<button type="button" className="ai-status-fix" onClick={actions.resume}>
								{t('接着说')}
							</button>
						</>
					)}
				</div>
			);
		case 'stop':
			return <div className="ai-stop">{STOP_NAMES[item.reason] ?? t('停了（{reason}）', { reason: item.reason })}</div>;
		case 'error':
			return (
				<div className="ai-error">
					{item.message} <SettingsFix />
					{/* The last thing in the conversation: what was said, said again. */}
					{items.at(-1)?.id === item.id && (
						<button type="button" className="ai-status-fix" onClick={actions.retry}>
							{t('重试')}
						</button>
					)}
				</div>
			);
		case 'compaction':
			return <Compaction item={item} />;
	}
});
