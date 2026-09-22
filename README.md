# Voice to Report

A small web app (installable on iPhone as a home-screen app) that turns dictation into a tidy, professional report.

## How it works
1. Choose a document type and optional title.
2. Tap the microphone and speak. Pauses are fine — it keeps listening until you press **Stop**.
3. On Stop, the text is sent to `/api/format`, which asks OpenAI to correct grammar and layout **without adding or changing facts**.
4. Edit, then Copy, Save .TXT, Share, Email or Print / PDF. **Show Original** swaps back to the raw dictation.

## Deploy (Vercel)
Set these in **Vercel > Project > Settings > Environment Variables**, then redeploy:

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI secret key |
| `APP_ACCESS_CODE` | Yes | Code users enter once in the app; stops strangers using your key |
| `OPENAI_MODEL` | No | Model name (default `gpt-5.5`) |
| `OPENAI_EFFORT` | No | Reasoning effort (default `low`) |

If `APP_ACCESS_CODE` or `OPENAI_API_KEY` is missing, formatting is switched off and the raw dictation is kept.

## Privacy
No reports are stored by the app. Report text passes through the Vercel function to OpenAI for formatting only. The optional email address and access code are stored on the device only.

## Files
- `index.html` — the app
- `api/format.js` — formatting endpoint (access code, rate limit, timeout)
- `service-worker.js` — offline support; bump `VERSION` when app files change
- `icon.svg`, `icon-512.png`, `apple-touch-icon.png` — app icons

## Limits
- The rate limit (20 requests per 10 minutes per IP) is per server instance, so it is best-effort.
- Speech recognition depends on the browser. Where unavailable, use the keyboard microphone and tap **Format Again**.
- Also set a monthly spend limit in the OpenAI dashboard as a backstop.
