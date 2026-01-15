
/**
 * Visualisation Recherche Binaire (Dichotomique)
 */
export function initBinarySearchViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'flex'; // Ensure centering context if needed
    container.style.justifyContent = 'center';
    
    // Config
    const COUNT = 15;
    let items = [];
    let isRunning = false;
    let stopRequested = false;
    const delay = 800; // Slower because it's fast

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
    inputTarget.value = '42'; // Will be set to a value present in array later
    inputTarget.className = 'bg-gray-800 border border-gray-600 text-white p-1 rounded w-16 text-center focus:border-blue-500 outline-none';
    
    const btnRun = document.createElement('button');
    btnRun.innerText = 'Run (O(log n))';
    btnRun.className = 'px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 font-medium text-sm transition transition-colors';
    
    const btnReset = document.createElement('button');
    btnReset.innerText = 'Nouveau';
    btnReset.className = 'px-4 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-600 font-medium text-sm transition transition-colors';
    
    controls.append(label, inputTarget, btnRun, btnReset);
    
    // Status
    const statusMsg = document.createElement('div');
    statusMsg.className = 'text-sm font-mono text-gray-400 h-6 font-medium';
    
    // Box Grid
    const boxContainer = document.createElement('div');
    boxContainer.className = 'flex flex-wrap gap-1 md:gap-2 justify-center w-full max-w-3xl items-center';
    
    wrapper.append(controls, statusMsg, boxContainer);
    container.appendChild(wrapper);

    // Logic
    function initArray() {
        if (isRunning) return;
        
        boxContainer.innerHTML = '';
        items = [];
        statusMsg.innerText = 'Tableau trié requis pour Binary Search';
        statusMsg.className = 'text-sm font-mono text-gray-400 h-6 font-medium';
        
        let values = [];
        let v = Math.floor(Math.random() * 5);
        for(let i=0; i<COUNT; i++) {
            v += Math.floor(Math.random() * 8) + 1;
            values.push(v);
        }
        
        // Pick a random target
        inputTarget.value = values[Math.floor(Math.random() * values.length)];

        values.forEach((val, i) => {
            const box = document.createElement('div');
            box.className = 'w-8 h-8 md:w-10 md:h-10 flex items-center justify-center border border-gray-600 rounded bg-gray-800 text-white font-mono text-sm md:text-base transition-all duration-300 relative';
            box.innerText = val;
            
            // Labels for indices
            const idxLabel = document.createElement('div');
            idxLabel.innerText = i;
            idxLabel.className = 'absolute -bottom-5 text-[10px] text-gray-500';
            box.appendChild(idxLabel);

            boxContainer.appendChild(box);
            items.push({ el: box, val: val });
        });
    }

    async function runSearch() {
        if (isRunning) return;
        isRunning = true;
        stopRequested = false;
        
        const target = parseInt(inputTarget.value);
        statusMsg.innerText = `Recherche de ${target}...`;
        statusMsg.className = 'text-sm font-mono text-blue-400 h-6 font-medium';
        
        // Reset styles and opacities
        items.forEach(item => {
            item.el.className = 'w-8 h-8 md:w-10 md:h-10 flex items-center justify-center border border-gray-600 rounded bg-gray-800 text-white font-mono text-sm md:text-base transition-all duration-300 relative';
            item.el.style.opacity = '1';
        });

        let left = 0;
        let right = items.length - 1;

        while (left <= right) {
            if (stopRequested) break;

            // Visual state: Gray out ignored parts
            items.forEach((item, idx) => {
                 if (idx < left || idx > right) {
                     item.el.style.opacity = '0.2';
                 } else {
                     item.el.style.opacity = '1';
                 }
                 // Reset highlights
                 item.el.classList.remove('bg-blue-600', 'border-blue-400', 'scale-110', 'z-10');
            });

            const mid = Math.floor((left + right) / 2);
            const midItem = items[mid];
            
            // Highlight Mid
            midItem.el.style.opacity = '1';
            midItem.el.classList.remove('bg-gray-800', 'border-gray-600');
            midItem.el.classList.add('bg-blue-600', 'border-blue-400', 'scale-110', 'z-10');
            
            statusMsg.innerHTML = `L=${left}, R=${right} -> <span class="text-blue-400">Mid=${mid} (${midItem.val})</span>`;
            
            await sleep(delay);

            if (midItem.val === target) {
                midItem.el.classList.remove('bg-blue-600', 'border-blue-400');
                midItem.el.classList.add('bg-green-600', 'border-green-400', 'scale-125');
                statusMsg.innerHTML = `Trouvé ! Index ${mid}`;
                statusMsg.className = 'text-sm font-mono text-green-400 h-6 font-bold';
                isRunning = false;
                return;
            } 
            
            if (midItem.val < target) {
                statusMsg.innerHTML += ` <span class="text-gray-400">(${midItem.val} < ${target} -> Aller à droite)</span>`;
                left = mid + 1;
            } else {
                statusMsg.innerHTML += ` <span class="text-gray-400">(${midItem.val} > ${target} -> Aller à gauche)</span>`;
                right = mid - 1;
            }
            
            await sleep(delay / 2);
        }
        
        if (!stopRequested) {
            statusMsg.innerText = `Non trouvé.`;
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
