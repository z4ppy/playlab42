/**
 * Charge un epic du catalogue statique ou signale un refus explicite.
 * @param {string} epicId
 * @returns {Promise<Object>}
 */
export async function fetchEpic(epicId) {
  const response = await fetch('./data/parcours.json');
  if (!response.ok) { throw new Error('Catalogue parcours introuvable'); }
  const catalogue = await response.json();
  const epic = catalogue.epics.find(entry => entry.id === epicId);
  if (!epic) { throw new Error(`Epic non trouvé: ${epicId}`); }
  return epic;
}

/** La cible explicite prime sur la reprise ; une cible disparue revient au début. */
export function getStartIndex(slides, slideId, progress) {
  const target = slideId || progress.getCurrentSlide();
  return Math.max(0, slides.findIndex(slide => slide.id === target));
}
