'use strict';

const { MAX_LENGTH } = require('./constants');
const MAX_DEPTH = 128;

const depthError = () => {
  const error = new RangeError(`Brace AST depth exceeds the safety limit (${MAX_DEPTH})`);
  error.code = 'ERR_BRACES_DEPTH';
  return error;
};

// Validate iteratively before any recursive walker, including caller-supplied ASTs.
const assertAst = ast => {
  const stack = [{ node: ast, depth: 0 }];
  let scheduled = 1;

  while (stack.length > 0) {
    const { node, depth } = stack.pop();
    if (depth > MAX_DEPTH) {
      throw depthError();
    }
    if (!node || typeof node !== 'object') {
      throw new TypeError('Expected a brace AST node');
    }
    if (node.value !== undefined && typeof node.value !== 'string') {
      throw new TypeError('Expected a string brace AST value');
    }
    if (node.nodes !== undefined) {
      if (!Array.isArray(node.nodes)) {
        throw new TypeError('Expected an array of brace AST nodes');
      }
      if (node.nodes.length > MAX_LENGTH + 3 - scheduled) {
        const error = new RangeError('Brace AST exceeds the node safety limit');
        error.code = 'ERR_BRACES_NODES';
        throw error;
      }
      scheduled += node.nodes.length;
      for (const child of node.nodes) {
        stack.push({ node: child, depth: depth + 1 });
      }
    }
  }
};

module.exports = { MAX_DEPTH, depthError, assertAst };
