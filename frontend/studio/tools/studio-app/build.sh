#!/bin/sh
# Builds the Studio as the Mac app RetainPDF and puts it in /Applications (or $STUDIO_APP_DIR), in place of the
# RetainPDF.app there before (the Electron desktop app, until the two are one) and of Studio.app (its old name).
#
#   tools/studio-app/build.sh [Studio folder]
#
# The app runs the Studio it was built for: the given folder, or the Studio this script is in (two folders up; the
# notes it opens are the ones that folder's .studio-local.json names).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
blog=$(cd "${1:-$here/../..}" && pwd)
into=${STUDIO_APP_DIR:-/Applications}
[ -f "$blog/src/studio/serve.mjs" ] || { echo "$blog 不是 Studio 的文件夹（没有 src/studio/serve.mjs）" >&2; exit 1; }

STUDIO_REPO="$blog" cargo build --release --manifest-path "$here/Cargo.toml"

app="$here/target/RetainPDF.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$here/target/release/studio-app" "$app/Contents/MacOS/RetainPDF"

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
	<key>CFBundleName</key><string>RetainPDF</string>
	<key>CFBundleDisplayName</key><string>RetainPDF</string>
	<key>CFBundleIdentifier</key><string>blog.studio.app</string>
	<key>CFBundleExecutable</key><string>RetainPDF</string>
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
# What was there before goes to the Trash, not away: the Electron RetainPDF (until the two are one), Studio.app (the old
# name; while it still runs, it runs on till it is quit).
for old in "$into/RetainPDF.app" "$into/Studio.app"; do
	[ -e "$old" ] && mv "$old" "$HOME/.Trash/$(basename "$old" .app) $(date +%Y%m%d-%H%M%S).app"
done
mv "$app" "$into/"
echo "已生成 $into/RetainPDF.app（运行的 Studio：${blog}）"
