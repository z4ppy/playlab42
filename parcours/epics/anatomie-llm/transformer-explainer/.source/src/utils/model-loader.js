/**
 * Charge exclusivement les poids exportés par l'amont, après consentement.
 * Le cache est facultatif : une navigation privée ne doit pas bloquer GPT-2.
 */
export function resolveModelManifest(manifest, manifestURL) {
	const location = new URL(manifestURL);
	const source = new URL(manifest.source, location);
	const upstream = `https://raw.githubusercontent.com/poloclub/transformer-explainer/${manifest.revision}/static/model-v2`;
	if (source.username || source.password || source.search || source.hash ||
		(source.origin !== location.origin && source.href !== upstream)) {
		throw new Error('Source des poids non autorisée : utilisez une copie statique locale ou la révision amont épinglée.');
	}
	return { ...manifest, source: source.href.replace(/\/$/, '') };
}

export async function fetchVerifiedChunks(manifest, {
	onProgress = () => {},
	signal,
	fetchImpl = fetch,
	cacheStorage = globalThis.caches,
	digest = buffer => crypto.subtle.digest('SHA-256', buffer)
} = {}) {
	const cancellation = new AbortController();
	signal = signal ? AbortSignal.any([signal, cancellation.signal]) : cancellation.signal;
	let cache;
	try {
		cache = await cacheStorage?.open(`playlab42-gpt2-${manifest.revision}`);
	} catch {
		// Un navigateur peut refuser le stockage sans refuser le calcul local.
	}
	let merged;
	const offsets = [];
	let expectedSize = 0;
	for (const chunk of manifest.chunks) {
		offsets.push(expectedSize);
		expectedSize += chunk.bytes;
	}
	if (expectedSize !== manifest.bytes) throw new Error('Taille du manifeste incorrecte.');
	let bytes = 0;
	let completed = 0;
	let next = 0;
	const verify = async (buffer, chunk) => {
		if (buffer.byteLength !== chunk.bytes) throw new Error(`Taille incorrecte : ${chunk.file}`);
		const hash = [...new Uint8Array(await digest(buffer))]
			.map(byte => byte.toString(16).padStart(2, '0')).join('');
		if (hash !== chunk.sha256) throw new Error(`Intégrité SHA-256 incorrecte : ${chunk.file}`);
	};
	const worker = async () => {
		while (next < manifest.chunks.length) {
			signal?.throwIfAborted();
			const index = next++;
			const chunk = manifest.chunks[index];
			const url = `${manifest.source}/${chunk.file}`;
			let response;
			try { response = await cache?.match(url); } catch { /* Cache facultatif. */ }
			let buffer;
			if (response) {
				try {
					buffer = await response.arrayBuffer();
					await verify(buffer, chunk);
				} catch {
					buffer = undefined;
					try { await cache?.delete(url); } catch { /* Cache facultatif. */ }
				}
			}
			if (!buffer) {
				const timeout = AbortSignal.timeout(90_000);
				const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
				try {
					// Le proxy du site peut exiger sa session. Aucun cookie n'est
					// transmis à une origine externe (dont les poids amont).
					response = await fetchImpl(url, {
						signal: requestSignal, credentials: 'same-origin', referrerPolicy: 'no-referrer', cache: 'no-store'
					});
				} catch (cause) {
					signal.throwIfAborted();
					throw new Error(`Téléchargement impossible : ${url}. Vérifiez l’accès à ce fichier et la session de prévisualisation. ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
				}
				if (!response.ok) throw new Error(`HTTP ${response.status} : ${chunk.file}`);
				const copy = response.clone();
				buffer = await response.arrayBuffer();
				await verify(buffer, chunk);
				try { await cache?.put(url, copy); } catch { /* Quota insuffisant : calcul sans cache. */ }
			}
			merged ??= new Uint8Array(manifest.bytes);
			merged.set(new Uint8Array(buffer), offsets[index]);
			bytes += buffer.byteLength;
			completed++;
			onProgress({ bytes, total: manifest.bytes, completed });
		}
	};
	try {
		await Promise.all([worker(), worker()]);
	} catch (cause) {
		cancellation.abort();
		throw cause;
	}
	signal?.throwIfAborted();
	if (bytes !== manifest.bytes) throw new Error('Taille finale du modèle incorrecte.');
	return merged;
}
