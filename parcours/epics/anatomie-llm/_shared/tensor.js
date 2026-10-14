/**
 * Petit moteur matriciel différentiable. Les gradients ne sont alloués que
 * pendant l'entraînement ; l'inférence utilise exactement les mêmes opérations.
 */
export class Tensor {
  constructor(data, rows, cols, train = false) {
    if (data.length !== rows * cols || rows < 1 || cols < 1) {
      throw new RangeError('Dimensions de tenseur incompatibles.');
    }
    this.data = Float64Array.from(data);
    this.rows = rows;
    this.cols = cols;
    this.grad = train ? new Float64Array(data.length) : null;
    this.parents = [];
    this.backwardOp = () => {};
  }

  /** Propage un gradient scalaire une fois dans l'ordre topologique inverse. */
  backward() {
    if (!this.grad || this.data.length !== 1) {
      throw new Error('La rétropropagation exige une perte scalaire différentiable.');
    }
    const visited = new Set();
    const order = [];
    const visit = tensor => {
      if (visited.has(tensor)) { return; }
      visited.add(tensor);
      tensor.parents.forEach(visit);
      order.push(tensor);
    };
    visit(this);
    this.grad[0] = 1;
    order.reverse().forEach(tensor => tensor.backwardOp());
  }

  toRows() {
    return Array.from({ length: this.rows }, (_, i) =>
      Array.from(this.data.slice(i * this.cols, (i + 1) * this.cols)));
  }
}

function operation(data, rows, cols, parents, backward) {
  const result = new Tensor(data, rows, cols, parents.some(p => p.grad));
  if (result.grad) {
    result.parents = parents;
    result.backwardOp = () => backward(result.grad);
  }
  return result;
}

export function add(a, b) {
  if (a.rows !== b.rows || a.cols !== b.cols) { throw new RangeError('Addition incompatible.'); }
  return operation(a.data.map((v, i) => v + b.data[i]), a.rows, a.cols, [a, b], grad => {
    grad.forEach((v, i) => {
      if (a.grad) { a.grad[i] += v; }
      if (b.grad) { b.grad[i] += v; }
    });
  });
}

export function matmul(a, b) {
  if (a.cols !== b.rows) { throw new RangeError('Produit matriciel incompatible.'); }
  const data = new Float64Array(a.rows * b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let k = 0; k < a.cols; k++) {
      for (let j = 0; j < b.cols; j++) {
        data[i * b.cols + j] += a.data[i * a.cols + k] * b.data[k * b.cols + j];
      }
    }
  }
  return operation(data, a.rows, b.cols, [a, b], grad => {
    for (let i = 0; i < a.rows; i++) {
      for (let k = 0; k < a.cols; k++) {
        for (let j = 0; j < b.cols; j++) {
          const g = grad[i * b.cols + j];
          if (a.grad) { a.grad[i * a.cols + k] += g * b.data[k * b.cols + j]; }
          if (b.grad) { b.grad[k * b.cols + j] += g * a.data[i * a.cols + k]; }
        }
      }
    }
  });
}

export function gather(table, ids) {
  if (!ids.length || ids.some(id => !Number.isInteger(id) || id < 0 || id >= table.rows)) {
    throw new RangeError('Identifiant hors du vocabulaire.');
  }
  const data = ids.flatMap(id => Array.from(table.data.slice(id * table.cols, (id + 1) * table.cols)));
  return operation(data, ids.length, table.cols, [table], grad => {
    if (!table.grad) { return; }
    ids.forEach((id, i) => {
      for (let j = 0; j < table.cols; j++) { table.grad[id * table.cols + j] += grad[i * table.cols + j]; }
    });
  });
}

export function relu(a) {
  return operation(a.data.map(v => Math.max(0, v)), a.rows, a.cols, [a], grad => {
    if (a.grad) { grad.forEach((v, i) => { a.grad[i] += a.data[i] > 0 ? v : 0; }); }
  });
}

