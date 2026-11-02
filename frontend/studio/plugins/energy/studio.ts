import { t } from '@blog/i18n/index.mjs';
import type { Context } from '@blog/kernel/index.mjs';
import type { StudioBlock } from '@blog/kernel/studio.ts';
import type { EditorView } from '@milkdown/prose/view';

import { ENERGY_LANGUAGE, ENERGY_STARTER, energyFigure, parseEnergy } from './energy.mjs';
import energyCss from './energy.css?raw';

const ICON =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M6 15h3M11 7h3M16 17h3"/><path d="M9 15l2-8M14 7l2 10" stroke-dasharray="2 2"/></svg>';

/** The editor's own part: what could not be read, under the diagram. */
const EDITOR_CSS = `
.note-energy-problems { margin: 6px 0 0; padding: 0; list-style: none; color: rgb(var(--gray)); font-size: 12px; text-align: left; }
`;

type Hast = { type: 'element'; tagName: string; properties: Record<string, unknown>; children: (Hast | { type: 'text'; value: string })[] };

const SVG = 'http://www.w3.org/2000/svg';

/** The figure as DOM, its diagram as SVG. */
function toDom(node: Hast, svg = false): Element {
	const inSvg = svg || node.tagName === 'svg';
	const element = inSvg ? document.createElementNS(SVG, node.tagName) : document.createElement(node.tagName);
	for (const [key, value] of Object.entries(node.properties)) {
		const name = key === 'className' ? 'class' : key === 'ariaLabel' ? 'aria-label' : key;
		element.setAttribute(name, Array.isArray(value) ? value.join(' ') : String(value));
	}
	for (const child of node.children) element.append(child.type === 'text' ? document.createTextNode(child.value) : toDom(child, inSvg));
	return element;
}

/** The preview of an ```energy block: its diagram, and what could not be read; null for the other languages. */
function energyPreview(language: string, content: string): HTMLElement | null {
	if (language.toLowerCase() !== ENERGY_LANGUAGE) return null;
	const profile = parseEnergy(content);
	const figure = toDom(energyFigure(profile) as Hast) as HTMLElement;
	if (profile.problems.length) {
		const list = document.createElement('ul');
		list.className = 'note-energy-problems';
		for (const problem of profile.problems) {
			const item = document.createElement('li');
			item.textContent = t('第 {line} 行：{reason}', { line: problem.line, reason: problem.reason });
			list.append(item);
		}
		figure.append(list);
	}
	return figure;
}

/** Puts a new diagram where the caret's (empty) block is. */
function insertEnergy(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes.code_block;
	if (!type) return;
	const { $from } = state.selection;
	const block = type.create({ language: ENERGY_LANGUAGE }, state.schema.text(ENERGY_STARTER));
	view.dispatch(state.tr.replaceWith($from.before(), $from.after(), block).scrollIntoView());
	view.focus();
}

/**
 * The Studio: ```energy blocks are code blocks, previewed as the diagram the
 * blog shows, redrawn as they change; in the slash menu's 化学 as 能量图.
 */
export const name = 'block-energy';
export const description = t('反应能量图（```energy）：一行一个物种（名字 能量），# 开始另一条路径，画成论文里那样的能量剖面图；博客上是 SVG，不要脚本。');
export const inject = ['blocks', 'styles'];

export function apply(ctx: Context): void {
	ctx.styles.add(energyCss + EDITOR_CSS);
	ctx.blocks.register({
		name,
		fence: ENERGY_LANGUAGE,
		codeBlock: { preview: energyPreview },
		menuGroup: { key: 'science', label: t('化学') },
		menu: {
			key: 'energy',
			label: t('能量图'),
			description: t('反应的势能面'),
			hint: '```energy',
			icon: ICON,
			keywords: ['energy', 'profile', 'diagram', 'pes', 'reaction', '势能面', '反应', '过渡态', 'nengliangtu', 'nlt', 'shinengmian'], // i18n-ignore: matched against what is typed
			insert: insertEnergy,
		},
	} satisfies StudioBlock);
}
