/** Corpus combinatoire déterministe complété par l'échantillon Tatoeba CC0. */
export function createCorpus(tatoeba) {
  const splits = { train: [], validation: [], test: [] };
  const originals = [
    'la capitale de la france est paris .',
    'la capitale de la belgique est bruxelles .',
    'la capitale de la suisse est berne .',
    'la capitale de l italie est rome .',
    'la capitale du japon est tokyo .',
    'paris est la capitale de la france .',
    'bruxelles est la capitale de la belgique .',
    'berne est la capitale de la suisse .',
    'rome est la capitale de l italie .',
    'tokyo est la capitale du japon .',
    'le chat dort sur le tapis .',
    'le chat joue dans le jardin .',
    'le chien dort dans le jardin .',
    'le chien joue sur le tapis .',
    'le soleil brille dans le ciel .',
    'la lune brille dans le ciel .',
    'un token devient un vecteur .',
    'le modèle prédit un token .',
    'le modèle calcule une probabilité .',
    'une probabilité ne garantit pas la vérité .',
    'le contexte change la prédiction .',
    'les poids changent pendant l entraînement .',
    'les poids restent fixes pendant l inférence .',
    'le token suivant rejoint le contexte .',
    'the capital of france is paris .',
    'the capital of belgium is brussels .',
    'the capital of japan is tokyo .',
    'the cat sleeps on the mat .',
    'the dog plays in the garden .',
    'a token becomes a vector .',
    'the model predicts a token .',
    'a probability is not the truth .',
  ];
  originals.forEach((text, i) => splits.train.push({ id: `original-${i}`, family: 'original', text }));
  tatoeba.sentences.forEach(({ id, text, language, url }) =>
    splits.train.push({ id: `tatoeba-${id}`, family: 'natural', text, language, url, license: 'CC0-1.0' }));
  const nouns = ['chat', 'chien', 'lapin', 'renard', 'canard', 'robot', 'garçon', 'voisin'];
  const places = ['jardin', 'tapis', 'lac', 'pont', 'mur', 'parc', 'village', 'magasin'];
  const adjectives = ['calme', 'petit', 'rapide'];
  nouns.forEach((noun, n) => places.forEach((place, p) => {
    const group = `accord-${n}-${p}`;
    const bucket = (n * 3 + p) % 8;
    const split = bucket === 0 ? 'validation' : bucket === 1 ? 'test' : 'train';
    adjectives.forEach((adjective, a) => [false, true].forEach(plural => {
      const prompt = `${plural ? 'les' : 'le'} ${noun}${plural ? 's' : ''} près du ${place}`;
      const target = plural ? 'sont' : 'est';
      splits[split].push({
        id: `${group}-${a}-${Number(plural)}`, group, family: 'agreement', prompt, target,
        baseline: 'est', text: `${prompt} ${target} ${adjective}${plural ? 's' : ''} .`,
      });
    }));
  }));
  const objects = ['chat', 'chien', 'livre', 'sac', 'ballon', 'crayon', 'robot', 'vélo', 'cube', 'stylo', 'chapeau', 'cadeau'];
  const colors = ['rouge', 'bleue', 'verte'];
  objects.forEach((first, a) => objects.forEach((second, b) => {
    if (a === b) { return; }
    // Une paire non ordonnée reste entièrement dans un seul lot, même inversée.
    const group = `boîtes-${Math.min(a, b)}-${Math.max(a, b)}`;
    const bucket = (Math.min(a, b) * 3 + Math.max(a, b)) % 7;
    const split = bucket === 0 ? 'validation' : bucket === 1 ? 'test' : 'train';
    colors.forEach((left, l) => colors.forEach((right, r) => {
      if (l === r) { return; }
      [0, 1].forEach(query => {
        const prompt = `la boîte ${left} contient un ${first} . la boîte ${right} contient un ${second} . dans la boîte ${query ? right : left} il y a un`;
        const target = query ? second : first;
        splits[split].push({
          id: `boîtes-${a}-${b}-${l}-${r}-${query}`, group, family: 'context', prompt, target,
          baseline: second, text: `${prompt} ${target} .`,
        });
      });
    }));
  }));
  return {
    meta: {
      version: 2, title: 'Luciole : Tatoeba CC0, phrases originales et combinaisons réservées',
      author: 'Playlab42 et contributeurs Tatoeba', date: '2026-10-12',
      license: 'Phrases synthétiques : CC-BY-NC-SA-4.0 ; phrases Tatoeba : CC0-1.0.', kind: 'mixed',
      generator: 'scripts/llm-anatomy-corpus.js',
      splitRule: 'Accords : paire sujet/lieu réservée. Contexte : paire non ordonnée d’objets réservée, toutes couleurs, positions et requêtes ensemble.',
      limitations: 'Les lots réservés sont synthétiques et partagent leurs mots et leurs patrons. Ils évaluent des recombinaisons limitées, pas le langage naturel général. Les capitales et les 40 phrases Tatoeba sont des exemples d’apprentissage, pas un test de multilinguisme.',
    },
    splits,
  };
}
