/**
 * Visualization DP Grid (Pathfinding Cost)
 */
export function initDPViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="p-4 flex flex-col items-center">
        <div id="grid-dp" class="grid grid-cols-4 gap-2 mb-4"></div>
        <div class="flex gap-2">
            <button id="btn-calc-dp" class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500">Calculer DP</button>
            <button id="btn-reset-dp" class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-500">Reset</button>
        </div>
    </div>`;

    const gridEl = container.querySelector('#grid-dp');
    const costs = [
        [1, 3, 1, 5],
        [2, 2, 4, 1],
        [5, 0, 2, 3],
        [0, 6, 1, 2]
    ];
    // DP table initialized with nulls
    let dp = Array(4).fill().map(() => Array(4).fill(null));

    function renderBoard(showResult = false) {
        gridEl.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                const cell = document.createElement('div');
                cell.className = 'w-12 h-12 flex items-center justify-center border border-gray-600 rounded bg-gray-800 text-sm flex-col';
                
                // Content
                if (showResult && dp[i][j] !== null) {
                    cell.innerHTML = `
                        <span class="text-xs text-gray-400">c:${costs[i][j]}</span>
                        <span class="text-yellow-400 font-bold">${dp[i][j]}</span>
                    `;
                    cell.style.backgroundColor = '#1e3a8a'; // darker blue
                } else {
                    cell.textContent = costs[i][j];
                }
                
                gridEl.appendChild(cell);
            }
        }
    }

    renderBoard(false);

    document.getElementById('btn-reset-dp').onclick = () => {
        dp = Array(4).fill().map(() => Array(4).fill(null));
        renderBoard(false);
    };

    document.getElementById('btn-calc-dp').onclick = async () => {
        // Algorithm: min path sum from (0,0) to (i,j) moving only right or down.
        // dp[i][j] = cost[i][j] + min(dp[i-1][j], dp[i][j-1])
        
        dp = Array(4).fill().map(() => Array(4).fill(null));

        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                let prev = Infinity;
                if (i === 0 && j === 0) prev = 0;
                else {
                    if (i > 0) prev = Math.min(prev, dp[i-1][j]);
                    if (j > 0) prev = Math.min(prev, dp[i][j-1]);
                }
                
                dp[i][j] = costs[i][j] + prev;
                
                renderBoard(true);
                // Highlight current cell ? (implied by incremental render)
                await new Promise(r => setTimeout(r, 200));
            }
        }
    };
}
