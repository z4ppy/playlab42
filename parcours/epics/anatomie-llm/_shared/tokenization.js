/** BPE pédagogique : fusions apprises sur un corpus local, sans pré-tokenisation. */
export function learnMerges(text, count = 32) {
  let tokens = Array.from(text);
  const merges = [];
  for (let n = 0; n < count; n++) {
    const counts = new Map();
    for (let i = 0; i < tokens.length - 1; i++) {
      const key = JSON.stringify([tokens[i], tokens[i + 1]]);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 2) { break; }
    const pair = JSON.parse(best[0]);
    merges.push(pair);
    tokens = mergePair(tokens, pair);
  }
  return merges;
}

function mergePair(tokens, [left, right]) {
  const output = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === left && tokens[i + 1] === right) {
      output.push(left + right);
      i++;
    } else {
      output.push(tokens[i]);
    }
  }
  return output;
}

export function bpeTokens(text, merges) {
  return merges.reduce((tokens, pair) => mergePair(tokens, pair), Array.from(text));
}
