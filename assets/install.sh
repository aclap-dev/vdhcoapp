#!/bin/bash

set -euo pipefail

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

case $host in
  linux-i686 | \
  linux-aarch64 | \
  linux-x86_64)
      ;;
  *)
    echo "E: Unsupported platform: $host"
    exit 1
    ;;
esac

if ! [ -x "$(command -v curl)" ]; then
  echo "E: Curl not installed. Please install: 'sudo apt install curl' on Ubuntu"
  exit 1
fi

if [ -x "$(command -v lsb_release )" ]; then
  if [ $(lsb_release -si) == "Ubuntu" ]; then
    if ! [ -x "$(command -v flatpak)" ]; then
      echo "W: flatpak not installed. It is not necessary to install it, but if you're using Ubuntu (and derivatives), we recommend to install it to solve some CoApp registrations issues."
      read -p "Should I install flatpak for you (y/n)? " answer
      case ${answer:0:1} in
          y|Y )
            echo "We might need your password to run this command: 'sudo apt install flatpak'."
            sudo apt install flatpak
          ;;
          * )
              echo "Skipping flatpak install"
          ;;
      esac
    fi
  fi
fi

url="https://github.com/aclap-dev/vdhcoapp/releases/latest/download/vdhcoapp-$host.tar.bz2"

echo "Downloading: $url"
version=$(curl --silent -qI https://github.com/aclap-dev/vdhcoapp/releases/latest | awk -F '/' '/^location/ {print  substr($NF, 1, length($NF)-1)}')
version="${version:1}"
tmpfile=$(mktemp /tmp/vdhcoapp-XXXXXX)
curl -L $url > $tmpfile

echo "Extracting tarball…"
file $tmpfile
mkdir -p ~/.local/share
tar -xf $tmpfile -C ~/.local/share/
if [ ! -d ~/.local/share/vdhcoapp-$version ]; then
  echo "E: Couldn't find extracted directory"
  exit 1
fi
rm -rf ~/.local/share/vdhcoapp
mv ~/.local/share/vdhcoapp-$version ~/.local/share/vdhcoapp

echo "Registering CoApp"
~/.local/share/vdhcoapp/vdhcoapp install

if [ -x "$(command -v flatpak)" ]; then
  flatpak permission-set webextensions net.downloadhelper.coapp snap.firefox yes
fi

echo "CoApp successfuly installed under '~/.local/share/vdhcoapp'."
echo "To uninstall, run '~/.local/share/vdhcoapp/vdhcoapp uninstall' and remove '~/.local/share/vdhcoapp'."
echo "Re-run that script to update the coapp."
