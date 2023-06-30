// Exports the absolute path of the ffmpeg/ffprobe/ffplay.

const path = require('path');

let arch;
let platform;

if (process.platform == "linux") {
  platform = "linux";
} else if (process.platform == "darwin") {
  platform = "mac";
} else if (/^win/.test(process.platform)) {
  platform = "win";
} else {
  throw new Error("Unsupported platform", process.platform);
}

if (process.arch == "x64") {
  arch = "64";
} else if (process.arch == "ia32") {
  arch = "32";
} else {
  throw new Error("Unsupported architecture", process.arch);
}

const dirname = path.dirname(process.execPath);
const binary_dir = path.join(dirname, "..", "converter", "build", platform, arch);

exports.ffmpeg = path.join(binary_dir, "ffmpeg");
exports.ffprobe = path.join(binary_dir, "ffprobe");
exports.ffplay = path.join(binary_dir, "ffplay");
