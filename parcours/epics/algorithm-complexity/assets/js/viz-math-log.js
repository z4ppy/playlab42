/**
 * Visualisation des Mathématiques (Logarithme)
 * Concept : "Paper Folding" ou "Halving"
 */
export function initMathLogViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    // Config
    let currentN = 100;
    let steps = 0;
    let history = [];

    // UI Structure
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full flex flex-col items-center gap-6';

    const controls = document.createElement('div');
    controls.className = 'flex gap-4 items-center mb-4';

    const label = document.createElement('span');
    label.innerText = 'Val (N):';

    const inputN = document.createElement('input');
    inputN.type = 'number';
    inputN.value = '128';
    inputN.className = 'bg-gray-700 text-white p-1 rounded w-20 text-center';
    inputN.min = '1';
    inputN.max = '1000000';

    const btnStart = document.createElement('button');
    btnStart.innerText = 'Démarrer';
    btnStart.className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm';

    const btnDivide = document.createElement('button');
    btnDivide.innerText = '÷ 2';
    btnDivide.className = 'px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed';
    btnDivide.disabled = true;

    controls.append(label, inputN, btnStart, btnDivide);

    // Visualization Area
    const vizArea = document.createElement('div');
    vizArea.className = 'w-full max-w-2xl bg-gray-800 rounded p-4 border border-gray-700 flex flex-col gap-2 min-h-[200px] relative transition-all';
    
    const infoPanel = document.createElement('div');
    infoPanel.className = 'text-center text-lg font-mono text-[var(--ac-accent-blue)] h-8';
    infoPanel.innerText = 'Prêt.';

    wrapper.append(controls, infoPanel, vizArea);
    container.appendChild(wrapper);

    // Logic
    function drawBar(val, maxVal) {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-4 animate-fade-in-up'; // Custom animation class if exists, or just transition
        row.style.animation = 'fadeIn 0.5s ease-out';
        
        const label = document.createElement('div');
        label.className = 'w-16 text-right font-mono text-xs text-gray-400';
        label.innerText = `Step ${steps}`;

        const barContainer = document.createElement('div');
        barContainer.className = 'flex-1 h-8 bg-gray-700 rounded overflow-hidden relative';

        const barWidth = (val / maxVal) * 100;
        const bar = document.createElement('div');
        bar.className = 'h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500';
        bar.style.width = `${Math.max(barWidth, 1)}%`; // Min 1% visibility

        // Text inside bar
        const text = document.createElement('span');
        text.className = 'absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow';
        text.innerText = Math.round(val);

        barContainer.appendChild(bar);
        barContainer.appendChild(text);
        row.append(label, barContainer);
        
        vizArea.insertBefore(row, vizArea.firstChild); // Newest on top
        
        // Limit history
        if(vizArea.children.length > 6) {
             vizArea.lastChild.remove();
        }
    }

    btnStart.onclick = () => {
        vizArea.innerHTML = ''; // clear
        steps = 0;
        currentN = parseInt(inputN.value) || 100;
        history = [currentN];
        infoPanel.innerHTML = `N = ${currentN}`;
        
        drawBar(currentN, currentN);
        
        btnDivide.disabled = false;
        inputN.disabled = true;
        btnStart.disabled = true;
    };

    btnDivide.onclick = () => {
        if(currentN <= 1) return;

        steps++;
        currentN = currentN / 2;
        
        drawBar(currentN, parseInt(inputN.value));
        
        if (currentN <= 1) {
             infoPanel.innerHTML = `<span class="text-green-400">Terminé en ${steps} étapes !</span> (log₂ ${inputN.value} ≈ ${steps})`;
             btnDivide.disabled = true;
             inputN.disabled = false;
             btnStart.disabled = false;
             btnStart.innerText = "Recommencer";
        } else {
             infoPanel.innerHTML = `${currentN * 2} ÷ 2 = ${Math.round(currentN * 100)/100}`;
        }
    };
}
