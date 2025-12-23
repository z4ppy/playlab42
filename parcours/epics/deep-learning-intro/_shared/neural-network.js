/**
 * Deep Neural Network avec Adam Optimizer
 * Implémentation pédagogique pour le laboratoire interactif
 *
 * @example
 * const nn = new DeepNeuralNetwork([2, 8, 4, 1], 0.01);
 * const output = nn.forward([0.5, -0.3]);
 * const loss = nn.train([0.5, -0.3], [1.0]);
 */

// Helpers
const tanh = Math.tanh;
const rand = (min, max) => Math.random() * (max - min) + min;

/**
 * Réseau de neurones multicouche avec Adam optimizer
 */
export class DeepNeuralNetwork {
    /**
     * @param {number[]} layerSizes - Taille de chaque couche [entrée, cachée1, ..., sortie]
     * @param {number} lr - Learning rate (défaut: 0.01)
     */
    constructor(layerSizes, lr = 0.01) {
        this.layerSizes = layerSizes;
        this.layers = [];
        this.lr = lr;

        // Paramètres Adam
        this.beta1 = 0.9;
        this.beta2 = 0.999;
        this.epsilon = 1e-8;
        this.t = 0;

        // Initialisation Xavier/Glorot
        for (let i = 0; i < layerSizes.length - 1; i++) {
            const inSize = layerSizes[i];
            const outSize = layerSizes[i + 1];
            const limit = Math.sqrt(6 / (inSize + outSize));

            this.layers.push({
                weights: new Float32Array(inSize * outSize).map(() => rand(-limit, limit)),
                biases: new Float32Array(outSize).fill(0.01),
                // Moments Adam
                mW: new Float32Array(inSize * outSize).fill(0),
                vW: new Float32Array(inSize * outSize).fill(0),
                mB: new Float32Array(outSize).fill(0),
                vB: new Float32Array(outSize).fill(0),
                // Cache pour backprop
                inputs: null,
                outputs: null,
                gradients: null,
                inSize,
                outSize,
            });
        }
    }

    /**
     * Propagation avant
     * @param {number[]} input - Vecteur d'entrée
     * @returns {Float32Array} Sortie du réseau
     */
    forward(input) {
        let curr = Float32Array.from(input);

        for (const layer of this.layers) {
            layer.inputs = curr;
            const next = new Float32Array(layer.outSize);

            for (let j = 0; j < layer.outSize; j++) {
                let sum = layer.biases[j];
                for (let k = 0; k < layer.inSize; k++) {
                    sum += curr[k] * layer.weights[k * layer.outSize + j];
                }
                next[j] = tanh(sum);
            }

            layer.outputs = next;
            curr = next;
        }

        return curr;
    }

    /**
     * Entraînement avec backpropagation et Adam
     * @param {number[]} input - Vecteur d'entrée
     * @param {number[]} target - Valeur cible
     * @returns {number} Loss (MSE)
     */
    train(input, target) {
        const output = this.forward(input);
        this.t++;

        // Calcul de l'erreur initiale
        let errors = new Float32Array(output.length);
        let loss = 0;
        for (let i = 0; i < output.length; i++) {
            const diff = target[i] - output[i];
            errors[i] = diff;
            loss += diff * diff;
        }

        // Backpropagation
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            const nextErrors = new Float32Array(layer.inSize);
            const gradients = new Float32Array(layer.outSize);

            for (let j = 0; j < layer.outSize; j++) {
                // Dérivée de tanh
                const dtanh = 1 - layer.outputs[j] * layer.outputs[j];
                const grad = errors[j] * dtanh;
                gradients[j] = grad;

                // Adam pour biais
                layer.mB[j] = this.beta1 * layer.mB[j] + (1 - this.beta1) * grad;
                layer.vB[j] = this.beta2 * layer.vB[j] + (1 - this.beta2) * grad * grad;
                const mBHat = layer.mB[j] / (1 - Math.pow(this.beta1, this.t));
                const vBHat = layer.vB[j] / (1 - Math.pow(this.beta2, this.t));
                layer.biases[j] += this.lr * mBHat / (Math.sqrt(vBHat) + this.epsilon);

                // Adam pour poids
                for (let k = 0; k < layer.inSize; k++) {
                    const wIdx = k * layer.outSize + j;
                    nextErrors[k] += errors[j] * layer.weights[wIdx] * dtanh;

                    const wGrad = grad * layer.inputs[k];
                    layer.mW[wIdx] = this.beta1 * layer.mW[wIdx] + (1 - this.beta1) * wGrad;
                    layer.vW[wIdx] = this.beta2 * layer.vW[wIdx] + (1 - this.beta2) * wGrad * wGrad;
                    const mWHat = layer.mW[wIdx] / (1 - Math.pow(this.beta1, this.t));
                    const vWHat = layer.vW[wIdx] / (1 - Math.pow(this.beta2, this.t));
                    layer.weights[wIdx] += this.lr * mWHat / (Math.sqrt(vWHat) + this.epsilon);
                }
            }

            layer.gradients = gradients;
            errors = nextErrors;
        }

