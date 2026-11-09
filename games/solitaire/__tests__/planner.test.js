/**
 * Indices à partir de la vue : choix du coup, phrases françaises, pioche,
 * recyclage, blocage, et indépendance vis-à-vis des cartes cachées.
 */

import { SolitaireEngine } from '../engine.js';
import { findHint, viewKey } from '../ai/planner.js';
import { describeAction, explainPlan, planGoal } from '../ai/explain.js';
import { PLAYER, board, column, move, stateWith } from './positions.js';

const engine = new SolitaireEngine();
const viewOf = (position, overrides) => engine.getPlayerView(stateWith(position, overrides), PLAYER);

describe('Indice : choix du coup', () => {
  it('monte un as sur sa fondation, avec une phrase simple', () => {
    const hint = findHint(viewOf(board({ tableau: [column(['KS'])], waste: ['AH'], stock: ['2C'] })));
    expect(hint).toMatchObject({ kind: 'move', action: move('waste', 'foundation-1'), goal: 'foundation' });
    expect(hint.explanation).toBe('Monte l’as de cœur de la défausse sur sa fondation.');
  });

  it('libère une carte cachée et nomme la colonne', () => {
    const hint = findHint(viewOf(board({ tableau: [column(['8S']), column([]), column([]), column([]), column(['7H'], ['XX'])] })));
    expect(hint.action).toEqual(move('tableau-4', 'tableau-0'));
    expect(hint.explanation).toBe('Déplace le 7 de cœur (colonne 5) sur le 8 de pique (colonne 1) : cela libère une carte cachée en colonne 5.');
  });

  it('prépare en plusieurs coups la découverte d\'une carte cachée', () => {
    // Il faut d'abord poser le 9 de cœur sur le 10 de pique pour accueillir le 8 de trèfle.
    const position = board({ tableau: [column(['TS']), column(['9H']), column(['8C'], ['XX']), column(['5D', '4S'])] });
    const hint = findHint(viewOf(position));
    expect(hint.plan.length).toBeGreaterThan(1);
    expect(hint.goal).toBe('reveal');
    expect(hint.explanation).toMatch(/plan en \d coups qui libère une carte cachée en colonne 3/);
  });

  it('pioche quand aucun coup ne fait progresser la partie', () => {
    const hint = findHint(viewOf(board({ drawCount: 3, tableau: [column(['KS'])], stock: ['2C', '3C', '4C', '5C'] })));
    expect(hint).toMatchObject({ kind: 'draw', action: { type: 'draw' } });
    expect(hint.explanation).toBe('Pioche 3 cartes : aucun coup du tableau ne fait progresser la partie pour l’instant.');
  });

  it('recycle la défausse si des coups ont été joués pendant ce tour', () => {
    const view = viewOf(board({ tableau: [column(['KS'])], waste: ['2C'] }), { passMoves: 2 });
    expect(findHint(view)).toMatchObject({ kind: 'recycle', action: { type: 'recycle' } });
  });

  it('se déclare bloqué quand le talon a fait un tour complet sans coup', () => {
    const recycledTwice = viewOf(board({ tableau: [column(['KS'])], stock: ['2C'] }), { stalePasses: 1 });
    expect(findHint(recycledTwice)).toMatchObject({ kind: 'blocked', action: null });
    const endOfPass = viewOf(board({ tableau: [column(['KS'])], waste: ['2C'] }), { passMoves: 0 });
    expect(findHint(endOfPass).explanation).toMatch(/^Aucun coup utile/);
  });

  it('reconnaît une partie gagnée', () => {
    expect(findHint(viewOf(board({ heights: [13, 13, 13, 13] }))).kind).toBe('won');
  });

  it('va jusqu\'au coup gagnant sans s\'arrêter à une évaluation', () => {
    const hint = findHint(viewOf(board({ waste: ['KS'], heights: [12, 13, 13, 13] })));
    expect(hint).toMatchObject({ kind: 'move', action: move('waste', 'foundation-0') });
  });
});

