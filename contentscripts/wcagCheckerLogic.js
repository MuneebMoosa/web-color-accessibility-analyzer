
let scannedElements = [];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.type === "RUN_WCAG_SCAN") {
        const results = runScan();
        sendResponse(results);
        return true;
    }
    // clear scan need  to improve
    if (request.type === "CLEAR_HIGHLIGHT"){
        scannedElements.forEach(el => el.style.outline = "");
    }
    if (request.type === "HIGHLIGHT_ELEMENT") {

        scannedElements.forEach(el => el.style.outline = "");

        const el = scannedElements[request.index];
        if (!el) return;

        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "3px solid red";
    }
});

function runScan() {

    scannedElements = [];
    const unique = new Map();

    scanNormal(unique);

    const results = Array.from(unique.values());

    const summary = {
        totalCombinations: results.length,
        passAA: results.filter(r => r.passAA).length,
        failAA: results.filter(r => !r.passAA).length,
        passAAA: results.filter(r => r.passAAA).length
    };

    return { summary, results };
}

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
        if (!bgData || !bgData.colors.length) return;

        const worstRatio = calculateWorstContrast(fg, bgData.colors);

        const fontSize = parseFloat(style.fontSize);
        const fontWeight = parseInt(style.fontWeight);

        const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
        const passAA = isLarge ? worstRatio >= 3 : worstRatio >= 4.5;
        const passAAA = isLarge ? worstRatio >= 4.5 : worstRatio >= 7;

        const key = `${rgbToHex(fg)}-${bgData.key}`;

        if (!unique.has(key)) {

            scannedElements.push(el);
            const elementIndex = scannedElements.length - 1;

            unique.set(key, {
                index: elementIndex,
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

function resolveBackground(el) {

    while (el) {

        const style = getComputedStyle(el);

        const bgColor = style.backgroundColor;
        const bgImage = style.backgroundImage;

        const parsedColor = parseColor(bgColor);

        if (parsedColor && parsedColor.a !== 0) {
            return {
                colors: [parsedColor],
                label: rgbToHex(parsedColor),
                key: rgbToHex(parsedColor)
            };
        }

        if (bgImage && bgImage !== "none" && bgImage.includes("gradient")) {
            return parseGradient(bgImage);
        }

        el = el.parentElement;
    }

    return null;
}

function parseGradient(bgImage) {

    const matches = bgImage.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,6}/g);

    const colors = matches
        ? matches.map(c => parseColor(c)).filter(Boolean)
        : [];

    if (!colors.length) return null;

    return {
        colors,
        label: bgImage,
        key: bgImage
    };
}

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
    return (Math.max(L1, L2) + 0.05) /
           (Math.min(L1, L2) + 0.05);
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

function parseColor(color) {

    if (!color) return null;

    if (color.startsWith("#")) {
        let hex = color.replace("#", "");
        if (hex.length === 3) {
            hex = hex.split("").map(c => c + c).join("");
        }
        const bigint = parseInt(hex, 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255,
            a: 1
        };
    }

    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

    if (!match) return null;

    return {
        r: +match[1],
        g: +match[2],
        b: +match[3],
        a: match[4] !== undefined ? parseFloat(match[4]) : 1
    };
}

function rgbToHex({ r, g, b }) {

    return "#" + [r, g, b]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
}
// Function to handle clicking a result
// Add this to wcagCheckerLogic.js (or your main popup script)
// Ensure this ID matches the one in your HTML
// Use a more robust way to attach the event

