#!/bin/bash

set -euo pipefail
cd $(dirname $0)/

# Print green
function log {
  echo -e "build.sh:" '\033[0;32m' "$@" '\033[0m'
}

# Print red and exit
function error {
  echo -e "build.sh:" '\033[0;31m' "Error:" "$@" '\033[0m'
  exit 1
}

# yq is used to process the toml file.
if ! [ -x "$(command -v yq)" ]; then
  error "yq not installed. See https://github.com/mikefarah/yq/#install"
fi

if ! [ -x "$(command -v node)" ]; then
  error "Node not installed"
fi

if [[ $(node -v) != v18.* ]]
then
  error "Wrong version of Node (expected v18)"
fi

if ! [ -x "$(command -v esbuild)" ]; then
  log "Installing esbuild"
  npm install -g esbuild
fi

if ! [ -x "$(command -v pkg)" ]; then
  log "Installing pkg"
  npm install -g pkg
fi

if ! [ -x "$(command -v ejs)" ]; then
  log "Installing ejs"
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
build_all=0
skip_packaging=0
skip_signing=0
skip_bundling=0
skip_notary=0

while [[ "$#" -gt 0 ]]; do
  case $1 in
    -h|--help)
      echo "Usage:"
      echo "--all              # Build all targets. Only works from a Apple Silicon host"
      echo "--skip-bundling    # skip bundling JS code into binary. Packaging will reuse already built binaries"
      echo "--skip-packaging   # skip packaging operations (including signing)"
      echo "--skip-signing     # do not sign the binaries"
      echo "--skip-notary      # do not send pkg to Apple's notary service"
      echo "--target <os-arch> # os: linux / mac / windows, arch: x86_64 / i686 / arm64"
      exit 0
      ;;
    --all) build_all=1 ;;
    --skip-bundling) skip_bundling=1 ;;
    --skip-packaging) skip_packaging=1 ; skip_signing=1 ; skip_notary=1 ;;
    --skip-signing) skip_signing=1 ; skip_notary=1 ;;
    --skip-notary) skip_notary=1 ;;
    --target) target="$2"; shift ;;
    *) error "Unknown parameter passed: $1" ;;
  esac
  shift
done

case $target in
  linux-aarch64 | \
  linux-x86_64 | \
  windows-x86_64 | \
  windows-i686 | \
  mac-x86_64 | \
  mac-arm64)
      ;;
  *)
    error "Unsupported target: $target"
    ;;
esac

target_os=$(echo $target | cut -f1 -d-)
target_arch=$(echo $target | cut -f2 -d-)

node_arch=$target_arch
deb_arch=$target_arch
if [ $target == "linux-aarch64" ]; then
  node_arch="arm64"
  deb_arch="arm64"
fi
if [ $target == "linux-x86_64" ]; then
  deb_arch="amd64"
fi

target_dist_dir_rel=$dist_dir_name/$target_os/$target_arch
target_dist_dir=$PWD/$target_dist_dir_rel
dist_dir=$PWD/$dist_dir_name

log "Building for $target on $host"
log "Skipping bundling: $skip_bundling"
log "Skipping packaging: $skip_packaging"
log "Skipping signing: $skip_signing"
log "Skipping notary: $skip_notary"
log "Installation destination: $target_dist_dir_rel"

if [ $target_os == "windows" ];
then
  exe_extension=".exe"
else
  exe_extension=""
fi

rm -rf $target_dist_dir
mkdir -p $target_dist_dir

# The json file is a copy of the toml + target information.
# Used for .ejs files and in JS code (importing config.json).
log "Creating config.json"
yq . -o yaml ./config.toml | \
  yq e ".target.os = \"$target_os\"" |\
  yq e ".target.arch = \"$target_arch\"" -o json \
  > $target_dist_dir/config.json

# Extract all toml data into shell variables.
eval $(yq ./config.toml -o shell)

out_deb_file="$package_binary_name-$meta_version-$target.deb"
out_bz2_file="$package_binary_name-$meta_version-$target.tar.bz2"
out_pkg_file="$package_binary_name-$meta_version-$target-installer.pkg"
out_dmg_file="$package_binary_name-$meta_version-$target.dmg"
out_win_file="$package_binary_name-$meta_version-$target-installer.exe"

