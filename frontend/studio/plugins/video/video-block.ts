import { $fencedBlock } from '@milkdown/kit/preset/commonmark';
import { NodeSelection, TextSelection } from '@milkdown/prose/state';
import type { Node as ProseNode } from '@milkdown/prose/model';
import type { EditorView, NodeView } from '@milkdown/prose/view';
import { $view } from '@milkdown/utils';

import { LOCAL_ONLY_EXTENSIONS } from '@blog/markdown/articles/rules.mjs';
import { articleFile, coverFor, localVideo, onlineVideo, parseVideo, VIDEO_LANGUAGE, videoFigure, writeVideo, type Video } from './video.mjs';

/**
 * A ```video fence in the editor (video.mjs). Empty, it asks for a link to a
 * video online or a video file of this machine; a file is put in the
 * article's assets/ (kept out of git) and plays here, a frame of it becoming
 * its cover, which is all the blog shows of it. 做封面 makes the frame shown
 * the cover. A video online plays in its site's player.
 */

export const VIDEO_TYPE = 'video_block';

export const videoSchema = $fencedBlock(VIDEO_TYPE, (language) => language.trim().toLowerCase() === VIDEO_LANGUAGE, () => ({
	atom: true,
	isolating: true,
}));

/** What the block needs from the plugin: the article's files, a short link opened, a word to the writer. */
export type VideoHost = {
	/** Where a file of the article shown is served (`assets/run.mp4`). */
	fileUrl(path: string): string;
	/** Puts a file into a folder of the article shown; its path in it. */
	upload(folder: string, file: File, options?: { replace?: boolean; onProgress?(loaded: number, total: number): void }): Promise<string>;
	/** A Bilibili short link (b23.tv) opened to the video's own address. */
	resolve(url: string): Promise<string>;
	toast(message: string, error?: boolean): void;
};

let host: VideoHost | null = null;
export function setVideoHost(next: VideoHost | null): void {
	host = next;
}

/** Blocks just put in, whose link field takes the caret once drawn. */
const opening = new WeakSet<ProseNode>();

/** A new, empty video where the caret's (empty) block is; its link field takes the caret. */
export function insertVideo(view: EditorView): void {
	const { state } = view;
	const type = state.schema.nodes[VIDEO_TYPE];
	if (!type) return;
	const { $from } = state.selection;
	const block = type.create({ language: VIDEO_LANGUAGE });
	opening.add(block);
	const tr = state.tr.replaceWith($from.before(), $from.after(), block);
	view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, $from.before())).scrollIntoView());
}

/** A file dropped into the article or inserted from its files (`assets/run.mp4`), as a block. */
export function videoMarkdown(path: string): string {
	return `\`\`\`${VIDEO_LANGUAGE}\n./${path}\n\`\`\``;
}

type Hast = { type: 'element'; tagName: string; properties: Record<string, unknown>; children: (Hast | { type: 'text'; value: string })[] };

const ATTRIBUTE_NAMES: Record<string, string> = { allowFullScreen: 'allowfullscreen', playsInline: 'playsinline', referrerPolicy: 'referrerpolicy' };

function toDom(node: Hast): HTMLElement {
	const element = document.createElement(node.tagName);
	for (const [key, value] of Object.entries(node.properties)) {
		if (key === 'className') element.className = (value as string[]).join(' ');
		else if (key.startsWith('data')) element.dataset[key[4].toLowerCase() + key.slice(5)] = String(value);
		else if (value === true) element.setAttribute(ATTRIBUTE_NAMES[key] ?? key, '');
		else element.setAttribute(ATTRIBUTE_NAMES[key] ?? key, String(value));
	}
	for (const child of node.children) element.append(child.type === 'text' ? document.createTextNode(child.value) : toDom(child));
	return element;
}

function button(label: string, action: () => void, title = ''): HTMLButtonElement {
	const element = document.createElement('button');
	element.type = 'button';
	element.textContent = label;
	if (title) element.title = title;
	element.addEventListener('mousedown', (event) => event.preventDefault());
	element.addEventListener('click', (event) => {
		event.preventDefault();
		action();
	});
	return element;
}

/** The frame the video shows, as a JPEG file named `name` (no wider than 1920 px). */
function frameOf(video: HTMLVideoElement, name: string): Promise<File> {
	const scale = Math.min(1, 1920 / (video.videoWidth || 1920));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
	canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
	canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(new File([blob], name, { type: 'image/jpeg' })) : reject(new Error('画面取不出来'))), 'image/jpeg', 0.86),
	);
}

/** Waits for the video to show the frame at `time` (seconds). */
function seek(video: HTMLVideoElement, time: number): Promise<void> {
	return new Promise((resolve) => {
		if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= 2) {
			resolve();
			return;
		}
		video.addEventListener('seeked', () => resolve(), { once: true });
		video.currentTime = time;
	});
}

const ACCEPT = ['video/*', ...LOCAL_ONLY_EXTENSIONS.map((extension) => `.${extension}`)].join(',');

