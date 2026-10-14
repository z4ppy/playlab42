import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { prepareLocalModel } from './local-model.mjs';

test('La préparation locale copie uniquement les fragments vérifiés et ne publie le manifeste qu’à la fin', async () => {
	const root = resolve('test-artifacts/local-model');
	const cache = resolve(root, 'cache');
	const output = resolve(root, 'public');
	const bytes = Buffer.from('vrais octets du test');
	const manifest = {
		revision: 'test', source: 'https://source.example/model', bytes: bytes.length,
		chunks: [{ file: 'gpt2.onnx.part0', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }]
	};
	await mkdir(cache, { recursive: true });
	try {
		await writeFile(resolve(cache, 'gpt2.onnx.part0'), bytes);
		const options = { from: cache, publicDirectory: output, manifest, onProgress: () => {} };
		const local = await prepareLocalModel({ ...options, fetchImpl: () => { throw new Error('Réseau interdit'); } });
		assert.equal(local.source, './model-v2');
		assert.equal(local.upstreamSource, manifest.source);
		assert.deepEqual(await readFile(resolve(output, 'model-v2/gpt2.onnx.part0')), bytes);
		await writeFile(resolve(cache, 'gpt2.onnx.part0'), Buffer.alloc(bytes.length));
		await assert.rejects(prepareLocalModel(options), /Intégrité incorrecte/);
		await assert.rejects(readFile(resolve(output, 'model-local-manifest.json')), { code: 'ENOENT' });
		let requests = 0;
		await prepareLocalModel({
			...options, download: true,
			fetchImpl: async (url, request) => {
				requests++;
				assert.equal(url, `${manifest.source}/gpt2.onnx.part0`);
				assert.equal(request.credentials, 'omit');
				assert.equal(request.referrerPolicy, 'no-referrer');
				return new Response(bytes);
			}
		});
		assert.equal(requests, 1);
		await rm(resolve(cache, 'gpt2.onnx.part0'));
		await assert.rejects(prepareLocalModel({
			...options, download: true, fetchImpl: async () => new Response('Refus', { status: 403 })
		}), /HTTP 403/);
		await assert.rejects(readFile(resolve(output, 'model-local-manifest.json')), { code: 'ENOENT' });
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
