#!/bin/sh
# Builds the Studio as a Mac app and puts it in /Applications (or $STUDIO_APP_DIR).
#
#   tools/studio-app/build.sh [blog folder]
#
# The app opens the blog it was built for: the given folder, or the git checkout this script is in.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
blog=$(cd "${1:-$(git -C "$here" rev-parse --show-toplevel)}" && pwd)
into=${STUDIO_APP_DIR:-/Applications}
[ -f "$blog/astro.config.mjs" ] || { echo "$blog 不是博客的文件夹（没有 astro.config.mjs）" >&2; exit 1; }

STUDIO_REPO="$blog" cargo build --release --manifest-path "$here/Cargo.toml"

app="$here/target/Studio.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$here/target/release/studio-app" "$app/Contents/MacOS/Studio"

icons="$here/target/icon.iconset"
rm -rf "$icons" && mkdir -p "$icons"
for size in 16 32 128 256 512; do
	sips -z $size $size "$here/icons/icon.png" --out "$icons/icon_${size}x${size}.png" >/dev/null
	sips -z $((size * 2)) $((size * 2)) "$here/icons/icon.png" --out "$icons/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$icons" -o "$app/Contents/Resources/icon.icns"

cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key><string>Studio</string>
	<key>CFBundleDisplayName</key><string>Studio</string>
	<key>CFBundleIdentifier</key><string>blog.studio.app</string>
	<key>CFBundleExecutable</key><string>Studio</string>
	<key>CFBundleIconFile</key><string>icon</string>
	<key>CFBundlePackageType</key><string>APPL</string>
	<key>CFBundleShortVersionString</key><string>0.1.0</string>
	<key>CFBundleVersion</key><string>1</string>
	<key>LSMinimumSystemVersion</key><string>11.0</string>
	<key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
	<key>NSHighResolutionCapable</key><true/>
	<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
PLIST

codesign --force --sign - "$app"
mkdir -p "$into"
rm -rf "$into/Studio.app"
mv "$app" "$into/"
echo "已生成 $into/Studio.app（打开的博客：${blog}）"
