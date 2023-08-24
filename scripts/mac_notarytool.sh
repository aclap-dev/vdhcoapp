#!/bin/bash

xcrun notarytool submit dist2/mac/arm64/vdh-coapp-1.7.0.pkg --keychain-profile "aclap" --wait
echo xcrun notarytool log UUID --keychain-profile aclap
xcrun stapler staple dist2/mac/arm64/vdh-coapp-1.7.0.pkg
