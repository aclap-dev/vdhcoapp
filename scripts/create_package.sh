#!/bin/bash

set -euo pipefail
cd $(dirname $0)/..
source ./scripts/target.sh
source ./scripts/ffmpeg.sh

echo "Packaging"
case $target_os in
  linux)
    source ./scripts/create_package_linux.sh
    ;;
  mac)
    source ./scripts/create_package_mac.sh
    ;;
  windows)
    echo "Not supported yet"
    ;;
esac
