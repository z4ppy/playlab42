/**
 * Visualisation Recherche Séquentielle (Linéaire)
 */
export function initLinearSearchViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    // UI Setup
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col items-center gap-4 w-full';
    
    // Controls: Array Size, Target, Run
    const controls = document.createElement('div');
    controls.className = 'flex gap-4 items-center mb-2';
    
    const label = document.createElement('span');
    label.innerText = 'Cible :';
    
    const inputTarget = document.createElement('input');
    inputTarget.type = 'number';
    inputTarget.value = '42';
    inputTarget.className = 'bg-gray-700 text-white p-1 rounded w-16 text-center';
    
    const btnRun = document.createElement('button');
    btnRun.innerText = 'Lancer Recherche';
    btnRun.className = 'px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-bold text-sm';
    
    const statusMsg = document.createElement('div');
    statusMsg.className = 'text-sm font-mono ac-text-secondary h-6';
    statusMsg.id = 'linear-status';
    
    controls.append(label, inputTarget, btnRun);
    
    // Visualization Area
    const boxContainer = document.createElement('div');
    boxContainer.className = 'flex flex-wrap gap-2 justify-center w-full max-w-lg';
    
    let items = [];
    const COUNT = 15;
    
    // Init random array
    function initArray() {
        boxContainer.innerHTML = '';
        items = [];
        for(let i=0; i<COUNT; i++) {
            const val = Math.floor(Math.random() * 100);
            const box = document.createElement('div');
            box.className = 'w-10 h-10 flex items-center justify-center border border-gray-600 rounded bg-gray-800 text-white font-mono transition-colors duration-200';
            box.innerText = val;
            box.id = `lin-box-${i}`;
            boxContainer.appendChild(box);
            items.push(val);
        }
        // Ensure strictly one visual target sometimes? No, let randomness decide or force it?
        // Let's force target into a random pos for demo purposes if not present?
        // Nah, randomness is fine, search can fail.
    }
    
    initArray();
    wrapper.append(controls, statusMsg, boxContainer);
    container.appendChild(wrapper);
    
    let isRunning = false;
    let shouldStop = false;
    
    async function runSearch() {
        if (isRunning) {
             shouldStop = true;
             await new Promise(r => setTimeout(r, 100)); // drain
             shouldStop = false;
             initArray(); // Reset array for fresh feel
        }
        
        isRunning = true;
        const target = parseInt(inputTarget.value);
        const boxes = boxContainer.querySelectorAll('div'); // Reset styles
        boxes.forEach(b => b.className = 'w-10 h-10 flex items-center justify-center border border-gray-600 rounded bg-gray-800 text-white font-mono transition-colors duration-200');
        
        document.getElementById('linear-status').innerText = `Recherche de ${target}...`;
        
        for(let i=0; i<COUNT; i++) {
            if (shouldStop) { isRunning = false; return; }
            
            const box = document.getElementById(`lin-box-${i}`);
            const val = parseInt(box.innerText);
            
            // Highlight checking
            box.classList.remove('bg-gray-800');
            box.classList.add('bg-yellow-600');
            
            await new Promise(r => setTimeout(r, 300));
            
            if (val === target) {
                box.classList.remove('bg-yellow-600');
                box.classList.add('bg-green-600', 'scale-110', 'ring-2', 'ring-green-400');
                document.getElementById('linear-status').innerHTML = `Trouvé à l'index <span class="text-green-400 font-bold">${i}</span> !`;
                isRunning = false;
                return;
            } else {
                // Mark as visited/checked
                box.classList.remove('bg-yellow-600');
                box.classList.add('bg-gray-600', 'opacity-50');
            }
        }
        
        document.getElementById('linear-status').innerHTML = '<span class="text-red-400">Non trouvé.</span> O(n) parcouru complet.';
        isRunning = false;
    }
    
    btnRun.onclick = runSearch;
}
