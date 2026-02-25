const BLOCKED_SITES_KEY = "blockedSites";
const BYPASS_KEY = "bypassByTabId";

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "allowOnce") {
    return;
  }

  void (async () => {
    const tabId = Number(message.tabId);
    const targetUrl = String(message.targetUrl || "");

    if (!Number.isInteger(tabId) || !isHttpUrl(targetUrl)) {
      sendResponse({ ok: false, error: "Invalid tab or URL." });
      return;
    }

    await saveBypass(tabId, targetUrl);
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
  if (!blockedSites.some((blockedHost) => hostMatches(host, blockedHost))) {
    return;
  }

  const bypassTargetUrl = await getBypass(tabId);
  if (bypassTargetUrl && urlsEquivalent(targetUrl, bypassTargetUrl)) {
    await clearBypass(tabId);
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

async function getBypass(tabId) {
  const session = await chrome.storage.session.get(BYPASS_KEY);
  const map = session[BYPASS_KEY] || {};
  return map[String(tabId)] || null;
}

async function saveBypass(tabId, targetUrl) {
  const session = await chrome.storage.session.get(BYPASS_KEY);
  const map = session[BYPASS_KEY] || {};
  map[String(tabId)] = normalizeUrl(targetUrl);
  await chrome.storage.session.set({ [BYPASS_KEY]: map });
}

async function clearBypass(tabId) {
  const session = await chrome.storage.session.get(BYPASS_KEY);
  const map = session[BYPASS_KEY] || {};
  if (!map[String(tabId)]) {
    return;
  }

  delete map[String(tabId)];
  await chrome.storage.session.set({ [BYPASS_KEY]: map });
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

function normalizeUrl(rawUrl) {
  try {
    return new URL(rawUrl).href;
  } catch {
    return rawUrl;
  }
}

function urlsEquivalent(urlA, urlB) {
  return normalizeUrl(urlA) === normalizeUrl(urlB);
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
