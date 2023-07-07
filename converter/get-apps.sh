#!/bin/bash

cd $(dirname "$0")/

set -euo pipefail

mkdir -p build

cd build

targets=(linux-i686 linux-x86_64 mac-arm64 windows-x86_64 windows-i686)

function download {
  tag="ffmpeg-285c7f6f6b-2023-06-26-001"
  location="https://github.com/mi-g/ffmpeg-static-builder/releases/download/"
  url=$location/$tag/$1
  wget $url
}

for target in ${targets[@]}; do
  file="ffmpeg-$target.tar.bz2"
  rm -rf $file $target
  echo "Downloading $file"
  download $file
  echo "Extracting $file"
  tar -xf $file
  rm $file
done

echo "All done."
