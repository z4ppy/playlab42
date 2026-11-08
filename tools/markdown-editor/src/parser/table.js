/**
 * Lignes de tableau GFM : découpage en cellules et ligne de délimitation.
 * @module parser/table
 */

/**
 * Découpe une ligne de tableau sur les `|` non échappés. Les barres de
 * bordure sont facultatives ; `\|` donne un `|` littéral dans la cellule
 * (y compris dans du code, comme l'exige GFM).
 * @param {string} line
 * @returns {string[]} Contenu brut des cellules, rogné.
 */
export function splitTableRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) {
    row = row.slice(1);
  }
  if (row.endsWith('|') && !row.endsWith('\\|')) {
    row = row.slice(0, -1);
  }
  const cells = [];
  let current = '';
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '\\' && row[i + 1] === '|') {
      current += '|';
      i += 1;
    } else if (row[i] === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += row[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Lit une ligne de délimitation (`| :--- | :-: | ---: |`).
 * @param {string} line - Ligne sans son indentation.
 * @returns {Array<'left'|'center'|'right'|null>|null} Alignements, ou null.
 */
export function parseDelimiterRow(line) {
  if (!line.includes('|') || !/^[|:\-\s]+$/.test(line)) {
    return null;
  }
  const cells = splitTableRow(line);
  if (!cells.every((cell) => /^:?-+:?$/.test(cell))) {
    return null;
  }
  return cells.map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) {
      return 'center';
    }
    return left ? 'left' : right ? 'right' : null;
  });
}
