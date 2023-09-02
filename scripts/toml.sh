#!/bin/bash

set -euo pipefail

if ! [ -x "$(command -v yq)" ]; then
  echo "Error: Missing yq binary"
  exit 1
fi

function toml() {
  yq $1 config.toml
}
