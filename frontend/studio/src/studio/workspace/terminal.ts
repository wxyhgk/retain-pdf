import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

import { openTerminal } from '../api/client';
import type { SourceLines } from '../document/source-lines';

type Cwd = 'root' | 'article';
type State = 'idle' | 'starting' | 'running' | 'ended';

const CWD_KEY = 'studio.terminal-cwd';
const FIRST_BUILD_HINT_MS = 2500;
const encoder = new TextEncoder();
/** How long after it starts a shell that has printed nothing is taken to read what is typed. */
const READY_AFTER_MS = 800;
/** How much of the lines a question quotes, to tell them by; the AI reads them from the file. */
const QUOTED_CHARACTERS = 24;

/**
 * Text that can be typed into whatever runs in the terminal without doing
 * anything until Enter: one line, no control characters, so no newline in
 * it can run a command, whether the shell takes pasted text or not.
 */
function typeable(text: string): string {
	return text.replace(/[\u0000-\u001f\u007f]+/gu, ' ').replace(/ {2,}/gu, ' ').trim();
}

/**
 * A question about lines of an article, to finish and send: where they
 * are, how they begin, and room for what is wanted. `path` is the file
 * as the shell finds it.
 */
export function questionAbout(path: string, lines: SourceLines): string {
	const where = lines.start === lines.end ? `第 ${lines.start} 行` : `第 ${lines.start}–${lines.end} 行`;
	const opening = typeable(lines.text.split('\n').find((line) => line.trim()) ?? '');
	const quoted = opening.length > QUOTED_CHARACTERS ? `${opening.slice(0, QUOTED_CHARACTERS)}…` : opening;
	return typeable(`${path} ${where}${quoted ? `（从「${quoted}」开始）` : ''}。要求：`);
}

function readCwd(): Cwd {
	try {
		return localStorage.getItem(CWD_KEY) === 'article' ? 'article' : 'root';
	} catch {
		return 'root';
	}
}

function writeCwd(cwd: Cwd): void {
	try {
		localStorage.setItem(CWD_KEY, cwd);
	} catch {
		// Private windows may refuse storage; the choice then lasts for this visit.
	}
}

/**
 * The 终端 tab: a shell from `tools/studio-terminal`, in the repository or in
 * the open article's folder. It starts the first time the tab is shown; after
 * the shell exits, any key opens a new one. Closing the page hangs the shell up.
 */
