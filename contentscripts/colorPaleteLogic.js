chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.type === "GET_CSS_COLORS") {

    const elements = document.querySelectorAll("*");
    const colors = new Set();

    elements.forEach(el => {

      const style = getComputedStyle(el);

      const props = [
        style.color,
        style.backgroundColor,
        style.borderColor,
        style.outlineColor,
        style.fill   && style.fill.startsWith("rgb")   ? style.fill   : null,
        style.stroke && style.stroke.startsWith("rgb") ? style.stroke : null,
      ];

      props.forEach(c => {

        if (!c) return;
        if (!c.startsWith("rgb")) return;

        const nums = c.match(/[\d.]+/g);
        if (!nums || nums.length < 3) return;

        const r = parseInt(nums[0]);
        const g = parseInt(nums[1]);
        const b = parseInt(nums[2]);

        const a = nums.length >= 4 ? parseFloat(nums[3]) : 1;
        if (a === 0) return;

        // skip near-white
        if (r > 240 && g > 240 && b > 240) return;

        // skip near-black
        if (r < 20 && g < 20 && b < 20) return;

        // skip grey/neutral — same filter as pixel extraction
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        if (chroma < 30) return;

        const hex = "#" + [r, g, b]
          .map(v => Math.min(255, v).toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();

        colors.add(hex);

      });

    });

    console.log('CSS colors extracted:', [...colors]); // remove after testing
    sendResponse([...colors]);
    return true;

  }

  if (request.type === "SCROLL_PAGE") {
    window.scrollBy({ top: window.innerHeight, behavior: "instant" });
    sendResponse(true);
    return true;
  }

  if (request.type === "SCROLL_TOP") {
    window.scrollTo({ top: 0, behavior: "instant" });
    sendResponse(true);
    return true;
  }

});