/**
 * Visualisation B-Tree (Simplifiée en BST pour la démo visuelle de base)
 * Les vrais B-Trees sont trop larges pour être lisibles sur petit écran.
 * On simule la logique de recherche logarithmique.
 */
export function initBSTViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = 300; 
    container.appendChild(canvas);
    
    // UI Controls
    const controls = document.createElement('div');
    controls.className = 'absolute top-2 right-2 flex gap-2';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.placeholder = 'Valeur (0-100)';
    input.className = 'w-24 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white';
    
    const btnSearch = document.createElement('button');
    btnSearch.textContent = 'Rechercher';
    btnSearch.className = 'px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500';
    
    controls.appendChild(input);
    controls.appendChild(btnSearch);
    container.appendChild(controls);

    const ctx = canvas.getContext('2d');
    
    // Tree Structure
    const tree = {
        val: 50, x: canvas.width/2, y: 40,
        left: {
            val: 25, x: canvas.width/2 - 100, y: 90,
            left: { val: 12, x: canvas.width/2 - 150, y: 140 },
            right: { val: 37, x: canvas.width/2 - 50, y: 140 }
        },
        right: {
            val: 75, x: canvas.width/2 + 100, y: 90,
            left: { val: 62, x: canvas.width/2 + 50, y: 140 },
            right: { val: 87, x: canvas.width/2 + 150, y: 140 }
        }
    };
    
    // Flatten for easy drawing logic, or dynamic? Dynamic is better
    // But fixed structure is cleaner for "Concept" demo.
    
    function drawNode(node, highlight = false, active = false) {
        if (!node) return;
        
        ctx.beginPath();
        ctx.fillStyle = active ? '#10b981' : (highlight ? '#f59e0b' : '#1e293b');
        ctx.strokeStyle = active ? '#34d399' : '#475569';
        ctx.lineWidth = highlight ? 3 : 1;
        ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = active ? '#ffffff' : (highlight ? '#ffffff' : '#94a3b8');
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.val, node.x, node.y);
        
        // Links
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.globalCompositeOperation = 'destination-over';
        if (node.left) {
             ctx.beginPath(); ctx.moveTo(node.x, node.y + 18); ctx.lineTo(node.left.x, node.left.y - 18); ctx.stroke();
             drawNode(node.left, highlight, false); // recursive call essentially re-draws, be careful...
             // Wait, standard recursion for drawing is better
        }
        if (node.right) {
             ctx.beginPath(); ctx.moveTo(node.x, node.y + 18); ctx.lineTo(node.right.x, node.right.y - 18); ctx.stroke();
             drawNode(node.right, highlight, false);
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawTree(activeNodeVals = []) {
         ctx.clearRect(0,0, canvas.width, canvas.height);
         const traverse = (node) => {
             if(!node) return;
             const isActive = activeNodeVals.includes(node.val);
             const isPath = activeNodeVals.indexOf(node.val) !== -1 && activeNodeVals.indexOf(node.val) < activeNodeVals.length - 1; // Highlight path
             
             // Draw links first
             ctx.strokeStyle = '#334155';
             ctx.lineWidth = 2;
             if(node.left) {
                 ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(node.left.x, node.left.y); ctx.stroke();
                 traverse(node.left);
             }
             if(node.right) {
                 ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(node.right.x, node.right.y); ctx.stroke();
                 traverse(node.right);
             }
             
             // Draw Node
             ctx.beginPath();
             ctx.fillStyle = isActive ? '#10b981' : '#1e293b'; 
             // If this is the LAST active node, it's the current one being checked (Yellow?), if Found (Green)
             // Let's simplify: Path is yellow, Found is Green.
             const lastActive = activeNodeVals[activeNodeVals.length-1];
             if(isActive) {
                 if(node.val === lastActive) ctx.fillStyle = '#f59e0b'; // Current processing
                 if(node.val === lastActive && activeNodeVals.found) ctx.fillStyle = '#10b981'; // Found!
             }
             
             ctx.strokeStyle = isActive ? '#fbbf24' : '#475569';
             ctx.lineWidth = 2;
             ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
             ctx.fill();
             ctx.stroke();
             
             ctx.fillStyle = '#f1f5f9';
             ctx.font = '14px monospace';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText(node.val, node.x, node.y);
         };
         traverse(tree);
    }
    
    async function search(target) {
        let path = [];
        let curr = tree;
        
        while(curr) {
            path.push(curr.val);
            drawTree(path);
            await new Promise(r => setTimeout(r, 600));
            
            if(curr.val === target) {
                path.found = true;
                drawTree(path);
                return;
            }
            
            if(target < curr.val) curr = curr.left;
            else curr = curr.right;
        }
        
        // Not found
        drawTree(path); // Last state
    }
    
    // Initial draw
    drawTree();
    
    btnSearch.onclick = () => {
        const val = parseInt(input.value);
        if(!isNaN(val)) search(val);
    };
}
