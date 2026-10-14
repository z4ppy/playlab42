import { readLocalData, writeLocalData } from '../../../../lib/local-data.js';
import { el, button, showError } from './dom.js';
import { transformerExplainer } from './transformer-explainer.js';

const modelViews = new Set(['modelCard', 'generation', 'laboratory', 'attention', 'embeddings', 'lens', 'training', 'transformerExplainer']);
const tokenizerViews = new Set(['tokenizer', 'tokenizerCases']);
const allowed = { model: ['luciole', 'gpt2'], tokenizer: ['luciole', 'gpt2', 'bert', 't5', 'compare'] };

export function experienceKind(experiment) {
  return tokenizerViews.has(experiment) ? 'tokenizer' : modelViews.has(experiment) ? 'model' : 'concept';
}

/** Le tokenizer est partagé ; le modèle reste propre à chaque expérience. */
export function choicePreferences(notify, storage, experiment) {
  const memory = {};
  function failure() {
    notify('Préférences non enregistrées : stockage local indisponible ou invalide. Les choix restent utilisables sur cette page ; aucun prompt n’est sauvegardé.');
  }
  return {
    read(kind, fallback) {
      if (memory[kind]) { return memory[kind]; }
      try {
        const saved = readLocalData('preferences', {}, storage).llmChoice;
        // Un ancien choix global ne doit pas ouvrir une vue incompatible ni
        // remplacer GPT-2 par Luciole dans le chapitre consacré à GPT-2.
        const value = kind === 'model' && experiment ? saved?.models?.[experiment] : saved?.[kind];
        if (value !== undefined && !allowed[kind].includes(value)) { failure(); }
        return memory[kind] = allowed[kind].includes(value) ? value : fallback;
      } catch { failure(); return memory[kind] = fallback; }
    },
    save(kind, value) {
      if (!allowed[kind]?.includes(value)) { throw new Error('Choix incompatible.'); }
      memory[kind] = value;
      try {
        const previous = readLocalData('preferences', {}, storage);
        const saved = previous.llmChoice || {};
        const llmChoice = {};
        for (const key of Object.keys(allowed)) {
          if (allowed[key].includes(saved[key])) { llmChoice[key] = saved[key]; }
        }
        const models = Object.fromEntries([...modelViews]
          .filter(view => allowed.model.includes(saved.models?.[view]))
          .map(view => [view, saved.models[view]]));
        if (kind === 'model' && experiment) { models[experiment] = value; }
        else { llmChoice[kind] = value; }
        if (Object.keys(models).length) { llmChoice.models = models; }
        writeLocalData('preferences', { ...previous, llmChoice }, storage);
      } catch { failure(); }
    },
  };
}

const lucioleCalculations = {
  modelCard: 'Poids, corpus, métriques et tokenizer de Luciole sont locaux. L’historique relit des mesures publiées : le curseur ne réentraîne pas le modèle.',
  training: 'Courbes et prédictions relues depuis l’entraînement publié de Luciole. Pas d’entraînement dans votre navigateur, ni de poids intermédiaires chargés.',
  embeddings: 'Coordonnées des embeddings appris de Luciole ; voisins calculés sur toutes les dimensions. La vue 3D ne montre que trois coordonnées, pas une PCA.',
  attention: 'Passage avant de Luciole et matrices d’attention causale réellement calculés. L’attention n’est pas une preuve causale.',
  lens: 'Activations de Luciole projetées avec sa sortie apprise. La logit lens est une lecture intermédiaire, pas une génération par chaque couche.',
};

const mixedCalculations = {
  heads: 'Exemple pédagogique par défaut : les sept opérations utilisent des nombres inventés. Le mode « Vraie trace Luciole » de « Calcul observé » utilise les poids appris, le tokenizer lexical et un passage avant réel de Luciole. Les limites du vocabulaire et du contexte de Luciole restent applicables. Le mode et les nombres affichés indiquent lequel des deux calculs vous inspectez.',
  memory: 'Animation conceptuelle du cache et estimation de sa taille, selon les hypothèses affichées. « Vérifier K/V dans Luciole (sans cache) » calcule de vrais passages avant de Luciole et compare leurs clés et valeurs. Aucun cache n’est utilisé par ce moteur ; aucune accélération ni économie de temps n’est mesurée.',
};

