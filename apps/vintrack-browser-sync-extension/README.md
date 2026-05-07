# Vintrack Browser Sync Extension

Browser extension for automatic Vintrack/Vinted session sync.

```text
https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor/releases/latest/download/vintrack-browser-sync-extension.zip
https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor/releases/latest/download/vintrack-browser-sync-extension-firefox.xpi
```

## Build Packages

```sh
apps/vintrack-browser-sync-extension/scripts/build-packages.sh
```

The script writes:

- `dist/vintrack-browser-sync-extension.zip` for Chrome and Chromium browsers.
- `dist/vintrack-browser-sync-extension-firefox.xpi` for Firefox.

The Firefox `.xpi` must be signed by Mozilla before normal Firefox Release/Beta users can install it permanently. Submit it through addons.mozilla.org as a listed or self-distributed add-on.

## Install in Chrome

1. Download and unzip `vintrack-browser-sync-extension.zip`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the extracted extension folder.
6. Open Vintrack, go to `Account`, and click `Link With Installed Extension`.

For local development, select `apps/vintrack-browser-sync-extension` directly in step 5.

## Install in Firefox

For local development:

1. Run `apps/vintrack-browser-sync-extension/scripts/build-packages.sh`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on`.
4. Select `apps/vintrack-browser-sync-extension/dist/firefox/manifest.json`.
5. Open Vintrack, go to `Account`, and click `Link With Installed Extension`.

For users, distribute the signed `vintrack-browser-sync-extension-firefox.xpi` from GitHub releases or addons.mozilla.org.

## What it sends

Only these values are synced to Vintrack:

- `access_token_web`
- current Vinted domain
- browser user agent
- Vintrack light/dark theme preference

It does not send the full cookie jar or the browser refresh token.
