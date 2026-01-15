/**
 * Visualisation Recherche Binaire
 */
export function initBinarySearchViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col items-center justify-center w-full h-full gap-4 relative';
    container.appendChild(wrapper);

    // Array viz
    const arrayContainer = document.createElement('div');
    arrayContainer.className = 'flex gap-1';
    
    const n = 15;
    const values = Array.from({length: n}, (_, i) => i * 3 + 2).sort((a,b) => a-b);
    let cells = [];

    values.forEach(val => {
        const cell = document.createElement('div');
        cell.className = 'w-8 h-8 md:w-10 md:h-10 border border-gray-600 flex items-center justify-center text-xs md:text-sm font-mono rounded transition-colors duration-300';
        cell.textContent = val;
        arrayContainer.appendChild(cell);
        cells.push(cell);
    });
    wrapper.appendChild(arrayContainer);

    const status = document.createElement('div');
    status.className = 'text-sm text-gray-400 h-6';
    wrapper.appendChild(status);

    const controls = document.createElement('div');
    controls.className = 'flex gap-2';
    
    async function search(target) {
        // Reset styles
        cells.forEach(c => {
            c.style.backgroundColor = 'transparent';
            c.style.opacity = '1';
        });

        let left = 0;
        let right = n - 1;

        while (left <= right) {
            // Dim out-of-bounds
            cells.forEach((c, i) => {
                if (i < left || i > right) c.style.opacity = '0.3';
                else c.style.opacity = '1';
            });

            const mid = Math.floor((left + right) / 2);
            cells[mid].style.backgroundColor = '#f59e0b'; // check
            status.textContent = `Vérification index ${mid} (valeur ${values[mid]})`;
            
            await new Promise(r => setTimeout(r, 800));

            if (values[mid] === target) {
                cells[mid].style.backgroundColor = '#10b981'; // found
                status.textContent = `Trouvé ${target} à l'index ${mid} !`;
                return;
            }

            if (values[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        status.textContent = `${target} non trouvé.`;
    }

    const btn = document.createElement('button');
    btn.textContent = 'Chercher 26';
    btn.className = 'px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500';
    btn.onclick = () => search(26);

    const btn2 = document.createElement('button');
    btn2.textContent = 'Chercher 8';
    btn2.className = 'px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600';
    btn2.onclick = () => search(8);

    controls.appendChild(btn);
    controls.appendChild(btn2);
    wrapper.appendChild(controls);
}
