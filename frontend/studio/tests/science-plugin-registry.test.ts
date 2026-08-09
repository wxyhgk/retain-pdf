import assert from 'node:assert/strict';
import test from 'node:test';
import { SciencePluginRegistry, type ScienceRendererPlugin } from '../src/science/browser/plugin-registry.ts';

function preview(): HTMLElement {
	return { dataset: {} } as HTMLElement;
}

function plugin(id: string, priority: number, language: string): ScienceRendererPlugin {
	return {
		id,
		priority,
		createPreview: (candidate) => candidate === language ? preview() : null,
		hydratePreview: () => {},
	};
}

test('higher-priority science plugins can override a general renderer', () => {
	const registry = new SciencePluginRegistry();
	registry.register(plugin('molecule', 0, 'cube'));
	registry.register(plugin('volume', 100, 'cube'));

	const result = registry.createPreview('cube', 'volume data');
	assert.equal(result?.dataset.sciencePlugin, 'volume');
});

test('science plugins are isolated by stable IDs and can be unregistered', () => {
	const registry = new SciencePluginRegistry();
	const unregister = registry.register(plugin('spectrum', 10, 'jcamp'));
	assert.throws(() => registry.register(plugin('spectrum', 20, 'csv')), /已经注册/u);
	assert.equal(registry.createPreview('jcamp', 'data')?.dataset.sciencePlugin, 'spectrum');
	unregister();
	assert.equal(registry.createPreview('jcamp', 'data'), null);
});
