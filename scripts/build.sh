#!/bin/bash

set -euo pipefail
cd $(dirname $0)/..

host_os=$(uname -s)
host_arch=$(uname -m)

case $host_os in
  Linux)
    host_os="linux"
    ;;
  Darwin)
    host_os="mac"
    ;;
  MINGW*)
    host_os="windows"
    ;;
esac

host="${host_os}-${host_arch}"

if [ $# -eq 0 ]; then
  target_os=$host_os
  target_arch=$host_arch
else
  case $1 in
    linux-x86_64 | \
    linux-i686 | \
    windows-x86_64 | \
    windows-i686 | \
    mac-x86_64 | \
    mac-arm64)
        ;;
    *)
      echo "Unsupported target: $1"
      exit 1
      ;;
  esac

  target_os=$(echo $1 | cut -f1 -d-)
  target_arch=$(echo $1 | cut -f2 -d-)
fi

target="${target_os}-${target_arch}"

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

if [ ! -d "node_modules" ]; then
  npm install
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

# -----------------------------

echo "Fetching ffmpeg"
ffmpeg_build_id=$(jq -r '.ffmpeg_build_id' ./config.json)
ffmpeg_url_base="https://github.com/aclap-dev/ffmpeg-static-builder/releases/download/"
ffmpeg_url=$ffmpeg_url_base/ffmpeg-$ffmpeg_build_id/ffmpeg-$target.tar.bz2
ffmpeg_tarball=/tmp/vdh-ffmpeg-$ffmpeg_build_id-$target.tar.bz2
wget --quiet -c -O $ffmpeg_tarball $ffmpeg_url

top_dist=$PWD/dist2
dist=$top_dist/$target_os/$target_arch
rm -rf $dist

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

echo "Packaging"
case $target_os in
  linux)
    ;;
  mac)
    source ./scripts/mac.sh
    ;;
  windows)
    ;;
esac

