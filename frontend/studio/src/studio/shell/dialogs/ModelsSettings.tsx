import { useEffect, useState, type ReactNode } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { checkPanelModels, checkPiModels, listAgents, panelAccounts, panelModels, piModels, savePanelModels, savePiModels, type PanelModelsShown, type PiProvider } from '../../api/client';

/** What 模型和账号 asks of the AI panel (ai/panel/panel-state.ts gives it, ask.ts keeps it). */
export type ModelsHost = {
	/** Runs a command in the 终端 tab (an account's login, which asks in the browser and the terminal). */
	runInTerminal(command: string): void;
	/** A service was saved for `agent` (claude, pi): a conversation begun with it from now on uses it. */
	saved(agent: string, name: string): void;
};

/** The logins, with the project's own Claude Code and Codex (their commands as the dependencies install them). */
const CLAUDE_LOGIN = 'npx --no-install claude-agent-acp --cli auth login --claudeai';
const CODEX_LOGIN = 'npx --no-install codex login';

type Said = { text: string; tone: '' | 'ok' | 'error' };
const quiet: Said = { text: '', tone: '' };
const failure = (error: unknown, fallback: string): Said => ({ text: error instanceof Error ? error.message : fallback, tone: 'error' });

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
	return (
		<label className="ai-sheet-field">
			<span className="ai-sheet-label">{label}</span>
			{children}
			{hint}
		</label>
	);
}

function Result({ said }: { said: Said }) {
	return (
		<p className="ai-sheet-result" role="status" data-tone={said.tone}>
			{said.text}
		</p>
	);
}

function KeyLink({ url }: { url?: string | null }) {
	return (
		<a className="ai-sheet-link" target="_blank" rel="noopener noreferrer" href={url || '#'} hidden={!url}>
			{t('去哪里拿 key')}
		</a>
	);
}

type Line = { text: string; button: string; command: string; missing: boolean } | string;

/** Whether an account is logged in, with a login (`onLogin`, in the 终端 tab) and ↻ to look again (`onLook`). */
function Account({ line, hidden, onLogin, onLook }: { line: Line; hidden?: boolean; onLogin(command: string): void; onLook(): void }) {
	return (
		<div className="ai-sheet-account" hidden={hidden}>
			{typeof line === 'string' ? (
				line && <p>{line}</p>
			) : (
				<>
					<p>{line.text}</p>
					<button type="button" disabled={line.missing} onClick={() => onLogin(line.command)}>
						{line.button}
					</button>
					<button type="button" className="ai-sheet-refresh" title={t('重新看是否登录了')} aria-label={t('重新看是否登录了')} onClick={onLook}>
						↻
					</button>
				</>
			)}
		</div>
	);
}

/**
 * 设置 › AI › 模型和账号 (the AI panel's ⚙ opens it): which service pi uses (one of its catalog, a key: its models are
 * listed by pi); and, once turned on in 高级, which models Claude Code talks to (the Claude account, or a service that
 * speaks Anthropic's API: Anthropic with a key, DeepSeek, Kimi, 智谱, 通义千问, MiniMax, another address), the key and the
 * models, tried with a word, and whether the Claude and Codex accounts are logged in, with a login for each. Keys go to
 * this machine's settings only; the page is never given them back.
 */
