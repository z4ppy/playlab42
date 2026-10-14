import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const revision = 'bfe50afba10b9b560b84143ee1107d977defa74f';
const folder = process.argv[2];
if (!folder) throw new Error('Fournir le dossier model-v2 extrait de la révision amont.');
const chunks = Array.from({ length: 63 }, (_, index) => {
	const file = `gpt2.onnx.part${index}`;
	const buffer = readFileSync(resolve(folder, file));
	return { file, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
});
writeFileSync('static/model-manifest.json', `${JSON.stringify({
	revision,
	source: `https://raw.githubusercontent.com/poloclub/transformer-explainer/${revision}/static/model-v2`,
	bytes: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
	chunks
}, null, 2)}\n`);
