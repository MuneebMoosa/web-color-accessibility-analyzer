document.addEventListener("DOMContentLoaded", () => {

  const statAAA = document.querySelector(".stat-num-aaa");
  const sortSelect = document.getElementById("sortSelect");
  const runBtn = document.getElementById("runScanBtn");
  const resultsList = document.querySelector(".results-list");

  const navChecked = document.querySelector(".nav-checked span");
  const statChecked = document.querySelector(".stat-num-checked");
  const statPass = document.querySelector(".stat-num-pass");
  const statFail = document.querySelector(".stat-num-fail");

  const ratioValue = document.querySelector(".ratio-value");
  const statusBadge = document.querySelector(".status-badge");
  const qualityBadge = document.querySelector(".quality-badge");

  const swatches = document.querySelectorAll(".color-swatch");
  const hexes = document.querySelectorAll(".color-hex");

  const leftPanel = document.querySelector(".left-panel");

  let allResults = [];

  // INITIAL STATE
  resetLeftPanel();

  // ================= RUN SCAN =================
  runBtn.addEventListener("click", () => {

    resetLeftPanel();
    resultsList.innerHTML = `<div style="padding:20px;color:#6B7280;">Scanning...</div>`;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "RUN_WCAG_SCAN" },
        (response) => {

          if (chrome.runtime.lastError) {
            resultsList.innerHTML =
              `<div style="padding:20px;color:red;">
                Cannot scan this page.
              </div>`;
            return;
          }

          if (!response) return;

          allResults = response.results;

          updateSummary(response.summary);
          renderResults(allResults);
        }
      );
    });
  });

  // ================= SUMMARY =================
  function updateSummary(summary) {

    navChecked.textContent = summary.totalCombinations;
    statChecked.textContent = summary.totalCombinations;
    statPass.textContent = summary.passAA;
    statFail.textContent = summary.failAA;
    statAAA.textContent = summary.passAAA;
  }

  // ================= RENDER RESULTS =================
  function renderResults(results) {

    resultsList.innerHTML = "";

    if (!results.length) {
      resultsList.innerHTML =
        `<div style="padding:20px;color:#6B7280;">
          No issues found
        </div>`;
      return;
    }

    results.forEach((result) => {

      const item = document.createElement("div");
      item.className = "result-item";

      item.innerHTML = `
        <div class="result-badge ${result.passAA ? "badge-pass" : "badge-fail"}">
          ${result.passAA ? "PASS" : "FAIL"}
        </div>
        <span class="result-ratio">${result.ratio}:1</span>
        <div class="result-info">
          <div class="result-name">${result.tag}</div>
        </div>
      `;

      item.addEventListener("click", () => {

        // REMOVE previous active
        document.querySelectorAll(".result-item")
          .forEach(el => el.classList.remove("active"));

        item.classList.add("active");

        updateLeftPanel(result);

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0].id,
            { type: "HIGHLIGHT_ELEMENT", index: result.index }
          );
        });
      });

      resultsList.appendChild(item);
    });
  }

  // ================= LEFT PANEL UPDATE =================
  function updateLeftPanel(result) {

    leftPanel.classList.remove("inactive");
    leftPanel.classList.add("active");
    leftPanel.classList.remove("pass", "fail");

    if (result.passAA) {
      leftPanel.classList.add("pass");
    } else {
      leftPanel.classList.add("fail");
    }

    ratioValue.textContent = result.ratio + " : 1";
    statusBadge.textContent = result.passAA ? "Pass" : "Fail";

    qualityBadge.textContent =
      result.ratio >= 7 ? "Excellent Contrast" :
      result.ratio >= 4.5 ? "Good Contrast" :
      "Poor Contrast";

    swatches[0].style.background = result.foreground;
    swatches[1].style.background = result.background;

    hexes[0].textContent = result.foreground;
    hexes[1].textContent = result.background;
  }

  // ================= RESET LEFT PANEL =================
  function resetLeftPanel() {

    leftPanel.classList.remove("active", "pass", "fail");
    leftPanel.classList.add("inactive");

    ratioValue.textContent = "-- : 1";
    statusBadge.textContent = "--";
    qualityBadge.textContent = "";

    swatches[0].style.background = "transparent";
    swatches[1].style.background = "transparent";

    hexes[0].textContent = "--";
    hexes[1].textContent = "--";
  }

  // ================= SORT =================
  sortSelect.addEventListener("change", () => {

    const mode = sortSelect.value;
    let filtered = [];

    if (mode === "pass") {
      filtered = allResults.filter(r => r.passAA);
    }
    else if (mode === "fail") {
      filtered = allResults.filter(r => !r.passAA);
    }
    else if (mode === "aaa") {
      filtered = allResults.filter(r => r.passAAA);
    }
    else {
      filtered = [...allResults].sort((a, b) => b.ratio - a.ratio);
    }

    renderResults(filtered);
  });

});