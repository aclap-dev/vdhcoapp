#!/bin/bash

set -euo pipefail
cd $(dirname $0)/..

ffmpeg_build_id=$(jq -r '.ffmpeg_build_id' ./config.json)
ffmpeg_url_base="https://github.com/aclap-dev/ffmpeg-static-builder/releases/download/"
ffmpeg_url=$ffmpeg_url_base/ffmpeg-$ffmpeg_build_id/ffmpeg-$target.tar.bz2
ffmpeg_tarball=/tmp/vdh-ffmpeg-$ffmpeg_build_id-$target.tar.bz2

