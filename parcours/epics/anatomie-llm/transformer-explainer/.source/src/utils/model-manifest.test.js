import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveModelManifest } from './model-loader.js';

test('Le manifeste local respecte le préfixe et les sources externes non épinglées sont refusées', () => {
	const url = 'https://example.test/playlab42/parcours/transformer/public/model-local-manifest.json';
	const revision = 'bfe50afba10b9b560b84143ee1107d977defa74f';
	assert.equal(resolveModelManifest({ revision, source: './model-v2' }, url).source,
		'https://example.test/playlab42/parcours/transformer/public/model-v2');
	const source = `https://raw.githubusercontent.com/poloclub/transformer-explainer/${revision}/static/model-v2`;
	assert.equal(resolveModelManifest({ revision, source }, url).source, source);
	for (const source of ['https://evil.test/model', 'https://raw.githubusercontent.com/poloclub/transformer-explainer/main/static/model-v2',
		'https://user:password@example.test/model', './model-v2?prompt=test']) {
		assert.throws(() => resolveModelManifest({ revision, source }, url), /non autorisée/);
	}
});
