// Exports the absolute path of the ffmpeg/ffprobe.

const path = require('path');
const exec_dir = path.dirname(process.execPath);

exports.ffmpeg = path.join(exec_dir, "ffmpeg");
exports.ffprobe = path.join(exec_dir, "ffprobe");
