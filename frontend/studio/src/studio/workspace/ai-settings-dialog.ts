import { aiSettings, saveAiSettings, type AiSettingsShown } from '../api/client';

/** Ready to ask: a key there and, for an OpenAI-compatible service, its address and model. */
export function aiReady(settings: AiSettingsShown): boolean {
	return settings.hasKey && (settings.provider === 'anthropic' || Boolean(settings.baseUrl && settings.model));
}

/**
 * 「AI 设置」: which large model the Studio asks (识别图片) — Claude, or a service that speaks OpenAI's
 * API — its model, its address, its key. The key is written, never read back: the page only hears
 * whether there is one.
 */
export function createAiSettingsDialog(dialog: HTMLDialogElement) {
	const form = dialog.querySelector('form')!;
	const reason = dialog.querySelector<HTMLElement>('#ai-settings-reason')!;
	const provider = dialog.querySelector<HTMLSelectElement>('#ai-provider')!;
	const model = dialog.querySelector<HTMLInputElement>('#ai-model')!;
	const baseUrl = dialog.querySelector<HTMLInputElement>('#ai-base-url')!;
	const key = dialog.querySelector<HTMLInputElement>('#ai-key')!;
	const keyNote = dialog.querySelector<HTMLElement>('#ai-key-note')!;
	const workspace = dialog.querySelector<HTMLInputElement>('#ai-workspace')!;
	const workspaceField = dialog.querySelector<HTMLElement>('#ai-workspace-field')!;
	const status = dialog.querySelector<HTMLElement>('#ai-settings-status')!;
	const save = dialog.querySelector<HTMLButtonElement>('#ai-settings-save')!;
	let shown: AiSettingsShown | null = null;
	let done: ((settings: AiSettingsShown | null) => void) | null = null;

	/** The hints follow the service chosen. */
	function hint(): void {
		const openai = provider.value === 'openai';
		model.placeholder = openai ? '例如 qwen-vl-max、glm-4v-plus' : shown?.defaults.anthropic ?? 'claude-opus-5-5';
		baseUrl.placeholder = openai ? '例如 https://dashscope.aliyuncs.com/compatible-mode/v1' : '空着就是 Anthropic 自己的（用代理时再填）';
		const saved = shown?.keySaved && shown.provider === provider.value;
		key.placeholder = saved ? '已保存（不改就空着）' : openai ? '空着就用环境变量 OPENAI_API_KEY' : '空着就用环境变量 ANTHROPIC_API_KEY';
		keyNote.textContent = saved ? '要换 key 就填新的；要删掉保存的 key，填一个空格再保存。' : '';
		// Only Claude's keys may belong to a whole organization rather than one workspace.
		workspaceField.hidden = openai;
		workspace.placeholder = '一般空着；key 属于整个组织时填 wrkspc_…';
	}

	provider.addEventListener('change', hint);
	for (const button of dialog.querySelectorAll('#ai-settings-cancel, #ai-settings-close')) button.addEventListener('click', () => dialog.close('cancel'));
	dialog.addEventListener('close', () => {
		done?.(dialog.returnValue === 'save' ? shown : null);
		done = null;
	});

	form.addEventListener('submit', async (event) => {
		const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
		if (submitter?.value !== 'save') return;
		event.preventDefault();
		save.disabled = true;
		status.textContent = '正在保存…';
		try {
			const typed = key.value;
			shown = await saveAiSettings({
				provider: provider.value as AiSettingsShown['provider'],
				model: model.value,
				baseUrl: baseUrl.value,
				workspaceId: workspace.value,
				// Empty: the saved key stays; a space: it goes.
				...(typed ? { apiKey: typed.trim() } : {}),
			});
			status.textContent = '';
			dialog.close('save');
		} catch (error) {
			status.textContent = error instanceof Error ? error.message : '没能保存';
		} finally {
			save.disabled = false;
		}
	});

	return {
		/** Opens it, saying `why` above (when it is opened for want of a setting); resolves with the settings saved, or null. */
		async open(why = ''): Promise<AiSettingsShown | null> {
			shown = await aiSettings();
			reason.hidden = !why;
			reason.textContent = why;
			provider.value = shown.provider;
			model.value = shown.model === shown.defaults[shown.provider] ? '' : shown.model;
			baseUrl.value = shown.baseUrl;
			workspace.value = shown.workspaceId;
			key.value = '';
			status.textContent = '';
			hint();
			dialog.showModal();
			(why ? (provider.value === 'openai' && !baseUrl.value ? baseUrl : key) : provider).focus();
			return new Promise((resolve) => (done = resolve));
		},
	};
}
