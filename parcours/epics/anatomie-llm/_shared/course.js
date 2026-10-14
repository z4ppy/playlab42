import { initTheme, toggleTheme } from '../../../../lib/theme.js';
import { initGlossary } from '../../../_shared/slide-utils.js';
import { chapters } from './chapters.js';
import { button } from './dom.js';
import { modelExperiments, getModel } from './model-experiments.js';
import { conceptExperiments } from './concept-experiments.js';
import { mountSelectedExperience } from './experience-selection.js';
import { realTokenizerExperience } from './real-tokenizers.js';

initTheme();
document.querySelector('#theme-toggle')?.addEventListener('click', toggleTheme);

// Les liens HTML restent utilisables seuls ; dans le viewer, le hash maintient
// sa navigation et sa progression plutôt que de naviguer l'iframe à son insu.
if (window.parent !== window) {
  document.body.classList.add('in-viewer');
  document.querySelectorAll('a[data-chapter]').forEach(anchor => {
    anchor.href = new URL(`../../../../../index.html#/parcours/anatomie-llm/${anchor.dataset.chapter}`, window.location.href).href;
    anchor.target = '_top';
  });
}

const chapter = chapters.find(c => c.id === document.body.dataset.chapter);
if (chapter) {
  const choices = document.querySelector('#challenge-choices');
  const feedback = document.querySelector('#challenge-feedback');
  chapter.choices.forEach((text, i) => {
    const choice = button(`${String.fromCharCode(65 + i)}. ${text}`, () => {
      [...choices.children].forEach(child => child.setAttribute('aria-pressed', String(child === choice)));
      feedback.textContent = `${i === chapter.answer ? 'Exact.' : 'Pas tout à fait.'} ${chapter.explanation}`;
    });
    choice.setAttribute('aria-pressed', 'false');
    choices.append(choice);
  });
  const root = document.querySelector('#experiment-root');
  const createSession = () => mountSelectedExperience(root, {
    experiment: chapter.experiment,
    mountLocal: target => {
      const mount = modelExperiments[chapter.experiment] || conceptExperiments[chapter.experiment];
      if (!mount) { throw new Error('Expérience introuvable.'); }
      return mount(target);
    },
    mountTokenizers: (target, { preferences, signal }) => realTokenizerExperience(target, {
      getModel, preferences, signal, cases: chapter.experiment === 'tokenizerCases',
    }),
  });
  let session = createSession();
  window.addEventListener('pagehide', () => session.destroy());
  window.addEventListener('pageshow', event => {
    if (event.persisted) { session = createSession(); }
  });
  initGlossary({ container: '.course-page' });
}
