#!/bin/bash

set -euo pipefail
cd $(dirname $0)/..

sudo installer -pkg dist/mac/arm64/vdh-coapp-1.7.0.pkg -target /