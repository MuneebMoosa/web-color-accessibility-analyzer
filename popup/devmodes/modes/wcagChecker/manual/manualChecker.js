function isValidHex(h) { return /^#[0-9A-Fa-f]{6}$/.test(h); }

function getRGB(hex) {
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
    const bg = document.getElementById('bg-hex').value.trim();
    const fg = document.getElementById('fg-hex').value.trim();
    if (!isValidHex(bg) || !isValidHex(fg)) return;

    document.documentElement.style.setProperty('--bg', bg);
    document.documentElement.style.setProperty('--fg', fg);

    document.getElementById('bg-picker').value = bg;
    document.getElementById('fg-picker').value = fg;
    document.getElementById('bg-swatch').style.background = bg;
    document.getElementById('fg-swatch').style.background = fg;

    const l1 = getLuminance(bg);
    const l2 = getLuminance(fg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    document.getElementById('ratio-value').textContent = ratio.toFixed(2) + ':1';

    const set = (id, pass) => {
        document.getElementById(id).querySelector('b').textContent = pass ? 'Pass ✔' : 'Fail ✖';
    };
    set('aa-large',   ratio >= 3);
    set('aaa-large',  ratio >= 4.5);
    set('aa-normal',  ratio >= 4.5);
    set('aaa-normal', ratio >= 7);
}

function syncPicker(hexId, pickerId) {
    const hex = document.getElementById(hexId).value.trim();
    if (isValidHex(hex)) document.getElementById(pickerId).value = hex;
}

function syncHex(pickerId, hexId) {
    document.getElementById(hexId).value = document.getElementById(pickerId).value;
    updateUI();
}

function copyHex(inputId, btn) {
    const val = document.getElementById(inputId).value.trim();
    navigator.clipboard.writeText(val).then(() => {
        btn.classList.add('did-copy');
        setTimeout(() => btn.classList.remove('did-copy'), 1500);
    });
}

document.getElementById('bg-hex').addEventListener('input', () => { syncPicker('bg-hex', 'bg-picker'); updateUI(); });
document.getElementById('fg-hex').addEventListener('input', () => { syncPicker('fg-hex', 'fg-picker'); updateUI(); });
document.getElementById('bg-picker').addEventListener('input', () => syncHex('bg-picker', 'bg-hex'));
document.getElementById('fg-picker').addEventListener('input', () => syncHex('fg-picker', 'fg-hex'));

document.getElementById('close-btn').addEventListener('click', () => {
    window.close();
});

window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const bg = params.get('bg');
    const fg = params.get('fg');
    if (bg && fg) {
        document.getElementById('bg-hex').value = bg;
        document.getElementById('fg-hex').value = fg;
    }
    updateUI();
});