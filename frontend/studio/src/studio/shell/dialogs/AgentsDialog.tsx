import { useState, type FormEvent } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { Input } from '@studio/ui/input';
import { saveAgents, type Agent, type AgentsShown } from '../../api/client';
import { Actions, errorText, Frame, Status } from './Frame';

/** AI 助手 opened, with the AIs as they are; `saved` once the list is saved (the terminal's buttons drawn again). */
export type AgentsAsk = { shown: AgentsShown; saved(): void };

const FIELDS: Array<{ key: 'launch' | 'run' | 'resume'; label: string; hint: string }> = [
	{ key: 'launch', label: t('终端里启动'), hint: t('点终端上的按钮时运行，比如 claude') },
	{ key: 'run', label: t('Alt+Enter：后台跑一次'), hint: t('{prompt} 换成交给它的话') },
	{ key: 'resume', label: t('Alt+Enter：接着上次'), hint: t('接着这篇文章文件夹里最近的会话；{prompt} 同上') },
];

/** An AI of the list as it is typed: `row` keeps it apart from the others while its id is typed. */
type Line = Agent & { row: number };

let rows = 0;
const lines = (agents: Agent[]): Line[] => agents.map((agent) => ({ ...agent, row: ++rows }));

function TextField({ label, name, value, hint, onChange }: { label: string; name: string; value: string; hint?: string; onChange(value: string): void }) {
	return (
		<label className="agent-field flex min-w-0 flex-col gap-[3px] text-xs text-muted-foreground">
			<span>{label}</span>
			<Input name={name} className="h-[30px] px-2 font-mono text-xs text-foreground" autoComplete="off" spellCheck={false} value={value} placeholder={hint} onChange={(event) => onChange(event.target.value)} />
		</label>
	);
}

/**
 * 「AI 助手」: the AIs the Studio starts (agent-settings.mjs): Claude Code, Codex and pi to begin with, others added
 * (omp…), each its three command lines, and the one Alt+Enter uses. Kept on this machine.
 */
export function AgentsDialog({ shown, saved, onClose }: AgentsAsk & { onClose(): void }) {
	const [agents, setAgents] = useState(() => lines(shown.agents.map(({ installed: _, ...agent }) => agent)));
	const [chosen, setChosen] = useState(() => agents.find((agent) => agent.id === shown.default)?.row ?? agents[0]?.row ?? 0);
	const [status, setStatus] = useState({ text: '', error: false });
	const installed = new Map(shown.agents.map((agent) => [agent.id, agent.installed]));

	const change = (row: number, field: keyof Agent, value: string) => setAgents((list) => list.map((agent) => (agent.row === row ? { ...agent, [field]: value } : agent)));
	function remove(row: number): void {
		const rest = agents.filter((agent) => agent.row !== row);
		setAgents(rest);
		if (chosen === row) setChosen(rest[0]?.row ?? 0);
	}
	function add(): void {
		const [added] = lines([{ id: '', name: '', launch: '', run: ' {prompt}', resume: ' {prompt}' }]);
		setAgents((list) => [...list, added!]);
		if (!agents.length) setChosen(added!.row);
		requestAnimationFrame(() => document.querySelector<HTMLInputElement>('#agents-list .agent-row:last-child input[name="name"]')?.focus());
	}
	function presets(): void {
		const listed = lines(shown.presets);
		setAgents(listed);
		setChosen(listed[0]?.row ?? 0);
	}

	async function save(event: FormEvent): Promise<void> {
		event.preventDefault();
		setStatus({ text: t('正在保存…'), error: false });
		// Its adapter is not sent: the server knows the presets' (and shows them with this machine's paths).
		const list = agents.map(({ row: _, acp: __, ...agent }) => Object.fromEntries(Object.entries(agent).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as Agent);
		try {
			await saveAgents(list, list[agents.findIndex((agent) => agent.row === chosen)]?.id ?? '');
			onClose();
			saved();
		} catch (error) {
			setStatus({ text: errorText(error, t('没能保存')), error: true });
		}
	}

	return (
		<Frame id="agents-dialog" title={t('AI 助手')} description={t('终端上的按钮和 Alt+Enter 用的 AI。只存在这台电脑上（.studio-settings.json，不进 git）')} className="sm:max-w-[720px]" onClose={onClose}>
			<form className="grid min-h-0 gap-3" onSubmit={(event) => void save(event)}>
				<p className="text-xs leading-relaxed text-muted-foreground">
					{t('在正文里写一句要做的事，按 Alt+Enter，选中的 AI 就在这篇文章的文件夹里后台去做，做完把这几行换成结果，你逐处审阅；⇧Alt+Enter 是另开一个新会话。后台命令里的 {prompt} 换成交给它的话。Claude 的预设开了沙箱（只写这篇文章的文件夹、不联网），Codex 的是 workspace-write；pi 没有沙箱。')}
				</p>
				<ol id="agents-list" className="flex max-h-[56vh] flex-col gap-2.5 overflow-auto">
					{agents.map((agent) => {
						const known = installed.get(agent.id);
						return (
							<li key={agent.row} className="agent-row flex flex-col gap-1.5 rounded-lg border p-2.5">
								<div className="grid grid-cols-[minmax(0,130px)_minmax(0,130px)_max-content_minmax(0,1fr)_max-content] items-end gap-2">
									<TextField label={t('名字')} name="name" value={agent.name} onChange={(value) => change(agent.row, 'name', value)} />
									<TextField label={t('代号')} name="id" value={agent.id} onChange={(value) => change(agent.row, 'id', value)} />
									<label className="flex h-[30px] items-center gap-1.5 text-xs whitespace-nowrap">
										<input type="radio" name="agents-default" className="accent-primary" checked={chosen === agent.row} onChange={() => setChosen(agent.row)} />
										{t('Alt+Enter 用它')}
									</label>
									<small className="truncate text-xs leading-[30px] text-muted-foreground">{known === undefined ? '' : known ? t('已安装') : t('这台电脑上没找到')}</small>
									<Button type="button" variant="outline" size="xs" className="text-destructive hover:text-destructive" onClick={() => remove(agent.row)}>
										{t('删除')}
									</Button>
								</div>
								{FIELDS.map((field) => (
									<TextField key={field.key} label={field.label} name={field.key} value={agent[field.key]} hint={field.hint} onChange={(value) => change(agent.row, field.key, value)} />
								))}
							</li>
						);
					})}
				</ol>
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" onClick={add}>
						{t('＋ 添加一个')}
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={presets}>
						{t('恢复预设')}
					</Button>
				</div>
				<Status id="agents-status" {...status} />
				<Actions>
					<Button type="button" variant="outline" size="sm" onClick={onClose}>
						{t('取消')}
					</Button>
					<Button type="submit" size="sm">
						{t('保存')}
					</Button>
				</Actions>
			</form>
		</Frame>
	);
}
