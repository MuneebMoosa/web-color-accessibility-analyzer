function applyUniversal() {
  document.body.style.backgroundColor = "#1A1A1A";
  document.body.style.color = "#FFFFFF";
}

function applyProtanopia() {
  document.body.style.backgroundColor = "#FFFFFF";
  document.body.style.color = "#1A1A1A";
}

// 
function runMode(mode) {
  if (mode === "universal") applyUniversal();
  if (mode === "protanopia") applyProtanopia();
  if (mode === "deuteranopia") applyProtanopia();
  if (mode === "tritanopia") applyUniversal();
}

// Reset Mode
function resetMode() {
  document.body.style.backgroundColor = "";
  document.body.style.color = "";
}

// run on page load only once per page load
    chrome.storage.local.get(["userModeEnabled", "selectedMode"], (data) => {
      if (data.userModeEnabled && data.selectedMode) {
        runMode(data.selectedMode);
      }
    });

// Listen For Storage Changes if any mode change it will run
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
