/**
 * Remplissage du select des presets, groupé par famille d'instruments.
 *
 * Partagé par le piano et le panneau synthétiseur : mêmes familles, même
 * ordre, groupes toujours présents même si un preset manque au catalogue.
 *
 * @module controllers/preset-select
 */

/** Familles de presets, dans l'ordre d'affichage. */
const PRESET_CATEGORIES = {
  'Claviers': ['piano', 'electricPiano', 'organ'],
  'Guitares': ['guitarClassic', 'guitarFolk', 'guitarElectric'],
  'Synthés': ['synthLead', 'retro8bit', 'bell'],
  'Percussions': ['percKick', 'percSnare', 'percTom', 'percWood', 'percHihat', 'percCymbal'],
};

/**
 * Remplace le contenu du select par un groupe par famille.
 *
 * @param {HTMLSelectElement} select - Select à remplir
 * @param {Object<string, {name: string}>} presets - Catalogue des presets
 * @param {string|undefined} currentPreset - Preset à sélectionner
 * @param {(preset: {name: string}, key: string) => string} formatLabel - Libellé d'une option
 */
export function populatePresetSelect(select, presets, currentPreset, formatLabel) {
  select.innerHTML = '';

  for (const [category, presetKeys] of Object.entries(PRESET_CATEGORIES)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;

    for (const key of presetKeys) {
      const preset = presets[key];
      if (!preset) {continue;}

      const option = document.createElement('option');
      option.value = key;
      option.textContent = formatLabel(preset, key);
      option.selected = currentPreset === key;
      optgroup.appendChild(option);
    }

    select.appendChild(optgroup);
  }
}
