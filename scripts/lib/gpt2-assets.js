import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const gpt2PublicPath = 'parcours/epics/anatomie-llm/transformer-explainer/public';

function assertManifests(upstream, local) {
  if (local.source !== './model-v2' || local.upstreamSource !== upstream.source ||
    local.revision !== upstream.revision || local.bytes !== upstream.bytes ||
    JSON.stringify(local.chunks) !== JSON.stringify(upstream.chunks)) {
    throw new Error('Le manifeste local doit conserver la révision, les tailles et SHA-256 amont.');
  }
  const invalidChunk = (chunk, index) => chunk.file !== `gpt2.onnx.part${index}` ||
    !Number.isSafeInteger(chunk.bytes) || chunk.bytes <= 0 || !/^[a-f\d]{64}$/.test(chunk.sha256);
  if (!Array.isArray(upstream.chunks) || !upstream.chunks.length || upstream.chunks.some(invalidChunk) ||
    upstream.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0) !== upstream.bytes) {
    throw new Error('Manifeste amont invalide.');
  }
}

/**
 * Refuse de publier un laboratoire dont les poids locaux sont absents ou altérés.
 * Le manifeste amont versionné fixe les octets attendus ; le descripteur local
 * change uniquement leur transport. Aucun téléchargement pendant ce contrôle.
 * @param {string} root Racine des sources ou de l'artefact public.
 */
export function assertLocalGpt2Assets(root) {
  const directory = join(root, gpt2PublicPath);
  if (!existsSync(directory)) { return; }
  try {
    const upstream = JSON.parse(readFileSync(join(directory, 'model-manifest.json'), 'utf8'));
    const local = JSON.parse(readFileSync(join(directory, 'model-local-manifest.json'), 'utf8'));
    assertManifests(upstream, local);
    for (const chunk of upstream.chunks) {
      // Un fragment à la fois : pas de copie de 657 Mo pour vérifier le paquet.
      const bytes = readFileSync(join(directory, 'model-v2', chunk.file));
      if (bytes.length !== chunk.bytes || createHash('sha256').update(bytes).digest('hex') !== chunk.sha256) {
        throw new Error(`Intégrité incorrecte : ${chunk.file}`);
      }
    }
  } catch (cause) {
    throw new Error(`GPT-2 local incomplet ou invalide : ${cause.message} Préparez les poids avec npm run prepare:gpt2 avant le build.`, { cause });
  }
}