describe('Indice : rois de la défausse et colonnes vides', () => {
  // Colonnes occupées sans coup utile entre elles ; les autres restent vides.
  const busy = [column(['5H'], ['XX', 'XX']), column(['9C'], ['XX', 'XX', 'XX']), column(['3S'], ['XX']), column(['JD'], ['XX', 'XX']),
    column(['7S'], ['XX']), column(['QD'], ['XX', 'XX'])];
  const withEmpty = empties => [...busy.slice(0, 7 - empties), ...Array.from({ length: empties }, () => column([]))];

  it.each([1, 2, 3])('pose le roi de la défausse dans une colonne vide (%i colonne(s) vide(s))', empties => {
    const hint = findHint(viewOf(board({ tableau: withEmpty(empties), waste: ['2C', 'KH'], stock: ['4C', '6C'] })));
    const target = 7 - empties;
    expect(hint).toMatchObject({ kind: 'move', action: move('waste', `tableau-${target}`), goal: 'king' });
    expect(hint.explanation).toBe(`Pose le roi de cœur de la défausse dans la colonne ${target + 1}, vide : `
      + `un roi commence une nouvelle suite en colonne ${target + 1}.`);
  });

  it('enchaîne roi puis dame noire en attente qui libère une carte cachée', () => {
    const tableau = [column(['QS'], ['XX', 'XX']), ...busy.slice(1, 4), column([]), column([])];
    const hint = findHint(viewOf(board({ tableau, waste: ['KH'], stock: ['4C'] })));
    expect(hint.plan.slice(0, 2)).toEqual([move('waste', 'tableau-4'), move('tableau-0', 'tableau-4')]);
    expect(hint.goal).toBe('reveal');
  });

  it('ne fait pas boucler un roi déjà au fond de sa colonne', () => {
    const tableau = [column(['KS', 'QH']), ...busy.slice(1, 4), column([]), column([])];
    const hint = findHint(viewOf(board({ tableau, waste: ['2C'], stock: ['4C'] })));
    expect(hint).toMatchObject({ kind: 'draw', action: { type: 'draw' } });
  });

  it('ne pose qu\'un roi dans une colonne vide', () => {
    const hint = findHint(viewOf(board({ tableau: withEmpty(3), waste: ['QH'], stock: ['4C'] })));
    expect(hint.kind).toBe('draw');
  });

  it('préfère une montée sur la fondation, puis le roi', () => {
    const tableau = [column(['AD']), ...busy.slice(1, 4), column([]), column([])];
    const hint = findHint(viewOf(board({ tableau, waste: ['KH'], stock: ['4C'] })));
    expect(hint.action).toEqual(move('tableau-0', 'foundation-3'));
    expect(hint.plan[1]).toMatchObject({ from: 'waste', to: expect.stringMatching(/^tableau-/) });
  });

  it('préfère le roi qui libère une carte cachée quand une seule colonne est vide', () => {
    const tableau = [column(['KS'], ['XX', 'XX']), ...busy.slice(1, 5), busy[0], column([])];
    const hint = findHint(viewOf(board({ tableau, waste: ['KH'], stock: ['4C'] })));
    expect(hint.action).toEqual(move('tableau-0', 'tableau-6'));
    expect(hint.goal).toBe('reveal');
  });
});

describe('Indice : information et historique', () => {
  it('donne le même conseil quelles que soient les cartes cachées', () => {
    const engineState = engine.init({ seed: 9 });
    const shuffled = structuredClone(engineState);
    // Échange de cartes cachées entre colonnes et talon : la vue ne change pas.
    [shuffled.board.tableau[6].down[0], shuffled.board.stock[0]] = [shuffled.board.stock[0], shuffled.board.tableau[6].down[0]];
    const view = engine.getPlayerView(engineState, PLAYER);
    expect(engine.getPlayerView(shuffled, PLAYER)).toEqual(view);
    expect(findHint(engine.getPlayerView(shuffled, PLAYER))).toEqual(findHint(view));
  });

  it('écarte un coup qui mènerait à une position déjà jouée', () => {
    const state = stateWith(board({ tableau: [column(['8S']), column(['7H'])], waste: ['AH'], stock: ['2C'] }));
    const view = engine.getPlayerView(state, PLAYER);
    const first = findHint(view);
    expect(first.kind).toBe('move');
    const reached = engine.getPlayerView(engine.applyAction(state, first.action, PLAYER), PLAYER);
    const remembered = findHint(view, { history: new Set([viewKey(reached)]) });
    expect(remembered.action).not.toEqual(first.action);
  });

  it('respecte le budget de nœuds et l\'échéance', () => {
    const view = engine.getPlayerView(engine.init({ seed: 2 }), PLAYER);
    expect(findHint(view, { maxNodes: 1 }).nodes).toBe(1);
    let clock = 0;
    expect(findHint(view, { deadline: -1, now: () => clock++ }).nodes).toBe(0);
  });
});

