console.log("WCAG content script loaded");

let scannedElements = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.type === "RUN_WCAG_SCAN") {
        const results = runScan();
        sendResponse(results);

        return true;
    }

    if (request.type === "HIGHLIGHT_ELEMENT") {

        scannedElements.forEach(el => el.style.outline = "");

        const el = scannedElements[request.index];
        if (!el) return;

        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "3px solid red";
    }
});

/* ================= MAIN SCAN ================= */

function runScan() {

    scannedElements = [];
    const unique = new Map();

    scanNormal(unique);
    scanHoverRules(unique);

    const results = Array.from(unique.values());

    const summary = {
        totalCombinations: results.length,
        passAA: results.filter(r => r.passAA).length,
        failAA: results.filter(r => !r.passAA).length,
        passAAA: results.filter(r => r.passAAA).length
    };

    return { summary, results };
}

/* ================= NORMAL SCAN ================= */

function scanNormal(unique) {

    const elements = Array.from(document.querySelectorAll("body *"));

    elements.forEach(el => {

        const style = getComputedStyle(el);

        if (
            el.textContent.trim().length === 0 ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            parseFloat(style.opacity) === 0
        ) return;

        const fg = parseColor(style.color);
        if (!fg) return;

        const bgData = resolveBackground(el);
        if (!bgData) return;

        const worstRatio = calculateWorstContrast(fg, bgData.colors);

        const fontSize = parseFloat(style.fontSize);
        const fontWeight = parseInt(style.fontWeight);

        const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
        const passAA = isLarge ? worstRatio >= 3 : worstRatio >= 4.5;
        const passAAA = isLarge ? worstRatio >= 4.5 : worstRatio >= 7;

        scannedElements.push(el);
        const elementIndex = scannedElements.length - 1;

        const key = `${rgbToHex(fg)}-${bgData.key}-normal`;

        if (!unique.has(key)) {
            unique.set(key, {
                index: elementIndex,
                state: "normal",
                tag: el.tagName.toLowerCase(),
                text: el.textContent.trim().slice(0, 60),
                foreground: rgbToHex(fg),
                background: bgData.label,
                ratio: Number(worstRatio.toFixed(2)),
                passAA,
                passAAA
            });
        }
    });
}

/* ================= HOVER RULE SCAN ================= */

function scanHoverRules(unique) {

    for (const sheet of document.styleSheets) {

        let rules;
        try { rules = sheet.cssRules; }
        catch { continue; }

        if (!rules) continue;

        for (const rule of rules) {

            if (!rule.selectorText || !rule.selectorText.includes(":hover")) continue;

            const baseSelector = rule.selectorText.replace(/:hover/g, "");

            let elements;
            try { elements = document.querySelectorAll(baseSelector); }
            catch { continue; }

            elements.forEach(el => {

                const fg =
                    parseColor(rule.style.color) ||
                    parseColor(getComputedStyle(el).color);

                if (!fg) return;

                const bgData =
                    extractBackgroundFromRule(rule) ||
                    resolveBackground(el);

                if (!bgData) return;

                const worstRatio = calculateWorstContrast(fg, bgData.colors);

                const fontSize = parseFloat(getComputedStyle(el).fontSize);
                const fontWeight = parseInt(getComputedStyle(el).fontWeight);

                const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
                const passAA = isLarge ? worstRatio >= 3 : worstRatio >= 4.5;
                const passAAA = isLarge ? worstRatio >= 4.5 : worstRatio >= 7;

                scannedElements.push(el);
                const elementIndex = scannedElements.length - 1;

                const key = `${rgbToHex(fg)}-${bgData.key}-hover`;

                if (!unique.has(key)) {
                    unique.set(key, {
                        index: elementIndex,
                        state: "hover",
                        tag: el.tagName.toLowerCase(),
                        text: el.textContent.trim().slice(0, 60),
                        foreground: rgbToHex(fg),
                        background: bgData.label,
                        ratio: Number(worstRatio.toFixed(2)),
                        passAA,
                        passAAA
                    });
                }

            });
        }
    }
}

/* ================= BACKGROUND ================= */

function resolveBackground(el) {

    while (el) {

        const style = getComputedStyle(el);

        if (style.backgroundImage && style.backgroundImage !== "none") {
            return parseGradient(style.backgroundImage);
        }

        const bg = parseColor(style.backgroundColor);
        if (bg && bg.a !== 0) {
            return {
                colors: [bg],
                label: rgbToHex(bg),
                key: rgbToHex(bg)
            };
        }

        el = el.parentElement;
    }

    return null;
}

function parseGradient(bgImage) {

    const matches = bgImage.match(/rgba?\([^)]+\)/g);
    const colors = matches ? matches.map(c => parseColor(c)).filter(Boolean) : [];

    return {
        colors,
        label: "gradient",
        key: "gradient"
    };
}

function extractBackgroundFromRule(rule) {

    if (!rule.style) return null;

    const bg = parseColor(rule.style.backgroundColor);
    if (bg) {
        return {
            colors: [bg],
            label: rgbToHex(bg),
            key: rgbToHex(bg)
        };
    }

    return null;
}

/* ================= CONTRAST ================= */

function calculateWorstContrast(fg, bgColors) {

    let worst = Infinity;

    bgColors.forEach(bg => {
        const ratio = contrast(fg, bg);
        if (ratio < worst) worst = ratio;
    });

    return worst;
}

function contrast(fg, bg) {
    const L1 = luminance(fg);
    const L2 = luminance(bg);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function luminance({ r, g, b }) {

    const convert = v => {
        v /= 255;
        return v <= 0.03928
            ? v / 12.92
            : Math.pow((v + 0.055) / 1.055, 2.4);
    };

    return 0.2126 * convert(r) +
           0.7152 * convert(g) +
           0.0722 * convert(b);
}

/* ================= COLOR ================= */

function parseColor(color) {

    if (!color) return null;

    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;

    return {
        r: +match[1],
        g: +match[2],
        b: +match[3],
        a: 1
    };
}

function rgbToHex({ r, g, b }) {

    return "#" + [r, g, b]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
}