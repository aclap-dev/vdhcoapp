// Exports the absolute path of the ffmpeg/ffprobe.

const path = require('path');
const dirname = path.dirname(process.execPath);

exports.ffmpeg = path.join(dirname, "ffmpeg");
exports.ffprobe = path.join(dirname, "ffprobe");
