# Hold Up (Chrome Extension)

A Manifest V3 Chrome extension that intercepts configured sites and shows a confirmation interstitial before loading them.

## Features

- Configure blocked domains in the extension options page.
- Redirects attempts to those domains to an interstitial screen.
- `Continue` allows that site for the current tab until you leave it, so in-site clicks do not re-prompt.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/Users/billy/workspace/website-hold`.
5. Open extension details and click **Extension options** to add domains.

## Domain format examples

- `instagram.com`
- `youtube.com`
- `https://news.ycombinator.com`

Subdomains are matched automatically (`www.youtube.com`, `m.youtube.com`, etc.).
