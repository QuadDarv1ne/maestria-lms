# PWA Icons

Icons for the Maestria brand live in this directory. They are generated from
`public/maestria-logo-icon.png` (the raster twin of `public/logo.svg`).

Naming convention used by `public/manifest.json`, `src/app/layout.tsx`
(apple-touch-icon) and the service worker precache:

- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-180x180.png` (apple-touch-icon)
- `icon-192x192.png` (required for Android)
- `icon-384x384.png`
- `icon-512x512.png` (required)
- `icon-maskable-192x192.png`, `icon-maskable-512x512.png` — full-bleed
  variants with the mark inside the 80% safe zone

## Regenerating

```powershell
# Windows-only helper built on System.Drawing
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-brand-assets.ps1
```

`src/lib/brand-assets.test.ts` fails whenever a manifest, service worker or
metadata entry points at an icon that is not present in `public/`, so broken
references cannot come back silently.