export function createTerminalPane(pane: HTMLElement) {
	const screen = pane.querySelector<HTMLElement>('#terminal-screen')!;
	const where = pane.querySelector<HTMLElement>('#terminal-cwd')!;
	const restartButton = pane.querySelector<HTMLButtonElement>('#restart-terminal')!;
	const cwdOptions = [...pane.querySelectorAll<HTMLButtonElement>('[data-cwd]')];

	let cwd = readCwd();
	let article: string | null = null;
	let state: State = 'idle';
	const setState = (next: State) => {
		state = next;
		screen.dataset.state = next;
	};
	let socket: WebSocket | null = null;
	/** Where the running shell is: an article's folder (its slug), or the repository (null). */
	let shellArticle: string | null = null;
	/** A question to put in once the shell is ready, and whether it is. */
	let pending: { slug: string; lines: SourceLines } | null = null;
	let ready = false;

	const terminal = new Terminal({
		cursorBlink: true,
		fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
		fontSize: 12,
		lineHeight: 1.2,
		scrollback: 5000,
		theme: { background: '#16181d', foreground: '#d7dae0', cursor: '#7ee2a8', selectionBackground: '#3a4250' },
	});
	const fit = new FitAddon();
	terminal.loadAddon(fit);
	let opened = false;

	const dim = (text: string) => terminal.writeln(`\x1b[2m${text}\x1b[0m`);

	function sendSize(): void {
		if (socket?.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
		}
	}

	function effectiveCwd(): Cwd {
		return cwd === 'article' && article ? 'article' : 'root';
	}

	function renderCwd(): void {
		for (const option of cwdOptions) {
			option.setAttribute('aria-checked', String(option.dataset.cwd === cwd));
			option.disabled = option.dataset.cwd === 'article' && !article;
		}
	}

	async function start(): Promise<void> {
		const closing = socket;
		socket = null;
		closing?.close();
		setState('starting');
		const target = effectiveCwd();
		const slug = article;
		ready = false;
		shellArticle = target === 'article' ? slug : null;
		terminal.reset();
		dim('正在打开终端…');
		const hint = window.setTimeout(() => dim('第一次使用要先编译终端程序（Rust），大约需要一分钟…'), FIRST_BUILD_HINT_MS);
		let url: string;
		let folder: string;
		try {
			({ url, cwd: folder } = await openTerminal(target === 'article' ? { cwd: 'article', slug: slug! } : { cwd: 'root' }));
		} catch (error) {
			setState('ended');
			terminal.writeln(`\x1b[31m${error instanceof Error ? error.message : '终端打不开'}\x1b[0m`);
			dim('按任意键重试');
			return;
		} finally {
			window.clearTimeout(hint);
		}
		const connection = new WebSocket(url);
		connection.binaryType = 'arraybuffer';
		socket = connection;
		connection.addEventListener('open', () => {
			if (socket !== connection) return;
			setState('running');
			terminal.reset();
			fit.fit();
			sendSize();
			// Where this shell is, which stays put when another article is opened.
			where.textContent = target === 'article' ? `blog/${slug}/` : `${folder.split('/').filter(Boolean).pop()}/`;
			where.title = folder;
			terminal.focus();
			// A shell whose prompt says nothing is taken to be ready a moment after it starts.
			window.setTimeout(becomeReady, READY_AFTER_MS);
		});
		connection.addEventListener('message', (event) => {
			if (socket !== connection) return;
			if (typeof event.data !== 'string') {
				terminal.write(new Uint8Array(event.data as ArrayBuffer));
				// The shell has said something (its prompt): it reads what is typed now.
				if (!ready) window.setTimeout(becomeReady, 150);
				return;
			}
			const message = JSON.parse(event.data) as { type: string; code?: number };
			if (message.type === 'exit') {
				setState('ended');
				dim(`\r\n[终端已结束${message.code ? `（退出码 ${message.code}）` : ''}，按任意键重新打开]`);
			}
		});
		connection.addEventListener('close', () => {
			if (socket !== connection) return;
			socket = null;
			if (state !== 'ended') {
				setState('ended');
				dim('\r\n[与终端的连接断开了，按任意键重新打开]');
			}
		});
	}

	function becomeReady(): void {
		if (ready || state !== 'running') return;
		ready = true;
		putPending();
	}

	/** The article's file as the running shell finds it from where it is. */
	function pathFor(slug: string): string {
		if (shellArticle === slug) return 'index.md';
		return shellArticle ? `../${slug}/index.md` : `blog/${slug}/index.md`;
	}

	/** Types the question waiting into the shell: nothing in it runs until Enter. */
	function putPending(): void {
		if (!pending || !ready || socket?.readyState !== WebSocket.OPEN) return;
		const question = questionAbout(pathFor(pending.slug), pending.lines);
		pending = null;
		// Typed as keys, one line without Enter: it waits for the author.
		socket.send(encoder.encode(question));
		terminal.focus();
	}

	/** Starts over in the chosen folder, asking first if a shell is running there now. */
	function restart(): void {
		if (state === 'running' && !confirm('重新打开终端会结束它里面正在运行的程序，继续吗？')) return;
		void start();
	}

	terminal.onData((data) => {
		if (state === 'ended') {
			void start();
			return;
		}
		if (socket?.readyState === WebSocket.OPEN) socket.send(encoder.encode(data));
	});
	terminal.onResize(sendSize);

	// The tab starts hidden: open the terminal, and the shell, when it first has a size.
	new ResizeObserver(() => {
		if (!screen.offsetWidth || !screen.offsetHeight) return;
		if (!opened) {
			terminal.open(screen);
			opened = true;
		}
		fit.fit();
		if (state === 'idle') void start();
	}).observe(screen);

	for (const option of cwdOptions) {
		option.addEventListener('click', () => {
			const next: Cwd = option.dataset.cwd === 'article' ? 'article' : 'root';
			if (next === cwd) return;
			const previous = cwd;
			cwd = next;
			if (state !== 'idle' && effectiveCwd() !== (previous === 'article' && article ? 'article' : 'root')) {
				if (state === 'running' && !confirm('在另一个目录重新打开终端？正在运行的程序会被结束。')) {
					cwd = previous;
					return;
				}
				void start();
			}
			writeCwd(cwd);
			renderCwd();
		});
	}
	restartButton.addEventListener('click', restart);
	renderCwd();

	return {
		/**
		 * The open article, for 当前文章. A running shell stays where it is;
		 * the next one opens in the new article's folder.
		 */
		showArticle(slug: string | null): void {
			article = slug;
			renderCwd();
		},
		/**
		 * Types a question about these lines of an article into the shell,
		 * for the author to finish and send (nothing is sent). A shell that
		 * has ended is opened again first; one not yet opened opens when its
		 * tab is shown.
		 */
		ask(slug: string, lines: SourceLines): void {
			pending = { slug, lines };
			if (state === 'ended') void start();
			else putPending();
		},
	};
}
