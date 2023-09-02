#!/bin/bash

set -euo pipefail

install_dir=$dist/install_dir

rm -rf $install_dir
mkdir -p $install_dir

certificate=$(toml '.package.windows.certificate')
binary_name=$(toml '.package.binary_name')
manifest_name=$(toml '.meta.id')
manifest_description=$(toml '.meta.description')

IFS=',' read -a stores <<< "$(yq '.store | keys' ./config.toml -o csv)"
for store in "${stores[@]}"
do
  yq ".store.$store.manifest" ./config.toml -o yaml | \
    yq e ".name = \"$manifest_name\"" |\
    yq e ".description = \"$manifest_description\"" |\
    yq e ".path = \"$binary_name.exe\"" -o json > $install_dir/$store.json
done

cp $dist/$app_binary_name $install_dir/$binary_name.exe
cp $dist/ffmpeg.exe $install_dir
cp $dist/ffprobe.exe $install_dir
cp -r $dist/ffmpeg-presets $install_dir
cp LICENSE.txt $dist
cp assets/windows/icon.ico $dist
ejs -f $dist/config.json ./assets/windows/installer.nsh.ejs > $dist/installer.nsh
cd $dist
makensis -V4 ./installer.nsh
cd -

osslsigncode sign -pkcs12 $certificate \
  -in $dist/$binary_name-installer-unsigned.exe \
  -out $dist/$binary_name-installer.exe
