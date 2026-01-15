/**
 * Visualization Greedy Algorithm (Coin Change)
 */
export function initGreedyViz(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  container.innerHTML = `
        <div class="flex flex-col items-center gap-4 p-4">
            <div class="text-xl">Montant à rendre : <span id="target-amount" class="font-bold text-yellow-400">47</span></div>
            <div class="flex gap-2">
                <div class="coin bg-yellow-500 rounded-full w-12 h-12 flex items-center justify-center text-black font-bold">20</div>
                <div class="coin bg-gray-400 rounded-full w-10 h-10 flex items-center justify-center text-black font-bold">10</div>
                <div class="coin bg-red-400 rounded-full w-8 h-8 flex items-center justify-center text-black font-bold">5</div>
                <div class="coin bg-orange-400 rounded-full w-6 h-6 flex items-center justify-center text-black font-bold">1</div>
            </div>
            <div id="result-area" class="flex flex-wrap gap-2 w-full justify-center min-h-[60px] p-2 bg-gray-800 rounded">
                <!-- coins added here -->
            </div>
             <div class="flex gap-2">
                <button id="btn-greedy" class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500">Calculer Glouton</button>
                <button id="btn-reset-greedy" class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-500">Reset</button>
            </div>
        </div>
    `;

  const coins = [20, 10, 5, 1];
  const target = 47;

  // reset logic
  const reset = () => {
    document.getElementById('result-area').innerHTML = '';
  };

  document.getElementById('btn-reset-greedy').onclick = reset;

  document.getElementById('btn-greedy').onclick = async () => {
    reset();
    let remaining = target;
    const resultArea = document.getElementById('result-area');

    for (const coin of coins) {
      while (remaining >= coin) {
        // Add visual coin
        const cDiv = document.createElement('div');
        cDiv.className = 'w-10 h-10 rounded-full flex items-center justify-center text-black font-bold animate-pulse';

        // Color mapping
        if (coin === 20) {cDiv.classList.add('bg-yellow-500');}
        else if (coin === 10) {cDiv.classList.add('bg-gray-400');}
        else if (coin === 5) {cDiv.classList.add('bg-red-400');}
        else {cDiv.classList.add('bg-orange-400', 'w-8', 'h-8');}

        cDiv.innerText = coin;
        resultArea.appendChild(cDiv);

        remaining -= coin;

        // delay
        await new Promise(r => setTimeout(r, 400));
      }
    }
  };
}
