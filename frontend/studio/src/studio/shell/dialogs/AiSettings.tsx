import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { t } from '@blog/i18n/index.mjs';
import { Button } from '@studio/ui/button';
import { Input } from '@studio/ui/input';
import { NativeSelect, NativeSelectOption } from '@studio/ui/native-select';
import { aiSettings, saveAiSettings, type AiSettingsShown } from '../../api/client';
import { Actions, errorText, Status } from './Frame';

/** A field: its name above it. */
export function Field({ label, id, hidden, children }: { label: string; id?: string; hidden?: boolean; children: ReactNode }) {
	return (
		<label id={id} className="grid gap-1.5" hidden={hidden}>
			<span className="text-xs text-muted-foreground">{label}</span>
			{children}
		</label>
	);
}

/**
 * 设置 › AI 模型: which large model the Studio asks (识别图片) — Claude, or a service that speaks OpenAI's API — its
 * model, its address, its key, as they are now. `why` above when it is opened for want of a setting (the caret then in
 * the field missing). The key is written, never read back: the page only hears whether there is one.
 */
export function AiSettings({ why, onSaved }: { why: string; onSaved(settings: AiSettingsShown): void }) {
	const [shown, setShown] = useState<AiSettingsShown | null>(null);
	const [status, setStatus] = useState({ text: '', error: false });
	useEffect(() => {
		aiSettings().then(setShown, (error: unknown) => setStatus({ text: errorText(error, t('读不到 AI 设置')), error: true }));
	}, []);
	return shown ? <AiForm shown={shown} why={why} onSaved={onSaved} /> : <Status id="ai-settings-status" {...status} />;
}

function AiForm({ shown, why, onSaved }: { shown: AiSettingsShown; why: string; onSaved(settings: AiSettingsShown): void }) {
	const [provider, setProvider] = useState(shown.provider);
	const [model, setModel] = useState(shown.model === shown.defaults[shown.provider] ? '' : shown.model);
	const [baseUrl, setBaseUrl] = useState(shown.baseUrl);
	const [workspace, setWorkspace] = useState(shown.workspaceId);
	const [key, setKey] = useState('');
	/** The service whose key is kept, if one is. */
	const [keptFor, setKeptFor] = useState(shown.keySaved ? shown.provider : null);
	const [status, setStatus] = useState({ text: '', error: false });
	const [saving, setSaving] = useState(false);
	const fields = { baseUrl: useRef<HTMLInputElement>(null), key: useRef<HTMLInputElement>(null) };

	const openai = provider === 'openai';
	const saved = keptFor === provider;
	useEffect(() => {
		if (why) (openai && !baseUrl ? fields.baseUrl : fields.key).current?.focus();
		// Once, as it is shown.
	}, []);

	async function save(event: FormEvent): Promise<void> {
		event.preventDefault();
		setSaving(true);
		setStatus({ text: t('正在保存…'), error: false });
		try {
			const settings = await saveAiSettings({
				provider,
				model,
				baseUrl,
				workspaceId: workspace,
				// Empty: the saved key stays; a space: it goes.
				...(key ? { apiKey: key.trim() } : {}),
			});
			setKey('');
			setKeptFor(settings.keySaved ? settings.provider : null);
			setStatus({ text: t('已保存'), error: false });
			onSaved(settings);
		} catch (error) {
			setStatus({ text: errorText(error, t('没能保存')), error: true });
		} finally {
			setSaving(false);
		}
	}

	return (
		<form className="grid gap-4" onSubmit={(event) => void save(event)}>
			{why && (
				<p id="ai-settings-reason" className="rounded-md bg-muted px-3 py-2 text-xs">
					{why}
				</p>
			)}
			<Field label={t('服务')}>
				<NativeSelect id="ai-provider" className="w-full" value={provider} onChange={(event) => setProvider(event.target.value as AiSettingsShown['provider'])}>
					<NativeSelectOption value="anthropic">Claude（Anthropic）</NativeSelectOption>
					<NativeSelectOption value="openai">{t('OpenAI 兼容接口（通义千问、DeepSeek、智谱、OpenRouter…）')}</NativeSelectOption>
				</NativeSelect>
			</Field>
			<Field label={t('模型')}>
				<Input id="ai-model" autoComplete="off" spellCheck={false} value={model} placeholder={openai ? t('例如 qwen-vl-max、glm-4v-plus') : shown.defaults.anthropic} onChange={(event) => setModel(event.target.value)} />
			</Field>
			<Field label={t('接口地址')}>
				<Input
					id="ai-base-url"
					ref={fields.baseUrl}
					autoComplete="off"
					spellCheck={false}
					value={baseUrl}
					placeholder={openai ? t('例如 https://dashscope.aliyuncs.com/compatible-mode/v1') : t('空着就是 Anthropic 自己的（用代理时再填）')}
					onChange={(event) => setBaseUrl(event.target.value)}
				/>
			</Field>
			<Field label="Key">
				<Input id="ai-key" ref={fields.key} type="password" autoComplete="off" value={key} placeholder={saved ? t('已保存（不改就空着）') : openai ? t('空着就用环境变量 OPENAI_API_KEY') : t('空着就用环境变量 ANTHROPIC_API_KEY')} onChange={(event) => setKey(event.target.value)} />
			</Field>
			{saved && <small className="-mt-2 text-xs leading-normal text-muted-foreground">{t('要换 key 就填新的；要删掉保存的 key，填一个空格再保存。')}</small>}
			{/* Only Claude's keys may belong to a whole organization rather than one workspace. */}
			<Field label={t('工作区 ID')} id="ai-workspace-field" hidden={openai}>
				<Input id="ai-workspace" autoComplete="off" spellCheck={false} value={workspace} placeholder={t('一般空着；key 属于整个组织时填 wrkspc_…')} onChange={(event) => setWorkspace(event.target.value)} />
			</Field>
			<Status id="ai-settings-status" {...status} />
			<Actions>
				<Button id="ai-settings-save" type="submit" size="sm" disabled={saving}>
					{t('保存')}
				</Button>
			</Actions>
		</form>
	);
}
