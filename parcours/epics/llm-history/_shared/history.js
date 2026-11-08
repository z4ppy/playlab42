/**
 * Script commun des slides « Histoire des LLM ».
 *
 * Initialise le thème, le glossaire (infobulles sur <dfn>) puis active les
 * activités déclarées par attributs data-* :
 * - [data-quiz]       : questions à choix unique avec correction ;
 * - [data-order-game] : frise à remettre dans l'ordre, au clavier ;
 * - [data-chinchilla] : calculateur de taille de modèle compute-optimale.
 *
 * Le contenu reste lisible sans JavaScript : les activités sont un bonus.
 */

import { initSlide, initGlossary } from '../../../_shared/slide-utils.js';
import {
  chinchillaOptimum,
  classifyTraining,
  formatCount,
  formatFlops,
  moveItem,
  scoreOrder,
  shuffleForExercise,
  trainingCompute,
} from './history-logic.js';

/**
 * Active un quiz : chaque fieldset contient un input [data-correct] et un
 * paragraphe .explain révélé après validation.
 *
 * La correction se déclenche au clic sur un bouton ordinaire et non via
 * l'événement « submit » : l'iframe du viewer est sandboxée sans
 * « allow-forms », ce qui bloque silencieusement toute soumission de formulaire.
 * @param {HTMLFormElement} form
 */
function setupQuiz(form) {
  const feedback = form.querySelector('.feedback');
  form.querySelector('[data-action="check-quiz"]').addEventListener('click', () => {
    const questions = [...form.querySelectorAll('fieldset')];
    let score = 0;
    for (const question of questions) {
      const chosen = question.querySelector('input:checked');
      const isCorrect = Boolean(chosen?.hasAttribute('data-correct'));
      if (isCorrect) {
        score++;
      }
      question.dataset.state = isCorrect ? 'ok' : 'ko';
      const explain = question.querySelector('.explain');
      if (explain) {
        explain.hidden = false;
      }
    }
    feedback.dataset.state = score === questions.length ? 'ok' : 'ko';
    feedback.textContent = score === questions.length
      ? `Bravo : ${score}/${questions.length}. Les explications sont affichées sous chaque question.`
      : `${score}/${questions.length} bonne(s) réponse(s). Relisez les explications affichées, puis réessayez.`;
  });
}

/**
 * Active une frise à remettre dans l'ordre. Les <li> sont écrits dans l'ordre
 * chronologique (lisible sans JS) ; le script les mélange de façon déterministe.
 * @param {HTMLElement} root
 */
function setupOrderGame(root) {
  const list = root.querySelector('.order-list');
  const feedback = root.querySelector('.feedback');
  const items = [...list.children];
  const byId = new Map(items.map(item => [item.dataset.id, item]));
  const expected = items.map(item => item.dataset.id);
  let order = shuffleForExercise(expected, Number(root.dataset.seed) || 1);

  for (const item of items) {
    // Les dates sont masquées pendant l'exercice puis révélées une fois résolu.
    item.querySelector('.date')?.setAttribute('hidden', '');
    item.append(makeMoveButton('↑', 'Monter', -1), makeMoveButton('↓', 'Descendre', 1));
  }

  function makeMoveButton(symbol, verb, direction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = symbol;
    button.dataset.direction = String(direction);
    button.setAttribute('aria-label', verb);
    return button;
  }

  function render(focusId, direction) {
    list.replaceChildren(...order.map(id => byId.get(id)));
    for (const item of list.children) {
      delete item.dataset.state;
      const label = item.querySelector('.label').textContent;
      for (const button of item.querySelectorAll('button')) {
        const verb = button.dataset.direction === '-1' ? 'Monter' : 'Descendre';
        button.setAttribute('aria-label', `${verb} : ${label}`);
      }
    }
    if (focusId) {
      byId.get(focusId).querySelector(`button[data-direction="${direction}"]`)?.focus();
    }
  }

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-direction]');
    if (!button) {
      return;
    }
    const id = button.closest('li').dataset.id;
    const direction = Number(button.dataset.direction);
    order = moveItem(order, order.indexOf(id), direction);
    feedback.textContent = '';
    render(id, direction);
  });

  root.querySelector('[data-action="check"]').addEventListener('click', () => {
    const result = scoreOrder(order, expected);
    for (const item of list.children) {
      item.dataset.state = result.misplaced.includes(item.dataset.id) ? 'ko' : 'ok';
    }
    feedback.dataset.state = result.solved ? 'ok' : 'ko';
    if (result.solved) {
      list.querySelectorAll('.date').forEach(date => date.removeAttribute('hidden'));
      feedback.textContent = 'Frise correcte ! Les dates sont maintenant affichées.';
    } else {
      feedback.textContent = `${result.correct}/${result.total} événements bien placés. Les cadres rouges sont à déplacer.`;
    }
  });

  root.querySelector('[data-action="reveal"]').addEventListener('click', () => {
    order = [...expected];
    render();
    list.querySelectorAll('.date').forEach(date => date.removeAttribute('hidden'));
    feedback.dataset.state = 'ok';
    feedback.textContent = 'Voici l’ordre chronologique, avec les dates.';
  });

  render();
}

/**
 * Active le calculateur Chinchilla.
 * @param {HTMLElement} root
 */
function setupChinchilla(root) {
  const slider = root.querySelector('input[type="range"]');
  const out = name => root.querySelector(`[data-out="${name}"]`);

  function showBudget(compute) {
    const { params, tokens } = chinchillaOptimum(compute);
    out('compute').textContent = `${formatFlops(compute)} FLOP`;
    out('params').textContent = `${formatCount(params)} paramètres`;
    out('tokens').textContent = `${formatCount(tokens)} tokens`;
  }

  slider.addEventListener('input', () => {
    showBudget(10 ** Number(slider.value));
    out('preset').textContent = 'Budget libre : choisissez un modèle réel pour comparer.';
  });

  root.querySelector('.presets').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-params]');
    if (!button) {
      return;
    }
    const params = Number(button.dataset.params);
    const tokens = Number(button.dataset.tokens);
    const compute = trainingCompute(params, tokens);
    slider.value = Math.log10(compute).toFixed(1);
    showBudget(compute);
    const { ratio, verdict } = classifyTraining(params, tokens);
    out('preset').textContent = `${button.textContent} : ${formatCount(params)} paramètres, ` +
      `${formatCount(tokens)} tokens, soit ${formatCount(ratio)} tokens par paramètre → ${verdict}.`;
  });

  showBudget(10 ** Number(slider.value));
}

initSlide();
initGlossary();
document.querySelectorAll('form[data-quiz]').forEach(setupQuiz);
document.querySelectorAll('[data-order-game]').forEach(setupOrderGame);
document.querySelectorAll('[data-chinchilla]').forEach(setupChinchilla);
