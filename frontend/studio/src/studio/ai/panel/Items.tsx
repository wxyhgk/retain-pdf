import { createContext, memo, useContext, useEffect, useRef, useState } from 'react';

import type { Conversation, ConversationItem } from '../../api/client';
import { STUDIO_MARKDOWN_DRAG_TYPE } from '../../files/article-files';
import { isPicture, pictureUrl, renderAiMarkdown } from '../ai-markdown';
import type { PanelActions } from './panel-state';

export type ToolItem = Extract<ConversationItem, { kind: 'tool' }>;

/** What each item is drawn with: the conversation (its folder, whether it works), all its items, what the panel does. */
export const ItemsContext = createContext<{ conversation: Conversation | null; items: ConversationItem[]; actions: PanelActions } | null>(null);
const useItems = () => useContext(ItemsContext)!;

const PERMISSION_NAMES: Record<string, string> = { allow_once: '允许', allow_always: '总是允许', reject_once: '拒绝', reject_always: '总是拒绝' };
const TOOL_ICONS: Record<string, string> = { execute: '›_', read: '◫', edit: '✎', delete: '⌫', move: '⇄', search: '⌕', fetch: '⇣', think: '…', switch_mode: '⇆', other: '•' };
const STOP_NAMES: Record<string, string> = { cancelled: '已停止', max_tokens: '回答太长，停在这里了', max_turn_requests: '步数到了上限，停在这里了', refusal: '它拒绝了这个请求' };

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

/**
 * Markdown as the panel draws it (ai-markdown.ts: formulas, code, the plugins' blocks); `blocks`, each top block with a
 * handle at its left to drag it into the article (or click, to put it where the caret is). Drawn by that renderer in
 * an element of its own, out of reach of the shell's reset (data-host).
 */
function Markdown({ text, blocks = false, className }: { text: string; blocks?: boolean; className: string }) {
	const { actions } = useItems();
	const node = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const words = node.current!;
		const drawn = renderAiMarkdown(text, { blocks });
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
			handle.title = '拖到文章里；点一下插入到光标处';
			handle.setAttribute('aria-label', '插入这一块到文章');
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
	}, [text, blocks]);
	return <div ref={node} className={className} data-host />;
}

function User({ item }: { item: Extract<ConversationItem, { kind: 'user' }> }) {
	const told = item.context;
	const names = [told?.article ? `📄 ${told.article}${told.selection ? ` · ${told.selection}` : ''}` : '', ...(told?.mentions ?? []).map((title) => `@ ${title}`)].filter(Boolean);
	return (
		<div className="ai-user">
			<div className="ai-bubble">{item.text}</div>
			{item.steer && <div className="ai-user-context">插话</div>}
			{names.length > 0 && (
				<div className="ai-user-context">
					{names.map((name) => (
						<span key={name} className="ai-chip-label">
							{name}
						</span>
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
					<button type="button" onClick={() => actions.insert(whole)}>
						插入到文章
					</button>
					<button type="button" onClick={() => actions.copy(whole)}>
						复制
					</button>
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
			<summary>{thinking ? '思考中…' : '思考过程'}</summary>
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
				{!removed.length && !added.length && <span>（没有改动）</span>}
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
				<span className="ai-tool-state" aria-label={{ pending: '等待', in_progress: '进行中', completed: '完成', failed: '失败' }[item.status]}>
					{item.status === 'completed' ? '✓' : item.status === 'failed' ? '✗' : item.status === 'pending' ? '等待' : ''}
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
				{failedExit && <p className="ai-tool-exit">退出码 {item.exitCode}</p>}
			</div>
		</div>
	);
}

function Plan({ item }: { item: Extract<ConversationItem, { kind: 'plan' }> }) {
	return (
		<div className="ai-plan">
			<p className="ai-plan-title">计划</p>
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
	const what = (tool && commandOf(tool)) || item.title || '这一步';
	const chosen = item.chosen ? item.options.find((entry) => entry.optionId === item.chosen) : undefined;
	return (
		<div className={`ai-permission${item.chosen ? ' is-answered' : ''}`}>
			<p className="ai-permission-ask">要允许它这么做吗？</p>
			<code className="ai-permission-what">{what}</code>
			{item.chosen ? (
				<p className="ai-permission-answer">{chosen ? `已${PERMISSION_NAMES[chosen.kind] ?? chosen.name}` : '没有回答（已停止）'}</p>
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

/** The fix for what most often fails, a login or a key: where to set them, right there. */
export function SettingsFix() {
	const { actions } = useItems();
	return (
		<button type="button" className="ai-status-fix" onClick={() => actions.showSheet(true)}>
			模型和账号
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
								接着说
							</button>
						</>
					)}
				</div>
			);
		case 'stop':
			return <div className="ai-stop">{STOP_NAMES[item.reason] ?? `停了（${item.reason}）`}</div>;
		case 'error':
			return (
				<div className="ai-error">
					{item.message} <SettingsFix />
				</div>
			);
	}
});
