/**
 * Outil commun aux bots : retrouver, parmi les actions valides fournies par le
 * moteur, celle qui correspond à la décision prise.
 */

const sameAction = (a, b) => a.type === b.type && a.cell === b.cell && a.value === b.value;

/**
 * @param {object[]} validActions Actions valides (getValidActions).
 * @param {{type: string, cell: number, value?: number}} decision Action décidée par le bot.
 * @returns {object} L'action valide identique.
 * @throws {Error} Si la décision n'est pas une action valide : un bot ne joue jamais un coup illégal.
 */
export function pickValidAction(validActions, decision) {
  const action = validActions.find((candidate) => sameAction(candidate, decision));
  if (!action) {
    throw new Error(`Décision du bot hors des actions valides : ${JSON.stringify(decision)}`);
  }
  return action;
}