if [ $build_all == 1 ]; then
  if [ $host != "mac-arm64" ]; then
    error "Can only build all targets on Apple Silicon"
  fi

  # Ensuring Rosetta is installed
  softwareupdate --install-rosetta --agree-to-license

  log "Building for Mac Intel"
  arch -x86_64 ./build.sh

  log "Building for Mac arm64"
  ./build.sh --target mac-arm64

  log "Building for Linux x86_64"
  ./build.sh --target linux-x86_64

  log "Building for Linux aarch64"
  ./build.sh --target linux-aarch64

  log "Building for Windows x86_64"
  ./build.sh --target windows-x86_64

  exit 0
fi

if [ ! $skip_bundling == 1 ]; then
  # This could be done by pkg directly, but esbuild is more tweakable.
  # - hardcoding import.meta.url because the `open` module requires it.
  # - faking an electron module because `got` requires on (but it's never used)
  log "Bundling JS code into single file"
  NODE_PATH=app/src:$target_dist_dir esbuild ./app/src/main.js \
    --format=cjs \
    --banner:js="const _importMetaUrl=require('url').pathToFileURL(__filename)" \
    --define:import.meta.url='_importMetaUrl' \
    --bundle --platform=node \
    --tree-shaking=true \
    --alias:electron=electron2 \
    --outfile=$dist_dir/bundled.js

  log "Bundling Node binary with code"
  pkg $dist_dir/bundled.js \
    --target node18-$target_os-$node_arch \
    --output $target_dist_dir/$package_binary_name$exe_extension
else
  log "Skipping bundling"
fi

if [ ! -d "$dist_dir/ffmpeg-$target" ]; then
  log "Retrieving ffmpeg"
  ffmpeg_url_base="https://github.com/aclap-dev/ffmpeg-static-builder/releases/download/"
  ffmpeg_url=$ffmpeg_url_base/ffmpeg-$package_ffmpeg_build_id/ffmpeg-$target.tar.bz2
  ffmpeg_tarball=$dist_dir/ffmpeg.tar.bz2
  wget --show-progress -c -O $ffmpeg_tarball $ffmpeg_url
  (cd $dist_dir && tar -xf $ffmpeg_tarball)
  rm $ffmpeg_tarball
else
  log "ffmpeg already downloaded"
fi

cp $dist_dir/ffmpeg-$target/ffmpeg$exe_extension \
  $dist_dir/ffmpeg-$target/ffprobe$exe_extension \
  $target_dist_dir/

