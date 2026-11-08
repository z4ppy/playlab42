/**
 * Outils sans tracé : pipette, texte et main (déplacement de la vue).
 */

/**
 * Pipette : prélève la couleur sous le doigt en continu (aperçu immédiat) ;
 * la couleur rejoint les récentes au relâchement.
 */
export function createEyedropperTool() {
  let picking = false;
  let secondary = false;

  function pick(editor, p) {
    const color = editor.sampleColor(p.x, p.y, editor.settingsFor('eyedropper').sampleAll);
    if (color) {
      editor.setColor(secondary ? 'secondary' : 'primary', color, { recent: false });
    }
  }

  return {
    id: 'eyedropper',
    label: 'Pipette',
    icon: '💧',
    key: 'I',
    cursor: 'crosshair',
    options: ['sampleAll'],
    defaults: { sampleAll: true },

    down(editor, p) {
      picking = true;
      secondary = Boolean(p.secondary);
      pick(editor, p);
    },

    move(editor, p) {
      if (picking) {
        pick(editor, p);
      }
    },

    up(editor) {
      if (picking) {
        picking = false;
        editor.rememberColor(secondary ? 'secondary' : 'primary');
      }
    },

    cancel() {
      picking = false;
    },
  };
}

/**
 * Texte : un appui choisit la position, une boîte de dialogue saisit le texte.
 */
export function createTextTool() {
  let point = null;
  return {
    id: 'text',
    label: 'Texte',
    icon: 'T',
    key: 'T',
    cursor: 'text',
    options: ['fontSize', 'fontFamily', 'bold', 'opacity'],
    defaults: { fontSize: 48, fontFamily: 'sans-serif', bold: false, opacity: 100 },

    down(_editor, p) {
      point = { x: p.x, y: p.y };
    },

    move() {},

    up(editor) {
      if (point && editor.editableLayer()) {
        editor.openTextDialog(point);
      }
      point = null;
    },

    cancel() {
      point = null;
    },
  };
}

/**
 * Main : un doigt ou la souris déplace la vue (le geste est géré par l'entrée).
 */
export function createHandTool() {
  return {
    id: 'hand',
    label: 'Main',
    icon: '✋',
    key: 'H',
    cursor: 'grab',
    pans: true,
    options: [],
    defaults: {},
    down() {},
    move() {},
    up() {},
    cancel() {},
  };
}
