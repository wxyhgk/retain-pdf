# Tray / menu-bar icons

- `trayTemplate.png` — 16×16 (1x)
- `nina.v@example.com` — 32×32 (2x retina)

On macOS, Electron treats files whose names end with `Template` as menu-bar
template images (auto light/dark). Do **not** use the 1024× app logo for the tray
(see issue #76).

Regenerate from `../RetainPDF-logo.png`:

```bash
sips -z 16 16 ../RetainPDF-logo.png --out trayTemplate.png
sips -z 32 32 ../RetainPDF-logo.png --out nina.v@example.com
```
