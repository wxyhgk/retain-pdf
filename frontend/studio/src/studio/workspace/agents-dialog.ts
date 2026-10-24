import { listAgents, saveAgents, type Agent, type AgentsShown } from '../api/client';

/** What the dialog needs from the Studio around it. */
export type AgentsDialogHost = {
	/** The list was saved: what shows the AIs shows them again (the terminal's buttons). */
	saved(): void;
};

const FIELDS: Array<{ key: 'launch' | 'run' | 'resume'; label: string; hint: string }> = [
	{ key: 'launch', label: '终端里启动', hint: '点终端上的按钮时运行，比如 claude' },
	{ key: 'run', label: 'Alt+Enter：后台跑一次', hint: '{prompt} 换成交给它的话' },
	{ key: 'resume', label: 'Alt+Enter：接着上次', hint: '接着这篇文章文件夹里最近的会话；{prompt} 同上' },
];

/**
 * 「AI 助手」: the AIs the Studio starts (agent-settings.mjs): Claude Code, Codex and pi to begin with,
 * others added (omp…), each its three command lines, and the one Alt+Enter uses. Kept on this machine.
 */
export function createAgentsDialog(dialog: HTMLDialogElement, host: AgentsDialogHost) {
	const list = dialog.querySelector<HTMLOListElement>('#agents-list')!;
	const status = dialog.querySelector<HTMLElement>('#agents-status')!;
	const form = dialog.querySelector('form')!;
	let presets: Agent[] = [];
	let installed = new Map<string, boolean>();

	function say(message: string, error = false): void {
		status.textContent = message;
		status.classList.toggle('is-error', error);
	}

	function input(value: string, label: string, name: string, wide = true): HTMLLabelElement {
		const field = document.createElement('label');
		field.className = wide ? 'agent-field' : 'agent-field is-short';
		const caption = document.createElement('span');
		caption.textContent = label;
		const box = document.createElement('input');
		box.type = 'text';
		box.name = name;
		box.value = value;
		box.autocomplete = 'off';
		box.spellcheck = false;
		field.append(caption, box);
		return field;
	}

	function row(agent: Agent, chosen: boolean): HTMLLIElement {
		const item = document.createElement('li');
		item.className = 'agent-row';
		const head = document.createElement('div');
		head.className = 'agent-head';
		const pick = document.createElement('label');
		pick.className = 'agent-default';
		const radio = document.createElement('input');
		radio.type = 'radio';
		radio.name = 'agents-default';
		radio.checked = chosen;
		pick.append(radio, document.createTextNode('Alt+Enter 用它'));
		const state = document.createElement('small');
		state.className = 'agent-installed';
		const known = installed.get(agent.id);
		state.textContent = known === undefined ? '' : known ? '已安装' : '这台电脑上没找到';
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'agent-remove';
		remove.textContent = '删除';
		remove.addEventListener('click', () => {
			item.remove();
			if (!list.querySelector('input[name="agents-default"]:checked')) list.querySelector<HTMLInputElement>('input[name="agents-default"]')?.click();
		});
		head.append(input(agent.name, '名字', 'name', false), input(agent.id, '代号', 'id', false), pick, state, remove);
		item.append(head, ...FIELDS.map((field) => {
			const line = input(agent[field.key], field.label, field.key);
			line.querySelector('input')!.placeholder = field.hint;
			return line;
		}));
		item.dataset.install = agent.install ?? '';
		return item;
	}

	function render(agents: Agent[], chosen: string): void {
		list.replaceChildren(...agents.map((agent) => row(agent, agent.id === chosen)));
	}

	function collect(): { agents: Agent[]; chosen: string } {
		let chosen = '';
		const agents = [...list.querySelectorAll<HTMLLIElement>('.agent-row')].map((item) => {
			const value = (name: string) => item.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value.trim();
			const agent: Agent = { id: value('id'), name: value('name'), launch: value('launch'), run: value('run'), resume: value('resume'), ...(item.dataset.install ? { install: item.dataset.install } : {}) };
			if (item.querySelector<HTMLInputElement>('input[name="agents-default"]')!.checked) chosen = agent.id;
			return agent;
		});
		return { agents, chosen };
	}

	dialog.querySelector('#agents-add')!.addEventListener('click', () => {
		list.append(row({ id: '', name: '', launch: '', run: ' {prompt}', resume: ' {prompt}' }, !list.children.length));
		list.lastElementChild?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
	});
	dialog.querySelector('#agents-presets')!.addEventListener('click', () => render(presets, presets[0]?.id ?? ''));
	dialog.querySelector('#agents-cancel')!.addEventListener('click', () => dialog.close());
	dialog.querySelector('#agents-close')!.addEventListener('click', () => dialog.close());
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const { agents, chosen } = collect();
		say('正在保存…');
		void saveAgents(agents, chosen).then(
			() => {
				say('');
				dialog.close();
				host.saved();
			},
			(error: unknown) => say(error instanceof Error ? error.message : '没能保存', true),
		);
	});

	return {
		async open(): Promise<void> {
			say('');
			let shown: AgentsShown;
			try {
				shown = await listAgents();
			} catch (error) {
				say(error instanceof Error ? error.message : '读不到 AI 助手的设置', true);
				return;
			}
			presets = shown.presets;
			installed = new Map(shown.agents.map((agent) => [agent.id, agent.installed]));
			render(shown.agents, shown.default);
			if (!dialog.open) dialog.showModal();
		},
	};
}
