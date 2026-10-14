/**
 * Extrait 40 phrases relues des exports officiels Tatoeba CC0.
 * node scripts/prepare-llm-corpus.js /chemin/exports
 * Les fichiers attendus sont fra-cc0.tsv.bz2, eng-cc0.tsv.bz2, spa-cc0.tsv.bz2.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

if (!process.argv[2]) { throw new Error('Indiquez le dossier des trois exports Tatoeba CC0.'); }
const selected = {
  fra: [331708, 333372, 333440, 333444, 333644, 333865, 337964, 337966, 346872, 373572, 387265, 387279, 7061795, 7104385, 7108211, 7108265],
  eng: [331259, 332331, 334553, 337215, 384016, 403860, 482832, 515726, 618394, 618396, 761916, 763114, 764407, 1565645, 1565647, 1566978],
  spa: [504299, 7104310, 7104352, 7104382, 7104384, 7105304, 8203016, 10552878],
};
const sources = [];
const sentences = [];
for (const [language, ids] of Object.entries(selected)) {
  const path = resolve(process.argv[2], `${language}-cc0.tsv.bz2`);
  const source = await readFile(path);
  const rows = execFileSync('bzip2', ['-dc', path], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
    .split('\n').filter(Boolean).map(line => line.split('\t'));
  const lookup = new Map(rows.map(row => [Number(row[0]), row]));
  for (const id of ids) {
    const row = lookup.get(id);
    if (!row || row[1] !== language || !row[2]) { throw new Error(`Phrase CC0 absente : ${language}/${id}`); }
    sentences.push({ id, language, text: row[2], url: `https://tatoeba.org/en/sentences/show/${id}` });
  }
  sources.push({
    language,
    url: `https://downloads.tatoeba.org/exports/per_language/${language}/${language}_sentences_CC0.tsv.bz2`,
    sha256: createHash('sha256').update(source).digest('hex'),
  });
}
const snapshot = {
  meta: {
    name: 'Tatoeba — échantillon des exports CC0', retrieved: '2026-10-12',
    license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    documentation: 'https://tatoeba.org/en/downloads',
    attribution: 'Tatoeba et ses contributeurs ; identifiants et liens conservés pour chaque phrase.',
    selection: '40 phrases choisies et relues pour leur brièveté et leur usage pédagogique : 16 françaises, 16 anglaises, 8 espagnoles. Non représentatif, non aligné pour la traduction, entièrement utilisé pour apprendre.',
    changes: 'Textes originaux conservés ici. Le tokenizer applique ensuite NFC et minuscules ; aucun découpage en paires de traduction.',
    sources,
  },
  sentences,
};
await writeFile(new URL('../parcours/epics/anatomie-llm/assets/tatoeba.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`${sentences.length} phrases CC0 préparées, sans téléchargement dans le build.`);
