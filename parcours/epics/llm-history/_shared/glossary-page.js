/**
 * Page glossaire du parcours : génère la liste des termes depuis glossary.json
 * grâce au module partagé du viewer, sans bloc <style> ni HTML dupliqué.
 */

import { initSlide, initGlossary } from '../../../_shared/slide-utils.js';

initSlide();

const container = document.getElementById('glossary-content');
const glossary = await initGlossary();

if (glossary && glossary.allTerms().length > 0) {
  // generateGlossaryPage échappe le contenu des définitions (voir ParcoursGlossary).
  container.innerHTML = glossary.generateGlossaryPage();
} else {
  container.textContent = 'Le glossaire n’a pas pu être chargé.';
}
