#!/bin/bash

set -euo pipefail
cd $(dirname $0)/..

source ./scripts/target.sh
source ./scripts/toml.sh
mkdir -p $dist

echo "Building packages for $target on $host"

echo "Ensuring Node 18 is available and running"

if ! [ -x "$(command -v node)" ]; then
  echo "Node not installed"
  exit 1
fi

if [[ $(node -v) != v18.* ]]
then
  echo "Wrong version of Node (expected v18)"
  exit 1
fi

if ! [ -x "$(command -v esbuild)" ]; then
  echo "Installing esbuild"
  npm install -g esbuild
fi

if ! [ -x "$(command -v pkg)" ]; then
  echo "Installing pkg"
  npm install -g pkg
fi

if ! [ -x "$(command -v ejs)" ]; then
  echo "Installing ejs"
  npm install -g ejs
fi

cd app/
npm install
cd ..

# -----------------------------

# Note: 2 config.json are created. One generic under dist/ and one target
# specific under dist/os/arch/.
yq . -o json ./config.toml > $top_dist/config.json
yq . -o yaml ./config.toml | \
  yq e ".target.os = \"$target_os\"" |\
  yq e ".target.arch = \"$target_arch\"" -o json > $dist/config.json

echo "Bundling JS code"
# This could be done by pkg directly, but esbuild is more tweakable.
# - hardcoding import.meta.url because the `open` module requires it.
# - faking an electron module because `got` requires on (but it's never used)
NODE_PATH=app/src esbuild ./app/src/main.js \
  --format=cjs \
  --banner:js="const _importMetaUrl=require('url').pathToFileURL(__filename)" \
  --define:import.meta.url='_importMetaUrl' \
  --bundle --platform=node \
  --tree-shaking=true \
  --alias:electron=electron2 \
  --outfile=$top_dist/main.js

echo "Bundling Node and JS Code"
pkg $top_dist/main.js \
  --target node18-$target_os-$target_arch \
  --output $dist/$app_binary_name

source ./scripts/ffmpeg.sh
cd $dist
echo "Fetching ffmpeg"
wget -c -O $ffmpeg_tarball $ffmpeg_url
echo "Extracting ffmpeg"
tar -xf $ffmpeg_tarball
rm -rf ffmpeg-presets
mv ffmpeg-$target/presets ffmpeg-presets
mv ffmpeg-$target/* .
rmdir ffmpeg-$target
cd -

rpath=./$top_dist_rel/$target_os/$target_arch
echo "Binary ready: $rpath/$app_binary_name"
echo "Install with: $rpath/$app_binary_name install"
echo "Test with: ./tests/test.mjs (after install)"
echo "Test with: ./tests/test.mjs $rpath/$app_binary_name (if not installed)"
