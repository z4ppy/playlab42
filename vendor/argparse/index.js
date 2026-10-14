'use strict';

const argparse = require('argparse-modern');

class ArgumentParser extends argparse.ArgumentParser {
  constructor(options = {}) {
    super(options);
    // argparse 2 accepte l'option historique version mais oublie sa valeur.
    if (options.version !== undefined) {
      this.version = options.version;
    }
  }
}

const descriptors = Object.getOwnPropertyDescriptors(argparse);
descriptors.ArgumentParser.value = ArgumentParser;
module.exports = Object.defineProperties({}, descriptors);
