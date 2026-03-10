document.getElementById("openPanel").addEventListener("click", async () => {

  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

  chrome.sidePanel.open({
    tabId: tab.id
  });
   window.close();
});