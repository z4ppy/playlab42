/**
 * Initialisation commune des slides du parcours « Le Paradigme As-Code ».
 *
 * Chargé par chaque slide via :
 *   <script type="module" src="../../_shared/as-code.js"></script>
 *
 * - thème, tableaux défilables et défilement vers les ancres du plan (initSlide) ;
 * - plan intra-slide envoyé au viewer depuis les h2 munis d'un id ;
 * - glossaire : infobulles des <dfn> et page générée dans [data-asc-glossary] ;
 * - liens [data-asc-slide] : dans le viewer, ils passent par son hash pour
 *   garder la progression synchronisée ; seuls, ils restent des liens relatifs.
 */
import { autoDetectTOC, initGlossary, initSlide, sendTOC } from '../../../_shared/slide-utils.js';

const EPIC_ID = 'as-code-paradigm';

/** Redirige les liens inter-slides vers la route du viewer quand la slide est intégrée. */
function routeSlideLinks() {
  if (window.parent === window) { return; }
  for (const link of document.querySelectorAll('a[data-asc-slide]')) {
    const route = `../../../../../index.html#/parcours/${EPIC_ID}/${link.dataset.ascSlide}`;
    link.href = new URL(route, window.location.href).href;
    link.target = '_top';
  }
}

routeSlideLinks();
await initSlide();

const headings = autoDetectTOC('h2[id]');
if (headings.length > 1) { sendTOC(headings); }

const glossaryTarget = document.querySelector('[data-asc-glossary]');
if (glossaryTarget || document.querySelector('dfn')) {
  const glossary = await initGlossary({ container: '.slide' });
  if (glossary && glossaryTarget) {
    // Contenu échappé par ParcoursGlossary (_escapeHtml) avant insertion.
    glossaryTarget.innerHTML = glossary.generateGlossaryPage();
  }
}
