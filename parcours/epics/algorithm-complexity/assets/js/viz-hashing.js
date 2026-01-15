/**
 * Visualisation simple d'une Table de Hachage avec chaînage
 */
export function initHashViz(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth > 800 ? 800 : container.clientWidth;
    canvas.height = 350;
    container.appendChild(canvas);
    
    // UI Controls
    const controls = document.createElement('div');
    controls.className = 'absolute top-2 right-2 flex gap-2';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Entrez un mot...';
    input.className = 'w-32 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white';
    input.maxLength = 10;
    
    const btnAdd = document.createElement('button');
    btnAdd.textContent = 'Insérer';
    btnAdd.className = 'px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-500 font-bold';
    
    controls.appendChild(input);
    controls.appendChild(btnAdd);
    container.appendChild(controls);

    const ctx = canvas.getContext('2d');
    
    // Config
    const bucketCount = 7;
    const bucketWidth = 60;
    const bucketHeight = 40;
    const buckets = Array(bucketCount).fill().map(() => []);
    const bucketX = 100;
    const startY = 50;
    
    // Simple hash function for demo
    function getHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash += str.charCodeAt(i);
        }
        return hash % bucketCount;
    }
    
    // Animate state
    let animationState = null; // { text, hash, targetBucket, progress, phase: 'hash'|'move' }
    
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = '14px sans-serif';
        
        // Draw Buckets (Vertical List)
        for (let i = 0; i < bucketCount; i++) {
            const y = startY + i * (bucketHeight + 10);
            
            // Bucket Index
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'right';
            ctx.fillText(`Index ${i}`, bucketX - 10, y + bucketHeight/2 + 5);
            
            // Bucket Box
            ctx.strokeStyle = '#475569';
            ctx.strokeRect(bucketX, y, bucketWidth, bucketHeight);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(bucketX, y, bucketWidth, bucketHeight);
            
            // Items in bucket (Chaining)
            buckets[i].forEach((item, idx) => {
                const itemX = bucketX + bucketWidth + 20 + idx * 90;
                
                // Arrow
                ctx.beginPath();
                ctx.moveTo(itemX - 20, y + bucketHeight/2);
                ctx.lineTo(itemX, y + bucketHeight/2);
                ctx.strokeStyle = '#64748b';
                ctx.stroke();
                
                // Item Box
                ctx.fillStyle = '#334155';
                ctx.fillRect(itemX, y, 80, bucketHeight);
                ctx.strokeStyle = '#fbbf24';
                ctx.strokeRect(itemX, y, 80, bucketHeight);
                
                ctx.fillStyle = '#f1f5f9';
                ctx.textAlign = 'center';
                ctx.fillText(item, itemX + 40, y + bucketHeight/2 + 5);
            });
        }
        
        // Draw Animation
        if (animationState) {
            const { text, hash, phase, progress } = animationState;
            
            // Phase 1: Show Hashing
            if (phase === 'hash') {
                ctx.fillStyle = '#fff';
                ctx.font = '20px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`Hash("${text}") = ${hash}`, canvas.width/2, 30);
            }
            
            // Phase 2: Move to bucket
            if (phase === 'move') {
                 const targetY = startY + hash * (bucketHeight + 10);
                 const startX = canvas.width / 2;
                 const startYPos = 30;
                 
                 const currentX = startX + (bucketX + bucketWidth/2 - startX) * progress;
                 const currentY = startYPos + (targetY + bucketHeight/2 - startYPos) * progress;
                 
                 ctx.fillStyle = '#fbbf24';
                 ctx.fillRect(currentX - 40, currentY - 15, 80, 30);
                 ctx.fillStyle = '#000';
                 ctx.font = '14px bold sans-serif';
                 ctx.fillText(text, currentX, currentY + 5);
            }
        }
    }
    
    async function animateInsert(text) {
        const hash = getHash(text);
        
        // Phase 1: Calculate
        animationState = { text, hash, phase: 'hash', progress: 0 };
        for(let i=0; i<20; i++) {
            draw();
            await new Promise(r => setTimeout(r, 50));
        }
        
        // Phase 2: Move
        animationState.phase = 'move';
        for(let i=0; i<=20; i++) {
            animationState.progress = i/20;
            draw();
            await new Promise(r => setTimeout(r, 20));
        }
        
        buckets[hash].push(text);
        animationState = null;
        draw();
    }
    
    btnAdd.onclick = () => {
        const val = input.value.trim();
        if(val) {
            animateInsert(val);
            input.value = '';
        }
    };
    
    draw();
}
