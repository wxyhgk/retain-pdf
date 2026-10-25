import { checkPanelModels, checkPiModels, panelAccounts, panelModels, piModels, savePanelModels, savePiModels, type PanelModelsShown, type PanelProvider, type PiProvider } from '../api/client';

export type ModelsSheetHost = {
	/** Runs a command in the 终端 tab (an account's login, which asks in the browser and the terminal). */
	runInTerminal(command: string): void;
	/** A service was saved for `agent` (claude, pi): a conversation begun with it from now on uses it. */
	saved(agent: string, name: string): void;
};

/** The logins, with the project's own Claude Code and Codex (their commands as the dependencies install them). */
const CLAUDE_LOGIN = 'npx --no-install claude-agent-acp --cli auth login --claudeai';
const CODEX_LOGIN = 'npx --no-install codex login';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text) node.textContent = text;
	return node;
}

function field(label: string, input: HTMLInputElement, hint?: HTMLElement): HTMLLabelElement {
	const node = element('label', 'ai-sheet-field');
	node.append(element('span', 'ai-sheet-label', label), input);
	if (hint) node.append(hint);
	return node;
}

/**
 * 模型和账号, in the AI panel: which models Claude Code talks to (the Claude account, or a service that speaks
 * Anthropic's API: Anthropic with a key, DeepSeek, Kimi, 智谱, 通义千问, MiniMax, another address), the key and the
 * models, tried with a word; which service pi uses (one of its catalog, a key: its models are listed by pi); and
 * whether the Claude and Codex accounts are logged in, with a login for each. Keys go to this machine's settings
 * only; the page is never given them back.
 */
