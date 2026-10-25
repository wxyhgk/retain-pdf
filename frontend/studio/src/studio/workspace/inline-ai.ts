/** What the AI in the editor box needs of the Studio: to ask (resolving once what the AI wrote is shown), to stop, the old way. */
export type InlineAiHost = {
	/** Asks the AI to do `instruction`; resolves once what it wrote is shown to review, rejects with why not. */
	run(instruction: string): Promise<void>;
	stop(): void;
	/** 在终端里问: the blocks typed into the terminal for an AI there (as 「问 AI」 did). */
	askInTerminal(): void;
};

/** What the AI is most often asked, with the selection and on an empty line. */
const REWRITES = ['改得更通顺', '改得更简洁', '扩写，讲得更清楚', '修正错别字和语法', '翻译成英文', '翻译成中文', '改成要点列表'];
const WRITES = ['接着写下一段', '写一个小结', '列出要点', '举一个计算化学里的例子'];

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text) node.textContent = text;
	return node;
}

/**
 * The AI in the editor, as Notion's: a box under the blocks selected (⌘J, the toolbar's 「AI」, a block's menu) or
 * under an empty line (Space there), where the author says what to do, or picks it; the AI's answer then comes in
 * place, as differences to accept or reject (the review bar, with 重试). While it writes, the box says so and can stop it.
 */
export function createInlineAi(host: InlineAiHost) {
	const root = element('div', 'inline-ai');
	root.hidden = true;
	root.setAttribute('role', 'dialog');
	root.setAttribute('aria-label', 'AI');
	const input = element('input', 'inline-ai-input');
	input.type = 'text';
	input.setAttribute('aria-label', '让 AI 做什么');
	const status = element('p', 'inline-ai-status');
	status.setAttribute('role', 'status');
	const list = element('div', 'inline-ai-list');
	list.setAttribute('role', 'listbox');
	root.append(input, status, list);
	document.body.append(root);

	let choices: Array<{ label: string; run: () => void }> = [];
	let at = 0;
	let running = false;
	let last = '';

	function close(): void {
		root.hidden = true;
		if (running) host.stop();
	}

	function draw(): void {
		list.replaceChildren(
			...choices.map((choice, index) => {
				const item = element('button', `inline-ai-choice${index === at ? ' is-current' : ''}`, choice.label);
				item.type = 'button';
				item.setAttribute('role', 'option');
				item.setAttribute('aria-selected', String(index === at));
				item.addEventListener('mousedown', (event) => event.preventDefault());
				item.addEventListener('click', () => choice.run());
				return item;
			}),
		);
	}

	async function run(instruction: string): Promise<void> {
		if (!instruction.trim() || running) return;
		last = instruction;
		running = true;
		root.classList.add('is-running');
		input.disabled = true;
		list.replaceChildren();
		const started = Date.now();
		const tick = () => {
			status.textContent = `AI 正在写…（${Math.round((Date.now() - started) / 1000)} 秒，Esc 停下）`;
		};
		tick();
		const timer = window.setInterval(tick, 1000);
		try {
			await host.run(instruction);
			root.hidden = true;
		} catch (error) {
			status.textContent = error instanceof Error ? error.message : 'AI 没能写出来';
			status.classList.add('is-error');
			choices = [{ label: '重试', run: () => void run(last) }];
			at = 0;
			draw();
		} finally {
			window.clearInterval(timer);
			running = false;
			root.classList.remove('is-running');
			input.disabled = false;
			if (!root.hidden) input.focus();
		}
	}

	input.addEventListener('input', () => {
		const typed = input.value.trim();
		const presets = (root.dataset.mode === 'write' ? WRITES : REWRITES).filter((label) => !typed || label.includes(typed));
		choices = [...(typed ? [{ label: `让 AI：${typed}`, run: () => void run(typed) }] : []), ...presets.map((label) => ({ label, run: () => void run(label) }))];
		at = 0;
		draw();
	});
	input.addEventListener('keydown', (event) => {
		if (event.isComposing) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!choices.length) return;
			at = (at + (event.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
			draw();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			choices[at]?.run();
		}
	});
	root.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && running) close();
	});
	document.addEventListener('mousedown', (event) => {
		if (!root.hidden && !running && !root.contains(event.target as Node)) root.hidden = true;
	});

	return {
		/** Opens under `anchor` (the blocks selected, or the empty line), for them rewritten or something written there. */
		open(mode: 'rewrite' | 'write', anchor: DOMRect | null): void {
			root.dataset.mode = mode;
			root.hidden = false;
			status.textContent = '';
			status.classList.remove('is-error');
			input.value = '';
			input.placeholder = mode === 'rewrite' ? '让 AI 怎么改这段…' : '让 AI 在这里写什么…';
			choices = [...(mode === 'rewrite' ? REWRITES : WRITES).map((label) => ({ label, run: () => void run(label) })), { label: '在终端里问 AI…', run: () => { root.hidden = true; host.askInTerminal(); } }];
			at = 0;
			draw();
			const width = Math.min(460, window.innerWidth - 32);
			const left = Math.max(16, Math.min((anchor?.left ?? window.innerWidth / 2 - width / 2), window.innerWidth - width - 16));
			const below = (anchor?.bottom ?? window.innerHeight / 3) + 8;
			root.style.width = `${width}px`;
			root.style.left = `${left}px`;
			root.style.top = `${Math.min(below, window.innerHeight - 320)}px`;
			input.focus();
		},
		/** Asks again what was asked last (the review bar's 重试). */
		retry(): void {
			if (!last) return;
			root.hidden = false;
			void run(last);
		},
	};
}
