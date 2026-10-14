/**
 * Inventorie les définitions importées depuis les révisions publiques épinglées.
 * Ne télécharge rien et ne modifie pas les fichiers de vocabulaire.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tokenizerDefinitions } from '../parcours/epics/anatomie-llm/_shared/real-tokenizers.js';

const root = new URL('../parcours/epics/anatomie-llm/assets/tokenizers/', import.meta.url);
const definitions = [];
for (const definition of tokenizerDefinitions) {
  const files = [];
  for (const name of ['tokenizer.json', 'tokenizer_config.json', 'LICENSE']) {
    const bytes = await readFile(new URL(`${definition.id}/${name}`, root));
    files.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  definitions.push({
    id: definition.id, model: definition.model, revision: definition.revision,
    source: `https://huggingface.co/${definition.model}/tree/${definition.revision}`,
    license: definition.id === 'gpt2' ? 'MIT' : 'Apache-2.0',
    licenseSource: definition.id === 'gpt2' ? 'https://raw.githubusercontent.com/openai/gpt-2/master/LICENSE' :
      definition.id === 't5' ? 'https://www.apache.org/licenses/LICENSE-2.0.txt' :
        `https://huggingface.co/${definition.model}/resolve/${definition.revision}/LICENSE`,
    files,
  });
}
await writeFile(new URL('provenance.json', root), `${JSON.stringify({
  runtime: '@huggingface/tokenizers@0.2.0',
  note: 'Définitions originales non modifiées ; aucun poids de modèle. T5 déclare Apache-2.0 dans sa fiche : le texte standard de la licence est fourni.',
  definitions,
}, null, 2)}\n`);
console.log('Provenance des trois tokeniseurs générée.');
