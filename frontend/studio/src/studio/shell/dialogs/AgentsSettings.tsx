import { useEffect, useState } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Switch } from '@studio/ui/switch';
import { listAgents, saveAgents, type AgentsShown } from '../../api/client';
import { errorText, Status } from './Frame';

const ABOUT: Record<string, string> = {
	claude: t('Claude Code：用 Claude 账号，或者说 Anthropic 接口的服务（DeepSeek、Kimi……）。'),
	codex: t('Codex：用 ChatGPT 账号。'),
};

/**
 * 设置 › AI › 高级: Claude Code and Codex, beside pi in the AI panel once turned on (server/ai/agent-settings.mjs). Off,
 * a conversation already had with one goes on with it; a new one is begun with pi.
 */
export function AgentsSettings() {
	const [shown, setShown] = useState<AgentsShown | null>(null);
	const [status, setStatus] = useState({ text: '', error: false });
	useEffect(() => {
		listAgents().then(setShown, (error: unknown) => setStatus({ text: errorText(error, t('读不到设置')), error: true }));
	}, []);

	async function turn(id: string, on: boolean): Promise<void> {
		if (!shown) return;
		const wanted = shown.agents.filter((agent) => (agent.id === id ? on : agent.on)).map((agent) => agent.id);
		try {
			setShown(await saveAgents(wanted));
			setStatus({ text: t('已保存；AI 面板下一次读 AI 列表时就是这样（重新打开 Studio 也行）。'), error: false });
		} catch (error) {
			setStatus({ text: errorText(error, t('没能保存')), error: true });
		}
	}

	return (
		<>
			<p className="mb-3 text-xs leading-relaxed text-muted-foreground">{t('AI 面板默认用 pi。想在面板里也用 Claude Code 或 Codex，在这里打开：模型菜单的「程序」里就有它们，账号和模型在「模型和账号」里设。')}</p>
			<ul id="agents-list" className="grid gap-0.5">
				{shown?.agents.map((agent) => (
					<li key={agent.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-md px-2 py-2.5 hover:bg-muted" data-agent={agent.id}>
						<div className="grid min-w-0 gap-0.5">
							<strong className="text-[13px] font-semibold text-accent-foreground">{agent.name}</strong>
							<span className="text-xs leading-normal text-muted-foreground">{ABOUT[agent.id] ?? ''}</span>
						</div>
						<Switch checked={agent.on} aria-label={t('在 AI 面板里用 {name}', { name: agent.name })} onCheckedChange={(on) => void turn(agent.id, on)} />
					</li>
				))}
			</ul>
			<Status id="agents-status" {...status} />
		</>
	);
}
