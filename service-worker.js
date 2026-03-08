const BLOCKED_SITES_KEY = "blockedSites";
const ALLOWED_SITE_KEY = "allowedSiteByTabId";

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(BLOCKED_SITES_KEY);
  if (!Array.isArray(existing[BLOCKED_SITES_KEY])) {
    await chrome.storage.sync.set({ [BLOCKED_SITES_KEY]: [] });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) {
    return;
  }

  void maybeShowInterstitial(tabId, changeInfo.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearAllowedSite(tabId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "allowOnce") {
    return;
  }

  void (async () => {
    const tabId = Number(message.tabId);
    const targetUrl = String(message.targetUrl || "");
    const blockedSite = await getMatchingBlockedSiteForUrl(targetUrl);

    if (!Number.isInteger(tabId) || !isHttpUrl(targetUrl) || !blockedSite) {
      sendResponse({ ok: false, error: "Invalid tab or URL." });
      return;
    }

    await saveAllowedSite({ tabId, blockedSite });
    await chrome.tabs.update(tabId, { url: targetUrl });
    sendResponse({ ok: true });
  })();

  return true;
});

async function maybeShowInterstitial(tabId, targetUrl) {
  if (!isHttpUrl(targetUrl)) {
    return;
  }

  const interstitialPrefix = chrome.runtime.getURL("interstitial.html");
  if (targetUrl.startsWith(interstitialPrefix)) {
    return;
  }

  const host = getHost(targetUrl);
  if (!host) {
    return;
  }

  const blockedSites = await getBlockedSites();
  const matchingBlockedSite = getMatchingBlockedSite({ host, blockedSites });
  if (!matchingBlockedSite) {
    await clearAllowedSite(tabId);
    return;
  }

  const allowedSite = await getAllowedSite(tabId);
  if (allowedSite && hostMatches(host, allowedSite)) {
    return;
  }

  const interstitialUrl = chrome.runtime.getURL(
    `interstitial.html?target=${encodeURIComponent(targetUrl)}&tabId=${tabId}`
  );

  await chrome.tabs.update(tabId, { url: interstitialUrl });
}

async function getBlockedSites() {
  const result = await chrome.storage.sync.get(BLOCKED_SITES_KEY);
  const blockedSites = result[BLOCKED_SITES_KEY];
  if (!Array.isArray(blockedSites)) {
    return [];
  }

  return blockedSites
    .map((entry) => normalizeSiteEntry(entry))
    .filter(Boolean);
}

async function getAllowedSite(tabId) {
  const session = await chrome.storage.session.get(ALLOWED_SITE_KEY);
  const map = session[ALLOWED_SITE_KEY] || {};
  return normalizeSiteEntry(map[String(tabId)]);
}

async function saveAllowedSite({ tabId, blockedSite }) {
  const session = await chrome.storage.session.get(ALLOWED_SITE_KEY);
  const map = session[ALLOWED_SITE_KEY] || {};
  map[String(tabId)] = normalizeSiteEntry(blockedSite);
  await chrome.storage.session.set({ [ALLOWED_SITE_KEY]: map });
}

async function clearAllowedSite(tabId) {
  const session = await chrome.storage.session.get(ALLOWED_SITE_KEY);
  const map = session[ALLOWED_SITE_KEY] || {};
  if (!map[String(tabId)]) {
    return;
  }

  delete map[String(tabId)];
  await chrome.storage.session.set({ [ALLOWED_SITE_KEY]: map });
}

function getHost(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isHttpUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function hostMatches(host, blockedHost) {
  return host === blockedHost || host.endsWith(`.${blockedHost}`);
}

async function getMatchingBlockedSiteForUrl(targetUrl) {
  const host = getHost(targetUrl);
  if (!host) {
    return null;
  }

  const blockedSites = await getBlockedSites();
  return getMatchingBlockedSite({ host, blockedSites });
}

function getMatchingBlockedSite({ host, blockedSites }) {
  return blockedSites.find((blockedHost) => hostMatches(host, blockedHost)) || null;
}

function normalizeSiteEntry(rawEntry) {
  if (typeof rawEntry !== "string") {
    return null;
  }

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

  if (!value) {
    return null;
  }

  return value;
}
