# Tauri app icons

Tauri expects platform-specific icons here. Generate them once with:

```bash
# from apps/desktop/
pnpm tauri icon path/to/source.png
```

Source should be a 1024×1024 PNG with transparency. The CLI will create
all the required sizes (32×32, 128×128, .icns for Mac, .ico for Windows).

For the system tray, the file `icon.png` (here) should be a small
template-style icon — a single-color PNG with transparency at 32×32 or
64×64. macOS will tint it automatically because `iconAsTemplate: true`
in `tauri.conf.json`.

If you want a quick placeholder, drop any transparent PNG named
`icon.png` here and the app will start.