if [ ! $skip_packaging == 1 ]; then

  log "Packaging v$meta_version for $target"

  if [ $target_os == "linux" ]; then
    mkdir -p $target_dist_dir/deb/opt/$package_binary_name
    mkdir -p $target_dist_dir/deb/DEBIAN
    cp LICENSE.txt README.md app/node_modules/open/xdg-open \
      $target_dist_dir/$package_binary_name \
      $target_dist_dir/ffmpeg \
      $target_dist_dir/ffprobe \
      $target_dist_dir/deb/opt/$package_binary_name

    yq ".package.deb" ./config.toml -o yaml | \
      yq e ".package = \"$meta_id\"" |\
      yq e ".description = \"$meta_description\"" |\
      yq e ".architecture = \"$deb_arch\"" |\
      yq e ".version = \"$meta_version\"" -o yaml > $target_dist_dir/deb/DEBIAN/control

    ejs -f $target_dist_dir/config.json ./assets/linux/prerm.ejs \
      > $target_dist_dir/deb/DEBIAN/prerm
    chmod +x $target_dist_dir/deb/DEBIAN/prerm

    ejs -f $target_dist_dir/config.json ./assets/linux/postinst.ejs \
      > $target_dist_dir/deb/DEBIAN/postinst
    chmod +x $target_dist_dir/deb/DEBIAN/postinst

    log "Building .deb file"
    dpkg-deb --build $target_dist_dir/deb $target_dist_dir/$out_deb_file

    rm -rf $target_dist_dir/$package_binary_name-$meta_version
    mkdir $target_dist_dir/$package_binary_name-$meta_version
    cp $target_dist_dir/deb/opt/$package_binary_name/* \
      $target_dist_dir/$package_binary_name-$meta_version
    log "Building .tar.bz2 file"
    tar_extra=""
    if [ $host_os == "mac" ]; then
      tar_extra="--no-xattrs --no-mac-metadata"
    fi
    (cd $target_dist_dir && tar -cvjS $tar_extra -f $out_bz2_file $package_binary_name-$meta_version)

    rm -rf $target_dist_dir/$package_binary_name-$meta_version
    rm -rf $target_dist_dir/deb
  fi

  if [ $target_os == "mac" ]; then
    if ! [ -x "$(command -v create-dmg)" ]; then
      error "create-dmg not installed"
    fi

    dot_app_dir=$target_dist_dir/dotApp/
    app_dir=$dot_app_dir/$meta_id.app
    macos_dir=$app_dir/Contents/MacOS
    res_dir=$app_dir/Contents/Resources
    scripts_dir=$target_dist_dir/scripts

    mkdir -p $macos_dir
    mkdir -p $res_dir
    mkdir -p $scripts_dir

    cp LICENSE.txt README.md assets/mac/icon.icns $res_dir

    cp $target_dist_dir/ffmpeg \
      $target_dist_dir/ffprobe \
      $target_dist_dir/$package_binary_name \
      $macos_dir

    # Note: without the shebang, the app is considered damaged by MacOS.
    echo '#!/bin/bash' > $macos_dir/register.sh
    echo 'cd $(dirname $0)/ && ./vdhcoapp install' >> $macos_dir/register.sh
    chmod +x $macos_dir/register.sh

    echo '#!/bin/bash' > $scripts_dir/postinstall
    echo "su \"\$USER\" -c \$DSTROOT/$meta_id.app/Contents/MacOS/register.sh" >> $scripts_dir/postinstall
    chmod +x $scripts_dir/postinstall

    ejs -f $target_dist_dir/config.json ./assets/mac/pkg-distribution.xml.ejs > $target_dist_dir/pkg-distribution.xml
    ejs -f $target_dist_dir/config.json ./assets/mac/pkg-component.plist.ejs > $target_dist_dir/pkg-component.plist
    ejs -f $target_dist_dir/config.json ./assets/mac/Info.plist.ejs > $app_dir/Contents/Info.plist

    pkgbuild_sign=()
    create_dmg_sign=()
    create_dmg_notarize=()
    if [ ! $skip_signing == 1 ]; then
      log "Signing binaries"
      # IMPORTANT: the entry point CFBundleExecutable must be the last
      # object to be signed! (register.sh here)
      codesign --entitlements \
        ./assets/mac/entitlements.plist \
        --options=runtime --timestamp -v -f \
        -s "$package_mac_signing_app_cert" \
        $macos_dir/ffmpeg \
        $macos_dir/ffprobe \
        $macos_dir/vdhcoapp \
        $macos_dir/register.sh
      pkgbuild_sign=("--sign" "$package_mac_signing_pkg_cert")
      create_dmg_sign=("--codesign" "$package_mac_signing_app_cert")
    else
      log "Skip signing"
    fi

    if [ ! $skip_notary == 1 ]; then
      create_dmg_notarize=("--notarize" "$package_mac_signing_keychain_profile")
    fi

    log "Creating .pkg file"
    pkgbuild \
      --root $dot_app_dir \
      --install-location /Applications \
      --scripts $scripts_dir \
      --identifier $meta_id \
      --component-plist $target_dist_dir/pkg-component.plist \
      --version $meta_version \
      ${pkgbuild_sign[@]+"${pkgbuild_sign[@]}"} \
      $target_dist_dir/$out_pkg_file

    log "Creating .dmg file"
    create-dmg \
      --volname "$meta_long_name" \
      --background ./assets/mac/dmg-background.tiff \
      --window-pos 200 120 --window-size 500 400 --icon-size 70 \
      --hide-extension "$meta_id.app" \
      --icon "$meta_id.app" 100 200 \
      --app-drop-link 350 200 \
      ${create_dmg_sign[@]+"${create_dmg_sign[@]}"} \
      ${create_dmg_notarize[@]+"${create_dmg_notarize[@]}"} \
      $target_dist_dir/$out_dmg_file \
      $dot_app_dir

    rm $target_dist_dir/pkg-distribution.xml
    rm $target_dist_dir/pkg-component.plist
    rm $scripts_dir/postinstall
    rm -rf $scripts_dir

    if [ ! $skip_notary == 1 ] && [ ! $skip_signing == 1 ]; then
      log "Sending .pkg to Apple for signing"
      log "In case of issues, run \"xcrun notarytool log UUID --keychain-profile $package_mac_signing_keychain_profile\""
      xcrun notarytool submit $target_dist_dir/$out_pkg_file --keychain-profile $package_mac_signing_keychain_profile --wait
      xcrun stapler staple $target_dist_dir/$out_pkg_file
    fi
  fi

  if [ $target_os == "windows" ]; then
    install_dir=$target_dist_dir/install_dir
    mkdir -p $install_dir

    IFS=',' read -a stores <<< "$(yq '.store | keys' ./config.toml -o csv)"
    for store in "${stores[@]}"
    do
      yq ".store.$store.manifest" ./config.toml -o yaml | \
        yq e ".name = \"$meta_id\"" |\
        yq e ".description = \"$meta_description\"" |\
        yq e ".path = \"$package_binary_name.exe\"" -o json > $install_dir/$store.json
    done

    cp $target_dist_dir/$package_binary_name.exe \
      $target_dist_dir/ffmpeg.exe \
      $target_dist_dir/ffprobe.exe \
      $install_dir
    cp LICENSE.txt $target_dist_dir
    cp assets/windows/icon.ico $target_dist_dir
    ejs -f $target_dist_dir/config.json ./assets/windows/installer.nsh.ejs > $target_dist_dir/installer.nsh
    log "Building Windows installer"
    (cd $target_dist_dir ; makensis -V4 ./installer.nsh)
    rm -r $install_dir $target_dist_dir/installer.nsh $target_dist_dir/LICENSE.txt $target_dist_dir/icon.ico

    if [ ! $skip_signing == 1 ]; then
      log "Signing Windows installer"
      osslsigncode sign -pkcs12 $package_windows_certificate \
        -in $target_dist_dir/installer.exe \
        -out $target_dist_dir/$out_win_file
      rm $target_dist_dir/installer.exe
    else
      mv $target_dist_dir/installer.exe $target_dist_dir/$out_win_file
    fi
  fi
fi

rm $target_dist_dir/config.json

target_dist_dir=$dist_dir/$target_os/$target_arch

if [ $target_os == "windows" ]; then
  log "Binary available: $target_dist_dir_rel/$package_binary_name.exe"
  log "Binary available: $target_dist_dir_rel/ffmpeg.exe"
  log "Binary available: $target_dist_dir_rel/ffprobe.exe"
  if [ ! $skip_packaging == 1 ]; then
    log "Installer available: $target_dist_dir_rel/$out_win_file"
  fi
fi

if [ $target_os == "linux" ]; then
  log "Binary available: $target_dist_dir_rel/$package_binary_name"
  log "Binary available: $target_dist_dir_rel/ffmpeg"
  log "Binary available: $target_dist_dir_rel/ffprobe"
  if [ ! $skip_packaging == 1 ]; then
    log "Deb file available: $target_dist_dir_rel/$out_deb_file"
    log "Tarball available: $target_dist_dir_rel/$out_bz2_file"
  fi
fi

if [ $target_os == "mac" ]; then
  log "Binary available: $target_dist_dir_rel/$package_binary_name"
  log "Binary available: $target_dist_dir_rel/ffmpeg"
  log "Binary available: $target_dist_dir_rel/ffprobe"
  if [ ! $skip_packaging == 1 ]; then
    log "App available: $target_dist_dir_rel/dotApp/$meta_id.app"
    log "Pkg available: $target_dist_dir_rel/$out_pkg_file"
    log "Dmg available: $target_dist_dir_rel/$out_dmg_file"
  fi
fi
