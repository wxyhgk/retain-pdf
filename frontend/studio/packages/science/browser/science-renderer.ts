import { cubeSciencePlugin } from './cube-renderer.ts';
import { moleculeSciencePlugin } from './molecule-renderer.ts';
import { SciencePluginRegistry, type ScienceRendererPlugin } from './plugin-registry.ts';

const PREVIEW_SELECTOR = '[data-science-plugin]:not([data-science-rendered])';

export const sciencePluginRegistry = new SciencePluginRegistry();
sciencePluginRegistry.register(cubeSciencePlugin);
sciencePluginRegistry.register(moleculeSciencePlugin);

export function registerSciencePlugin(plugin: ScienceRendererPlugin): () => void {
	return sciencePluginRegistry.register(plugin);
}

export function createSciencePreview(language: string, source: string): HTMLElement | null {
	return sciencePluginRegistry.createPreview(language, source);
}

export function hydrateSciencePreviews(root: ParentNode = document): void {
	for (const preview of root.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR)) {
		void sciencePluginRegistry.hydratePreview(preview);
	}
}

/** Hydrate placeholders that an editor recreates after code changes. */
export function observeSciencePreviews(root: HTMLElement): () => void {
	// Lazy: a single article can embed multi-megabyte Cube grids whose
	// isosurface extraction blocks the main thread, so figures hydrate only
	// when they approach the viewport. In-view figures still resolve right
	// after load via the observer's initial callback.
	const pending = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			const preview = entry.target as HTMLElement;
			pending.unobserve(preview);
			void sciencePluginRegistry.hydratePreview(preview);
		}
	}, { rootMargin: '600px' });
	const watch = (): void => {
		for (const preview of root.querySelectorAll<HTMLElement>(PREVIEW_SELECTOR)) pending.observe(preview);
	};
	watch();
	const observer = new MutationObserver(watch);
	observer.observe(root, { childList: true, subtree: true });
	return () => {
		observer.disconnect();
		pending.disconnect();
	};
}

/** Replace ordinary Markdown code blocks on a generated blog page. */
export function renderScienceCodeBlocks(root: ParentNode = document): void {
	const blocks = [...root.querySelectorAll<HTMLElement>('pre > code[class*="language-"]')];
	for (const block of blocks) {
		const languageClass = [...block.classList].find((name) => name.startsWith('language-'));
		const language = languageClass?.replace('language-', '') ?? '';
		const source = block.textContent?.trim() ?? '';
		if (!source) continue;
		const preview = createSciencePreview(language, source);
		if (!preview) continue;
		block.parentElement?.replaceWith(preview);
	}
	hydrateSciencePreviews(root);
}
