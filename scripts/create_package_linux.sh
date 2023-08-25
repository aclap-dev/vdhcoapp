set -euo pipefail

binary_name="net.downloadhelper.coapp"
app_id=$(jq -r '.id' ./config.json)
app_version=$(jq -r '.version' ./package.json)

echo "Extracting ffmpeg"

cd $dist
mkdir bin
mv $dist/app.bin $dist/bin/$binary_name
tar -xf $ffmpeg_tarball
mv ffmpeg-linux-$target_arch/ffmpeg bin
mv ffmpeg-linux-$target_arch/ffprobe bin
mv ffmpeg-linux-$target_arch/presets ffmpeg-presets
rmdir ffmpeg-linux-$target_arch
cd -


jq "{id, name, description, allowed_extensions}" ./config.json > $dist/config.json

cp node_modules/open/xdg-open $dist/bin

cp LICENSE.txt assets/README.txt $dist
