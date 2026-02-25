const params = new URLSearchParams(window.location.search);
const targetUrl = params.get("target") || "";
const tabId = Number(params.get("tabId"));

const targetHostElement = document.getElementById("targetHost");
const targetUrlElement = document.getElementById("targetUrl");
const continueButton = document.getElementById("continue");
const backButton = document.getElementById("back");

const parsed = parseTarget(targetUrl);
if (parsed) {
  targetHostElement.textContent = parsed.host;
  targetUrlElement.textContent = parsed.href;
} else {
  targetHostElement.textContent = "Invalid destination";
  targetUrlElement.textContent = "";
  continueButton.disabled = true;
}

continueButton.addEventListener("click", () => {
  if (!parsed || !Number.isInteger(tabId)) {
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "allowOnce",
      tabId,
      targetUrl: parsed.href
    },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        continueButton.disabled = false;
        continueButton.textContent = "Failed. Try again";
      }
    }
  );

  continueButton.disabled = true;
  continueButton.textContent = "Opening...";
});

backButton.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = "chrome://newtab";
});

function parseTarget(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}
