// Exports the absolute path of the ffmpeg/ffprobe.

const path = require('path');
const exec_dir = path.dirname(process.execPath);

let resource_dir;

if (process.platform === "darwin") {
  resource_dir = path.join(exec_dir, "../Resources/");
} else {
  resource_dir = path.join(exec_dir, "./resources/");
}

exports.ffmpeg = path.join(exec_dir, "ffmpeg");
exports.ffprobe = path.join(exec_dir, "ffprobe");
exports.config = path.join(resource_dir, "config.json");
