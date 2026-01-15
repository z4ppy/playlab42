
/**
 * Visualisation Recherche Séquentielle (Linéaire)
 */
export function initLinearSearchViz(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {return;}

  container.innerHTML = '';

  // Config
  const COUNT = 16;
  let items = [];
  let isRunning = false;
  let stopRequested = false;
  const delay = 300;

  // Helper: Sleep
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // UI Structure
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center w-full gap-6 p-4';

  // Controls
  const controls = document.createElement('div');
  controls.className = 'flex gap-3 items-center flex-wrap justify-center';

  const label = document.createElement('span');
  label.innerText = 'Cible :';
  label.className = 'text-gray-300 font-medium';

  const inputTarget = document.createElement('input');
  inputTarget.type = 'number';
  inputTarget.value = '42';
  inputTarget.className = 'bg-gray-800 border border-gray-600 text-white p-1 rounded w-16 text-center focus:border-blue-500 outline-none';

  const btnRun = document.createElement('button');
  btnRun.innerText = '🔍 Rechercher';
  btnRun.className = 'px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 font-medium text-sm transition transition-colors';

  const btnReset = document.createElement('button');
  btnReset.innerText = '🎲 Nouveau tableau';
  btnReset.className = 'px-4 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-600 font-medium text-sm transition transition-colors';

  controls.append(label, inputTarget, btnRun, btnReset);

  // Status
  const statusMsg = document.createElement('div');
  statusMsg.className = 'text-sm font-mono text-gray-400 h-6 font-medium';

  // Box Grid
  const boxContainer = document.createElement('div');
  boxContainer.className = 'flex flex-wrap gap-2 justify-center w-full max-w-2xl';

  wrapper.append(controls, statusMsg, boxContainer);
  container.appendChild(wrapper);

  // Logic
  function initArray() {
    if (isRunning) {return;}

    boxContainer.innerHTML = '';
    items = [];
    statusMsg.innerText = 'Prêt à chercher... Algo en O(n)';
    statusMsg.className = 'text-sm font-mono text-gray-400 h-6 font-medium';

    for(let i=0; i<COUNT; i++) {
      const val = Math.floor(Math.random() * 99) + 1;
      const box = document.createElement('div');
      box.className = 'w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border-2 border-gray-700 rounded bg-gray-800/50 text-white font-mono text-lg transition-all duration-300';
      box.innerText = val;
      boxContainer.appendChild(box);
      items.push({ el: box, val: val });
    }
  }

  async function runSearch() {
    if (isRunning) {return;}
    isRunning = true;
    stopRequested = false;

    const target = parseInt(inputTarget.value) || 0;
    statusMsg.innerText = `Recherche de ${target}...`;
    statusMsg.className = 'text-sm font-mono text-blue-400 h-6 font-medium';

    // Reset styles
    items.forEach(item => {
      item.el.className = 'w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border-2 border-gray-700 rounded bg-gray-800/50 text-white font-mono text-lg transition-all duration-300';
    });

    for (let i = 0; i < items.length; i++) {
      if (stopRequested) {break;}

      const item = items[i];

      // Highlight current checking
      item.el.classList.remove('border-gray-700', 'bg-gray-800/50');
      item.el.classList.add('border-yellow-500', 'bg-yellow-900/30', 'scale-110', 'z-10');

      await sleep(delay);

      if (item.val === target) {
        item.el.classList.remove('border-yellow-500', 'bg-yellow-900/30');
        item.el.classList.add('border-green-500', 'bg-green-600', 'scale-110');
        statusMsg.innerText = `Comparaison ${i+1}/${items.length} : Trouvé ! O(${i+1})`;
        statusMsg.className = 'text-sm font-mono text-green-400 h-6 font-bold';
        isRunning = false;
        return;
      } else {
        item.el.classList.remove('border-yellow-500', 'bg-yellow-900/30', 'scale-110', 'z-10');
        item.el.classList.add('border-gray-700', 'bg-gray-800', 'opacity-40');
        statusMsg.innerText = `Comparaison ${i+1}/${items.length} : ${item.val} ≠ ${target}`;
      }
    }

    if (!stopRequested) {
      statusMsg.innerText = `Non trouvé après ${items.length} comparaisons.`;
      statusMsg.className = 'text-sm font-mono text-red-400 h-6 font-bold';
    }
    isRunning = false;
  }

  // Events
  btnReset.onclick = initArray;
  btnRun.onclick = runSearch;

  // Init
  initArray();
}

