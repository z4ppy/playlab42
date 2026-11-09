/**
 * Annonces vocales (région `aria-live`) après chaque coup, à partir des vues
 * avant/après : on ne dit jamais plus que ce que le joueur voit.
 *
 * @module games/solitaire/ui/announce
 */

import { cardName } from '../engine/cards.js';
import { parsePile } from '../engine/rules.js';
import { takenCard } from '../ai/heuristics.js';
import { boardFromView } from '../ai/position.js';

/** Où arrive une prise : sur une carte, dans une colonne vide ou sur la fondation. */
function landing(before, to, plural) {
  const verb = plural ? 'vont' : 'va';
  const pile = parsePile(to);
  if (pile.zone === 'foundation') {
    return 'monte sur sa fondation';
  }
  const { up } = before.tableau[pile.index];
  return up.length
    ? `${verb} sur ${cardName(up[up.length - 1])}, colonne ${pile.index + 1}`
    : `${verb} dans la colonne ${pile.index + 1}`;
}

/** Carte découverte par le coup, lue dans la vue d'après. */
function revealNote(beforeView, afterView) {
  const index = afterView.tableau.findIndex((column, i) => column.downCount < beforeView.tableau[i].downCount);
  if (index < 0) {
    return '';
  }
  return ` Carte découverte en colonne ${index + 1} : ${cardName(afterView.tableau[index].up[0])}.`;
}

/** Phrase d'une pioche : les cartes retournées, la dernière étant jouable. */
function drawText(beforeView, afterView) {
  const drawn = afterView.waste.slice(beforeView.waste.length);
  const names = drawn.map(cardName);
  return drawn.length === 1 ? `Pioche : ${names[0]}.` : `Pioche : ${names.join(', ')} ; ${names[names.length - 1]} est jouable.`;
}

/**
 * Annonce d'une action jouée.
 * @param {import('../engine.js').SolitaireView} beforeView
 * @param {import('../engine/rules.js').SolitaireAction} action
 * @param {import('../engine.js').SolitaireView} afterView
 * @returns {string}
 */
export function announceAction(beforeView, action, afterView) {
  let text;
  if (action.type === 'draw') {
    text = drawText(beforeView, afterView);
  } else if (action.type === 'recycle') {
    text = `La défausse retourne au talon : ${afterView.stockCount} cartes.`;
  } else {
    const before = boardFromView(beforeView);
    const subject = cardName(takenCard(before, action.from, action.count));
    const group = action.count > 1 ? ` et ${action.count - 1} carte${action.count > 2 ? 's' : ''}` : '';
    text = `${subject[0].toUpperCase()}${subject.slice(1)}${group} ${landing(before, action.to, action.count > 1)}.${revealNote(beforeView, afterView)}`;
  }
  return afterView.winners ? `${text} Partie gagnée !` : text;
}