export function createModelsSheet(host: ModelsSheetHost) {
	const root = element('section', 'ai-sheet');
	root.hidden = true;
	root.setAttribute('aria-label', '模型和账号');
	const head = element('header', 'ai-sheet-head');
	const close = element('button', 'ai-sheet-close', '×');
	close.type = 'button';
	close.setAttribute('aria-label', '关闭模型和账号');
	head.append(element('h3', '', '模型和账号'), close);

	const claudeTitle = element('h4', '', 'Claude Code 用哪家的模型');
	const provider = element('select', 'ai-sheet-provider');
	provider.setAttribute('aria-label', '模型来源');
	const account = element('div', 'ai-sheet-account');
	const keyed = element('div', 'ai-sheet-keyed');
	const baseUrl = element('input');
	baseUrl.type = 'url';
	baseUrl.spellcheck = false;
	const apiKey = element('input');
	apiKey.type = 'password';
	apiKey.autocomplete = 'off';
	apiKey.spellcheck = false;
	const keyLink = element('a', 'ai-sheet-link', '去哪里拿 key');
	keyLink.target = '_blank';
	keyLink.rel = 'noopener noreferrer';
	const main = element('input');
	main.spellcheck = false;
	const fast = element('input');
	fast.spellcheck = false;
	const note = element('p', 'ai-sheet-note', '模型名各家常改，以它们官网为准；填好点「检查」，用一句话试一下。');
	const actions = element('div', 'ai-sheet-actions');
	const check = element('button', '', '检查');
	check.type = 'button';
	const save = element('button', 'is-primary', '保存');
	save.type = 'button';
	actions.append(check, save);
	const result = element('p', 'ai-sheet-result');
	result.setAttribute('role', 'status');
	keyed.append(field('接口地址', baseUrl), field('API key', apiKey, keyLink), field('主模型', main), field('快速模型（小事和子任务）', fast), note);

	const codexTitle = element('h4', '', 'Codex');
	const codexAccount = element('div', 'ai-sheet-account');

	// pi: a service of its catalog and a key; its models are then those of the service.
	const piTitle = element('h4', '', 'pi 用哪家的模型');
	const piProvider = element('select', 'ai-sheet-provider');
	piProvider.setAttribute('aria-label', 'pi 的模型来源');
	const piKeyed = element('div', 'ai-sheet-keyed');
	const piKey = element('input');
	piKey.type = 'password';
	piKey.autocomplete = 'off';
	piKey.spellcheck = false;
	const piKeyLink = element('a', 'ai-sheet-link', '去哪里拿 key');
	piKeyLink.target = '_blank';
	piKeyLink.rel = 'noopener noreferrer';
	const piNote = element('p', 'ai-sheet-note', 'pi 自带各家的模型列表，只要填 key；「检查」会列出这家的模型。');
	piKeyed.append(field('API key', piKey, piKeyLink), piNote);
	const piActions = element('div', 'ai-sheet-actions');
	const piCheck = element('button', '', '检查');
	piCheck.type = 'button';
	const piSave = element('button', 'is-primary', '保存');
	piSave.type = 'button';
	piActions.append(piCheck, piSave);
	const piResult = element('p', 'ai-sheet-result');
	piResult.setAttribute('role', 'status');
	root.append(head, claudeTitle, provider, account, keyed, actions, result, piTitle, piProvider, piKeyed, piActions, piResult, codexTitle, codexAccount);

	let shown: PanelModelsShown | null = null;
	let piShown: { chosen: string; providers: PiProvider[] } | null = null;
	const piCurrent = (): PiProvider | undefined => piShown?.providers.find((entry) => entry.id === piProvider.value);

	function piSay(text: string, tone: '' | 'ok' | 'error' = ''): void {
		piResult.textContent = text;
		piResult.dataset.tone = tone;
	}

	function showPiService(): void {
		const entry = piCurrent();
		const own = !entry?.env;
		piKeyed.hidden = own;
		piCheck.hidden = own;
		piKey.value = '';
		piKey.placeholder = entry?.hasKey ? '已保存（不改就留空）' : `粘贴 API key（pi 从 ${entry?.env ?? ''} 读）`;
		piKeyLink.hidden = !entry?.keyUrl;
		piKeyLink.href = entry?.keyUrl || '#';
		piSay(own ? '用 pi 在这台电脑上自己的设置和登录（~/.pi），模型从输入框下面选。' : '');
	}

	async function piStore(): Promise<boolean> {
		const entry = piCurrent();
		if (!entry) return false;
		try {
			piShown = await savePiModels({ provider: entry.id, ...(piKey.value.trim() ? { apiKey: piKey.value.trim() } : {}) });
			showPiService();
			return true;
		} catch (error) {
			piSay(error instanceof Error ? error.message : '没能保存', 'error');
			return false;
		}
	}

	piProvider.addEventListener('change', showPiService);
	piSave.addEventListener('click', async () => {
		if (!(await piStore())) return;
		piSay('已保存；新开的 pi 对话会用它。', 'ok');
		host.saved('pi', piCurrent()?.name ?? '');
	});
	piCheck.addEventListener('click', async () => {
		if (!(await piStore())) return;
		piSay('正在问一句…');
		piCheck.disabled = true;
		try {
			const answer = await checkPiModels();
			piSay(`能用：${answer.model} 回答了「${answer.answered.slice(0, 40)}」。这家的模型：${answer.models.map((model) => model.split('/').slice(1).join('/')).join('、')}`, 'ok');
		} catch (error) {
			piSay(error instanceof Error ? error.message : '不能用', 'error');
		} finally {
			piCheck.disabled = false;
		}
	});

	const current = (): PanelProvider | undefined => shown?.providers.find((entry) => entry.id === provider.value);

	function say(text: string, tone: '' | 'ok' | 'error' = ''): void {
		result.textContent = text;
		result.dataset.tone = tone;
	}

	/** The fields of the service chosen in the list: as saved, the preset's suggestions as placeholders. */
	function showService(): void {
		const entry = current();
		const isAccount = entry?.id === 'claude-account';
		account.hidden = !isAccount;
		keyed.hidden = isAccount;
		check.hidden = isAccount;
		if (!entry || isAccount) return;
		baseUrl.value = entry.baseUrl;
		baseUrl.placeholder = entry.suggested.baseUrl || 'https://…/anthropic';
		apiKey.value = '';
		apiKey.placeholder = entry.hasKey ? '已保存（不改就留空）' : '粘贴 API key';
		keyLink.hidden = !entry.keyUrl;
		keyLink.href = entry.keyUrl || '#';
		main.value = entry.main;
		main.placeholder = entry.suggested.main || (entry.id === 'anthropic' ? '留空：用 Claude 自己的模型列表' : '模型名');
		fast.value = entry.fast === entry.main ? '' : entry.fast;
		fast.placeholder = '留空：和主模型一样';
		say('');
	}

	function accountLine(holder: HTMLElement, text: string, button: string, command: string, missing: boolean): void {
		const line = element('p', '', text);
		const login = element('button', '', button);
		login.type = 'button';
		login.disabled = missing;
		login.addEventListener('click', () => {
			host.runInTerminal(command);
			say('在右边「终端」里按提示登录（会打开浏览器）；登好了回来点 ↻。');
		});
		const again = element('button', 'ai-sheet-refresh', '↻');
		again.type = 'button';
		again.title = '重新看是否登录了';
		again.setAttribute('aria-label', '重新看是否登录了');
		again.addEventListener('click', () => void showAccounts());
		holder.replaceChildren(line, login, again);
	}

	async function showAccounts(): Promise<void> {
		account.replaceChildren(element('p', '', '正在看是否登录了…'));
		codexAccount.replaceChildren(element('p', '', '正在看是否登录了…'));
		try {
			const { claude, codex } = await panelAccounts();
			const plan = claude.plan ? `（${claude.plan === 'max' ? 'Max' : claude.plan === 'pro' ? 'Pro' : claude.plan} 订阅）` : '';
			accountLine(account, claude.missing ? '没有装好 Claude Code（npm install）' : claude.loggedIn ? `已登录${plan}` : '还没有登录', claude.loggedIn ? '换个账号登录' : '登录 Claude 账号', CLAUDE_LOGIN, claude.missing);
			accountLine(codexAccount, codex.missing ? '没有装好 Codex（npm install）' : codex.loggedIn ? `已登录（${codex.how || 'ChatGPT'}）` : '还没有登录', codex.loggedIn ? '换个账号登录' : '登录 ChatGPT 账号', CODEX_LOGIN, codex.missing);
		} catch (error) {
			account.replaceChildren(element('p', '', error instanceof Error ? error.message : '看不了是否登录'));
			codexAccount.replaceChildren();
		}
	}

	/** Saves the service chosen, with what was typed (a key left empty is kept). */
	async function store(): Promise<boolean> {
		const entry = current();
		if (!entry) return false;
		try {
			shown = await savePanelModels({
				provider: entry.id,
				...(entry.id === 'claude-account' ? {} : { baseUrl: baseUrl.value, main: main.value, fast: fast.value }),
				...(apiKey.value.trim() ? { apiKey: apiKey.value.trim() } : {}),
			});
			showService();
			return true;
		} catch (error) {
			say(error instanceof Error ? error.message : '没能保存', 'error');
			return false;
		}
	}

	provider.addEventListener('change', showService);
	close.addEventListener('click', () => {
		root.hidden = true;
	});
	save.addEventListener('click', async () => {
		if (!(await store())) return;
		const entry = current();
		say('已保存；新开的对话会用它。', 'ok');
		host.saved('claude', entry?.name ?? '');
	});
	check.addEventListener('click', async () => {
		if (!(await store())) return;
		say('正在问一句…');
		check.disabled = true;
		try {
			const answer = await checkPanelModels();
			say(`能用：${answer.model} 回答了「${answer.answered.slice(0, 40)}」`, 'ok');
		} catch (error) {
			say(error instanceof Error ? error.message : '不能用', 'error');
		} finally {
			check.disabled = false;
		}
	});

	return {
		element: root,
		get open(): boolean {
			return !root.hidden;
		},
		/** Shown, with what is saved and whether the accounts are logged in. */
		async show(): Promise<void> {
			root.hidden = false;
			say('');
			try {
				shown = await panelModels();
				provider.replaceChildren(...shown.providers.map((entry) => new Option(entry.name, entry.id)));
				provider.value = shown.chosen;
				showService();
			} catch (error) {
				say(error instanceof Error ? error.message : '读不到设置', 'error');
			}
			try {
				piShown = await piModels();
				piProvider.replaceChildren(...piShown.providers.map((entry) => new Option(entry.name, entry.id)));
				piProvider.value = piShown.chosen;
				showPiService();
			} catch (error) {
				piSay(error instanceof Error ? error.message : '读不到设置', 'error');
			}
			void showAccounts();
		},
		hide(): void {
			root.hidden = true;
		},
	};
}
