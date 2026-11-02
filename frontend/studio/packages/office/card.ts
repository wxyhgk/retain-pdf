import { t } from '@blog/i18n/index.mjs';
import { OFFICE_KIND_NAMES, fileSize, type OfficeKind } from './kinds.mjs';
import { drawOffice, officeBytes } from './render.ts';
import { openOfficeFile } from './viewer.ts';
import './office.css';

/**
 * An office file in an article, as a card: its first page, slide or rows
 * small at the left; its name, kind, length and size at the right; 预览
 * shows it whole (office-viewer.ts), 下载 saves it. A link alone in its
 * paragraph to one of the article's office files is one (remark-office-cards
 * on the blog, office-card-block in the Studio), drawn from the same markup:
 *
 *   div.office-card[data-office-kind][data-office-size]
 *     div.office-card-thumb
 *     div.office-card-info
 *       a.office-card-name[href]   the file, which is all a page without script has
 *       span.office-card-meta
 *
 * The start is drawn when the card comes near the screen, once a file.
 */

/** How wide the start of the file is drawn. */
const THUMB_WIDTH = 176;
/** How wide a slide is laid out before it is made small. */
const SLIDE_WIDTH = 640;

type CardFile = { url: string; name: string; kind: OfficeKind; size?: number };

/** The card's markup for a file, before it is drawn. */
export function officeCardElement(file: CardFile): HTMLElement {
	const card = document.createElement('div');
	card.className = 'office-card';
	card.dataset.officeKind = file.kind;
	if (file.size !== undefined) card.dataset.officeSize = String(file.size);
	const thumb = document.createElement('div');
	thumb.className = 'office-card-thumb';
	const info = document.createElement('div');
	info.className = 'office-card-info';
	const name = document.createElement('a');
	name.className = 'office-card-name';
	name.href = file.url;
	name.textContent = file.name;
	const meta = document.createElement('span');
	meta.className = 'office-card-meta';
	meta.textContent = OFFICE_KIND_NAMES[file.kind];
	info.append(name, meta);
	card.append(thumb, info);
	return card;
}

type Drawn = { node: HTMLElement; count: number; size: number };

/** Each file's start, drawn once; a card shows a copy. */
const drawings = new Map<string, Promise<Drawn>>();

function countText(kind: OfficeKind, count: number): string {
	if (!count) return '';
	if (kind === 'document') return t('{count} 页', { count });
	if (kind === 'slides') return t('{count} 张', { count });
	return count > 1 ? t('{count} 个工作表', { count }) : '';
}

/** The start of a file, small: drawn full size off to the side, then scaled to the card. */
async function drawStart(url: string, kind: Exclude<OfficeKind, 'old'>): Promise<Drawn> {
	const bytes = await officeBytes(url);
	const stage = document.createElement('div');
	stage.className = 'office-card-stage';
	document.body.append(stage);
	try {
		const drawn = await drawOffice(kind, bytes, stage, { width: SLIDE_WIDTH, start: true });
		if (kind === 'document') {
			// The first page only: the rest is not shown and costs memory in every copy.
			for (const page of [...stage.querySelectorAll('section.docx')].slice(1)) page.remove();
		}
		const first = stage.querySelector<HTMLElement>('section.docx, .pptx-preview-slide-wrapper, table') ?? stage;
		const width = Math.max(first.scrollWidth, 1);
		const node = document.createElement('div');
		node.className = 'office-card-page';
		node.append(...stage.childNodes);
		node.style.width = `${width}px`;
		node.style.transform = `scale(${Math.min(1, THUMB_WIDTH / width)})`;
		return { node, count: drawn.count, size: bytes.byteLength };
	} finally {
		stage.remove();
	}
}

function startOf(url: string, kind: Exclude<OfficeKind, 'old'>): Promise<Drawn> {
	let drawing = drawings.get(url);
	if (!drawing) {
		drawing = drawStart(url, kind);
		drawings.set(url, drawing);
		drawing.catch(() => drawings.delete(url));
	}
	return drawing;
}

