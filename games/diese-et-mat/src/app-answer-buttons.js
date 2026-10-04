/**
 * Diese & Mat - Boutons de réponse selon le mode d'exercice (module privé de App)
 *
 * Chaque mode décrit ses colonnes, son balisage et la lecture de la valeur
 * soumise au clic. Le mode rythme n'a pas de boutons : ses contrôles vivent
 * dans la zone de portée.
 *
 * @module app-answer-buttons
 */

const INTERVALS = [
  { label: '2de m', value: 1, name: 'Seconde mineure' },
  { label: '2de M', value: 2, name: 'Seconde majeure' },
  { label: '3ce m', value: 3, name: 'Tierce mineure' },
  { label: '3ce M', value: 4, name: 'Tierce majeure' },
  { label: '4te', value: 5, name: 'Quarte juste' },
  { label: 'Triton', value: 6, name: 'Triton' },
  { label: '5te', value: 7, name: 'Quinte juste' },
];

const CHORDS = [
  { label: 'Majeur', value: 'major' },
  { label: 'Mineur', value: 'minor' },
  { label: 'Diminué', value: 'diminished' },
  { label: 'Augmenté', value: 'augmented' },
];

const NOTES = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

const intervalButtonsHtml = () => INTERVALS.map(int => `
        <button class="note-btn" data-semitones="${int.value}" title="${int.name}" aria-label="${int.name}" style="
          padding: var(--space-sm) var(--space-xs);
          background: var(--color-bg-secondary);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--font-size-sm);
          font-weight: bold;
          transition: all 0.15s ease;
        ">${int.label}</button>
      `).join('');

const chordButtonsHtml = () => CHORDS.map(chord => `
        <button class="note-btn" data-chord="${chord.value}" style="
          padding: var(--space-md);
          background: var(--color-bg-secondary);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--font-size-md);
          font-weight: bold;
          transition: all 0.15s ease;
        ">${chord.label}</button>
      `).join('');

const noteButtonsHtml = () => NOTES.map((note, index) => `
        <button class="note-btn" data-note="${index}" style="
          padding: var(--space-md);
          background: var(--color-bg-secondary);
          border: 2px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--font-size-md);
          font-weight: bold;
          transition: all 0.15s ease;
        ">${note}</button>
      `).join('');

/** Description des boutons par mode ; les notes servent de mode par défaut. */
const ANSWER_MODES = {
  interval: { columns: 'repeat(7, 1fr)', html: intervalButtonsHtml, read: btn => parseInt(btn.dataset.semitones) },
  chord: { columns: 'repeat(4, 1fr)', html: chordButtonsHtml, read: btn => btn.dataset.chord },
  note: { columns: 'repeat(7, 1fr)', html: noteButtonsHtml, read: btn => parseInt(btn.dataset.note) },
};

/**
 * Remplit le conteneur de boutons de réponse et relie leurs clics.
 * @param {HTMLElement} container - Conteneur des boutons
 * @param {string} mode - 'note', 'interval', 'chord' ou 'rhythm'
 * @param {(answer: number|string) => void} onAnswer - Reçoit la valeur du bouton cliqué
 */
export function renderAnswerButtons(container, mode, onAnswer) {
  if (mode === 'rhythm') {
    container.style.display = 'none';
    return;
  }

  const spec = ANSWER_MODES[mode] ?? ANSWER_MODES.note;
  container.style.gridTemplateColumns = spec.columns;
  container.innerHTML = spec.html();
  container.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', () => onAnswer(spec.read(btn)));
  });
}

/**
 * Mode des boutons associé au mode d'un exercice.
 * @param {string} exerciseMode - Mode de l'exercice
 * @returns {string}
 */
export function answerModeFor(exerciseMode) {
  return ['interval', 'chord', 'rhythm'].includes(exerciseMode) ? exerciseMode : 'note';
}
