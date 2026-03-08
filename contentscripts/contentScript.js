const FILTER_ID     = 'cb-filter-svg';   // SVG container id
const ROOT_ATTR     = 'data-cb-mode';    

const FILTERS = {

  protanopia: {
    id: 'cb-protanopia',
    // L-cone (red) weak
    // Aggressive: red channel fully redirected to green channel
    // so protanopia patient sees strong distinction
    matrix: `0.0  1.0  0.0  0  0
             0.0  1.0  0.0  0  0
             0.0  0.0  1.0  0  0
             0.0  0.0  0.0  1  0`
  },

  deuteranopia: {
    id: 'cb-deuteranopia',
    // M-cone (green) weak
    // Aggressive: green channel redistributed into red & blue
    matrix: `1.0  0.0  0.0  0  0
             0.5  0.0  0.5  0  0
             0.0  0.0  1.0  0  0
             0.0  0.0  0.0  1  0`
  },

  tritanopia: {
    id: 'cb-tritanopia',
    // S-cone (blue) weak
    // Aggressive: blue channel pushed into green channel
    matrix: `1.0  0.0  0.0  0  0
             0.0  1.0  0.0  0  0
             0.0  0.7  0.3  0  0
             0.0  0.0  0.0  1  0`
  },

  universal: {
    id: 'cb-universal',
    // Luminance based universal matrix
    // Converts to perceptual luminance values
    // Maximises contrast for ALL deficiency types simultaneously
    matrix: `0.299  0.587  0.114  0  0
             0.299  0.587  0.114  0  0
             0.299  0.587  0.114  0  0
             0.000  0.000  0.000  1  0`
  }

};



// injectSVG()
// Injects the hidden SVG with all 4 filter definitions
// into <body> once. Safe to call multiple times.
// ─────────────────────────────────────────────────────────────
function injectSVG() {
  if (document.getElementById(FILTER_ID)) return; // already injected

  const filterDefs = Object.values(FILTERS).map(f => `
    <filter id="${f.id}" x="0%" y="0%" width="100%" height="100%"
            color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="${f.matrix}" />
    </filter>
  `).join('');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', FILTER_ID);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs>${filterDefs}</defs>`;

  document.body.insertBefore(svg, document.body.firstChild);
}



// apply mode
function runMode(mode) {
  const filter = FILTERS[mode];
  if (!filter) return;

  // Inject SVG filters if not already present
  if (document.body) {
    injectSVG();
  } else {
    // body not ready yet - wait for it
    document.addEventListener('DOMContentLoaded', injectSVG);
  }

  // Apply filter to root — auto covers all dynamic content too
  document.documentElement.style.filter = `url(#${filter.id})`;
  document.documentElement.setAttribute(ROOT_ATTR, mode);
}

// Reset Mode
function resetMode() {
  const root = document.documentElement;

  // Only remove our filter, don't touch any other filters
  if (root.style.filter && root.style.filter.includes('cb-')) {
    root.style.filter = '';
    root.removeAttribute(ROOT_ATTR);
  }
}


// run on content script load
chrome.storage.local.get(["userModeEnabled", "selectedMode"], (data) => {
  if (data.userModeEnabled && data.selectedMode) {
    runMode(data.selectedMode);
  }
});

// Listen For Storage Changes and if any mode change it will run
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") { 
    if (changes.userModeEnabled && changes.userModeEnabled.newValue === false) {
      resetMode();
      return;
    }
     if (changes.selectedMode && changes.selectedMode.newValue) {
      runMode(changes.selectedMode.newValue);
    }
  }
});

// Listen For Messages in the tab if any mode changes message come it will run 
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "applyMode") {
    runMode(request.mode);
  }
  if (request.action === "disableMode") {
    resetMode();
  }
});
