/**
 * Table de transposition : mémorise le résultat des positions déjà analysées.
 *
 * Au Puissance 4, des ordres de coups différents mènent souvent à la même
 * grille (« transpositions ») : la table évite de recalculer ces sous-arbres.
 * Elle est stockée dans des tableaux typés (pas d'objet par entrée) pour rester
 * compacte et rapide. En cas de collision d'index, l'entrée la plus récente
 * remplace l'ancienne : c'est un cache, jamais une source de vérité.
 */

/** Le score stocké est exact. */
export const EXACT = 1;
/** Le score stocké est un minorant (coupure bêta : la vraie valeur est ≥). */
export const LOWER = 2;
/** Le score stocké est un majorant (aucun coup n'a dépassé alpha : valeur ≤). */
export const UPPER = 3;

/** Taille par défaut : nombre premier de Mersenne 2^19 - 1 (≈ 5 Mo de tableaux). */
export const DEFAULT_TABLE_SIZE = 524287;

/**
 * @typedef {Object} TableEntry
 * @property {number} depth - Profondeur restante de la recherche qui a produit le score
 * @property {number} score - Score du point de vue du joueur au trait
 * @property {number} flag - EXACT, LOWER ou UPPER
 * @property {number} move - Meilleure colonne trouvée (-1 si aucune)
 */

export class TranspositionTable {
  /**
   * @param {number} [size] - Nombre d'emplacements (un nombre premier répartit mieux les clés)
   */
  constructor(size = DEFAULT_TABLE_SIZE) {
    this.size = size;
    this.keys = new Float64Array(size);
    this.scores = new Int32Array(size);
    this.depths = new Int8Array(size);
    this.flags = new Uint8Array(size);
    this.moves = new Int8Array(size);
    // Objet de lecture réutilisé : `get` est appelé à chaque nœud et une
    // allocation par appel occuperait inutilement le ramasse-miettes.
    this.entry = { depth: 0, score: 0, flag: 0, move: -1 };
  }

  /** Vide la table : une nouvelle analyse ne dépend jamais de la précédente. */
  clear() {
    this.keys.fill(0);
    this.flags.fill(0);
  }

  /**
   * @param {number} key - Clé unique de la position
   * @returns {Readonly<TableEntry> | null} Entrée valable jusqu'au prochain appel de `get`
   */
  get(key) {
    const index = key % this.size;
    if (this.flags[index] === 0 || this.keys[index] !== key) {
      return null;
    }
    const { entry } = this;
    entry.depth = this.depths[index];
    entry.score = this.scores[index];
    entry.flag = this.flags[index];
    entry.move = this.moves[index];
    return entry;
  }

  /**
   * @param {number} key - Clé unique de la position
   * @param {TableEntry} entry - Résultat à mémoriser
   */
  set(key, { depth, score, flag, move }) {
    const index = key % this.size;
    this.keys[index] = key;
    this.depths[index] = depth;
    this.scores[index] = score;
    this.flags[index] = flag;
    this.moves[index] = move;
  }
}
