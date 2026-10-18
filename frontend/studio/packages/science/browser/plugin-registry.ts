export interface ScienceRendererPlugin {
	/** Stable machine name stored on preview placeholders. */
	id: string;
	/** Higher-priority plugins get the first chance to claim a fenced block. */
	priority?: number;
	createPreview(language: string, source: string): HTMLElement | null;
	hydratePreview(preview: HTMLElement): void | Promise<void>;
}

export class SciencePluginRegistry {
	private readonly plugins = new Map<string, ScienceRendererPlugin>();

	register(plugin: ScienceRendererPlugin): () => void {
		if (!/^[a-z][a-z0-9-]*$/u.test(plugin.id)) throw new Error(`无效的科学插件 ID：${plugin.id}`);
		if (this.plugins.has(plugin.id)) throw new Error(`科学插件已经注册：${plugin.id}`);
		this.plugins.set(plugin.id, plugin);
		return () => this.plugins.delete(plugin.id);
	}

	list(): ScienceRendererPlugin[] {
		return [...this.plugins.values()].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
	}

	createPreview(language: string, source: string): HTMLElement | null {
		for (const plugin of this.list()) {
			const preview = plugin.createPreview(language, source);
			if (!preview) continue;
			preview.dataset.sciencePlugin = plugin.id;
			return preview;
		}
		return null;
	}

	hydratePreview(preview: HTMLElement): void | Promise<void> {
		if (preview.dataset.scienceRendered === 'true') return;
		const pluginId = preview.dataset.sciencePlugin;
		if (!pluginId) return;
		const plugin = this.plugins.get(pluginId);
		if (!plugin) return;
		preview.dataset.scienceRendered = 'true';
		return plugin.hydratePreview(preview);
	}
}
