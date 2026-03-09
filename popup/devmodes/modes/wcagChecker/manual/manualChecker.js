window.addEventListener('DOMContentLoaded', () => {
    // 1. Get the color parameters from the URL
    const params = new URLSearchParams(window.location.search);
    const bg = params.get('bg');
    const fg = params.get('fg');

    // 2. If colors were sent, update the inputs and the UI
    if (bg && fg) {
        document.getElementById('bg-hex').value = bg;
        document.getElementById('fg-hex').value = fg;
        
        // This calls your existing function to update the yellow UI
        updateUI(); 
    }
});function getRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const fix = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return [fix(r), fix(g), fix(b)];
}

function getLuminance(hex) {
    const [r, g, b] = getRGB(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function updateUI() {
    const bg = document.getElementById('bg-hex').value;
    const fg = document.getElementById('fg-hex').value;
    
    // Update visual colors
    document.body.style.backgroundColor = bg;
    document.body.style.color = fg;
    
    const l1 = getLuminance(bg);
    const l2 = getLuminance(fg);
    
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    document.getElementById('ratio-value').innerText = ratio.toFixed(2);

    // Update Badges
    document.getElementById('aa-normal').className = ratio >= 4.5 ? 'badge' : 'badge fail';
    document.getElementById('aaa-normal').className = ratio >= 7 ? 'badge' : 'badge fail';
    document.getElementById('aa-large').className = ratio >= 3 ? 'badge' : 'badge fail';
    document.getElementById('aaa-large').className = ratio >= 4.5 ? 'badge' : 'badge fail';
}

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', updateUI);
});
// Run once on load
updateUI();