function describe(card: HTMLElement, kind: OfficeKind, count: number, size: number | undefined): void {
	const meta = card.querySelector<HTMLElement>('.office-card-meta');
	if (meta) meta.textContent = [OFFICE_KIND_NAMES[kind], countText(kind, count), size !== undefined ? fileSize(size) : ''].filter(Boolean).join(' · ');
}

/** Draws the start of the card's file into it. */
async function draw(card: HTMLElement): Promise<void> {
	const link = card.querySelector<HTMLAnchorElement>('.office-card-name');
	const thumb = card.querySelector<HTMLElement>('.office-card-thumb');
	const kind = card.dataset.officeKind as OfficeKind | undefined;
	if (!link || !thumb || !kind) return;
	const url = link.href;
	const known = card.dataset.officeSize ? Number(card.dataset.officeSize) : undefined;
	describe(card, kind, 0, known);
	if (kind === 'old') {
		thumb.dataset.state = 'old';
		thumb.textContent = link.textContent?.split('.').pop()?.toUpperCase() ?? '';
		return;
	}
	thumb.dataset.state = 'loading';
	try {
		const drawn = await startOf(url, kind);
		if (link.href !== url) return;
		thumb.replaceChildren(drawn.node.cloneNode(true));
		thumb.dataset.state = 'drawn';
		describe(card, kind, drawn.count, drawn.size);
	} catch (error) {
		thumb.dataset.state = 'failed';
		thumb.textContent = t('无法预览');
		thumb.title = error instanceof Error ? error.message : String(error);
	}
}

/** Gives a card what script adds: 预览 and 下载, the whole card opening the file. */
function connect(card: HTMLElement): void {
	if (card.dataset.officeConnected) return;
	card.dataset.officeConnected = 'true';
	const link = card.querySelector<HTMLAnchorElement>('.office-card-name');
	const info = card.querySelector<HTMLElement>('.office-card-info');
	if (!link || !info) return;
	const show = (event: Event) => {
		event.preventDefault();
		event.stopPropagation();
		void openOfficeFile(link.href, link.textContent ?? '');
	};
	const actions = document.createElement('span');
	actions.className = 'office-card-actions';
	if (card.dataset.officeKind !== 'old') {
		const open = document.createElement('button');
		open.type = 'button';
		open.className = 'office-card-button';
		open.textContent = t('预览');
		open.addEventListener('click', show);
		actions.append(open);
	}
	const save = document.createElement('a');
	save.className = 'office-card-button';
	save.textContent = t('下载');
	save.href = link.href;
	save.download = link.textContent ?? '';
	save.addEventListener('click', (event) => event.stopPropagation());
	actions.append(save);
	info.append(actions);
	if (card.dataset.officeKind !== 'old') {
		link.addEventListener('click', show);
		card.querySelector('.office-card-thumb')?.addEventListener('click', show);
	}
}

let watcher: IntersectionObserver | null = null;

/** Draws a card when it comes near the screen. */
export function watchOfficeCard(card: HTMLElement): void {
	connect(card);
	watcher ??= new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				watcher!.unobserve(entry.target);
				void draw(entry.target as HTMLElement);
			}
		},
		{ rootMargin: '400px 0px' },
	);
	watcher.observe(card);
}

/** Every card in the page, made ready (the blog's article). */
export function connectOfficeCards(root: ParentNode = document): void {
	for (const card of root.querySelectorAll<HTMLElement>('.office-card')) watchOfficeCard(card);
}

/** Files that changed (the Studio's): their cards drawn again. */
export function officeFilesChanged(urls: readonly string[]): void {
	const changed = new Set(urls.map((url) => new URL(url, location.href).href));
	for (const url of [...drawings.keys()]) if (changed.has(new URL(url, location.href).href)) drawings.delete(url);
	for (const card of document.querySelectorAll<HTMLElement>('.office-card')) {
		const link = card.querySelector<HTMLAnchorElement>('.office-card-name');
		if (link && changed.has(link.href)) {
			delete card.dataset.officeSize;
			void draw(card);
		}
	}
}

