// Exports the absolute path of the ffmpeg/ffprobe.

const path = require('path');

const dirname = path.dirname(process.execPath);
const binary_dir = path.join(dirname, "..", "ffmpeg");

exports.ffmpeg = path.join(binary_dir, "ffmpeg");
exports.ffprobe = path.join(binary_dir, "ffprobe");
