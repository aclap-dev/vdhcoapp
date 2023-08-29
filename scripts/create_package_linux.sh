#!/bin/bash

set -euo pipefail

app_id=$(toml '.meta.id')
binary_name=$(toml '.package.binary_name')
app_version=$(toml '.meta.version')

mv $dist/app.bin $dist/bin/$binary_name
cp app/node_modules/open/xdg-open $dist/bin
cp LICENSE.txt README.md $dist
