#!/bin/bash

set -euo pipefail

echo "Setting up environment"

echo -n "Checking nvm… "
nvm_sh=~/.nvm/nvm.sh
if [ ! -f "$nvm_sh" ]; then
  echo "failed."
  echo 'Error: nvm.sh not found.' >&2
  exit 1
fi
source $nvm_sh
echo "ok."

echo "Ensuring Node 18 is available and running…"
nvm install 18
nvm use 18

if [ ! -d "node_modules" ]; then
  npm install
fi

if ! [ -x "$(command -v pkg)" ]; then
  echo "Installing pkg"
  npm install -g pkg
fi

if ! [ -x "$(command -v ejs)" ]; then
  echo "Installing ejs"
  npm install -g ejs
fi

# -----------------------------

binary_name="net.downloadhelper.coapp"
ffmpeg_url_base="https://github.com/aclap-dev/ffmpeg-static-builder/releases/download/"
ffmpeg_url=$ffmpeg_url_base/ffmpeg-285c7f6f6b-2023-06-26-001/ffmpeg-mac-arm64.tar.bz2
app_id=$(jq -r '.id' ./config.json)
pkg_version=`date +%s`
dist=$PWD/dist2/

rm -rf $dist

pkg_dir=$dist/mac/arm64/pkg
scripts_dir=$dist/mac/arm64/pkg/scripts
content_dir=$pkg_dir/content
contents_dir=$content_dir/$app_id.app/Contents
macos_dir=$contents_dir/MacOS
ffmpeg_dir=$macos_dir/ffmpeg
res_dir=$contents_dir/Resources

mkdir -p $pkg_dir
mkdir -p $scripts_dir
mkdir -p $contents_dir
mkdir -p $macos_dir
mkdir -p $ffmpeg_dir
mkdir -p $res_dir

echo "Fetching ffmpeg…"
cd $ffmpeg_dir
tmpfile=$(mktemp /tmp/coapp-build.XXXXXX)
curl -L $ffmpeg_url > $tmpfile
echo "Extracting ffmpeg"
tar -xf $tmpfile
mv ffmpeg-mac-arm64/ffmpeg ffmpeg-mac-arm64/ffprobe ffmpeg-mac-arm64/presets .
rmdir ffmpeg-mac-arm64
rm $tmpfile
cd -

echo "Building single executable"
pkg ./app/main.js --target node18-macos-arm64 --output $macos_dir/bin/$binary_name

echo "Creating pkg config files"

echo "ejs"

tmpfile=$(mktemp /tmp/coapp-build.XXXXXX)
jq -n --argfile config config.json \
  --argfile package package.json \
  "{config:\$config, manifest:\$package, version:$pkg_version, binaryName:\"$binary_name\"}" \
  > $tmpfile

ejs -f $tmpfile ./assets/pkg-distribution.xml.ejs > $pkg_dir/pkg-distribution.xml
ejs -f $tmpfile ./assets/pkg-component.plist.ejs > $pkg_dir/pkg-component.plist
ejs -f $tmpfile ./assets/Info.plist.ejs > $contents_dir/Info.plist
ejs -f $tmpfile ./assets/setup-mac-pkg.sh.ejs > $scripts_dir/postinstall
chmod +x $scripts_dir/postinstall

cp assets/README.txt $macos_dir/README.txt
cp assets/gpl-2.0.txt $macos_dir/LICENSE.txt
cp assets/icon.icns $res_dir

jq "{id, name, description, allowed_extensions}" ./config.json > $macos_dir/config.json

pkgbuild \
  --root $content_dir \
  --install-location /Applications \
  --scripts $scripts_dir \
  --identifier $app_id \
  --component-plist $pkg_dir/pkg-component.plist \
  --version $pkg_version \
  $pkg_dir/app.pkg

echo Done
