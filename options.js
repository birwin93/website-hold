const BLOCKED_SITES_KEY = "blockedSites";

const sitesTextArea = document.getElementById("sites");
const saveButton = document.getElementById("save");
const statusText = document.getElementById("status");

void loadSites();

saveButton.addEventListener("click", () => {
  void saveSites();
});

async function loadSites() {
  const result = await chrome.storage.sync.get(BLOCKED_SITES_KEY);
  const sites = Array.isArray(result[BLOCKED_SITES_KEY])
    ? result[BLOCKED_SITES_KEY]
    : [];

  sitesTextArea.value = sites.join("\n");
}

async function saveSites() {
  const lines = sitesTextArea.value
    .split("\n")
    .map((line) => normalizeSiteEntry(line))
    .filter(Boolean);

  const uniqueSites = [...new Set(lines)];

  await chrome.storage.sync.set({ [BLOCKED_SITES_KEY]: uniqueSites });
  sitesTextArea.value = uniqueSites.join("\n");
  flashStatus(`Saved ${uniqueSites.length} site${uniqueSites.length === 1 ? "" : "s"}.`);
}

function flashStatus(message) {
  statusText.textContent = message;
  window.setTimeout(() => {
    statusText.textContent = "";
  }, 1800);
}

function normalizeSiteEntry(rawEntry) {
  let value = rawEntry.trim().toLowerCase();
  if (!value) {
    return null;
  }

  if (value.includes("://")) {
    try {
      value = new URL(value).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  value = value.split(/[/?#]/)[0];
  value = value.replace(/^\*\./, "");
  value = value.replace(/^\./, "");
  value = value.replace(/:\d+$/, "");
  value = value.replace(/\.+$/, "");

  return value || null;
}
