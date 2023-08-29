#!/bin/bash

set -euo pipefail
cd $(dirname $0)/..

source ./scripts/toml.sh

ffmpeg_build_id=$(toml ".package.ffmpeg_build_id")
ffmpeg_url_base="https://github.com/aclap-dev/ffmpeg-static-builder/releases/download/"
ffmpeg_url=$ffmpeg_url_base/ffmpeg-$ffmpeg_build_id/ffmpeg-$target.tar.bz2
ffmpeg_tarball=$dist/ffmpeg.tar.bz2
ffmpeg_dir=$dist/ffmpeg

