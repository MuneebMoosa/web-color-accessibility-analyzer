// ─── State ───────────────────────────────────────────────────────────────
let currentColors = [];
let savedPalettes = JSON.parse(localStorage.getItem('palettix_saved') || '[]');


// ─── Extract Button ──────────────────────────────────────────────────────
document.getElementById('extractBtn').addEventListener('click', async () => {

  const btn = document.getElementById('extractBtn');
  btn.classList.add('loading');
  btn.querySelector('.btn-text').textContent = 'Extracting…';

  try {

    // Step 1 — Extract CSS colors (exact, highest priority)
    const cssColorsRaw = await extractCSSColors();

    // Step 2 — Deduplicate CSS colors (same existing distance < 40)
    const cssColors = removeDuplicateColors(cssColorsRaw);

    // Step 3 — Extract screenshot pixel colors across 4 viewports
    const screenColors = await captureAndExtract();

    // Step 4 — Merge: CSS first, screenshot fills gaps, final dedup, fallback
    const colors = mergeColorSources(cssColors, screenColors);

    currentColors = colors;
    renderColors(colors);

    btn.querySelector('.btn-text').textContent = 'Re-extract';

  } catch (err) {

    btn.querySelector('.btn-text').textContent = 'Extract Colors';
    showToast('Failed to extract. Try again.');
    console.error(err);

  }

  btn.classList.remove('loading');

});


// ─── Step 1: Extract CSS Colors via content script ───────────────────────
function extractCSSColors() {

  return new Promise((resolve) => {

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "GET_CSS_COLORS" },
        (response) => {

          if (chrome.runtime.lastError) {
            resolve([]);
            return;
          }

          resolve(response || []);

        }
      );

    });

  });

}


// ─── Step 3: Scroll + Multi-Screenshot Extraction ────────────────────────
async function captureAndExtract() {

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // scroll to top first
  await chrome.tabs.sendMessage(tab.id, { type: "SCROLL_TOP" }).catch(() => {});
  await sleep(300);

  let allColors = [];

  // capture 4 viewport positions down the page
  for (let i = 0; i < 4; i++) {

    try {

      const dataUrl = await chrome.tabs.captureVisibleTab(
        tab.windowId,
        { format: 'png' }
      );

      const colors = await extractColorsFromImage(dataUrl);
      allColors.push(...colors);

    } catch (e) {
      // skip failed capture
    }

    await chrome.tabs.sendMessage(tab.id, { type: "SCROLL_PAGE" }).catch(() => {});
    await sleep(350);

  }

  // scroll back to top
  await chrome.tabs.sendMessage(tab.id, { type: "SCROLL_TOP" }).catch(() => {});

  return removeDuplicateColors(allColors);

}


// ─── Extract Colors From a Single Screenshot ──────────────────────────────
function extractColorsFromImage(dataUrl) {

  return new Promise((resolve) => {

    const img = new Image();

    img.onload = () => {

      const canvas = document.createElement('canvas');
      const ctx    = canvas.getContext('2d');

      const scale = 0.5;

      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      resolve(extractDominantColors(imageData));

    };

    img.onerror = () => resolve([]);
    img.src = dataUrl;

  });

}


// ─── Dominant Color Extraction from Pixels ───────────────────────────────
function extractDominantColors(imageData) {

  const data   = imageData.data;
  const width  = imageData.width;
  const height = imageData.height;

  const colorMap = new Map();

  const step   = 4;
  const bucket = 16;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {

      const index = (y * width + x) * 4;

      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      if (a < 200) continue;

      // same filters as CSS extraction — no change
      if (r > 240 && g > 240 && b > 240) continue; // near-white
      if (r < 20  && g < 20  && b < 20)  continue; // near-black

      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma < 30) continue; // grey/neutral

      const rr = Math.round(r / bucket) * bucket;
      const gg = Math.round(g / bucket) * bucket;
      const bb = Math.round(b / bucket) * bucket;

      const hex = rgbToHex(
        Math.min(255, rr),
        Math.min(255, gg),
        Math.min(255, bb)
      );

      colorMap.set(hex, (colorMap.get(hex) || 0) + 1);

    }
  }

  // sort by frequency — most dominant first
  const sorted = Array.from(colorMap.entries()).sort((a, b) => b[1] - a[1]);

  const finalColors = [];

  for (const [hex] of sorted) {
    if (!isSimilarColor(hex, finalColors)) {
      finalColors.push(hex);
    }
  }

  return finalColors;

}