describe('Explications', () => {
  const position = board({
    drawCount: 3,
    tableau: [column(['TS']), column(['9H', '8C', '7D']), column([]), column(['KH'])],
    waste: ['9D'], stock: ['2C'], heights: [0, 4, 0, 0],
  });

  it('décrit chaque type de coup', () => {
    expect(describeAction(position, { type: 'draw' })).toBe('Pioche une carte');
    expect(describeAction(position, { type: 'recycle' })).toBe('Retourne la défausse pour reformer le talon');
    expect(describeAction(position, move('tableau-1', 'tableau-0', 3)))
      .toBe('Déplace le 9 de cœur (colonne 2) et les 2 cartes posées dessus sur le 10 de pique (colonne 1)');
    expect(describeAction(position, move('tableau-1', 'tableau-0', 2)))
      .toBe('Déplace le 8 de trèfle (colonne 2) et la carte posée dessus sur le 10 de pique (colonne 1)');
    expect(describeAction(position, move('tableau-3', 'tableau-2'))).toBe('Déplace le roi de cœur (colonne 4) dans la colonne 3, vide');
    expect(describeAction(position, move('waste', 'tableau-0'))).toBe('Pose le 9 de carreau de la défausse sur le 10 de pique (colonne 1)');
    expect(describeAction(position, move('foundation-1', 'tableau-0'))).toBe('Redescends le 4 de cœur de sa fondation sur le 10 de pique (colonne 1)');
    expect(describeAction(position, move('foundation-1', 'foundation-0'))).toBe('Monte le 4 de cœur sur sa fondation');
  });

  it('classe l\'effet d\'un plan', () => {
    const emptied = board({ tableau: [column(['TS', '9H'])] });
    expect(planGoal(board({ tableau: [column(['TS']), column(['9H'])] }), emptied)).toEqual({ goal: 'empty', column: 1 });
    expect(planGoal(board({ waste: ['9H'], tableau: [column(['TS'])] }), board({ tableau: [column(['TS', '9H'])] })).goal).toBe('waste');
    expect(planGoal(board({ waste: ['KH'] }), board({ tableau: [column([]), column(['KH'])] }))).toEqual({ goal: 'king', column: 1 });
    expect(planGoal(board({ tableau: [column(['TS', '9H']), column(['9D'])] }), board({ tableau: [column(['TS']), column(['9D'])] })).goal).toBe('improve');
  });

  it('rédige la raison selon l\'effet et la longueur du plan', () => {
    const before = board({ tableau: [column(['TS']), column(['9H'])], heights: [0, 0, 0, 0] });
    const after = board({ tableau: [column(['TS', '9H'])] });
    expect(explainPlan(before, [move('tableau-1', 'tableau-0')], after).text)
      .toBe('Déplace le 9 de cœur (colonne 2) sur le 10 de pique (colonne 1) : la colonne 2 se vide et pourra accueillir un roi.');
    const climbed = board({ tableau: [column(['TS', '9H'])], heights: [1, 0, 0, 0] });
    expect(explainPlan(before, [move('tableau-1', 'tableau-0'), move('waste', 'foundation-0')], climbed).text)
      .toMatch(/prépare une montée sur les fondations, en 2 coups\.$/);
    expect(explainPlan(before, [move('tableau-1', 'tableau-0')], before).text).toMatch(/la position s'améliore\.$/);
    expect(explainPlan(board({ waste: ['9H'], tableau: [column(['TS'])] }), [move('waste', 'tableau-0')], after).text)
      .toMatch(/une carte de la défausse entre en jeu\.$/);
  });
});
