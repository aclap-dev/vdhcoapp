set -euo pipefail

binary_name="net.downloadhelper.coapp"
app_id=$(jq -r '.id' ./config.json)
app_version=$(jq -r '.version' ./package.json)

echo "Extracting ffmpeg"

cd $dist
tar -xf $ffmpeg_tarball
mv ffmpeg-linux-$target_arch/ffmpeg .
mv ffmpeg-linux-$target_arch/ffprobe .
mv ffmpeg-linux-$target_arch/presets ffmpeg-presets
rmdir ffmpeg-linux-$target_arch
cd -

mv $dist/app.bin $dist/$binary_name

cp node_modules/open/xdg-open $dist

cp LICENSE.txt assets/README.txt $dist
