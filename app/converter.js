const path = require('path');
const { spawn } = require('child_process');
const { open } = require('open');
const { ffmpeg, ffprobe } = require('./binaries');

const logger = require('./logger');
const rpc = require('./weh-rpc');

logger.info("process.cwd", process.cwd);
logger.info("__dirname", __dirname);
logger.info("__filename", __filename);
logger.info("path.resolve('.')", path.resolve('.'));
logger.info("process.execPath", process.execPath);

function ExecConverter(args) {
  return new Promise((resolve, reject) => {
    let convProcess = spawn(ffmpeg, args);
    let stdout = "";
    convProcess.stdout.on("data", (data) => stdout += data);
    convProcess.stderr.on("data", (_data) => {
      // need to consume data or process stalls
    });
    convProcess.on("exit", (exitCode) => {
      if (exitCode !== 0) {
        return reject(new Error("Converter returned exit code " + exitCode));
      }
      resolve(stdout);
    });
  });
}

rpc.listen({

  // FIXME: test
  "convert": (args = ["-h"], options = {}) => new Promise((resolve, _reject) => {

    // `-progress pipe:1` send program-friendly progress information to stdin every 500ms.
    // `-hide_banner -loglevel error`: make the output less noisy.
    const ffmpeg_base_args = "-progress pipe:1 -hide_banner -loglevel error";
    args = [...ffmpeg_base_args.split(" "), ...args];

    const child = spawn(ffmpeg, args);

    let stderr = "";

    child.on("exit", (code) => resolve({exitCode: code, stderr}));
    child.stderr.on("data", (data) => stderr += data);

    const on_line = async (line) => {
      if (line.startsWith("out_time_ms=")) {
        // out_time_ms is in ns, not ms.
        const seconds = parseInt(line.split("=")[1]) / 1_000_000;
        try {
          await rpc.call("convertOutput", options.progressTime, seconds);
        } catch (_) {
          // Extension stopped caring
          child.kill();
        }
      }
    };

    if (options.progressTime) {
      child.stdout.on("data", (lines) => {
        lines.toString("utf-8").split("\n").forEach(on_line);
      });
    }

  }),
  // FIXME: test
  "probe": (input, json = false) => {
    return new Promise((resolve, reject) => {
      let args = [];
      if (json) {
        args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams"];
      }
      args.push(input);
      let probeProcess = spawn(ffprobe, args);
      let stdout = "";
      let stderr = "";
      probeProcess.stdout.on("data", (data) => stdout += data);
      probeProcess.stderr.on("data", (data) => stderr += data);
      probeProcess.on("exit", (exitCode) => {
        if (exitCode !== 0) {
          return reject(new Error("Exit code: " + exitCode + "\n" + stderr));
        }
        if (json) {
          // FIXME: not parsed?
          resolve(stdout);
        } else {
          let info = {};
          let m = /([0-9]{2,})x([0-9]{2,})/g.exec(stderr);
          if (m) {
            info.width = parseInt(m[1]);
            info.height = parseInt(m[2]);
          }
          m = /Duration: ([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]{2})/g.exec(stderr);
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
  // FIXME: test
  "play": (filePath) => {
    return new Promise((resolve, _reject) => {
      // FIXME: use https://github.com/sindresorhus/open
      open(filePath);
      resolve();
    });
  },
  // FIXME: test
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
  // FIXME: test
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
  // FIXME: test
  "open": (filePath) => {
    open(filePath);
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
