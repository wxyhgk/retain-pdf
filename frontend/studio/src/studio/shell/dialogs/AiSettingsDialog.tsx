import { useRef, useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@studio/ui/button';
import { Input } from '@studio/ui/input';
import { NativeSelect, NativeSelectOption } from '@studio/ui/native-select';
import { saveAiSettings, type AiSettingsShown } from '../../api/client';
import { Actions, errorText, Frame, Status } from './Frame';

/** AI 设置 opened: as they are, why (when for want of a setting), and what is saved (`done`; null when not). */
export type AiSettingsAsk = { shown: AiSettingsShown; why: string; done(settings: AiSettingsShown | null): void };

/** A field: its name above it. */
export function Field({ label, id, hidden, children }: { label: string; id?: string; hidden?: boolean; children: ReactNode }) {
	return (
		<label id={id} className="grid gap-1.5" hidden={hidden}>
			<span className="text-[11px] text-muted-foreground">{label}</span>
			{children}
		</label>
	);
}

/**
 * 「AI 设置」: which large model the Studio asks (识别图片) — Claude, or a service that speaks OpenAI's API — its model,
 * its address, its key. The key is written, never read back: the page only hears whether there is one.
 */
export function AiSettingsDialog({ shown, why, done, onClose }: AiSettingsAsk & { onClose(): void }) {
	const [provider, setProvider] = useState(shown.provider);
	const [model, setModel] = useState(shown.model === shown.defaults[shown.provider] ? '' : shown.model);
	const [baseUrl, setBaseUrl] = useState(shown.baseUrl);
	const [workspace, setWorkspace] = useState(shown.workspaceId);
	const [key, setKey] = useState('');
	const [status, setStatus] = useState('');
	const [saving, setSaving] = useState(false);
	const fields = { provider: useRef<HTMLSelectElement>(null), baseUrl: useRef<HTMLInputElement>(null), key: useRef<HTMLInputElement>(null) };

	const openai = provider === 'openai';
	const saved = shown.keySaved && shown.provider === provider;
	const close = (settings: AiSettingsShown | null) => {
		done(settings);
		onClose();
	};

	async function save(event: FormEvent): Promise<void> {
		event.preventDefault();
		setSaving(true);
		setStatus('正在保存…');
		try {
			const settings = await saveAiSettings({
				provider,
				model,
				baseUrl,
				workspaceId: workspace,
				// Empty: the saved key stays; a space: it goes.
				...(key ? { apiKey: key.trim() } : {}),
			});
			close(settings);
		} catch (error) {
			setStatus(errorText(error, '没能保存'));
			setSaving(false);
		}
	}

	return (
		<Frame
			id="ai-settings-dialog"
			title="AI 设置"
			description="识别图片时用的大模型。key 只存在这台电脑上（.studio-settings.json，不进 git）"
			className="sm:max-w-[520px]"
			onClose={() => close(null)}
			focus={() => (why ? (openai && !baseUrl ? fields.baseUrl : fields.key) : fields.provider).current}
		>
			<form className="grid gap-4" onSubmit={(event) => void save(event)}>
				{why && (
					<p id="ai-settings-reason" className="rounded-md bg-muted px-3 py-2 text-xs">
						{why}
					</p>
				)}
				<Field label="服务">
					<NativeSelect id="ai-provider" ref={fields.provider} className="w-full" value={provider} onChange={(event) => setProvider(event.target.value as AiSettingsShown['provider'])}>
						<NativeSelectOption value="anthropic">Claude（Anthropic）</NativeSelectOption>
						<NativeSelectOption value="openai">OpenAI 兼容接口（通义千问、DeepSeek、智谱、OpenRouter…）</NativeSelectOption>
					</NativeSelect>
				</Field>
				<Field label="模型">
					<Input id="ai-model" autoComplete="off" spellCheck={false} value={model} placeholder={openai ? '例如 qwen-vl-max、glm-4v-plus' : shown.defaults.anthropic} onChange={(event) => setModel(event.target.value)} />
				</Field>
				<Field label="接口地址">
					<Input
						id="ai-base-url"
						ref={fields.baseUrl}
						autoComplete="off"
						spellCheck={false}
						value={baseUrl}
						placeholder={openai ? '例如 https://dashscope.aliyuncs.com/compatible-mode/v1' : '空着就是 Anthropic 自己的（用代理时再填）'}
						onChange={(event) => setBaseUrl(event.target.value)}
					/>
				</Field>
				<Field label="Key">
					<Input id="ai-key" ref={fields.key} type="password" autoComplete="off" value={key} placeholder={saved ? '已保存（不改就空着）' : openai ? '空着就用环境变量 OPENAI_API_KEY' : '空着就用环境变量 ANTHROPIC_API_KEY'} onChange={(event) => setKey(event.target.value)} />
				</Field>
				{saved && <small className="-mt-2 text-[10px] leading-normal text-muted-foreground">要换 key 就填新的；要删掉保存的 key，填一个空格再保存。</small>}
				{/* Only Claude's keys may belong to a whole organization rather than one workspace. */}
				<Field label="工作区 ID" id="ai-workspace-field" hidden={openai}>
					<Input id="ai-workspace" autoComplete="off" spellCheck={false} value={workspace} placeholder="一般空着；key 属于整个组织时填 wrkspc_…" onChange={(event) => setWorkspace(event.target.value)} />
				</Field>
				<Status id="ai-settings-status" text={status} />
				<Actions>
					<Button id="ai-settings-cancel" type="button" variant="outline" size="sm" onClick={() => close(null)}>
						取消
					</Button>
					<Button id="ai-settings-save" type="submit" size="sm" disabled={saving}>
						保存
					</Button>
				</Actions>
			</form>
		</Frame>
	);
}
