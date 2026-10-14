import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformerExplainer, mountTransformerExplainer, transformerExplainerCapabilities } from '../../../_shared/transformer-explainer.js';

test('le registre 16b propose un nouvel onglet, transmet le thème et ne charge aucun modèle', async () => {
	const previous = {
		document: globalThis.document,
		HTMLElement: globalThis.HTMLElement,
		fetch: globalThis.fetch
	};
	class Element {
		constructor(ownerDocument) {
			this.ownerDocument = ownerDocument;
			this.style = {};
			this.children = [];
			this.attributes = new Map();
			this.listeners = new Map();
			this.isConnected = true;
		}
		setAttribute(name, value) { this.attributes.set(name, value); }
		addEventListener(name, listener) { this.listeners.set(name, listener); }
		removeEventListener(name) { this.listeners.delete(name); }
		append(...children) {
			this.children.push(...children);
			for (const child of children) child.parent = this;
		}
		remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
	}
	const document = {
		documentElement: { dataset: { theme: 'dark' } },
		listeners: new Map(),
		createElement() { return new Element(this); },
		addEventListener(name, listener) { this.listeners.set(name, listener); },
		removeEventListener(name) { this.listeners.delete(name); }
	};
	globalThis.document = document;
	globalThis.HTMLElement = Element;
	globalThis.fetch = () => { throw new Error('Réseau externe interdit pendant le montage'); };
	try {
		for (const theme of ['dark', 'light']) {
			document.documentElement.dataset.theme = theme;
			const root = new Element(document);
			const laboratory = await transformerExplainer(root);
			assert.equal(root.children.length, 1);
			assert.ok(laboratory.link.href.endsWith(`/transformer-explainer/public/index.html?theme=${theme}`));
			assert.equal(laboratory.link.target, '_blank');
			assert.equal(laboratory.link.rel, 'noopener noreferrer');
			assert.equal(laboratory.capabilities.integration, 'new-tab');
			assert.equal(laboratory.capabilities, transformerExplainerCapabilities);
			assert.deepEqual(laboratory.capabilities.programmatic, { tokenize: false, inference: false, tensors: false });
			assert.ok(Object.isFrozen(laboratory.capabilities));
			assert.ok(laboratory.capabilities.tokenizerAssets.json.endsWith('/public/tokenizer/tokenizer.json'));
			laboratory.destroy();
			assert.equal(root.children.length, 0);
			assert.equal(document.listeners.size, 0);
		}
		await assert.rejects(mountTransformerExplainer(new Element(document), { url: 'https://external.example/lab' }), /même origine/);
		const before = new AbortController();
		before.abort();
		const unused = new Element(document);
		await assert.rejects(transformerExplainer(unused, { signal: before.signal }), { name: 'AbortError' });
		assert.equal(unused.children.length, 0);
		const detached = new Element(document);
		detached.isConnected = false;
		await assert.rejects(transformerExplainer(detached), { name: 'AbortError' });
		const racing = new Element(document);
		const pending = transformerExplainer(racing);
		racing.isConnected = false;
		await assert.rejects(pending, { name: 'AbortError' });
		assert.equal(racing.children.length, 0);
		const abort = new AbortController();
		const root = new Element(document);
		const laboratory = await transformerExplainer(root, { signal: abort.signal });
		abort.abort();
		assert.equal(root.children.length, 0);
		laboratory.destroy();
		assert.equal(document.listeners.size, 0);
	} finally {
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete globalThis[name];
			else globalThis[name] = value;
		}
	}
});
