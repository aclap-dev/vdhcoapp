#!/bin/bash

set -euo pipefail
cd $(dirname $0)/

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

if [ ! -d "app/node_modules" ]; then
  (cd app/ ; npm install)
fi


dist_dir_name=dist

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

target=$host
skip_packaging=0
skip_signing=0
skip_bundling=0

while [[ "$#" -gt 0 ]]; do
  case $1 in
    -h|--help)
      echo "Usage:"
      echo "--skip-bundling    # skip bundling JS code into binary. Packaging will reuse already built binaries"
      echo "--skip-packaging   # skip packaging operations"
      echo "--skip-signing     # do not sign the binaries"
      echo "--target <os-arch> # os: linux / mac / windows, arch: x86_64 / i686 / arm64"
      exit 0
      ;;
    --skip-bundling) skip_bundling=1 ;;
    --skip-packaging) skip_packaging=1 ;;
    --skip-signing) skip_signing=1 ;;
    --target) target="$2"; shift ;;
    *) echo "Unknown parameter passed: $1"; exit 1 ;;
  esac
  shift
done


case $target in
  linux-x86_64 | \
  windows-x86_64 | \
  windows-i686 | \
  mac-x86_64 | \
  mac-arm64)
      ;;
  *)
    echo "Unsupported target: $target"
    exit 1
    ;;
esac

target_os=$(echo $target | cut -f1 -d-)
target_arch=$(echo $target | cut -f2 -d-)

dist_dir=$PWD/$dist_dir_name
target_dist_dir=$dist_dir/$target_os/$target_arch

if [ $target_os == "windows" ];
then
  exe_extension=".exe"
else
  exe_extension=""
fi

mkdir -p $target_dist_dir

# Note: 2 config.json are created:
# specific under dist/os/arch/.
yq . -o yaml ./config.toml | \
  yq e ".target.os = \"$target_os\"" |\
  yq e ".target.arch = \"$target_arch\"" -o json \
  > $target_dist_dir/config.json
cp $target_dist_dir/config.json $dist_dir # for JS require(config.json)

eval $(yq ./config.toml -o shell)

if [ ! $skip_bundling == 1 ]; then
  # This could be done by pkg directly, but esbuild is more tweakable.
  # - hardcoding import.meta.url because the `open` module requires it.
  # - faking an electron module because `got` requires on (but it's never used)
  NODE_PATH=app/src esbuild ./app/src/main.js \
    --format=cjs \
    --banner:js="const _importMetaUrl=require('url').pathToFileURL(__filename)" \
    --define:import.meta.url='_importMetaUrl' \
    --bundle --platform=node \
    --tree-shaking=true \
    --alias:electron=electron2 \
    --outfile=$dist_dir/bundled.js

  pkg $dist_dir/bundled.js \
    --target node18-$target \
    --output $target_dist_dir/$package_binary_name$exe_extension
fi

if [ ! -d "$target_dist_dir/ffmpeg-$target" ]; then
  ffmpeg_url_base="https://github.com/aclap-dev/ffmpeg-static-builder/releases/download/"
  ffmpeg_url=$ffmpeg_url_base/ffmpeg-$package_ffmpeg_build_id/ffmpeg-$target.tar.bz2
  ffmpeg_tarball=$target_dist_dir/ffmpeg.tar.bz2
  echo "Fetching ffmpeg… "
  wget --show-progress --quiet -c -O $ffmpeg_tarball $ffmpeg_url
  (cd $target_dist_dir && tar -xf $ffmpeg_tarball)
  rm $ffmpeg_tarball
fi

