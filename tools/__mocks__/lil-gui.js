/**
 * Mock de lil-gui pour les tests
 */

class Controller {
  constructor() {
    this.property = '';
  }
  name() { return this; }
  onChange() { return this; }
  options() { return this; }
  updateDisplay() { return this; }
  destroy() {}
}

class Folder {
  constructor() {
    this.children = [];
  }
  add() { return new Controller(); }
  addFolder() { return new Folder(); }
  close() { return this; }
  open() { return this; }
  show() { return this; }
  hide() { return this; }
}

export default class GUI extends Folder {
  constructor() {
    super();
  }
  controllersRecursive() { return []; }
  destroy() {}
}