function calculation(text) {
  const details = el('details', 'calculation-note');
  details.append(el('summary', '', 'Ce qui est réellement calculé'), el('p', 'microcopy', text));
  return details;
}

/**
 * Monte une seule expérience. Chaque tentative possède sa propre surface :
 * un chargement tardif ne peut pas réécrire la sélection suivante.
 * Les montages peuvent retourner {destroy}; le final ne monte qu'un lien.
 */
export function mountSelectedExperience(root, { experiment, mountLocal, mountTokenizers, storage }) {
  const kind = experienceKind(experiment);
  const toolbar = el('div', 'experience-choice');
  const notice = el('p', 'microcopy choice-storage-notice');
  notice.setAttribute('role', 'status');
  const preferences = choicePreferences(message => { notice.textContent = message; }, storage, experiment);
  const content = el('div', 'experience-content');
  root.replaceChildren(toolbar, notice, content);
  let version = 0;
  let disposed = false;
  let cleanup;
  let abort;
  if (kind === 'model') { toolbar.append(el('strong', 'example-badge', experiment === 'transformerExplainer' ? 'GPT-2 · laboratoire autonome' : 'Luciole · petit modèle du cours')); }
  if (kind === 'concept') { toolbar.append(el('strong', 'example-badge', 'Exemple pédagogique')); }

  function invalidate() {
    version++;
    abort?.abort();
    cleanup?.();
    cleanup = null;
    delete root.dataset.ready;
  }
  async function mount(target, mountFunction, ticket) {
    try {
      const handle = await mountFunction(target, { signal: abort.signal, preferences });
      if (disposed || ticket !== version) { handle?.destroy?.(); return; }
      cleanup = () => handle?.destroy?.();
      target.querySelector('.loading-note')?.remove();
      delete target.dataset.loading;
      root.dataset.ready = 'true';
      return true;
    } catch (error) {
      if (disposed || ticket !== version) { return; }
      delete target.dataset.loading;
      showError(target, error);
      target.append(button('Réessayer le chargement', restart));
      root.dataset.ready = 'true';
    }
  }
  function restart() {
    render();
    (content.querySelector('select') || content.querySelector('summary'))?.focus();
  }
  function render() {
    if (disposed) { return; }
    invalidate();
    abort = new AbortController();
    const ticket = version;
    const surface = el('div', 'selected-instrument');
    const target = el('div');
    toolbar.querySelector('.calculation-note')?.remove();
    content.replaceChildren(surface);
    if (kind === 'tokenizer') {
      surface.append(target);
      mount(target, mountTokenizers, ticket);
      const actions = el('div', 'button-row');
      actions.append(button('Réinitialiser l’expérience', restart));
      surface.append(actions);
      return;
    }
    if (experiment === 'transformerExplainer') {
      surface.append(el('p', 'microcopy', 'Le laboratoire s’ouvre dans un nouvel onglet. Cliquez ensuite sur « Charger GPT-2 » dans cet onglet. Gardez-le ouvert pour revenir au cours sans perdre votre exploration.'), target);
      mount(target, transformerExplainer, ticket);
      return;
    }
    const note = calculation(kind === 'concept'
      ? mixedCalculations[experiment] || 'Exemple pédagogique : nombres inventés, règles ou estimations calculées localement, selon les hypothèses indiquées ci-dessous. Ces résultats ne proviennent pas de l’exécution d’un modèle de langage.'
      : lucioleCalculations[experiment] || 'Passage avant réel de Luciole, avec ses poids appris et son tokenizer lexical associé. Modèle pédagogique à vocabulaire fermé et contexte limité. Les traces affichées proviennent du calcul courant.');
    if (kind === 'model') {
      note.querySelector('p').prepend(el('span', 'active-model', 'Calcul actuel : Luciole · tokenizer lexical de Luciole. '));
      toolbar.append(note);
    } else { surface.append(note); }
    target.dataset.loading = 'true';
    target.append(el('p', 'loading-note', 'Préparation de l’instrument local…'));
    surface.append(target);
    mount(target, mountLocal, ticket);
    if (!['generation', 'laboratory'].includes(experiment)) {
      const actions = el('div', 'button-row');
      actions.append(button('Réinitialiser l’expérience', restart));
      surface.append(actions);
    }
  }
  render();
  return { destroy() { disposed = true; invalidate(); content.replaceChildren(); } };
}
