// Exports the absolute path of the ffmpeg/ffprobe.

const path = require('path');
const exec_dir = path.dirname(process.execPath);
const resource_dir = path.join(exec_dir, "../Resources/");

exports.ffmpeg = path.join(exec_dir, "ffmpeg");
exports.ffprobe = path.join(exec_dir, "ffprobe");
exports.config = path.join(resource_dir, "config.json");
