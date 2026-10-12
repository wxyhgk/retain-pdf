import { createApp, h, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Editor } from '@tiptap/core';
import CodeBlock from '@tiptap/extension-code-block';
import { OStarterKit, StudioInlineMath, YiiEditor } from '@yiitap/vue';
import '@tiptap/markdown';

type YiiEditorExpose = {
	editor: Editor | null;
};

export type StudioEditor = {
	getMarkdown(): string;
	focusStart(): void;
	destroy(): void;
};

const editorExtensions = [
	OStarterKit.configure({
		UniqueID: false,
		OCodeBlock: false,
	}),
	CodeBlock.configure({
		languageClassPrefix: 'language-',
	}),
	'Markdown',
	StudioInlineMath,
	'OBlockMath',
];

function readMarkdown(editor: Editor): string {
	return editor.getMarkdown();
}

function unwrapEditor(value: unknown): Editor | null {
	if (!value || typeof value !== 'object') return null;
	if ('commands' in value) return value as Editor;
	const inner = 'value' in value ? value.value : null;
	if (inner && typeof inner === 'object' && 'commands' in inner) return inner as Editor;
	return null;
}

export function mountStudioEditor(options: {
	host: HTMLElement;
	markdown: string;
	onUpdate: (markdown: string) => void;
}): Promise<StudioEditor> {
	const host = options.host;
	return new Promise((resolve, reject) => {
		const app = createApp({
			setup() {
				const yii = ref<YiiEditorExpose | null>(null);
				const darkMode = ref(document.documentElement.dataset.theme === 'dark');
				const observer = new MutationObserver(() => {
					darkMode.value = document.documentElement.dataset.theme === 'dark';
				});
				observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
				onBeforeUnmount(() => observer.disconnect());
				onMounted(() => {
					const editor = unwrapEditor(yii.value?.editor);
					if (!editor) {
						reject(new Error('编辑器没有完成初始化'));
						return;
					}
					try {
						editor.commands.setContent(options.markdown, {
							emitUpdate: false,
							contentType: 'markdown',
						});
					} catch (error) {
						reject(error instanceof Error ? error : new Error('文章正文无法载入编辑器'));
						return;
					}
					resolve({
						getMarkdown: () => readMarkdown(editor),
						focusStart() {
							editor.commands.focus('start');
						},
						destroy() {
							app.unmount();
						},
					});
				});
				return () => h(YiiEditor, {
					ref: yii,
					content: '',
					title: false,
					editable: true,
					autofocus: false,
					locale: 'zh',
					darkMode: darkMode.value,
					showMainMenu: false,
					showBubbleMenu: true,
					showFloatingMenu: false,
					sideMenu: { show: true, add: 'menu', addMenuOptions: null },
					pageView: 'full',
					extensions: editorExtensions,
					onUpdate: ({ editor }: { editor: Editor }) => {
						options.onUpdate(readMarkdown(editor));
					},
				});
			},
		});
		try {
			app.mount(host);
		} catch (error) {
			reject(error instanceof Error ? error : new Error('编辑器无法挂载'));
		}
	});
}