if [ ! $skip_packaging == 1 ]; then

  if [ $target_os == "linux" ]; then
    cp LICENSE.txt README.md app/node_modules/open/xdg-open $target_dist_dir
    cp $target_dist_dir/ffmpeg-$target/ffmpeg \
      $target_dist_dir/ffmpeg-$target/ffprobe \
      $target_dist_dir
  fi

  if [ $target_os == "mac" ]; then
    if ! [ -x "$(command -v create-dmg)" ]; then
      echo "create-dmg not installed"
      exit 1
    fi

    dot_app_dir=$target_dist_dir/dotApp/
    app_dir=$dot_app_dir/$meta_id.app
    macos_dir=$app_dir/Contents/MacOS
    res_dir=$app_dir/Contents/Resources
    scripts_dir=$target_dist_dir/scripts

    rm -rf $dot_app_dir
    rm -rf $scripts_dir

    mkdir -p $macos_dir
    mkdir -p $res_dir
    mkdir -p $scripts_dir

    cp LICENSE.txt README.md assets/mac/icon.icns $res_dir

    cp $target_dist_dir/ffmpeg-$target/ffmpeg \
      $target_dist_dir/ffmpeg-$target/ffprobe \
      $target_dist_dir/$package_binary_name \
      $macos_dir

    cp -r $target_dist_dir/ffmpeg-$target/presets $res_dir/ffmpeg-presets

    ejs -f $target_dist_dir/config.json ./assets/mac/pkg-distribution.xml.ejs > $target_dist_dir/pkg-distribution.xml
    ejs -f $target_dist_dir/config.json ./assets/mac/pkg-component.plist.ejs > $target_dist_dir/pkg-component.plist
    ejs -f $target_dist_dir/config.json ./assets/mac/Info.plist.ejs > $app_dir/Contents/Info.plist
    ejs -f $target_dist_dir/config.json ./assets/mac/postinstall.ejs > $scripts_dir/postinstall

    chmod +x $scripts_dir/postinstall

    if [ ! $skip_signing == 1 ]; then
      codesign  --entitlements ./assets/mac/entitlements.plist --options=runtime --timestamp -v -f -s "$package_mac_signing_app_cert" $macos_dir/*
    fi

    rm -f $target_dist_dir/$package_binary_name-installer-$meta_version.pkg
    pkgbuild \
      --root $dot_app_dir \
      --install-location /Applications \
      --scripts $scripts_dir \
      --identifier $meta_id \
      --component-plist $target_dist_dir/pkg-component.plist \
      --version $meta_version \
      --sign "$package_mac_signing_pkg_cert" \
      $target_dist_dir/$package_binary_name-installer-$meta_version.pkg

    rm -f $target_dist_dir/$package_binary_name.dmg
    create-dmg --volname "$meta_name" \
      --background ./assets/mac/dmg-background.tiff \
      --window-pos 200 120 --window-size 500 400 --icon-size 70 \
      --icon "$meta_id.app" 100 200 \
      --app-drop-link 350 200 \
      --codesign $package_mac_signing_name \
      $target_dist_dir/$package_binary_name.dmg \
      $dot_app_dir

    rm $target_dist_dir/pkg-distribution.xml
    rm $target_dist_dir/pkg-component.plist
    rm $app_dir/Contents/Info.plist
    rm $scripts_dir/postinstall
    rm -rf $scripts_dir

    if [ ! $skip_signing == 1 ]; then
      xcrun notarytool submit \
        $target_dist_dir/$package_binary_name-installer-$meta_version.pkg \
        --keychain-profile $package_mac_signing_keychain_profile --wait
      echo "In case of issues, run \"xcrun notarytool log UUID --keychain-profile $package_mac_signing_keychain_profile\""
      xcrun stapler staple $target_dist_dir/$package_binary_name-installer-$meta_version.pkg 
    fi
  fi

  if [ $target_os == "windows" ]; then
    install_dir=$target_dist_dir/install_dir
    rm -rf $install_dir
    mkdir -p $install_dir

    IFS=',' read -a stores <<< "$(yq '.store | keys' ./config.toml -o csv)"
    for store in "${stores[@]}"
    do
      yq ".store.$store.manifest" ./config.toml -o yaml | \
        yq e ".name = \"$meta_id\"" |\
        yq e ".description = \"$meta_description\"" |\
        yq e ".path = \"$package_binary_name.exe\"" -o json > $install_dir/$store.json
    done

    cp $target_dist_dir/$package_binary_name.exe $install_dir/
    cp $target_dist_dir/ffmpeg-$target/ffmpeg.exe \
      $target_dist_dir/ffmpeg-$target/ffprobe.exe \
      $install_dir
    cp -r $target_dist_dir/ffmpeg-$target/presets $install_dir/ffmpeg-presets
    cp LICENSE.txt $target_dist_dir
    cp assets/windows/icon.ico $target_dist_dir
    ejs -f $target_dist_dir/config.json ./assets/windows/installer.nsh.ejs > $target_dist_dir/installer.nsh
    (cd $target_dist_dir ; makensis -V4 ./installer.nsh)
    rm -r $install_dir $target_dist_dir/installer.nsh $target_dist_dir/LICENSE.txt $target_dist_dir/icon.ico

    rm -f $target_dist_dir/$package_binary_name-installer.exe
    if [ ! $skip_signing == 1 ]; then
      osslsigncode sign -pkcs12 $package_windows_certificate \
        -in $target_dist_dir/$package_binary_name-installer-unsigned.exe \
        -out $target_dist_dir/$package_binary_name-installer.exe
      rm $target_dist_dir/$package_binary_name-installer-unsigned.exe
    fi
  fi
fi

rm $dist_dir/config.json $target_dist_dir/config.json

echo "Success"
