document.addEventListener("DOMContentLoaded", () => {

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;

        chrome.storage.session.get("mode_" + tabId, (data) => {

            const savedMode = data["mode_" + tabId] || "normal";

            const radio = document.querySelector(
                `input[value="${savedMode}"]`
            );
            if (radio) {
                radio.checked = true;
            }

        });
    });

});

document.querySelectorAll('input[name="vision"]').forEach(radio => {
    radio.addEventListener("change", function () {

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, {
                type: "SIMULATE",
                mode: radio.value
            });
        
        chrome.storage.session.set({
                ["mode_" + tabId]: radio.value
            });
        });
    });

});