#!/bin/bash

set -euo pipefail

if ! [ -x "$(command -v create-dmg)" ]; then
  echo "create-dmg not installed"
  exit 1
fi

sign_id=$(toml '.package.mac.signing.name')
sign_pkg_id=$(toml '.package.mac.signing.pkg_cert')
sign_app_id=$(toml '.package.mac.signing.app_cert')
binary_name=$(toml '.package.binary_name')
app_name=$(toml '.meta.name')
app_id=$(toml '.meta.id')
app_version=$(toml '.meta.version')
pkg_filename="vdh-coapp-$app_version"
pkg_version=`date +%s`

echo "Creating dotApp"

dot_app_path=$dist/dotApp/
app_path=$dot_app_path/$app_id.app
macos_dir=$app_path/Contents/MacOS
res_dir=$app_path/Contents/Resources

rm -rf $dot_app_path

mkdir -p $macos_dir
mkdir -p $res_dir

scripts_dir=$dist/scripts
rm -rf $scripts_dir
mkdir -p $scripts_dir

cd $res_dir
cp $dist/ffmpeg $macos_dir
cp $dist/ffprobe $macos_dir
cp -r $dist/ffmpeg-presets $res_dir
cd -

cp $dist/app.bin $macos_dir/$binary_name

echo "Creating pkg config files"

cp LICENSE.txt README.md assets/mac/icon.icns $res_dir

ejs -f $dist/config.json ./assets/mac/pkg-distribution.xml.ejs > $dist/pkg-distribution.xml
ejs -f $dist/config.json ./assets/mac/pkg-component.plist.ejs > $dist/pkg-component.plist
ejs -f $dist/config.json ./assets/mac/Info.plist.ejs > $app_path/Contents/Info.plist
ejs -f $dist/config.json ./assets/mac/postinstall.ejs > $scripts_dir/postinstall

chmod +x $scripts_dir/postinstall

echo "Signing binaries"

# FIXME: is that first line necessary?
# codesign --options=runtime --timestamp -v -f -s "$sign_app_id" $app_path
codesign  --entitlements ./assets/mac/entitlements.plist --options=runtime --timestamp -v -f -s "$sign_app_id" $macos_dir/*

echo "Building $pkg_filename.pkg"

pkgbuild \
  --root $dot_app_path \
  --install-location /Applications \
  --scripts $scripts_dir \
  --identifier $app_id \
  --component-plist $dist/pkg-component.plist \
  --version $pkg_version \
  --sign "$sign_pkg_id" \
  $dist/$pkg_filename.pkg

echo "Building DMG file"

create-dmg --volname "$app_name" \
  --background ./assets/mac/dmg-background.tiff \
  --window-pos 200 120 --window-size 500 400 --icon-size 70 \
  --icon "$app_id.app" 100 200 \
  --app-drop-link 350 200 \
  --codesign $sign_id \
  $dist/$pkg_filename.dmg \
  $dot_app_path
