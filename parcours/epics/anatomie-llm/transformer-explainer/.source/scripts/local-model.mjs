import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const manifestPath = new URL('../static/model-manifest.json', import.meta.url);

export async function prepareLocalModel({
	download = false,
	from = resolve(sourceRoot, '.model-cache'),
	publicDirectory = fileURLToPath(new URL('../../public', import.meta.url)),
	manifest,
	fetchImpl = fetch,
	onProgress = console.log
} = {}) {
	manifest ??= JSON.parse(await readFile(manifestPath, 'utf8'));
	if (!manifest.chunks.length || manifest.chunks.some(chunk => !/^gpt2\.onnx\.part\d+$/.test(chunk.file))) {
		throw new Error('Noms de fragments invalides.');
	}
	if (manifest.chunks.reduce((bytes, chunk) => bytes + chunk.bytes, 0) !== manifest.bytes) {
		throw new Error('Taille du manifeste incorrecte.');
	}
	const directory = resolve(publicDirectory, 'model-v2');
	const descriptor = resolve(publicDirectory, 'model-local-manifest.json');
	await mkdir(directory, { recursive: true });
	await mkdir(from, { recursive: true });
	await rm(descriptor, { force: true });
	const verify = (bytes, chunk) => {
		if (bytes.length !== chunk.bytes || createHash('sha256').update(bytes).digest('hex') !== chunk.sha256) {
			throw new Error(`Intégrité incorrecte : ${chunk.file}`);
		}
	};
	for (const [index, chunk] of manifest.chunks.entries()) {
		const path = resolve(from, chunk.file);
		let bytes;
		try {
			bytes = await readFile(path);
			verify(bytes, chunk);
		} catch (cause) {
			if (!download) throw cause;
			const response = await fetchImpl(`${manifest.source}/${chunk.file}`, {
				signal: AbortSignal.timeout(90_000), credentials: 'omit', referrerPolicy: 'no-referrer'
			});
			if (!response.ok) throw new Error(`HTTP ${response.status} : ${chunk.file}`);
			bytes = Buffer.from(await response.arrayBuffer());
			verify(bytes, chunk);
			const incoming = `${path}.incoming`;
			await writeFile(incoming, bytes);
			await rename(incoming, path);
		}
		await copyFile(path, resolve(directory, chunk.file));
		onProgress(`${index + 1}/${manifest.chunks.length} : ${chunk.file}, SHA-256 vérifié`);
	}
	const local = { ...manifest, upstreamSource: manifest.source, source: './model-v2' };
	await writeFile(descriptor, `${JSON.stringify(local, null, 2)}\n`);
	return local;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const fromIndex = args.indexOf('--from');
	if (!args.includes('--download') && fromIndex === -1) {
		throw new Error('Choisir explicitement --download ou --from DIRECTORY ; aucun poids téléchargé automatiquement.');
	}
	if (fromIndex !== -1 && !args[fromIndex + 1]) throw new Error('--from exige un répertoire.');
	await prepareLocalModel({ download: args.includes('--download'), ...(fromIndex === -1 ? {} : { from: resolve(args[fromIndex + 1]) }) });
	console.log('Poids statiques locaux prêts. model-v2/ et model-local-manifest.json sont exclus de Git.');
}
