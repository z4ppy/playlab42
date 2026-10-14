import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Tokenizer } from '@huggingface/tokenizers';
import { tokenizerDefinitions } from './real-tokenizers.js';
import { rotate3D } from './math.js';

const root = new URL('../assets/tokenizers/', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const known = { gpt2: [15496, 995], bert: [7592, 2088], t5: [8774, 296] };

test.each(tokenizerDefinitions)('$id utilise le vocabulaire original, sans marqueurs ajoutés', ({ id }) => {
  const tokenizer = new Tokenizer(read(`${id}/tokenizer.json`), read(`${id}/tokenizer_config.json`));
  expect(tokenizer.encode('Hello world', { add_special_tokens: false }).ids).toEqual(known[id]);
  expect(tokenizer.encode('', { add_special_tokens: false }).ids).toEqual([]);
  const input = 'éclair 👩‍💻';
  const ids = tokenizer.encode(input, { add_special_tokens: false }).ids;
  const decoded = tokenizer.decode(ids, { skip_special_tokens: false, clean_up_tokenization_spaces: false });
  if (id === 'gpt2') { expect(decoded).toBe(input); }
  if (id === 'bert') { expect(ids).toContain(tokenizer.token_to_id('[UNK]')); }
  if (id === 't5') { expect(ids).toContain(tokenizer.token_to_id('<unk>')); }
});

test('les fichiers importés correspondent aux empreintes publiées', () => {
  for (const definition of read('provenance.json').definitions) {
    for (const file of definition.files) {
      const bytes = readFileSync(new URL(`${definition.id}/${file.name}`, root));
      expect(bytes.length).toBe(file.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
    }
  }
});

test('la rotation 3D conserve la norme et les produits scalaires', () => {
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const a = [1, -2, 3], b = [-4, 2, 1];
  const ar = rotate3D(a, 0.7, -0.4), br = rotate3D(b, 0.7, -0.4);
  expect(dot(ar, ar)).toBeCloseTo(dot(a, a), 12);
  expect(dot(ar, br)).toBeCloseTo(dot(a, b), 12);
  expect(rotate3D(a, 0, 0)).toEqual(a);
  expect(() => rotate3D([NaN, 0, 0], 0, 0)).toThrow();
});
