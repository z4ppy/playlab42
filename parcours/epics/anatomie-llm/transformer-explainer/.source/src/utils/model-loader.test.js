import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fetchVerifiedChunks } from './model-loader.js';

const files = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])];
const manifest = {
	revision: 'test', source: 'https://example.test/weights', bytes: 5,
	chunks: files.map((file, index) => ({
		file: `part${index}`, bytes: file.length,
		sha256: createHash('sha256').update(file).digest('hex')
	}))
};
function response(index) { return new Response(files[index]); }

test('fusionne les vrais octets dans l’ordre, avec la session du site uniquement et sans prompt', async () => {
	const progress = [];
	const result = await fetchVerifiedChunks(manifest, {
		cacheStorage: undefined,
		onProgress: event => progress.push(event),
		fetchImpl: async (url, options) => {
			assert.equal(options.credentials, 'same-origin');
			assert.equal(options.referrerPolicy, 'no-referrer');
			assert.equal(Object.hasOwn(options, 'body'), false);
			return response(Number(url.at(-1)));
		}
	});
	assert.deepEqual([...result], [1, 2, 3, 4, 5]);
	assert.equal(progress.at(-1).bytes, 5);
});

test('refuse un téléchargement HTTP incomplet', async () => {
	await assert.rejects(fetchVerifiedChunks(manifest, {
		cacheStorage: undefined,
		fetchImpl: async () => new Response('absent', { status: 503 })
	}), /HTTP 503/);
});

test('une erreur réseau identifie le fichier et conserve la cause sans conclure à CORS', async () => {
	const cause = new TypeError('Failed to fetch');
	await assert.rejects(fetchVerifiedChunks(manifest, {
		cacheStorage: undefined,
		fetchImpl: async () => { throw cause; }
	}), error => {
		assert.match(error.message, /Téléchargement impossible : https:\/\/example.test\/weights\/part[01]/);
		assert.match(error.message, /session de prévisualisation/);
		assert.equal(error.cause, cause);
		return true;
	});
});

test('refuse une taille incorrecte et un contenu corrompu de même taille', async () => {
	for (const bytes of [new Uint8Array([0]), new Uint8Array([0, 0])]) {
		await assert.rejects(fetchVerifiedChunks(manifest, {
			cacheStorage: undefined,
			fetchImpl: async () => new Response(bytes)
		}), /Taille incorrecte|Intégrité SHA-256/);
	}
});

test('fonctionne même si le navigateur refuse le cache ou son quota', async () => {
	for (const cacheStorage of [
		{ open: async () => { throw new Error('Stockage privé'); } },
		{ open: async () => ({ match: async () => undefined, put: async () => { throw new Error('Quota'); } }) }
	]) {
		const result = await fetchVerifiedChunks(manifest, {
			cacheStorage,
			fetchImpl: async url => response(Number(url.at(-1)))
		});
		assert.equal(result.length, 5);
	}
});

test('vérifie le cache, remplace une entrée corrompue et réutilise les entrées valides', async () => {
	const requested = [];
	const deleted = [];
	const result = await fetchVerifiedChunks(manifest, {
		cacheStorage: { open: async () => ({
			match: async url => url.endsWith('0') ? response(0) : new Response([0]),
			delete: async url => deleted.push(url),
			put: async () => {}
		}) },
		fetchImpl: async url => { requested.push(url); return response(1); }
	});
	assert.deepEqual([...result], [1, 2, 3, 4, 5]);
	assert.equal(requested.length, 1);
	assert.equal(deleted.length, 1);
});

test('une annulation explicite interrompt le téléchargement', async () => {
	const controller = new AbortController();
	controller.abort();
	let requested = false;
	await assert.rejects(fetchVerifiedChunks(manifest, {
		cacheStorage: undefined,
		signal: controller.signal,
		fetchImpl: async () => { requested = true; return response(0); }
	}), /abort/i);
	assert.equal(requested, false);
});
