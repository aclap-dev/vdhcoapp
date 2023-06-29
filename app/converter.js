const path = require('path');
const { spawn } = require('child_process');
const opn = require('opn');
const { ffmpeg, ffprobe, ffplay } = require('./binaries');

const logger = require('./logger');
const rpc = require('./weh-rpc');

logger.info("process.cwd", process.cwd);
logger.info("__dirname", __dirname);
logger.info("__filename", __filename);
logger.info("path.resolve('.')", path.resolve('.'));
logger.info("process.execPath", process.execPath);

function ExecConverter(args) {
  let outBuffers = [];
  return new Promise((resolve, reject) => {
    let convProcess = spawn(ffmpeg, args);
    convProcess.stdout.on("data", (data) => {
      outBuffers.push(data);
    });
    convProcess.stderr.on("data", (_data) => {
      // need to consume data or process stalls
    });
    convProcess.on("exit", (exitCode) => {
      if (exitCode !== 0) {
        return reject(new Error("Converter returned exit code " + exitCode));
      }
      let out = Buffer.concat(outBuffers).toString("utf8");
      resolve(out);
    });
  });
}

const PARSETIME_RE = new RegExp("time=([0-9]+):([0-9]+):([0-9]+)");

rpc.listen({
  "convert": (args = ["-h"], options = {}) => {
    return new Promise((resolve, _reject) => {
      let convProcess = spawn(ffmpeg, args);
      let stdErrParts = [];
      let stdErrSize = 0;

      convProcess.stderr.on("data", (_data) => {
        // just consume data
      });

      convProcess.stderr.on("data", (data) => {
        let str = data.toString("utf8");
        let m = PARSETIME_RE.exec(str);
        if (m) {
          if (options.progressTime) {
            let frameTime = parseFloat(m[1]) * 3600 + parseFloat(m[2]) * 60 + parseFloat(m[3]);
            rpc.call("convertOutput", options.progressTime, frameTime)
              .catch((_err) => {
                convProcess.kill();
              });
          }
        } else {
          const maxSize = 20000;
          if (stdErrSize + str.length >= maxSize) {
            str = str.substr(0, maxSize - stdErrSize);
          }
          if (str.length > 0) {
            stdErrParts.push(str);
            stdErrSize += str.length;
          }
        }
      });

      convProcess.on("exit", (exitCode) => {
        resolve({exitCode, stderr: stdErrParts.join("")});
      });
    });
  },
  "probe": (filePath, json = false) => {
    return new Promise((resolve, reject) => {
      let args = [];
      if (json) {
        args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams"];
      }
      args.push(filePath);
      let probeProcess = spawn(ffprobe, args);
      let streams = {
        stdout: "",
        stderr: ""
      };
      Object.keys(streams).forEach((stream) => {
        probeProcess[stream].on("data", (data) => {
          streams[stream] += data.toString("utf8");
        });
      });
      probeProcess.on("exit", (exitCode) => {
        if (exitCode !== 0) {
          return reject(new Error("Exit code: " + exitCode + "\n" + streams.stderr));
        }
        if (json) {
          try {
            resolve(streams.stdout);
          } catch (e) {
            reject(new Error("Invalid format: " + e.message));
          }
        } else {
          let info = {};
          let m = /([0-9]{2,})x([0-9]{2,})/g.exec(streams.stderr);
          if (m) {
            info.width = parseInt(m[1]);
            info.height = parseInt(m[2]);
          }
          m = /Duration: ([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{2})/g.exec(streams.stderr);
          if (m) {
            info.duration = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
          }
          m = /Video:\s+([^\s\(,]+)/g.exec(stderr);
          if (m) {
            info.videoCodec = m[1];
          }
          m = /Audio:\s+([^\s\(,]+)/g.exec(stderr);
          if (m) {
            info.audioCodec = m[1];
          }
          m = /([0-9]+(?:\.[0-9]+)?)\s+fps\b/g.exec(stderr);
          if (m) {
            info.fps = parseFloat(m[1]);
          }
          resolve(info);
        }
      });
    });
  },
  "play": (filePath) => {
    return new Promise((resolve, reject) => {
      let playProcess = spawn(ffplay, [filePath]);
      let stderr = [];
      playProcess.stderr.on("data", (data) => {
        stderr.push(data.toString("utf8"));
      });
      playProcess.on("exit", (exitCode) => {
        if (exitCode !== 0) {
          reject(new Error(stderr.slice(1).join("")));
        } else {
          resolve();
        }
      });
    });
  },
  "codecs": () => {
    return ExecConverter(["-codecs"])
      .then((out) => {
        let lines = out.split("\n");
        let result = {};
        lines.forEach((line) => {
          let m = /^\s*(\.|D)(\.|E)(\.|V|A|S)(\.|I)(\.|L)(\.|S)\s+([^\s]+)\s+(.*?)\s*$/.exec(line);
          if (!m || m[7] === '=') {
            return;
          }
          result[m[7]] = {
            d: m[1] != ".",
            e: m[2] != ".",
            t: m[3] == "." && null || m[3],
            i: m[4] != ".",
            l: m[5] != ".",
            s: m[6] != ".",
            _: m[8]
          };
        });
        return result;
      });
  },
  "formats": () => {
    return ExecConverter(["-formats"])
      .then((out) => {
        let lines = out.split("\n");
        let result = {};
        lines.forEach((line) => {
          let m = /^\s*(\.| |D)(\.| |E)\s+([^\s]+)\s+(.*?)\s*$/.exec(line);
          if (!m || m[3] === '=') {
            return;
          }
          result[m[3]] = {
            d: m[1] == "D",
            e: m[2] == "E",
            _: m[4]
          };
        });
        return result;
      });
  },
  "open": (filePath) => {
    opn(filePath);
  },

});

exports.info = () => {
  return new Promise((resolve, reject) => {
    let convProcess = spawn(ffmpeg, ["-h"]);
    let done = false;

    function Parse(data) {
      if (done) {
        return;
      }
      let str = data.toString("utf8");
      logger.info("stdout:", str);
      let m = /^(\S+).*?v.*?((?:\d+\.)+\d+)/.exec(str);
      if (m) {
        done = true;
        resolve({
          program: m[1],
          version: m[2],
          converterBinary: ffmpeg,
        });
      }
    }

    convProcess.stdout.on("data", Parse);
    convProcess.stderr.on("data", Parse);
    convProcess.on("exit", (_code) => {
      if (!done) {
        reject(new Error("Exit without answer"));
      }
    });
  });
};
