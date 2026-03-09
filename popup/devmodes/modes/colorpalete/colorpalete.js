//  State 
let currentColors = [];
let savedPalettes = JSON.parse(localStorage.getItem('palettix_saved') || '[]');

//  Sample color sets to cycle through 
const MOCK_PALETTES = [
  ['#1A1A2E','#16213E','#0F3460','#E94560','#F5A623','#4ECDC4','#A8E6CF','#FF8B94'],
  ['#2D1B69','#11998E','#38EF7D','#FC466B','#3F5EFB','#FC466B','#F7971E','#FFD200'],
  ['#0F0C29','#302B63','#24243E','#F953C6','#B91D73','#833AB4','#FD1D1D','#FCB045'],
  ['#005C97','#363795','#1CB5E0','#000851','#4776E6','#8E54E9','#09C6F9','#045DE9'],
];
let mockIndex = 0;

//  Extract
document.getElementById('extractBtn').addEventListener('click', async () => {
  const btn = document.getElementById('extractBtn');
  btn.classList.add('loading');
  btn.querySelector('.btn-text').textContent = 'Extracting…';

  await delay(1400);

  const colors = MOCK_PALETTES[mockIndex % MOCK_PALETTES.length];
  mockIndex++;
  currentColors = colors;
  renderColors(colors);

  btn.classList.remove('loading');
  btn.querySelector('.btn-text').textContent = 'Re-extract';
});

function renderColors(colors) {
  const grid = document.getElementById('colorGrid');
  const result = document.getElementById('colorsResult');
  const saveBtn = document.getElementById('savePaletteBtn');

  result.style.display = 'block';
  document.getElementById('colorCount').textContent = `${colors.length} colors`;
  saveBtn.style.display = 'flex';
  saveBtn.classList.remove('saved');
  saveBtn.disabled = false;
  saveBtn.innerHTML = '<span>⬡</span> Save Palette';

  grid.innerHTML = '';
  colors.forEach((hex, i) => {
    const item = document.createElement('div');
    item.className = 'color-item';

    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = hex;

    const indicator = document.createElement('div');
    indicator.className = 'copy-indicator';
    indicator.textContent = '⎘';
    swatch.appendChild(indicator);

    swatch.addEventListener('click', () => copyColor(hex, swatch));

    const label = document.createElement('div');
    label.className = 'color-hex';
    label.textContent = hex;
    label.addEventListener('click', () => copyColor(hex, swatch));

    item.appendChild(swatch);
    item.appendChild(label);
    grid.appendChild(item);
  });
}

//  Save palette 
document.getElementById('savePaletteBtn').addEventListener('click', () => {
  if (!currentColors.length) return;
  const btn = document.getElementById('savePaletteBtn');

  const palette = {
    id: Date.now(),
    name: `Palette #${savedPalettes.length + 1}`,
    colors: [...currentColors],
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };

  savedPalettes.unshift(palette);
  persist();
  renderSaved();

  btn.classList.add('saved');
  btn.innerHTML = '<span>✓</span> Saved!';
  btn.disabled = true;
  showToast('Palette saved!');
});

//  Render saved 
function renderSaved() {
  const list = document.getElementById('savedList');
  document.getElementById('savedCount').textContent = savedPalettes.length;
  list.innerHTML = '';

  if (!savedPalettes.length) {
    list.innerHTML = `
      <div class="saved-empty">
        <div class="saved-empty-icon">🗂</div>
        <div class="saved-empty-text">No saved palettes yet.<br>Extract colors and hit "Save Palette".</div>
      </div>`;
    return;
  }

  savedPalettes.forEach((pal, idx) => {
    const card = document.createElement('div');
    card.className = 'palette-card';

    const topRow = document.createElement('div');
    topRow.className = 'palette-card-row';
    topRow.innerHTML = `
      <span class="palette-card-name">${pal.name}</span>
      <span class="palette-card-date">${pal.date}</span>`;

    const swatches = document.createElement('div');
    swatches.className = 'palette-swatches';
    pal.colors.forEach(hex => {
      const sw = document.createElement('div');
      sw.className = 'mini-swatch';
      sw.style.background = hex;
      sw.title = hex;
      sw.addEventListener('click', () => copyColor(hex, sw));
      swatches.appendChild(sw);
    });

    const actions = document.createElement('div');
    actions.className = 'palette-actions';


    const copyAllBtn = document.createElement('button');
    copyAllBtn.className = 'pal-action-btn';
    copyAllBtn.textContent = 'Copy All';
    copyAllBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(pal.colors.join(', ')).catch(() => {});
      showToast(`All colors of ${pal.name} copied!1`);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'pal-action-btn danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      savedPalettes = savedPalettes.filter(p => p.id !== pal.id);
      persist();
      renderSaved();
    });

    actions.appendChild(copyAllBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(topRow);
    card.appendChild(swatches);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

//  Tabs 
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
  if (tab === 'saved') renderSaved();
}

//  Copy 
function copyColor(hex, el) {
  navigator.clipboard.writeText(hex).catch(() => {});
  el.classList.add('copied');
  showToast(`${hex} copied!`);
  setTimeout(() => el.classList.remove('copied'), 900);
}

//  Helpers
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = `✓ ${msg}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function persist() {
  localStorage.setItem('palettix_saved', JSON.stringify(savedPalettes));
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

//  Init 
renderSaved();