// ─── Step 2: Remove Duplicate Colors ────────────────────────────────────
function removeDuplicateColors(colors) {

  const unique = [];

  for (const c of colors) {
    if (!isSimilarColor(c, unique)) unique.push(c);
  }

  return unique;

}


// ─── Step 4: Merge CSS + Screenshot ──────────────────────────────────────
function mergeColorSources(cssColors, screenColors) {

  // CSS colors go first — they are exact, highest priority
  const final = [...cssColors];

  // add screenshot colors only if not similar to anything already in final
  for (const sc of screenColors) {
    if (!isSimilarColor(sc, final)) {
      final.push(sc);
    }
  }

  // final dedup pass — catches anything that slipped through merge
  const deduped = removeDuplicateColors(final);

  // fallback — if CSS gave nothing useful, use screenshot alone
  if (deduped.length < 4 && screenColors.length > 0) {
    return removeDuplicateColors(screenColors).slice(0, 24);
  }

  // cap at 24
  return deduped.slice(0, 24);

}


// ─── Color Similarity Check ──────────────────────────────────────────────
function isSimilarColor(hex, palette) {

  for (const c of palette) {
    if (colorDistance(hex, c) < 40) return true;
  }

  return false;

}


// ─── Color Distance (Euclidean RGB) ─────────────────────────────────────
function colorDistance(c1, c2) {

  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);

  return Math.sqrt(
    (r1 - r2) ** 2 +
    (g1 - g2) ** 2 +
    (b1 - b2) ** 2
  );

}


// ─── HEX → RGB ───────────────────────────────────────────────────────────
function hexToRgb(hex) {

  hex = hex.replace('#', '');

  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];

}


// ─── RGB → HEX ───────────────────────────────────────────────────────────
function rgbToHex(r, g, b) {

  return '#' + [r, g, b]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

}


// ─── Render Colors ────────────────────────────────────────────────────────
function renderColors(colors) {

  const grid    = document.getElementById('colorGrid');
  const result  = document.getElementById('colorsResult');
  const saveBtn = document.getElementById('savePaletteBtn');
  const hero    = document.querySelector('.extract-hero');

  if (hero) hero.style.display = 'none';

  result.style.display = 'block';

  document.getElementById('colorCount')
    .textContent = `${colors.length} colors`;

  saveBtn.style.display = 'flex';
  saveBtn.classList.remove('saved');
  saveBtn.disabled = false;
  saveBtn.innerHTML = '<span>⬡</span> Save Palette';

  grid.innerHTML = '';

  colors.forEach(hex => {

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


// ─── Save Palette ─────────────────────────────────────────────────────────
document.getElementById('savePaletteBtn').addEventListener('click', () => {

  if (!currentColors.length) return;

  const btn = document.getElementById('savePaletteBtn');

  const palette = {
    id:     Date.now(),
    name:   `Palette #${savedPalettes.length + 1}`,
    colors: [...currentColors],
    date:   new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };

  savedPalettes.unshift(palette);
  persist();
  renderSaved();

  btn.classList.add('saved');
  btn.innerHTML = '<span>✓</span> Saved!';
  btn.disabled = true;

  showToast('Palette saved!');

});


// ─── Render Saved Palettes ────────────────────────────────────────────────
function renderSaved() {

  const list = document.getElementById('savedList');

  document.getElementById('savedCount')
    .textContent = savedPalettes.length;

  list.innerHTML = '';

  if (!savedPalettes.length) {
    list.innerHTML = `
      <div class="saved-empty">
        <div class="saved-empty-icon">🗂</div>
        <div class="saved-empty-text">
          No saved palettes yet.<br>
          Extract colors and hit "Save Palette".
        </div>
      </div>`;
    return;
  }

  savedPalettes.forEach(pal => {

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
      showToast(`All colors of ${pal.name} copied!`);
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


// ─── Tabs ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {

  document.querySelectorAll('.tab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  document.querySelectorAll('.panel')
    .forEach(p => p.classList.remove('active'));

  document.getElementById(`panel-${tab}`)
    .classList.add('active');

  if (tab === 'saved') renderSaved();

}


// ─── Copy ─────────────────────────────────────────────────────────────────
function copyColor(hex, el) {

  navigator.clipboard.writeText(hex).catch(() => {});

  if (el) {
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 900);
  }

  showToast(`${hex} copied!`);

}


// ─── Helpers ──────────────────────────────────────────────────────────────
function showToast(msg) {

  const t = document.getElementById('toast');
  t.textContent = `✓ ${msg}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);

}

function persist() {
  localStorage.setItem('palettix_saved', JSON.stringify(savedPalettes));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}


// ─── Init ─────────────────────────────────────────────────────────────────
renderSaved();