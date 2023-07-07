// Exports the absolute path of the ffmpeg/ffprobe/ffplay.

const path = require('path');

const dirname = path.dirname(process.execPath);
const binary_dir = path.join(dirname, "..", "converter");

exports.ffmpeg = path.join(binary_dir, "ffmpeg");
exports.ffprobe = path.join(binary_dir, "ffprobe");
exports.ffplay = path.join(binary_dir, "ffplay");
