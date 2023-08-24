set -euo pipefail

sign_pkg_id="Developer ID Installer: ACLAP (4YP9AW3WW3)"
sign_app_id="Developer ID Application: ACLAP (4YP9AW3WW3)"
binary_name="net.downloadhelper.coapp"
app_id=$(jq -r '.id' ./config.json)
app_version=$(jq -r '.version' ./package.json)
pkg_filename="vdh-coapp-$app_version"
pkg_version=`date +%s`

echo "Creating dotApp"

dot_app_path=$dist/dotApp/
app_path=$dot_app_path/$app_id.app
macos_dir=$app_path/Contents/MacOS
res_dir=$app_path/Contents/Resources

mkdir -p $macos_dir
mkdir -p $res_dir

scripts_dir=$dist/scripts
mkdir -p $scripts_dir

echo "Extracting ffmpeg"

cd $res_dir
tar -xf $ffmpeg_tarball
mv ffmpeg-mac-$target_arch/ffmpeg $macos_dir
mv ffmpeg-mac-$target_arch/ffprobe $macos_dir
mv ffmpeg-mac-$target_arch/presets ffmpeg-presets
rmdir ffmpeg-mac-$target_arch
cd -

cp $dist/app.bin $macos_dir/$binary_name

cp node_modules/open/xdg-open $res_dir

echo "Creating pkg config files"

cp LICENSE.txt assets/README.txt assets/mac/icon.icns $res_dir

tmpfile=$(mktemp /tmp/coapp-build.tmp)
jq -n --argfile config config.json \
  --argfile package package.json \
  "{config:\$config, manifest:\$package, version:$pkg_version, binaryName:\"$binary_name\"}" \
  > $tmpfile
ejs -f $tmpfile ./assets/mac/pkg-distribution.xml.ejs \
  > $dist/pkg-distribution.xml
ejs -f $tmpfile ./assets/mac/pkg-component.plist.ejs \
  > $dist/pkg-component.plist
ejs -f $tmpfile ./assets/mac/Info.plist.ejs \
  > $app_path/Contents/Info.plist
ejs -f $tmpfile ./assets/mac/postinstall.ejs \
  > $scripts_dir/postinstall
rm $tmpfile

chmod +x $scripts_dir/postinstall

jq "{id, name, description, allowed_extensions}" ./config.json \
  > $res_dir/config.json

echo "Signing binaries"

# FIXME: is that first line necessary?
# codesign --options=runtime --timestamp -v -f -s "$sign_app_id" $app_path
codesign --options=runtime --timestamp -v -f -s "$sign_app_id" $macos_dir/*

echo "Building $pkg_filename.pkg"

pkgbuild \
  --root $dot_app_path \
  --install-location /Applications \
  --scripts $scripts_dir \
  --identifier $app_id \
  --component-plist $dist/pkg-component.plist \
  --version $pkg_version \
  --sign "$sign_pkg_id" \
  $dist/$pkg_filename.pkg

echo "Building DMG file"

# FIXME: test it exist, and doc
create-dmg --volname "DownloadHelper Co-app" \
  --background ./assets/mac/dmg-background.tiff \
  --window-pos 200 120 --window-size 500 400 --icon-size 70 \
  --icon "net.downloadhelper.coapp.app" 100 200 \
  --app-drop-link 350 200 \
  --codesign "ACLAP" \
  $dist/$pkg_filename.dmg \
  $dot_app_path
