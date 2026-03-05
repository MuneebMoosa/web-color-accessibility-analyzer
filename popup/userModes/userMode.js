//select all btns in usermode
const buttons =  document.querySelectorAll(".usermode-btn"); 

// for applying active class
function setActive(mode) {
  buttons.forEach(btn => {
    btn.classList.remove("active");
    if(btn.classList.contains(mode)){
      btn.classList.add("active");
    }
  })
}

chrome.storage.local.get(["selectedMode"], (data) => {
    if(data.selectedMode){
      setActive(data.selectedMode);
    }
});

// click handler
buttons.forEach(button => {
    button.addEventListener("click" , () => { 
        let selectedMode = " ";
        if (button.classList.contains("universal")){
          selectedMode = "universal";
        }else if(button.classList.contains("protanopia")){
          selectedMode = "protanopia";
        }else if(button.classList.contains("deuteranopia")){
          selectedMode = "deuteranopia";
        }else{
          selectedMode = "tritanopia";
        }

      chrome.storage.local.get(["selectedMode", "userModeEnabled"], (data) => {

      // case 1 if the selected is the current active one

      if (data.selectedMode === selectedMode && data.userModeEnabled) {

        chrome.storage.local.set({
          userModeEnabled: false,
          selectedMode: ""
        });

        // Remove active class
        buttons.forEach(btn => btn.classList.remove("active"));

        // Tell all tabs to reset
        chrome.tabs.query({}).then((tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: "disableMode"
            }).catch(() => {
              // ignore safely
            });
          });
        });
        // do not close popup
        return;
      }

        //case 2 if it is a new mode
        chrome.storage.local.set({
          userModeEnabled: true,
          selectedMode: selectedMode
          }, () => {
            setActive(selectedMode);
            // Send message to ALL open tabs
            chrome.tabs.query({}).then((tabs) => {
              tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                  action: "applyMode",
                  mode: selectedMode
                }).catch(() => {
                  // ignore safely
                });
              });
            });

            window.close(); // close popup after selection
        });
    })
  })
})
