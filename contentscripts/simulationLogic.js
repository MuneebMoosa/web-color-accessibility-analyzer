

function applySimulation(mode) {

    // remove existing filter if it is there
    const existingStyle = document.getElementById("cvd-style");
    const existingFilter = document.getElementById("cvd-svg");

    if (existingStyle) existingStyle.remove();
    if (existingFilter) existingFilter.remove();

    // if normal mode is selected do nothing
    if (mode === "normal") return;

    // create <style> element
    const style = document.createElement("style");
    style.id = "cvd-style";
    document.head.appendChild(style);

    // Create hidden SVG container
    const svgContainer = document.createElement("div");
    svgContainer.id = "cvd-svg";
    svgContainer.style.position = "absolute";
    svgContainer.style.width = "0";
    svgContainer.style.height = "0";
    svgContainer.style.overflow = "hidden";
    document.body.appendChild(svgContainer);

    // simulation matrices
    const matrices = {
        protanopia: `
            0.567 0.433 0 0 0
            0.558 0.442 0 0 0
            0 0.242 0.758 0 0
            0 0 0 1 0
        `,
        deuteranopia: `
            0.625 0.375 0 0 0
            0.7   0.3   0 0 0
            0     0.3   0.7 0 0
            0 0 0 1 0
        `,
        tritanopia: `
            0.95  0.05  0 0 0
            0     0.433 0.567 0 0
            0     0.475 0.525 0 0
            0 0 0 1 0
        `
    };

    const matrix = matrices[mode];

    // Inject SVG filter
    svgContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="cvd-filter" color-interpolation-filters="linearRGB">
                    <feColorMatrix type="matrix" values="${matrix}" />
                </filter>
            </defs>
        </svg>
    `;

    // Apply filter to whole page
    style.innerHTML = `
        html {
            filter: url(#cvd-filter);
        }
    `;

    // Force repaint (fix rendering delay issue)
    setTimeout(() => {
        window.scrollBy(1, 1);
        window.scrollBy(-1, -1);
    }, 1);
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "SIMULATE") {
        applySimulation(request.mode);
    }
});