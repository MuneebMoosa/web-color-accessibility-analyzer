// ─── popup.js ─────────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────────────────────
let currentColors = [];
let savedPalettes = JSON.parse(localStorage.getItem('palettix_saved') || '[]');

const MAX_COLORS   = 24;
const SCR_SIM_DIST = 40; // similarity threshold — screenshot internal dedup + CSS vs screenshot


// ─── Extract Button ───────────────────────────────────────────────────────────
document.getElementById('extractBtn').addEventListener('click', async () => {

  const btn = document.getElementById('extractBtn');
  btn.classList.add('loading');
  btn.querySelector('.btn-text').textContent = 'Extracting…';

  try {

    // ── Step 1: Get CSS colors ─────────────────────────────────────────────────
    // content.js returns frequency-sorted, exact-deduped, capped at 24.
    // All distinct shades preserved — no similarity removal within CSS.
    const cssColors = await extractCSSColors();

    // ── Step 2: CSS already at cap — skip screenshot entirely ─────────────────
    if (cssColors.length >= MAX_COLORS) {
      currentColors = cssColors;
      renderColors(currentColors);
      btn.querySelector('.btn-text').textContent = 'Re-extract';
      btn.classList.remove('loading');
      return;
    }

    // ── Step 3: Capture screenshots across up to 4 viewport positions ─────────
    const rawScreenColors = await captureAndExtract();

    // ── Step 4: Similarity-dedup screenshot colors among themselves ────────────
    // Pixel sampling is noisy — closely matched shades collapsed to one.
    // CSS is NOT similarity-deduped — all its shades are kept as-is.
    const screenColors = removeSimilar(rawScreenColors, SCR_SIM_DIST);

    // ── Step 5: Merge ──────────────────────────────────────────────────────────
    // CSS is the base. Fill remaining slots with screenshot colors that are
    // not similar to any CSS color. If CSS is empty, use screenshot only.
    const merged = mergeColorSources(cssColors, screenColors);

    currentColors = merged;
    renderColors(currentColors);

    btn.querySelector('.btn-text').textContent = 'Re-extract';

  } catch (err) {

    btn.querySelector('.btn-text').textContent = 'Extract Colors';
    showToast('Failed to extract. Try again.');
    console.error(err);

  }

  btn.classList.remove('loading');

});


// ─── Step 1: Extract CSS Colors via content script ────────────────────────────
function extractCSSColors() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "GET_CSS_COLORS" },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            resolve([]);
            return;
          }
          resolve(response);
        }
      );
    });
  });
}


// ─── Step 3: Scroll + Multi-Screenshot Capture ────────────────────────────────
async function captureAndExtract() {

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.tabs.sendMessage(tab.id, { type: "SCROLL_TOP" }).catch(() => {});
  await sleep(300);

  const allColors   = [];
  let   lastScrollY = -1;

  for (let i = 0; i < 4; i++) {

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      const colors  = await extractColorsFromImage(dataUrl);
      allColors.push(...colors);
    } catch (e) {
      // skip failed capture
    }

    // scroll and check if we actually moved — stop early if at page bottom
    const scrollResp = await chrome.tabs.sendMessage(
      tab.id, { type: "SCROLL_PAGE" }
    ).catch(() => null);

    await sleep(350);

    if (scrollResp && scrollResp.scrollY !== undefined) {
      if (scrollResp.scrollY === lastScrollY) break; // hit page bottom
      lastScrollY = scrollResp.scrollY;
    }

  }

  await chrome.tabs.sendMessage(tab.id, { type: "SCROLL_TOP" }).catch(() => {});

  return allColors;

}


// ─── Extract Colors From a Single Screenshot ──────────────────────────────────
function extractColorsFromImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas  = document.createElement('canvas');
      const ctx     = canvas.getContext('2d');
      const scale   = 0.5;
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(extractDominantColors(ctx.getImageData(0, 0, canvas.width, canvas.height)));
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}


// ─── Dominant Color Extraction from Pixels ────────────────────────────────────
function extractDominantColors(imageData) {

  const { data, width, height } = imageData;
  const colorMap = new Map();

  const step   = 4;  // sample every 4th pixel
  const bucket = 20; // quantise to reduce per-pixel noise

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {

      const i = (y * width + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];

      // skip transparent pixels
      if (a < 200) continue;

      // skip only true greys — no meaningful hue
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma < 12) continue;

      const rq  = Math.min(255, Math.round(r / bucket) * bucket);
      const gq  = Math.min(255, Math.round(g / bucket) * bucket);
      const bq  = Math.min(255, Math.round(b / bucket) * bucket);
      const hex = rgbToHex(rq, gq, bq);

      colorMap.set(hex, (colorMap.get(hex) || 0) + 1);

    }
  }

  // sort by frequency — most dominant first
  return Array
    .from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);

}


// ─── Step 5: Merge CSS + Screenshot ───────────────────────────────────────────
//
//  Case A  CSS === 24  → early return before this is called (Step 2)
//  Case B  CSS === 0   → screenshot only, already similarity-deduped, cap at 24
//  Case C  CSS is 1–23 → CSS is base; fill remaining slots with screenshot
//                        colors not similar to any CSS color
//
function mergeColorSources(cssColors, screenColors) {

  // Case B — no CSS at all
  if (cssColors.length === 0) {
    return screenColors.slice(0, MAX_COLORS);
  }

  // Case C — CSS is base, fill gaps from screenshot
  const final = [...cssColors];

  for (const sc of screenColors) {
    if (final.length >= MAX_COLORS) break;
    if (!isSimilarToAny(sc, final, SCR_SIM_DIST)) {
      final.push(sc);
    }
  }

  return final;

}


// ─── Similarity Dedup ─────────────────────────────────────────────────────────
// Used for screenshot internal dedup only — NOT for CSS.
function removeSimilar(colors, threshold) {
  const unique = [];
  for (const c of colors) {
    if (!isSimilarToAny(c, unique, threshold)) unique.push(c);
  }
  return unique;
}


// ─── Is hex within threshold distance of any color in palette? ────────────────
function isSimilarToAny(hex, palette, threshold) {
  return palette.some(c => colorDistance(hex, c) < threshold);
}


// ─── Euclidean RGB Distance ───────────────────────────────────────────────────
function colorDistance(c1, c2) {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
}


// ─── HEX ↔ RGB ────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}


// ─── Render Colors ────────────────────────────────────────────────────────────
function renderColors(colors) {

  const grid    = document.getElementById('colorGrid');
  const result  = document.getElementById('colorsResult');
  const saveBtn = document.getElementById('savePaletteBtn');
  const hero    = document.querySelector('.extract-hero');

  if (hero) hero.style.display = 'none';

  result.style.display = 'block';

  document.getElementById('colorCount').textContent = `${colors.length} colors`;

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


// ─── Save Palette ─────────────────────────────────────────────────────────────
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


// ─── Render Saved Palettes ────────────────────────────────────────────────────
function renderSaved() {

  const list = document.getElementById('savedList');

  document.getElementById('savedCount').textContent = savedPalettes.length;

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


// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(tab) {
  document.querySelectorAll('.tab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel')
    .forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${tab}`).classList.add('active');
  if (tab === 'saved') renderSaved();
}


// ─── Copy ─────────────────────────────────────────────────────────────────────
function copyColor(hex, el) {
  navigator.clipboard.writeText(hex).catch(() => {});
  if (el) {
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 900);
  }
  showToast(`${hex} copied!`);
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
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


// ─── Init ─────────────────────────────────────────────────────────────────────
renderSaved();