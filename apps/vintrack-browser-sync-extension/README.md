# Vintrack Browser Sync Extension

Chrome extension for automatic Vintrack/Vinted session sync.

```text
https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor/releases/latest/download/vintrack-browser-sync-extension.zip
```

## Install

1. Download and unzip `vintrack-browser-sync-extension.zip`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the extracted extension folder.
6. Open Vintrack, go to `Account`, and click `Link With Installed Extension`.

For local development, select `apps/vintrack-browser-sync-extension` directly in step 5.

## What it sends

Only these values are synced to Vintrack:

- `access_token_web`
- `refresh_token_web`
- current Vinted domain
- browser user agent
- Vintrack light/dark theme preference

It does not send the full cookie jar.
