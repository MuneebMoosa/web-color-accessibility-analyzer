// ─── content.js ───────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // ── GET_CSS_COLORS ────────────────────────────────────────────────────────────
  if (request.type === "GET_CSS_COLORS") {

    const elements = document.querySelectorAll("*");
    const freqMap  = new Map();

    elements.forEach(el => {

      const style = getComputedStyle(el);

      const props = [
        style.color,
        style.backgroundColor,
        style.borderTopColor,
        style.borderBottomColor,
        style.borderLeftColor,
        style.borderRightColor,
        style.outlineColor,
        style.fill            && style.fill.startsWith("rgb")   ? style.fill   : null,
        style.stroke          && style.stroke.startsWith("rgb") ? style.stroke : null,
        style.caretColor,
        style.textDecorationColor,
        style.columnRuleColor,
      ];

      props.forEach(c => {

        if (!c) return;
        if (!c.startsWith("rgb")) return;

        const nums = c.match(/[\d.]+/g);
        if (!nums || nums.length < 3) return;

        const r = parseInt(nums[0]);
        const g = parseInt(nums[1]);
        const b = parseInt(nums[2]);

        // skip fully / nearly transparent
        const a = nums.length >= 4 ? parseFloat(nums[3]) : 1;
        if (a < 0.15) return;

        // skip only true greys — no hue at all
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        if (chroma < 12) return;

        const hex = cssRgbToHex(r, g, b);
        freqMap.set(hex, (freqMap.get(hex) || 0) + 1);

      });

    });

    // sort by frequency (most dominant first)
    // EXACT dedup only — all distinct shades preserved as designer intended
    const cssColors = Array
      .from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([hex]) => hex)
      .slice(0, 24);

    sendResponse(cssColors);
    return true;

  }

  // ── SCROLL_PAGE ───────────────────────────────────────────────────────────────
  if (request.type === "SCROLL_PAGE") {
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: "instant" });
    sendResponse({ scrollY: window.scrollY, pageHeight: document.body.scrollHeight });
    return true;
  }

  // ── SCROLL_TOP ────────────────────────────────────────────────────────────────
  if (request.type === "SCROLL_TOP") {
    window.scrollTo({ top: 0, behavior: "instant" });
    sendResponse(true);
    return true;
  }

});


// ─── Helpers ──────────────────────────────────────────────────────────────────

function cssRgbToHex(r, g, b) {
  return "#" + [r, g, b]
    .map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}