        return loss / output.length;
    }

    /**
     * Évalue le réseau sur un dataset
     * @param {Array<{i: number[], t: number[]}>} dataset
     * @returns {number} Loss moyenne
     */
    evaluate(dataset) {
        let totalLoss = 0;
        for (const d of dataset) {
            const out = this.forward(d.i);
            for (let i = 0; i < out.length; i++) {
                totalLoss += (d.t[i] - out[i]) ** 2;
            }
        }
        return totalLoss / dataset.length;
    }
}

/**
 * Tâches prédéfinies pour le laboratoire
 */
export const TASKS = {
    'xor': {
        arch: [2, 8, 4, 1],
        type: 'classif',
        defaultLR: 0.05,
        gen: () => {
            const d = [];
            for (let i = 0; i < 20; i++) {
                d.push({ i: [-0.9 + rand(-0.1, 0.1), -0.9 + rand(-0.1, 0.1)], t: [-0.9] });
                d.push({ i: [-0.9 + rand(-0.1, 0.1), 0.9 + rand(-0.1, 0.1)], t: [0.9] });
                d.push({ i: [0.9 + rand(-0.1, 0.1), -0.9 + rand(-0.1, 0.1)], t: [0.9] });
                d.push({ i: [0.9 + rand(-0.1, 0.1), 0.9 + rand(-0.1, 0.1)], t: [-0.9] });
            }
            return d;
        },
    },
    'circle': {
        arch: [2, 16, 8, 1],
        type: 'classif',
        defaultLR: 0.03,
        gen: () => {
            const d = [];
            for (let i = 0; i < 120; i++) {
                const x = rand(-1, 1);
                const y = rand(-1, 1);
                d.push({ i: [x, y], t: [(x * x + y * y < 0.4) ? 0.9 : -0.9] });
            }
            return d;
        },
    },
    'sine': {
        arch: [1, 32, 32, 1],
        type: 'reg',
        defaultLR: 0.01,
        gen: () => {
            const d = [];
            for (let i = 0; i < 100; i++) {
                const x = rand(-1, 1);
                d.push({ i: [x], t: [Math.sin(x * Math.PI)] });
            }
            return d;
        },
    },
    'spiral': {
        arch: [2, 64, 32, 1],
        type: 'classif',
        defaultLR: 0.01,
        gen: () => {
            const d = [];
            const N = 150;
            const noise = () => rand(-0.02, 0.02);
            for (let i = 0; i < N; i++) {
                const r = (i / N) * 0.95 + 0.05;
                const t = 1.75 * i / N * 2 * Math.PI + rand(-0.1, 0.1);
                d.push({ i: [r * Math.sin(t) + noise(), r * Math.cos(t) + noise()], t: [0.9] });
                d.push({ i: [r * Math.sin(t + Math.PI) + noise(), r * Math.cos(t + Math.PI) + noise()], t: [-0.9] });
            }
            return d;
        },
    },
};

/**
 * Mélange un tableau (Fisher-Yates)
 * @param {Array} arr
 * @returns {Array}
 */
export function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
}
