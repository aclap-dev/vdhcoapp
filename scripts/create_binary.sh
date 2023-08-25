#!/bin/bash

set -euo pipefail
cd $(dirname $0)/..
source ./scripts/target.sh
source ./scripts/ffmpeg.sh

rm -rf $dist

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

npm install

# -----------------------------

echo "Fetching ffmpeg"
wget --quiet -c -O $ffmpeg_tarball $ffmpeg_url

echo "Bundling JS code"
# This could be done by pkg directly, but esbuild is more tweakable.
# - hardcoding import.meta.url because the `open` module requires it.
# - faking an electron module because `got` requires on (but it's never used)
NODE_PATH=app esbuild ./app/main.js \
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
  --output $dist/app.bin