/** RMSNorm sans gain appris : x / sqrt(moyenne(x²) + epsilon). */
export function rmsnorm(a) {
  const data = new Float64Array(a.data.length);
  const scales = [];
  for (let i = 0; i < a.rows; i++) {
    const row = a.data.slice(i * a.cols, (i + 1) * a.cols);
    const scale = 1 / Math.sqrt(row.reduce((s, v) => s + v * v, 0) / a.cols + 1e-5);
    scales.push(scale);
    row.forEach((v, j) => { data[i * a.cols + j] = v * scale; });
  }
  return operation(data, a.rows, a.cols, [a], grad => {
    if (!a.grad) { return; }
    for (let i = 0; i < a.rows; i++) {
      let dot = 0;
      for (let j = 0; j < a.cols; j++) { dot += grad[i * a.cols + j] * a.data[i * a.cols + j]; }
      for (let j = 0; j < a.cols; j++) {
        const k = i * a.cols + j;
        a.grad[k] += grad[k] * scales[i] - a.data[k] * scales[i] ** 3 * dot / a.cols;
      }
    }
  });
}

/** Attention multi-tête causale, avec cartes exactes pour l'inspection. */
export function attention(q, k, v, heads) {
  if (q.cols % heads || q.rows !== k.rows || q.rows !== v.rows || q.cols !== k.cols || q.cols !== v.cols) {
    throw new RangeError('Dimensions des têtes incompatibles.');
  }
  const width = q.cols / heads;
  const n = q.rows;
  const scale = 1 / Math.sqrt(width);
  const maps = Array.from({ length: heads }, () => Array.from({ length: n }, () => Array(n).fill(0)));
  const data = new Float64Array(n * q.cols);
  for (let h = 0; h < heads; h++) {
    for (let i = 0; i < n; i++) {
      const scores = [];
      for (let j = 0; j <= i; j++) {
        let score = 0;
        for (let d = 0; d < width; d++) { score += q.data[i * q.cols + h * width + d] * k.data[j * q.cols + h * width + d]; }
        scores.push(score * scale);
      }
      const max = Math.max(...scores);
      const exps = scores.map(s => Math.exp(s - max));
      const sum = exps.reduce((s, x) => s + x, 0);
      exps.forEach((x, j) => { maps[h][i][j] = x / sum; });
      for (let d = 0; d < width; d++) {
        for (let j = 0; j <= i; j++) { data[i * q.cols + h * width + d] += maps[h][i][j] * v.data[j * q.cols + h * width + d]; }
      }
    }
  }
  const result = operation(data, n, q.cols, [q, k, v], grad => {
    for (let h = 0; h < heads; h++) {
      for (let i = 0; i < n; i++) {
        const dp = Array(i + 1).fill(0);
        for (let j = 0; j <= i; j++) {
          for (let d = 0; d < width; d++) {
            const qi = i * q.cols + h * width + d;
            const kj = j * q.cols + h * width + d;
            dp[j] += grad[qi] * v.data[kj];
            if (v.grad) { v.grad[kj] += maps[h][i][j] * grad[qi]; }
          }
        }
        const mean = dp.reduce((s, x, j) => s + x * maps[h][i][j], 0);
        for (let j = 0; j <= i; j++) {
          const ds = maps[h][i][j] * (dp[j] - mean) * scale;
          for (let d = 0; d < width; d++) {
            const qi = i * q.cols + h * width + d;
            const kj = j * q.cols + h * width + d;
            if (q.grad) { q.grad[qi] += ds * k.data[kj]; }
            if (k.grad) { k.grad[kj] += ds * q.data[qi]; }
          }
        }
      }
    }
  });
  return { result, maps };
}

export function crossEntropy(logits, targets) {
  if (targets.length !== logits.rows || targets.some(t => !Number.isInteger(t) || t < 0 || t >= logits.cols)) {
    throw new RangeError('Cibles incompatibles.');
  }
  let loss = 0;
  const probabilities = logits.toRows().map((row, i) => {
    const max = Math.max(...row);
    const exp = row.map(v => Math.exp(v - max));
    const sum = exp.reduce((s, v) => s + v, 0);
    loss += Math.log(sum) + max - row[targets[i]];
    return exp.map(v => v / sum);
  });
  return operation([loss / targets.length], 1, 1, [logits], grad => {
    if (!logits.grad) { return; }
    probabilities.forEach((row, i) => row.forEach((p, j) => {
      logits.grad[i * logits.cols + j] += (p - Number(j === targets[i])) / targets.length * grad[0];
    }));
  });
}
