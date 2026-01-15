/**
 * Visualisation de Tri (Sorting)
 * Rendu simple avec Canvas
 */
export function initSortingViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = 300;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const n = 50;
    let array = [];
    const barWidth = canvas.width / n;
    
    // State control
    let isSorting = false;
    let shouldStop = false;

    function generateArray() {
        array = [];
        for (let i = 0; i < n; i++) {
            array.push(Math.random() * (canvas.height - 20) + 10);
        }
        draw();
    }

    function reset() {
        if (isSorting) {
            shouldStop = true;
            // Attendre que le tri s'arrête avant de régénérer
            const waitForStop = () => {
                if (isSorting) {
                   setTimeout(waitForStop, 50);
                } else {
                   generateArray();
                }
            };
            waitForStop();
            return;
        }
        generateArray();
    }

    function draw(highlightIndices = [], color = '#f59e0b') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < n; i++) {
            if (highlightIndices.includes(i)) {
                ctx.fillStyle = color;
            } else {
                ctx.fillStyle = '#3b82f6';
            }
            ctx.fillRect(i * barWidth, canvas.height - array[i], barWidth - 1, array[i]);
        }
    }

    async function sleep(ms) {
        if (shouldStop) throw new Error('Stopped');
        return new Promise(r => setTimeout(r, ms));
    }

    async function bubbleSort() {
        try {
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n - i - 1; j++) {
                    draw([j, j + 1]);
                    if (array[j] > array[j + 1]) {
                        let temp = array[j];
                        array[j] = array[j + 1];
                        array[j + 1] = temp;
                    }
                    await sleep(20);
                }
            }
            draw();
        } catch (e) { if(e.message !== 'Stopped') console.error(e); }
    }

    async function selectionSort() {
        try {
            for (let i = 0; i < n; i++) {
                let minIdx = i;
                for (let j = i + 1; j < n; j++) {
                    draw([i, j], '#ef4444');
                    // Check stop frequently
                    if (shouldStop) throw new Error('Stopped');
                    if (array[j] < array[minIdx]) {
                        minIdx = j;
                    }
                    if (j % 5 === 0) await sleep(10); // Batch draw calls slightly? No, keeping visualization smooth
                    else await sleep(2);
                }
                if (minIdx !== i) {
                    let temp = array[i];
                    array[i] = array[minIdx];
                    array[minIdx] = temp;
                }
                draw([i], '#10b981');
                await sleep(20);
            }
            draw();
        } catch (e) { if(e.message !== 'Stopped') console.error(e); }
    }

    async function insertionSort() {
        try {
            for (let i = 1; i < n; i++) {
                let key = array[i];
                let j = i - 1;
                while (j >= 0 && array[j] > key) {
                    draw([j, j + 1], '#ef4444');
                    array[j + 1] = array[j];
                    j = j - 1;
                    await sleep(20);
                }
                array[j + 1] = key;
                draw([j + 1], '#10b981');
                await sleep(20);
            }
            draw();
        } catch (e) { if(e.message !== 'Stopped') console.error(e); }
    }

    async function quickSortRecursive(start, end) {
        if (start >= end) return;
        if (shouldStop) throw new Error('Stopped');

        let pivotValue = array[end];
        let pivotIndex = start;
        
        draw([end], '#8b5cf6');
        await sleep(20);

        for (let i = start; i < end; i++) {
            draw([i, pivotIndex, end], '#ef4444');
            if (array[i] < pivotValue) {
                [array[i], array[pivotIndex]] = [array[pivotIndex], array[i]];
                pivotIndex++;
            }
            await sleep(10);
        }
        [array[pivotIndex], array[end]] = [array[end], array[pivotIndex]];
        
        await Promise.all([
            quickSortRecursive(start, pivotIndex - 1),
            quickSortRecursive(pivotIndex + 1, end)
        ]);
    }

    async function quickSort() {
        try {
            await quickSortRecursive(0, n - 1);
            draw();
        } catch (e) { if(e.message !== 'Stopped') console.error(e); }
    }

    async function runSort(sortFunction) {
        if (isSorting) {
            shouldStop = true;
            const checkStop = async () => {
                if (isSorting) {
                    setTimeout(checkStop, 50);
                } else {
                    start(sortFunction);
                }
            };
            checkStop();
            return;
        }
        start(sortFunction);
    }

    async function start(sortFn) {
        shouldStop = false;
        
        // Si tableau trié (visual check simple), on régénère pour que l'utilisateur voit quelque chose
        // On suppose que si le premier est plus petit que le dernier, c'est peut-être trié...
        // Plus simple: on régénère toujours pour garantir le spectacle
        generateArray();

        isSorting = true;
        disableButtons(true);
        
        await sortFn();
        
        isSorting = false;
        disableButtons(false);
    }
    
    function disableButtons(disabled) {
        const btns = controls.querySelectorAll('button:not(#btn-reset)');
        btns.forEach(b => {
             // On ne désactive pas, on laisse cliquer pour changer de tri (ça lance le stop/restart)
             // Sauf si on veut forcer l'attente
             // Mieux : on ajoute une classe active
             if (disabled) b.classList.add('opacity-50', 'cursor-not-allowed');
             else b.classList.remove('opacity-50', 'cursor-not-allowed');
        });
    }

    // UI Buttons
    const controls = document.createElement('div');
    controls.className = 'absolute top-2 right-2 flex flex-wrap justify-end gap-2 max-w-[90%]';
    
    const btnReset = document.createElement('button');
    btnReset.id = 'btn-reset';
    btnReset.textContent = 'Mélanger';
    btnReset.className = 'px-3 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 font-bold transition-colors';
    btnReset.onclick = reset;
    controls.appendChild(btnReset);

    const algos = [
        { name: 'Bubble', fn: bubbleSort, color: 'bg-blue-600' },
        { name: 'Selection', fn: selectionSort, color: 'bg-indigo-600' },
        { name: 'Insertion', fn: insertionSort, color: 'bg-indigo-600' },
        { name: 'Quick', fn: quickSort, color: 'bg-purple-600' }
    ];

    algos.forEach(algo => {
        const btn = document.createElement('button');
        btn.textContent = algo.name;
        btn.className = `px-3 py-1 ${algo.color} text-white rounded text-xs hover:bg-opacity-90 transition-all shadow-sm`;
        btn.onclick = () => runSort(algo.fn);
        controls.appendChild(btn);
    });

    container.appendChild(controls);

    generateArray();
}
