/**
 * Pavé numérique tactile : un bouton par chiffre, avec le nombre d'exemplaires
 * restant à poser. Un chiffre complet reste cliquable (on peut s'être trompé
 * ailleurs) mais il est signalé visuellement et vocalement.
 */

import { DIGITS } from '../engine/grid.js';

function createDigitButton(digit) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pad-digit';
  button.dataset.digit = String(digit);
  const value = document.createElement('span');
  value.className = 'pad-value';
  value.textContent = String(digit);
  const count = document.createElement('span');
  count.className = 'pad-count';
  count.setAttribute('aria-hidden', 'true');
  button.append(value, count);
  return button;
}

/** « Chiffre 4, 3 restants » ; en mode notes : « Note 4 ». */
export function describeDigit(digit, remaining, notesMode) {
  const action = notesMode ? `Note ${digit}` : `Chiffre ${digit}`;
  if (remaining === 0) {
    return `${action}, tous posés`;
  }
  return `${action}, ${remaining} restant${remaining > 1 ? 's' : ''}`;
}

/**
 * @param {HTMLElement} root
 * @param {(digit: number) => void} onDigit
 * @returns {{buttons: HTMLButtonElement[], render: (counts: Record<number, number>, options: {notesMode: boolean, disabled: boolean}) => void}}
 */
export function createPadView(root, onDigit) {
  const buttons = DIGITS.map(createDigitButton);
  root.replaceChildren(...buttons);
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-digit]');
    if (button && !button.disabled) {
      onDigit(Number(button.dataset.digit));
    }
  });
  return {
    buttons,
    render(counts, { notesMode, disabled }) {
      root.classList.toggle('is-notes', notesMode);
      buttons.forEach((button, index) => {
        const digit = DIGITS[index];
        button.disabled = disabled;
        button.classList.toggle('is-complete', counts[digit] === 0);
        button.querySelector('.pad-count').textContent = counts[digit] === 0 ? '✓' : String(counts[digit]);
        button.setAttribute('aria-label', describeDigit(digit, counts[digit], notesMode));
      });
    },
  };
}