export function ModelsSettings({ host }: { host: ModelsHost | null }) {
	/** Those of 高级 turned on: only theirs shown. */
	const [on, setOn] = useState<string[]>([]);
	const [shown, setShown] = useState<PanelModelsShown | null>(null);
	const [provider, setProvider] = useState('');
	const [fields, setFields] = useState({ baseUrl: '', apiKey: '', main: '', fast: '' });
	const [said, say] = useState(quiet);
	const [checking, setChecking] = useState(false);

	const [piShown, setPiShown] = useState<{ chosen: string; providers: PiProvider[] } | null>(null);
	const [piProvider, setPiProvider] = useState('');
	const [piKey, setPiKey] = useState('');
	const [piSaid, piSay] = useState(quiet);
	const [piChecking, setPiChecking] = useState(false);

	const [claudeLine, setClaudeLine] = useState<Line>('');
	const [codexLine, setCodexLine] = useState<Line>('');

	const current = shown?.providers.find((entry) => entry.id === provider);
	const isAccount = current?.id === 'claude-account';
	const piCurrent = piShown?.providers.find((entry) => entry.id === piProvider);
	const piOwn = !piCurrent?.env;

	/** The fields of the service chosen in the list: as saved (the key never), the preset's suggestions as placeholders. */
	function choose(id: string, from = shown): void {
		setProvider(id);
		const entry = from?.providers.find((candidate) => candidate.id === id);
		if (entry && entry.id !== 'claude-account') setFields({ baseUrl: entry.baseUrl, apiKey: '', main: entry.main, fast: entry.fast === entry.main ? '' : entry.fast });
		say(quiet);
	}
	function choosePi(id: string): void {
		setPiProvider(id);
		setPiKey('');
		const entry = piShown?.providers.find((candidate) => candidate.id === id);
		piSay(entry?.env ? quiet : { text: t('用 pi 在这台电脑上自己的设置和登录（~/.pi），模型从输入框下面选。'), tone: '' });
	}

	async function lookAtAccounts(): Promise<void> {
		setClaudeLine(t('正在看是否登录了…'));
		setCodexLine(t('正在看是否登录了…'));
		try {
			const { claude, codex } = await panelAccounts();
			const plan = claude.plan === 'max' ? 'Max' : claude.plan === 'pro' ? 'Pro' : claude.plan;
			setClaudeLine({ text: claude.missing ? t('没有装好 Claude Code（npm install）') : claude.loggedIn ? (plan ? t('已登录（{plan} 订阅）', { plan }) : t('已登录')) : t('还没有登录'), button: claude.loggedIn ? t('换个账号登录') : t('登录 Claude 账号'), command: CLAUDE_LOGIN, missing: claude.missing });
			setCodexLine({ text: codex.missing ? t('没有装好 Codex（npm install）') : codex.loggedIn ? t('已登录（{how}）', { how: codex.how || 'ChatGPT' }) : t('还没有登录'), button: codex.loggedIn ? t('换个账号登录') : t('登录 ChatGPT 账号'), command: CODEX_LOGIN, missing: codex.missing });
		} catch (error) {
			setClaudeLine(error instanceof Error ? error.message : t('看不了是否登录'));
			setCodexLine('');
		}
	}
	const login = (command: string) => {
		host?.runInTerminal(command);
		say({ text: t('在右边「终端」里按提示登录（会打开浏览器）；登好了回来点 ↻。'), tone: '' });
	};
	const look = () => void lookAtAccounts();

	// Opened: what is saved, and whether the accounts are logged in.
	useEffect(() => {
		say(quiet);
		listAgents().then(
			(known) => setOn(known.agents.filter((agent) => agent.on).map((agent) => agent.id)),
			() => {},
		);
		panelModels().then(
			(models) => {
				setShown(models);
				choose(models.chosen, models);
			},
			(error: unknown) => say(failure(error, t('读不到设置'))),
		);
		piModels().then(
			(models) => {
				setPiShown(models);
				setPiProvider(models.chosen);
				setPiKey('');
				piSay(models.providers.find((entry) => entry.id === models.chosen)?.env ? quiet : { text: t('用 pi 在这台电脑上自己的设置和登录（~/.pi），模型从输入框下面选。'), tone: '' });
			},
			(error: unknown) => piSay(failure(error, t('读不到设置'))),
		);
		void lookAtAccounts();
	}, []);

	/** Saves the service chosen, with what was typed (a key left empty is kept). */
	async function store(): Promise<boolean> {
		if (!current) return false;
		try {
			const saved = await savePanelModels({
				provider: current.id,
				...(isAccount ? {} : { baseUrl: fields.baseUrl, main: fields.main, fast: fields.fast }),
				...(fields.apiKey.trim() ? { apiKey: fields.apiKey.trim() } : {}),
			});
			setShown(saved);
			choose(current.id, saved);
			return true;
		} catch (error) {
			say(failure(error, t('没能保存')));
			return false;
		}
	}

	async function piStore(): Promise<boolean> {
		if (!piCurrent) return false;
		try {
			const saved = await savePiModels({ provider: piCurrent.id, ...(piKey.trim() ? { apiKey: piKey.trim() } : {}) });
			setPiShown(saved);
			setPiKey('');
			return true;
		} catch (error) {
			piSay(failure(error, t('没能保存')));
			return false;
		}
	}

	const field = (key: keyof typeof fields) => ({ value: fields[key], onChange: (event: { target: { value: string } }) => setFields({ ...fields, [key]: event.target.value }), spellCheck: false });

	return (
		<section className="ai-sheet is-in-settings" aria-label={t('模型和账号')}>
			{/* pi: a service of its catalog and a key; its models are then those of the service. */}
			<h4>{t('pi 用哪家的模型')}</h4>
			<select className="ai-sheet-provider" aria-label={t('pi 的模型来源')} value={piProvider} onChange={(event) => choosePi(event.target.value)}>
				{piShown?.providers.map((entry) => (
					<option key={entry.id} value={entry.id}>
						{entry.name}
					</option>
				))}
			</select>
			<div className="ai-sheet-keyed" hidden={piOwn}>
				<Field label="API key" hint={<KeyLink url={piCurrent?.keyUrl} />}>
					<input type="password" autoComplete="off" spellCheck={false} placeholder={piCurrent?.hasKey ? t('已保存（不改就留空）') : t('粘贴 API key（pi 从 {env} 读）', { env: piCurrent?.env ?? '' })} value={piKey} onChange={(event) => setPiKey(event.target.value)} />
				</Field>
				<p className="ai-sheet-note">{t('pi 自带各家的模型列表，只要填 key；「检查」会列出这家的模型。')}</p>
			</div>
			<div className="ai-sheet-actions">
				<button
					type="button"
					hidden={piOwn}
					disabled={piChecking}
					onClick={async () => {
						if (!(await piStore())) return;
						piSay({ text: t('正在问一句…'), tone: '' });
						setPiChecking(true);
						try {
							const answer = await checkPiModels();
							piSay({ text: t('能用：{model} 回答了「{answer}」。这家的模型：{models}', { model: answer.model, answer: answer.answered.slice(0, 40), models: answer.models.map((model) => model.split('/').slice(1).join('/')).join('、') }), tone: 'ok' });
						} catch (error) {
							piSay(failure(error, t('不能用')));
						} finally {
							setPiChecking(false);
						}
					}}
				>
					{t('检查')}
				</button>
				<button
					type="button"
					className="is-primary"
					onClick={async () => {
						if (!(await piStore())) return;
						piSay({ text: t('已保存；新开的 pi 对话会用它。'), tone: 'ok' });
						host?.saved('pi', piCurrent?.name ?? '');
					}}
				>
					{t('保存')}
				</button>
			</div>
			<Result said={piSaid} />

			{on.includes('claude') && (
				<>
					<h4>{t('Claude Code 用哪家的模型')}</h4>
					<select className="ai-sheet-provider" aria-label={t('模型来源')} value={provider} onChange={(event) => choose(event.target.value)}>
						{shown?.providers.map((entry) => (
							<option key={entry.id} value={entry.id}>
								{entry.name}
							</option>
						))}
					</select>
					<Account line={claudeLine} hidden={!isAccount} onLogin={login} onLook={look} />
					<div className="ai-sheet-keyed" hidden={isAccount}>
						<Field label={t('接口地址')}>
							<input type="url" placeholder={current?.suggested.baseUrl || 'https://…/anthropic'} {...field('baseUrl')} />
						</Field>
						<Field label="API key" hint={<KeyLink url={current?.keyUrl} />}>
							<input type="password" autoComplete="off" placeholder={current?.hasKey ? t('已保存（不改就留空）') : t('粘贴 API key')} {...field('apiKey')} />
						</Field>
						<Field label={t('主模型')}>
							<input placeholder={current?.suggested.main || (current?.id === 'anthropic' ? t('留空：用 Claude 自己的模型列表') : t('模型名'))} {...field('main')} />
						</Field>
						<Field label={t('快速模型（小事和子任务）')}>
							<input placeholder={t('留空：和主模型一样')} {...field('fast')} />
						</Field>
						<p className="ai-sheet-note">{t('模型名各家常改，以它们官网为准；填好点「检查」，用一句话试一下。')}</p>
					</div>
					<div className="ai-sheet-actions">
						<button
							type="button"
							hidden={isAccount}
							disabled={checking}
							onClick={async () => {
								if (!(await store())) return;
								say({ text: t('正在问一句…'), tone: '' });
								setChecking(true);
								try {
									const answer = await checkPanelModels();
									say({ text: t('能用：{model} 回答了「{answer}」', { model: answer.model, answer: answer.answered.slice(0, 40) }), tone: 'ok' });
								} catch (error) {
									say(failure(error, t('不能用')));
								} finally {
									setChecking(false);
								}
							}}
						>
							{t('检查')}
						</button>
						<button
							type="button"
							className="is-primary"
							onClick={async () => {
								if (!(await store())) return;
								say({ text: t('已保存；新开的对话会用它。'), tone: 'ok' });
								host?.saved('claude', current?.name ?? '');
							}}
						>
							{t('保存')}
						</button>
					</div>
					<Result said={said} />

				</>
			)}
			{on.includes('codex') && (
				<>
					<h4>Codex</h4>
					<Account line={codexLine} onLogin={login} onLook={look} />
				</>
			)}
			{!on.length && <p className="ai-sheet-note">{t('Claude Code、Codex 在「高级」里打开后，它们的模型和账号也在这里。')}</p>}
		</section>
	);
}