export const videoView = $view(videoSchema.schema.node, () => (initial: ProseNode, view: EditorView, getPos: () => number | undefined): NodeView => {
	let node = initial;
	let video = parseVideo(node.textContent);
	let editing = !video.src;
	/** What is being done that the block shows: 正在放入… 37%, 正在做封面…. */
	let busy = '';
	/** A cover is made once, by itself, for a video of the article that has none. */
	let coverAsked = false;
	let player: HTMLVideoElement | null = null;
	let caption: HTMLInputElement | null = null;
	/** What the block shows (its address, cover and width), to tell what a change of the document changes. */
	let drawn: Video | null = null;
	const dom = document.createElement('div');
	dom.className = 'video-block';
	dom.contentEditable = 'false';

	/** Writes the fence anew, the block selected (not while its caption is typed); the view is drawn from the document again. */
	const write = (next: Video, select = true) => {
		const pos = getPos();
		if (pos == null) return;
		const current = view.state.doc.nodeAt(pos);
		if (!current) return;
		const text = writeVideo(next);
		if (text === current.textContent) return;
		const block = current.type.create(current.attrs, text ? view.state.schema.text(text) : null);
		const tr = view.state.tr.replaceWith(pos, pos + current.nodeSize, block);
		view.dispatch(select ? tr.setSelection(NodeSelection.create(tr.doc, pos)) : tr);
	};

	/** Says what is being done over the block, its player left playing (drawn again, it would be another). */
	const say = (text: string) => {
		busy = text;
		let note = dom.querySelector<HTMLElement>('.video-block-busy');
		if (!text) {
			note?.remove();
			return;
		}
		if (!note) {
			note = document.createElement('div');
			note.className = 'video-block-busy';
			(dom.querySelector('.note-video') ?? dom).append(note);
		}
		note.textContent = text;
	};

	const fail = (what: string, error: unknown) => host?.toast(`${what}：${error instanceof Error ? error.message : String(error)}`, true);

	/** A link typed or pasted: a video online (a short link opened first). */
	const useLink = async (text: string) => {
		let url = text.trim();
		if (!url) return;
		if (/^https?:\/\/b23\.tv\//iu.test(url)) {
			busy = '正在打开短链接…';
			paint();
			try {
				url = await host!.resolve(url);
			} catch (error) {
				busy = '';
				paint();
				fail('没能打开这个短链接', error);
				return;
			}
			busy = '';
		}
		if (!onlineVideo(url)) {
			paint();
			host?.toast('只认 B 站和 YouTube 的视频链接；本机的视频用「选本地视频…」', true);
			return;
		}
		editing = false;
		const changed = url !== video.src;
		video = { ...video, src: url, ...(changed ? { cover: '' } : {}) };
		write(video);
		paint();
	};

	/** A video file of this machine: put in the article's assets/, then played here. */
	const useFile = async (file: File) => {
		if (!host) return;
		busy = '正在放入视频…';
		paint();
		try {
			const path = await host.upload('assets', file, {
				onProgress: (loaded, total) => say(`正在放入视频… ${Math.floor((loaded / (total || 1)) * 100)}%`),
			});
			busy = '';
			editing = false;
			coverAsked = false;
			video = { ...video, src: `./${path}`, cover: '' };
			write(video);
			paint();
		} catch (error) {
			busy = '';
			paint();
			fail(`没能放入 ${file.name}`, error);
		}
	};

	/** The frame shown (or, made by itself, one a little way in) as the video's cover. */
	const makeCover = async (here: boolean) => {
		const shown = player;
		const path = localVideo(video.src);
		if (!host || !shown || !path) return;
		const kept = articleFile(video.cover);
		const target = kept?.startsWith('img/') ? kept : coverFor(path);
		say('正在做封面…');
		try {
			if (!here) await seek(shown, Math.min(1, (shown.duration || 0) * 0.1));
			const saved = await host.upload(target.slice(0, target.lastIndexOf('/')), await frameOf(shown, target.slice(target.lastIndexOf('/') + 1)), { replace: true });
			say('');
			video = { ...video, cover: `./${saved}` };
			// Made by itself, or from a button: where the caret is stays.
			write(video, false);
			if (here) host.toast('封面换成了这一帧；博客上显示的就是它');
		} catch (error) {
			say('');
			fail('没能做封面', error);
		}
	};

	const form = () => {
		const element = document.createElement('form');
		element.className = 'video-block-form';
		element.noValidate = true;
		const input = document.createElement('input');
		input.type = 'url';
		input.placeholder = '粘贴 B 站或 YouTube 的视频链接，回车';
		input.value = onlineVideo(video.src) ? video.src : '';
		input.setAttribute('aria-label', '视频链接');
		const picker = document.createElement('input');
		picker.type = 'file';
		picker.accept = ACCEPT;
		picker.hidden = true;
		picker.addEventListener('change', () => {
			const file = picker.files?.[0];
			if (file) void useFile(file);
		});
		element.append(input, button('选本地视频…', () => picker.click(), '只放在这台电脑上（不进 git）；博客上显示它的封面'), picker);
		const cancel = () => {
			editing = false;
			paint();
			view.focus();
		};
		if (video.src) element.append(button('取消', cancel));
		element.addEventListener('submit', (event) => {
			event.preventDefault();
			void useLink(input.value);
		});
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && video.src) cancel();
		});
		if (opening.has(node)) {
			opening.delete(node);
			requestAnimationFrame(() => input.focus());
		}
		return element;
	};

	const paint = () => {
		dom.replaceChildren();
		player = null;
		caption = null;
		if (busy && (editing || !video.src)) {
			const note = document.createElement('div');
			note.className = 'video-block-busy is-alone';
			note.textContent = busy;
			dom.append(note);
			return;
		}
		if (editing) {
			dom.append(form());
			return;
		}
		const figure = toDom(videoFigure(video, { fileUrl: (path) => host?.fileUrl(path) ?? path, play: true }) as Hast);
		const frame = figure.querySelector<HTMLElement>('.note-video-frame')!;
		// Its controls (and the player's frame) are its own: a press there is no block selection.
		frame.dataset.ownsPointer = '';
		figure.querySelector('figcaption')?.remove();
		const local = localVideo(video.src);
		player = figure.querySelector('video');
		drawn = video;
		if (player) {
			const shown = player;
			shown.addEventListener('error', () => {
				if (shown.error) frame.append(Object.assign(document.createElement('div'), { className: 'video-block-missing', textContent: `放不了 ./${local}：文件不在，或这种视频这里放不了` }));
			});
			if (!articleFile(video.cover) && !coverAsked) {
				// Told its length (WebKit loads no frame of a video not played before it is sought): to a frame, and that one.
				shown.addEventListener('loadedmetadata', () => {
					if (coverAsked || shown !== player) return;
					coverAsked = true;
					void makeCover(false);
				}, { once: true });
			}
		}
		// The caption, typed under it as under a picture.
		caption = document.createElement('input');
		caption.className = 'video-block-caption';
		caption.placeholder = '添加说明';
		caption.value = video.caption;
		caption.setAttribute('aria-label', '视频说明');
		caption.addEventListener('input', () => {
			video = { ...video, caption: caption!.value };
			write(video, false);
		});
		// ↩ or Esc: on to the text after it, as from a picture's caption.
		caption.addEventListener('keydown', (event) => {
			if (event.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return;
			event.preventDefault();
			const pos = getPos();
			if (pos == null) return;
			const after = Math.min(pos + node.nodeSize, view.state.doc.content.size);
			view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(after), 1)).scrollIntoView());
			view.focus();
		});
		figure.append(caption);
		dom.append(figure);

		const actions = document.createElement('div');
		actions.className = 'video-block-actions';
		if (local) {
			const note = document.createElement('span');
			note.className = 'video-block-note';
			note.textContent = '只在本机 · 博客上显示封面';
			actions.append(note, button('做封面', () => void makeCover(true), '把现在这一帧做成封面（博客上显示的图）'));
		} else if (onlineVideo(video.src)) {
			actions.append(button('打开', () => window.open(video.src, '_blank', 'noopener,noreferrer')));
		}
		actions.append(
			button(local ? '换视频' : '改链接', () => {
				editing = true;
				opening.add(node);
				paint();
			}),
		);
		// Over the video's own corner, however wide it is.
		figure.append(actions);
		if (busy) say(busy);
	};

	paint();
	return {
		dom,
		update: (updated) => {
			if (updated.type !== initial.type) return false;
			if (updated === node) return true;
			const wasOpening = opening.has(node);
			node = updated;
			if (wasOpening) opening.add(node);
			const next = parseVideo(node.textContent);
			const shown = drawn && next.src === drawn.src && next.width === drawn.width;
			video = next;
			// Only its cover changed: the player keeps playing where it is, showing the new one.
			if (shown && player && !editing && next.cover !== drawn!.cover) {
				const cover = articleFile(video.cover);
				if (cover) player.poster = `${host?.fileUrl(cover) ?? cover}?${Date.now()}`;
				else player.removeAttribute('poster');
				drawn = video;
			}
			const same = shown && next.cover === drawn!.cover;
			if (!video.src && !busy) editing = true;
			// Its caption being typed: the field keeps the caret.
			if (same && !editing && caption && caption.value === video.caption) return true;
			paint();
			return true;
		},
		selectNode: () => dom.classList.add('ProseMirror-selectednode'),
		deselectNode: () => dom.classList.remove('ProseMirror-selectednode'),
		ignoreMutation: () => true,
		stopEvent: (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return false;
			if (event.type === 'dragstart') return false;
			return Boolean(target.closest('button, input, form, video'));
		},
	};
});

export const videoBlockPlugins = [...videoSchema, videoView];
